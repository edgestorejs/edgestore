import path from 'node:path';
import {
  applyEdits,
  findNodeAtLocation,
  modify,
  parseTree,
  type Node,
  type ParseError,
} from 'jsonc-parser';
import { parse as parseToml } from 'smol-toml';
import { usageError } from '../errors';

export const MCP_URL = 'https://api.edgestore.dev/mcp';
export const CLIENTS = ['codex', 'claude', 'cursor'] as const;
export type AgentClient = (typeof CLIENTS)[number];
export type ConfigFile = { file: string; root: string };

export function clientConfig(
  client: AgentClient,
  root: string,
  { global, codexHome }: { global: boolean; codexHome?: string },
): ConfigFile {
  if (client === 'codex') {
    const directory =
      global && codexHome ? path.resolve(codexHome) : path.join(root, '.codex');
    return {
      file: path.join(directory, 'config.toml'),
      root: global && codexHome ? directory : root,
    };
  }
  return {
    root,
    file: path.join(
      root,
      client === 'claude'
        ? global
          ? '.claude.json'
          : '.mcp.json'
        : '.cursor/mcp.json',
    ),
  };
}

export function expectedEntry(client: AgentClient): Record<string, string> {
  return client === 'claude'
    ? { type: 'http', url: MCP_URL }
    : { url: MCP_URL };
}

export function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function parseConfig(
  client: AgentClient,
  source: string | undefined,
): Record<string, unknown> {
  if (source === undefined) return {};
  try {
    if (client === 'codex') return parseToml(source);
    const errors: ParseError[] = [];
    const tree = parseTree(source, errors, { allowTrailingComma: true });
    if (errors.length || tree?.type !== 'object') throw new Error();
    return readTree(tree) as Record<string, unknown>;
  } catch {
    throw usageError(
      'invalid_agent_config',
      'Agent configuration is malformed or contains duplicate keys. Repair it before continuing.',
    );
  }
}

function readTree(node: Node): unknown {
  if (node.type === 'object') {
    const result: Record<string, unknown> = Object.create(null);
    for (const property of node.children ?? []) {
      const key = property.children![0]!.value as string;
      if (Object.hasOwn(result, key)) throw new Error();
      result[key] = readTree(property.children![1]!);
    }
    return result;
  }
  if (node.type === 'array') return node.children?.map(readTree);
  return node.value;
}

export function serverEntries(
  client: AgentClient,
  config: Record<string, unknown>,
): Record<string, unknown> {
  const servers = config[client === 'codex' ? 'mcp_servers' : 'mcpServers'];
  if (servers === undefined) return {};
  if (!object(servers))
    throw usageError(
      'invalid_agent_config',
      'The MCP server configuration must be an object/table.',
    );
  return servers;
}

export const CODEX_BLOCK = `# BEGIN EDGESTORE MCP\n[mcp_servers.edgestore]\nurl = "${MCP_URL}"\n# END EDGESTORE MCP\n`;

export function entrySource(
  client: AgentClient,
  source: string | undefined,
): string {
  if (source === undefined) return '';
  if (client === 'codex') {
    const entry = serverEntries(client, parseConfig(client, source)).edgestore;
    return JSON.stringify({
      entry,
      managedBlock: source.includes(CODEX_BLOCK),
    });
  }
  const node = findNodeAtLocation(parseTree(source)!, [
    'mcpServers',
    'edgestore',
  ]);
  return node ? source.slice(node.offset, node.offset + node.length) : '';
}

export function editConnection(
  client: AgentClient,
  source: string | undefined,
  remove: boolean,
): string {
  let result: string;
  if (client === 'codex') {
    if (remove) {
      if (
        !source?.includes(CODEX_BLOCK) ||
        source.indexOf(CODEX_BLOCK) !== source.lastIndexOf(CODEX_BLOCK)
      ) {
        throw usageError(
          'modified_agent_config',
          'The managed Codex block was edited; remove it manually.',
        );
      }
      result = source.replace(CODEX_BLOCK, '');
    } else {
      result = `${source ?? ''}${source && !source.endsWith('\n') ? '\n' : ''}\n${CODEX_BLOCK}`;
    }
  } else {
    const text = source ?? '{}\n';
    result = applyEdits(
      text,
      modify(
        text,
        ['mcpServers', 'edgestore'],
        remove ? undefined : expectedEntry(client),
        { formattingOptions: { insertSpaces: true, tabSize: 2 } },
      ),
    );
  }
  const parsed = parseConfig(client, result);
  const entry = serverEntries(client, parsed).edgestore;
  if (remove ? entry !== undefined : !object(entry) || entry.url !== MCP_URL) {
    throw usageError(
      'agent_config_conflict',
      'The existing config layout cannot safely accept this MCP entry. Configure it manually.',
    );
  }
  return result;
}

export function hasPlugin(config: Record<string, unknown>): boolean {
  return (
    object(config.plugins) &&
    Object.entries(config.plugins).some(
      ([name, entry]) =>
        name.split('@')[0] === 'edgestore' &&
        object(entry) &&
        entry.enabled === true,
    )
  );
}
