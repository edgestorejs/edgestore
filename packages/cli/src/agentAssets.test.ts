import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { runCli } from './cli';
import { clientConfig, CLIENTS, type AgentClient } from './core/agent/clients';
import { applyChanges, digest } from './core/agent/files';
import {
  loadSkillBundle,
  planSkills,
  skillDirectory,
  type SkillBundle,
} from './core/agent/skills';
import { createFixture } from './testFixture';

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((dir) => rm(dir, { recursive: true, force: true })),
  );
});
const bundledFile = fileURLToPath(
  new URL('../agent-assets/skills.json', import.meta.url),
);

function bundle(files: Record<string, string>): SkillBundle {
  return { schemaVersion: 1, revision: digest(JSON.stringify(files)), files };
}
const first = bundle({
  'edgestore-setup/SKILL.md': 'first',
  'edgestore-setup/references/old.md': 'reference',
});
const second = bundle({
  'edgestore-setup/SKILL.md': 'second',
  'edgestore-setup/references/new.md': 'new reference',
});

async function fixture(client: AgentClient) {
  const root = await realpath(
    await mkdtemp(path.join(os.tmpdir(), 'edgestore-assets-')),
  );
  directories.push(root);
  const options = {
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
  const cli = createFixture();
  cli.runtime.setCwd(options.project);
  cli.runtime.env.HOME = options.home;
  cli.runtime.globalConfig.path = path.join(options.stateRoot, 'config.json');
  return {
    root,
    options,
    cli,
    skill: path.join(
      skillDirectory(client, options.project),
      'edgestore-setup/SKILL.md',
    ),
  };
}

describe.each(CLIENTS)('%s skill assets', (client) => {
  it('installs, repeats without writes, and updates only an owned snapshot', async () => {
    const { options, skill } = await fixture(client);
    await applyChanges((await planSkills(options, first, 'setup')).changes);
    expect(await readFile(skill, 'utf8')).toBe('first');
    expect((await planSkills(options, first, 'setup')).changes).toEqual([]);
    expect((await planSkills(options, second, 'setup')).result.status).toBe(
      'update-available',
    );
    expect((await planSkills(options, second, 'setup')).changes).toEqual([]);
    const plan = await planSkills(options, second, 'update');
    expect(plan.changes.some(({ after }) => after === undefined)).toBe(true);
    await applyChanges(plan.changes);
    expect(await readFile(skill, 'utf8')).toBe('second');
    expect(await readdir(path.join(path.dirname(skill), 'references'))).toEqual(
      ['new.md'],
    );
    expect((await planSkills(options, second, 'status')).result.status).toBe(
      'current',
    );
  });

  it('refuses modified and additional files even with yes', async () => {
    const { options, cli, skill } = await fixture(client);
    const actual = await loadSkillBundle(bundledFile);
    await applyChanges((await planSkills(options, actual, 'setup')).changes);
    await writeFile(skill, 'user modification secret-sentinel');
    expect(
      await runCli(
        ['agent', 'update', '--client', client, '--yes', '--json'],
        cli.runtime,
        '1',
      ),
    ).toBe(2);
    expect(await readFile(skill, 'utf8')).toBe(
      'user modification secret-sentinel',
    );
    expect(cli.stdout() + cli.stderr()).not.toContain('secret-sentinel');
    await writeFile(skill, actual.files['edgestore-setup/SKILL.md']!);
    await writeFile(path.join(path.dirname(skill), 'custom.md'), 'mine');
    await expect(planSkills(options, actual, 'update')).rejects.toMatchObject({
      code: 'skill_conflict',
    });
  });

  it('dry-runs both plans without writes and skills-only leaves malformed MCP alone', async () => {
    const { options, cli } = await fixture(client);
    expect(
      await runCli(
        ['agent', 'setup', '--client', client, '--dry-run', '--json'],
        cli.runtime,
        '1',
      ),
    ).toBe(0);
    expect(await readdir(options.project)).toEqual(['.git', 'package.json']);
    const config = clientConfig(client, options.project, { global: false });
    await mkdir(path.dirname(config.file), { recursive: true });
    await writeFile(config.file, 'malformed secret-sentinel');
    expect(
      await runCli(
        ['agent', 'setup', '--client', client, '--yes', '--json'],
        cli.runtime,
        '1',
      ),
    ).toBe(2);
    await expect(
      readFile(path.join(options.project, '.edgestore/skill-assets.json')),
    ).rejects.toMatchObject({ code: 'ENOENT' });
    expect(
      await runCli(
        [
          'agent',
          'setup',
          '--client',
          client,
          '--skills-only',
          '--yes',
          '--json',
        ],
        cli.runtime,
        '1',
      ),
    ).toBe(0);
    expect(await readFile(config.file, 'utf8')).toBe(
      'malformed secret-sentinel',
    );
    expect(cli.stdout() + cli.stderr()).not.toContain('secret-sentinel');
    expect(cli.oauthLogin).not.toHaveBeenCalled();
    expect(cli.runtime.sdkFactory).not.toHaveBeenCalled();
  });

  it('requires explicit noninteractive choices and confirmation', async () => {
    const { cli } = await fixture(client);
    expect(await runCli(['agent', 'setup', '--json'], cli.runtime, '1')).toBe(
      2,
    );
    expect(
      await runCli(
        ['agent', 'setup', '--client', client, '--json'],
        cli.runtime,
        '1',
      ),
    ).toBe(2);
  });

  it('keeps global scope separate and reports an inherited copy without duplicates', async () => {
    const { options } = await fixture(client);
    await applyChanges(
      (await planSkills({ ...options, global: true }, first, 'setup')).changes,
    );
    const project = await planSkills(options, first, 'setup');
    expect(project.result.status).toBe('other-source');
    expect(project.changes).toEqual([]);
    expect(await readdir(options.project)).toEqual(['.git', 'package.json']);
  });

  it('preserves unrelated skill folders and rejects symlinked destinations', async () => {
    const { options, skill, root } = await fixture(client);
    const other = path.join(
      skillDirectory(client, options.project),
      'unrelated',
    );
    await mkdir(other, { recursive: true });
    await writeFile(path.join(other, 'SKILL.md'), 'keep');
    await symlink(root, path.dirname(skill));
    await expect(planSkills(options, first, 'setup')).rejects.toMatchObject({
      code: 'unsafe_agent_path',
    });
    expect(await readFile(path.join(other, 'SKILL.md'), 'utf8')).toBe('keep');
  });

  it('context reports installed assets and connection metadata without contents', async () => {
    const { cli } = await fixture(client);
    expect(
      await runCli(
        ['agent', 'setup', '--client', client, '--yes', '--json'],
        cli.runtime,
        '1',
      ),
    ).toBe(0);
    expect(await runCli(['agent', 'context', '--json'], cli.runtime, '1')).toBe(
      0,
    );
    expect(cli.stdout()).toContain('"status": "current"');
    expect(cli.stdout()).toContain('"status": "configured"');
    expect(cli.stdout()).not.toContain('# EdgeStore setup');
    expect(cli.runtime.sdkFactory).not.toHaveBeenCalled();
  });
});

it('detects Cursor’s shared .agents skill source', async () => {
  const { options } = await fixture('cursor');
  const shared = path.join(options.project, '.agents/skills/edgestore-setup');
  await mkdir(shared, { recursive: true });
  await writeFile(path.join(shared, 'SKILL.md'), 'external installer');
  expect((await planSkills(options, first, 'setup')).result.status).toBe(
    'other-source',
  );
});

it('validates content revision and safe paths before using a packaged bundle', async () => {
  const { root } = await fixture('codex');
  const file = path.join(root, 'bundle.json');
  await writeFile(file, JSON.stringify({ ...first, revision: 'corrupt' }));
  await expect(loadSkillBundle(file)).rejects.toMatchObject({
    code: 'invalid_skill_bundle',
  });
  await writeFile(
    file,
    JSON.stringify(
      bundle({ ...first.files, 'edgestore-setup/../../escape': 'bad' }),
    ),
  );
  await expect(loadSkillBundle(file)).rejects.toMatchObject({
    code: 'invalid_skill_bundle',
  });
});

it('packs the canonical source bytes rather than a second authored skill', async () => {
  const actual = await loadSkillBundle(bundledFile);
  const root = fileURLToPath(new URL('../../../skills/', import.meta.url));
  for (const [name, contents] of Object.entries(actual.files))
    expect(contents).toBe(await readFile(path.join(root, name), 'utf8'));
});
