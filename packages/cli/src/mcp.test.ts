import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runCli } from './cli';
import {
  clientConfig,
  CLIENTS,
  CODEX_BLOCK,
  expectedEntry,
  MCP_URL,
  parseConfig,
  serverEntries,
  type AgentClient,
} from './core/agent/clients';
import { applyChanges } from './core/agent/files';
import { planMcp, type McpOptions } from './core/agent/mcp';
import { createFixture } from './testFixture';

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

async function fixture(client: AgentClient) {
  const root = await realpath(
    await mkdtemp(path.join(os.tmpdir(), 'edgestore-mcp-')),
  );
  directories.push(root);
  const options: McpOptions = {
    client,
    project: path.join(root, 'app'),
    home: path.join(root, 'home'),
    stateRoot: path.join(root, 'state'),
  };
  await Promise.all(
    [options.project, options.home, options.stateRoot].map((dir) => mkdir(dir)),
  );
  await mkdir(path.join(options.project, '.git'));
  await writeFile(path.join(options.project, 'package.json'), '{}');
  const target = clientConfig(client, options.project, { global: false });
  const cli = createFixture();
  cli.runtime.setCwd(options.project);
  cli.runtime.env.HOME = options.home;
  cli.runtime.globalConfig.path = path.join(options.stateRoot, 'config.json');
  const writeConfig = async (text: string, file = target.file) => {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, text);
  };
  return { root, options, target, cli, writeConfig };
}

