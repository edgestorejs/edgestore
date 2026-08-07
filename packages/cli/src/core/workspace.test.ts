import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolvedProjectRef } from '../commands/project';
import { createFixture } from '../testFixture';
import { selectWorkspaceContext } from './workspace';

const directories: string[] = [];
const flags = { color: false, progress: false };

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('selectWorkspaceContext', () => {
  it('targets the nearest package when run inside a workspace', async () => {
    const root = await monorepo();
    const workspace = await packageDirectory(root, 'apps/web', 'web');
    const source = path.join(workspace, 'src');
    await mkdir(source);
    const fixture = createFixture();
    fixture.runtime.cwd = source;

    await selectWorkspaceContext(fixture.runtime, flags, 'read');

    expect(fixture.runtime.cwd).toBe(source);
    expect(fixture.runtime.workspaceCwd).toBe(workspace);
  });

  it('uses the only configured workspace from the monorepo root', async () => {
    const root = await monorepo();
    const workspace = await packageDirectory(root, 'apps/web', 'web');
    await packageDirectory(root, 'apps/api', 'api');
    await configure(workspace, 'web-project');
    const fixture = createFixture();
    fixture.runtime.cwd = root;

    await selectWorkspaceContext(fixture.runtime, flags, 'read');

    expect(fixture.runtime.cwd).toBe(root);
    expect(fixture.runtime.workspaceCwd).toBe(workspace);
  });

  it('prompts for one of multiple configured workspaces', async () => {
    const root = await monorepo();
    const web = await packageDirectory(root, 'apps/web', 'web');
    const api = await packageDirectory(root, 'apps/api', 'api');
    await configure(web, 'web-project');
    await configure(api, 'api-project');
    const fixture = createFixture();
    fixture.runtime.cwd = root;
    const select = vi.fn(async () => api);
    fixture.runtime.prompts.select =
      select as typeof fixture.runtime.prompts.select;

    await selectWorkspaceContext(fixture.runtime, flags, 'read');

    expect(fixture.runtime.cwd).toBe(root);
    expect(fixture.runtime.workspaceCwd).toBe(api);
    expect(select).toHaveBeenCalledWith(
      'Which workspace package should EdgeStore use?',
      expect.arrayContaining([
        { value: web, label: 'web', hint: 'apps/web' },
        { value: api, label: 'api', hint: 'apps/api' },
      ]),
    );
  });

  it('requires explicit context for ambiguous automation', async () => {
    const root = await monorepo();
    const web = await packageDirectory(root, 'apps/web', 'web');
    const api = await packageDirectory(root, 'apps/api', 'api');
    await configure(web, 'web-project');
    await configure(api, 'api-project');
    const fixture = createFixture();
    fixture.runtime.cwd = root;
    fixture.runtime.io.inputIsTty = false;

    await expect(
      selectWorkspaceContext(fixture.runtime, { ...flags, json: true }, 'read'),
    ).rejects.toMatchObject({
      code: 'workspace_context_required',
      exitCode: 2,
    });
  });

  it('prompts for an application package before writing the first link', async () => {
    const root = await monorepo();
    await packageDirectory(root, 'apps/web', 'web');
    const api = await packageDirectory(root, 'apps/api', 'api');
    const fixture = createFixture();
    fixture.runtime.cwd = root;
    fixture.runtime.prompts.select = vi.fn(
      async () => api,
    ) as typeof fixture.runtime.prompts.select;

    await selectWorkspaceContext(fixture.runtime, flags, 'write');

    expect(fixture.runtime.cwd).toBe(root);
    expect(fixture.runtime.workspaceCwd).toBe(api);
  });

  it('discovers a workspace without a Git repository', async () => {
    const root = await monorepo(false);
    const workspace = await packageDirectory(root, 'apps/web', 'web');
    await configure(workspace, 'web-project');
    const fixture = createFixture();
    fixture.runtime.cwd = root;

    await selectWorkspaceContext(fixture.runtime, flags, 'read');

    expect(fixture.runtime.workspaceCwd).toBe(workspace);
  });

  it('normalizes an explicit subdirectory to its workspace package', async () => {
    const root = await monorepo();
    const workspace = await packageDirectory(root, 'apps/web', 'web');
    const source = path.join(workspace, 'src');
    await mkdir(source);
    const fixture = createFixture();
    fixture.runtime.setCwd(source);

    await selectWorkspaceContext(
      fixture.runtime,
      { ...flags, cwd: 'apps/web/src' },
      'read',
    );

    expect(fixture.runtime.cwd).toBe(source);
    expect(fixture.runtime.workspaceCwd).toBe(workspace);
  });

  it('does not discover a parent workspace across a nested Git root', async () => {
    const root = await monorepo();
    const nested = await packageDirectory(root, 'vendor/tool', 'tool');
    await mkdir(path.join(nested, '.git'));
    const source = path.join(nested, 'src');
    await mkdir(source);
    const fixture = createFixture();
    fixture.runtime.cwd = source;

    await selectWorkspaceContext(fixture.runtime, flags, 'read');

    expect(fixture.runtime.workspaceCwd).toBe(nested);
  });

  it('does not discover a workspace for an explicit project', async () => {
    const fixture = createFixture();

    await expect(
      resolvedProjectRef(fixture.runtime, flags, 'x36t1ejdlz'),
    ).resolves.toBe('x36t1ejdlz');
    expect(fixture.runtime.cwd).toBe('/repo');
    expect(fixture.runtime.workspaceCwd).toBe('/repo');
  });
});

async function monorepo(git = true): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'edgestore-workspace-'));
  directories.push(root);
  if (git) await mkdir(path.join(root, '.git'));
  await writeFile(path.join(root, 'package.json'), '{"private":true}\n');
  await writeFile(
    path.join(root, 'pnpm-workspace.yaml'),
    "packages:\n  - 'apps/*'\n",
  );
  return root;
}

async function packageDirectory(
  root: string,
  relative: string,
  name: string,
): Promise<string> {
  const directory = path.join(root, relative);
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, 'package.json'),
    `${JSON.stringify({ name })}\n`,
  );
  return directory;
}

async function configure(directory: string, project: string): Promise<void> {
  const configDirectory = path.join(directory, '.edgestore');
  await mkdir(configDirectory);
  await writeFile(
    path.join(configDirectory, 'config.json'),
    `${JSON.stringify({ account: 'acc_123', project })}\n`,
  );
}
