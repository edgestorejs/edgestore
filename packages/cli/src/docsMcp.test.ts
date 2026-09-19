import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import {
  expectedEntry,
  parseConfig,
  serverEntries,
} from './core/agent/clients';

it.each([
  { client: 'codex', title: '.codex/config.toml' },
  { client: 'claude', title: '.mcp.json' },
  { client: 'cursor', title: '.cursor/mcp.json' },
] as const)(
  'manual $client docs match the CLI connection',
  async ({ client, title }) => {
    const content = await readFile(
      new URL(
        '../../../docs/content/docs/(getting-started)/agents.mdx',
        import.meta.url,
      ),
      'utf8',
    );
    const blocks = [
      ...content.matchAll(
        /```(?:json|toml) tab="[^"]+" title="([^"]+)"\n([\s\S]*?)\n```/g,
      ),
    ];
    const example = blocks.find((block) => block[1] === title);
    expect(example, title).toBeDefined();
    const servers = serverEntries(client, parseConfig(client, example![2]));
    expect(servers).toEqual({ edgestore: expectedEntry(client) });
  },
);
