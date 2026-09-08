import path from 'node:path';
import { z } from 'zod';
import { usageError } from '../errors';
import {
  clientConfig,
  editConnection,
  entrySource,
  hasPlugin,
  MCP_URL,
  object,
  parseConfig,
  serverEntries,
  type AgentClient,
} from './clients';
import { digest, readOptional, type FileChange } from './files';

const stateSchema = z
  .object({
    schemaVersion: z.literal(1),
    mcp: z
      .record(z.string(), z.object({ location: z.string(), hash: z.string() }))
      .default({}),
  })
  .passthrough();

export type McpOptions = {
  client: AgentClient;
  project: string;
  home: string;
  stateRoot: string;
  global?: boolean;
  codexHome?: string;
};

export type McpAction = 'setup' | 'status' | 'remove';

export async function planMcp(options: McpOptions, action: McpAction) {
  const { client, project, home, global = false } = options;
  const target = clientConfig(client, global ? home : project, {
    global,
    codexHome: options.codexHome,
  });
  const before = await readOptional(target.file, target.root);
  const config = parseConfig(client, before);
  const servers = serverEntries(client, config);
  const entry = servers.edgestore;
  const stateRoot = global ? options.stateRoot : project;
  const stateFile = path.join(
    stateRoot,
    global ? 'agent-assets.json' : '.edgestore/agent-assets.json',
  );
  const stateBefore = await readOptional(stateFile, stateRoot);
  let state: z.infer<typeof stateSchema>;
  try {
    state = stateSchema.parse(
      stateBefore === undefined
        ? { schemaVersion: 1 }
        : JSON.parse(stateBefore),
    );
  } catch {
    throw usageError(
      'invalid_agent_state',
      'Agent installation metadata is malformed; preserve it and inspect before continuing.',
    );
  }
  const location = global ? target.file : path.relative(project, target.file);
  const owned = state.mcp[client];
  const matches =
    owned?.location === location &&
    owned.hash === digest(entrySource(client, before));
  const duplicate = Object.entries(servers).some(
    ([name, value]) => name !== 'edgestore' && isEdgeStore(value),
  );
  const inherited = global ? undefined : await inheritedConnection(options);
  const plugin = client === 'codex' && hasPlugin(config);
  let status = owned ? 'missing' : 'not-configured';
  if (inherited) status = inherited;
  if (duplicate) status = 'configured-under-other-name';
  if (plugin) status = 'plugin-configured';
  if (entry !== undefined) {
    status = isEdgeStore(entry) ? 'unmanaged' : 'conflict';
    if (owned) status = 'modified';
    if (matches) status = 'configured';
  }
  // Claude's private local scope overrides project config. Be conservative on conflicts.
  if (inherited === 'conflict') status = 'conflict';
  const changes: FileChange[] = [];
  if (action !== 'status') {
    if (status === 'modified' || status === 'conflict') {
      throw usageError(
        'agent_config_conflict',
        'The EdgeStore entry is user-owned or modified. It was preserved; inspect it before continuing.',
      );
    }
    if (
      action === 'setup' &&
      (status === 'not-configured' || status === 'missing')
    ) {
      const after = editConnection(client, before, false);
      changes.push({ ...target, before, after });
      state.mcp[client] = {
        location,
        hash: digest(entrySource(client, after)),
      };
    }
    if (
      action === 'remove' &&
      owned?.location === location &&
      (matches || entry === undefined)
    ) {
      if (matches)
        changes.push({
          ...target,
          before,
          after: editConnection(client, before, true),
        });
      delete state.mcp[client];
    }
    if (
      changes.length ||
      (action === 'remove' && owned && !state.mcp[client])
    ) {
      changes.push({
        file: stateFile,
        root: stateRoot,
        before: stateBefore,
        after: `${JSON.stringify(state, null, 2)}\n`,
      });
    }
  }
  return {
    // Never expose config contents: other servers may contain credentials.
    result: {
      schemaVersion: 1,
      client,
      scope: global ? 'global' : 'project',
      configPath: target.file,
      status,
      endpoint: MCP_URL,
      authentication: 'not-checked',
      pluginDiscovery: 'visible-config-only',
      plannedFiles: changes.map(({ file }) => file),
    },
    changes,
  };
}

function isEdgeStore(entry: unknown): boolean {
  return object(entry) && entry.url === MCP_URL;
}

async function inheritedConnection(
  options: McpOptions,
): Promise<'inherited' | 'conflict' | undefined> {
  const target = clientConfig(options.client, options.home, {
    global: true,
    codexHome: options.codexHome,
  });
  const config = parseConfig(
    options.client,
    await readOptional(target.file, target.root),
  );
  // A named global entry with another endpoint is ambiguous, not a connection to adopt.
  const servers = serverEntries(options.client, config);
  if (servers.edgestore !== undefined && !isEdgeStore(servers.edgestore)) {
    return 'conflict';
  }
  if (options.client === 'claude' && object(config.projects)) {
    const project = config.projects[options.project];
    if (object(project) && object(project.mcpServers)) {
      if (
        project.mcpServers.edgestore !== undefined &&
        !isEdgeStore(project.mcpServers.edgestore)
      ) {
        return 'conflict';
      }
      if (Object.values(project.mcpServers).some(isEdgeStore))
        return 'inherited';
    }
  }
  return Object.values(servers).some(isEdgeStore) ||
    (options.client === 'codex' && hasPlugin(config))
    ? 'inherited'
    : undefined;
}
