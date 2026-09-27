import { access, readdir, readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { MCP_URL } from './core/agent/clients';

const root = new URL('../../../', import.meta.url);
async function json(file: string) {
  return JSON.parse(await readFile(new URL(file, root), 'utf8'));
}

describe('repository plugin', () => {
  it('keeps identity and release metadata aligned across client manifests', async () => {
    const { $schema, ...identity } = await json('plugin.json');
    expect($schema).toBe(
      'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
    );
    expect(identity.name).toBe('edgestore');
    expect(identity.version).toMatch(/^\d+\.\d+\.\d+$/);
    for (const file of [
      '.codex-plugin/plugin.json',
      '.claude-plugin/plugin.json',
    ]) {
      const {
        skills,
        mcpServers,
        interface: ui,
        ...metadata
      } = await json(file);
      expect(metadata).toEqual(identity);
      expect(skills).toBe('./skills/');
      expect(mcpServers).toEqual({
        edgestore: { type: 'http', url: MCP_URL },
      });
      if (ui) expect(ui.capabilities).toEqual(['Read', 'Write']);
      await access(new URL(`${skills}edgestore-setup/SKILL.md`, root));
    }
  });

  it('bundles only the hosted MCP endpoint without credentials or local commands', async () => {
    expect(await json('mcp.json')).toEqual({
      $schema: 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json',
      mcpServers: {
        edgestore: { type: 'streamable-http', url: MCP_URL },
      },
    });
    // A project-level .mcp.json would connect contributors merely opening this repo.
    await expect(access(new URL('.mcp.json', root))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('shares the canonical skill directory without client-specific copies', async () => {
    expect(await readdir(new URL('skills/', root))).toEqual([
      'edgestore-setup',
    ]);
    for (const client of ['.codex-plugin', '.claude-plugin']) {
      expect(await readdir(new URL(`${client}/`, root))).toEqual([
        'plugin.json',
      ]);
    }
  });
});