describe.each(CLIENTS)('%s direct MCP', (client) => {
  it('configures, repeats without writes, and removes only the owned entry', async () => {
    const { options, target, writeConfig } = await fixture(client);
    const original =
      client === 'codex'
        ? '# keep me\n[features]\nweb_search = true\n'
        : '{\n // keep me\n "mcpServers": { "other": { "url": "https://other.example", "token": "secret-sentinel" }, },\n "theme": "dark",\n}\n';
    await writeConfig(original);
    const plan = await planMcp(options, 'setup');
    expect(JSON.stringify(plan.result)).not.toContain('secret-sentinel');
    await applyChanges(plan.changes);
    const installed = await readFile(target.file, 'utf8');
    expect(installed).toContain('keep me');
    expect(
      serverEntries(client, parseConfig(client, installed)).edgestore,
    ).toEqual(expectedEntry(client));
    expect((await stat(target.file)).mode & 0o777).toBe(0o600);
    expect((await planMcp(options, 'setup')).changes).toEqual([]);
    expect((await planMcp(options, 'status')).result.status).toBe('configured');
    await applyChanges((await planMcp(options, 'remove')).changes);
    const removed = await readFile(target.file, 'utf8');
    expect(removed).toContain('keep me');
    expect(
      serverEntries(client, parseConfig(client, removed)).edgestore,
    ).toBeUndefined();
    if (client !== 'codex') expect(removed).toContain('secret-sentinel');
    expect((await planMcp(options, 'remove')).changes).toEqual([]);
  });

  it('makes dry-run zero-write and never authenticates', async () => {
    const { cli, options } = await fixture(client);
    expect(
      await runCli(
        ['mcp', 'setup', '--client', client, '--dry-run', '--json'],
        cli.runtime,
        '1.0.0',
      ),
    ).toBe(0);
    expect(await readdir(options.project)).toEqual(['.git', 'package.json']);
    expect(await readdir(options.home)).toEqual([]);
    expect(cli.stdout()).toContain('not-checked');
    expect(cli.runtime.sdkFactory).not.toHaveBeenCalled();
    expect(cli.oauthLogin).not.toHaveBeenCalled();
  });

  it('requires yes noninteractively and reports post-apply status', async () => {
    const { cli } = await fixture(client);
    expect(
      await runCli(
        ['mcp', 'setup', '--client', client, '--json'],
        cli.runtime,
        '1',
      ),
    ).toBe(2);
    expect(
      await runCli(
        ['mcp', 'setup', '--client', client, '--yes', '--json'],
        cli.runtime,
        '1',
      ),
    ).toBe(0);
    expect(cli.stdout()).toContain('"status": "configured"');
  });

  it('preserves user-owned matching entries and refuses collisions', async () => {
    const { options, writeConfig } = await fixture(client);
    const matching =
      client === 'codex'
        ? `[mcp_servers.edgestore]\nurl = "${MCP_URL}"\n`
        : JSON.stringify({ mcpServers: { edgestore: expectedEntry(client) } });
    await writeConfig(matching);
    expect((await planMcp(options, 'setup')).result.status).toBe('unmanaged');
    expect((await planMcp(options, 'remove')).changes).toEqual([]);
    await writeConfig(matching.replace(MCP_URL, 'https://different.example'));
    await expect(planMcp(options, 'setup')).rejects.toMatchObject({
      code: 'agent_config_conflict',
    });
  });

  it('refuses removal after user edits, including comments in the owned entry', async () => {
    const { options, target, writeConfig } = await fixture(client);
    await applyChanges((await planMcp(options, 'setup')).changes);
    const source = await readFile(target.file, 'utf8');
    await writeConfig(
      client === 'codex'
        ? source.replace(
            '[mcp_servers.edgestore]',
            '[mcp_servers.edgestore]\n# my comment',
          )
        : source.replace('"url":', '// my comment\n"url":'),
    );
    expect((await planMcp(options, 'status')).result.status).toBe('modified');
    await expect(planMcp(options, 'remove')).rejects.toMatchObject({
      code: 'agent_config_conflict',
    });
  });

  it('detects existing alternate names and inherited global connections', async () => {
    const { options, writeConfig } = await fixture(client);
    const original =
      client === 'codex'
        ? `[mcp_servers.storage]\nurl = "${MCP_URL}"\n`
        : JSON.stringify({ mcpServers: { storage: expectedEntry(client) } });
    await writeConfig(original);
    expect((await planMcp(options, 'setup')).result.status).toBe(
      'configured-under-other-name',
    );
    await rm(clientConfig(client, options.project, { global: false }).file);
    await writeConfig(
      original,
      clientConfig(client, options.home, { global: true }).file,
    );
    const inherited = await planMcp(options, 'setup');
    expect(inherited.result.status).toBe('inherited');
    expect(inherited.changes).toEqual([]);
  });

  it('keeps global and project scopes independent', async () => {
    const { options, target } = await fixture(client);
    await applyChanges(
      (await planMcp({ ...options, global: true }, 'setup')).changes,
    );
    await expect(readFile(target.file)).rejects.toMatchObject({
      code: 'ENOENT',
    });
    expect((await planMcp(options, 'remove')).changes).toEqual([]);
    await applyChanges(
      (await planMcp({ ...options, global: true }, 'remove')).changes,
    );
  });

  it('rejects malformed and duplicate config keys without echoing secrets', async () => {
    const { options, writeConfig, cli } = await fixture(client);
    await writeConfig('secret-sentinel INVALID');
    expect(
      await runCli(
        ['mcp', 'setup', '--client', client, '--yes', '--json'],
        cli.runtime,
        '1',
      ),
    ).toBe(2);
    expect(cli.stdout() + cli.stderr()).not.toContain('secret-sentinel');
    await writeConfig(
      client === 'codex'
        ? 'token="secret-sentinel"\ntoken="duplicate"'
        : '{"token":"secret-sentinel","token":"duplicate"}',
    );
    await expect(planMcp(options, 'setup')).rejects.toMatchObject({
      code: 'invalid_agent_config',
    });
  });

  it('refuses symlinked config and detects edits after preflight', async () => {
    const { options, target, root, writeConfig } = await fixture(client);
    const plan = await planMcp(options, 'setup');
    await writeConfig(client === 'codex' ? '# changed' : '{}');
    await expect(applyChanges(plan.changes)).rejects.toMatchObject({
      code: 'agent_file_changed',
    });
    await rm(target.file);
    await symlink(path.join(root, 'missing'), target.file);
    await expect(planMcp(options, 'setup')).rejects.toMatchObject({
      code: 'unsafe_agent_path',
    });
  });
});

it('observes enabled Codex plugins without changing their inventory', async () => {
  const { options, writeConfig } = await fixture('codex');
  await writeConfig('[plugins."edgestore@marketplace"]\nenabled = true\n');
  const plan = await planMcp(options, 'setup');
  expect(plan.result.status).toBe('plugin-configured');
  expect(plan.changes).toEqual([]);
});

it('respects CODEX_HOME for global configuration', async () => {
  const { options, root } = await fixture('codex');
  const codexHome = path.join(root, 'custom-codex');
  await applyChanges(
    (await planMcp({ ...options, global: true, codexHome }, 'setup')).changes,
  );
  expect(await readFile(path.join(codexHome, 'config.toml'), 'utf8')).toContain(
    CODEX_BLOCK,
  );
});

it('reports partial writes without leaking the underlying failure', async () => {
  const { root } = await fixture('cursor');
  const first = path.join(root, 'one');
  // Preflight sees a missing path; the first write makes its parent a regular file.
  await expect(
    applyChanges([
      { file: first, root, before: undefined, after: 'secret-sentinel' },
      { file: path.join(first, 'two'), root, before: undefined, after: '{}' },
    ]),
  ).rejects.toMatchObject({
    code: 'agent_write_failed',
    options: { details: { applied: [first] } },
  });
});
