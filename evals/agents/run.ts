import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
  appendFile,
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  writeFile,
} from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import YAML from 'yaml';
import {
  framework,
  initialResults,
  inside,
  isolatedEnv,
  packageNames,
  sanitize,
  sha256,
  type Framework,
  type PackageName,
} from './policy.ts';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../../', import.meta.url));
type Run = {
  schemaVersion: 1;
  framework: Framework;
  sourceCommit: string;
  createdAt: string;
  packages: Record<
    PackageName,
    { file: string; version: string; sha256: string }
  >;
  results: ReturnType<typeof initialResults>;
};

async function json(file: string, value: unknown) {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

async function command(
  directory: string,
  cwd: string,
  executable: string,
  args: string[],
  home = path.join(directory, 'home'),
) {
  await mkdir(home, { recursive: true });
  const started = Date.now();
  const log = path.join(directory, 'commands.log');
  await appendFile(
    log,
    `${JSON.stringify({ cwd, executable, args, startedAt: new Date(started).toISOString() })}\n`,
    { mode: 0o600 },
  );
  try {
    const result = await exec(executable, args, {
      cwd,
      env: isolatedEnv(home),
      timeout: 600_000,
      maxBuffer: 10 * 1024 * 1024,
    });
    await appendFile(
      log,
      `${sanitize(result.stdout + result.stderr)}\nCompleted in ${Date.now() - started}ms\n`,
    );
    return result.stdout;
  } catch (error) {
    const failure = error as {
      stdout?: string;
      stderr?: string;
      code?: string | number;
    };
    await appendFile(
      log,
      `${sanitize((failure.stdout ?? '') + (failure.stderr ?? ''))}\nFailed in ${Date.now() - started}ms\n`,
    );
    throw new Error(
      `${executable} failed (${failure.code ?? 'unknown'}). See sanitized ${log}.`,
    );
  }
}

async function load(directory: string): Promise<Run> {
  const canonical = await realpath(directory);
  assert.ok(
    path.basename(canonical).startsWith('edgestore-agent-eval-'),
    'Expected a disposable evaluation run',
  );
  assert.ok(
    !inside(await realpath(root), canonical),
    'Run must be outside this repository',
  );
  const run = JSON.parse(
    await readFile(path.join(canonical, 'run.json'), 'utf8'),
  ) as Run;
  assert.equal(run.schemaVersion, 1);
  framework(run.framework);
  for (const name of packageNames) {
    const artifact = run.packages[name];
    assert.equal(path.basename(artifact.file), artifact.file);
    const file = await realpath(
      path.join(canonical, 'artifacts', artifact.file),
    );
    assert.ok(inside(canonical, file));
    assert.equal(
      sha256(await readFile(file)),
      artifact.sha256,
      `Changed ${name} tarball`,
    );
  }
  return run;
}

function overrideMap(directory: string, run: Run) {
  return Object.fromEntries(
    packageNames.map((name) => [
      `@edgestore/${name}`,
      `file:${path.join(directory, 'artifacts', run.packages[name].file)}`,
    ]),
  );
}

async function copyFixture(directory: string, run: Run, destination: string) {
  // Never merge a fresh fixture into an existing or linked application.
  await mkdir(destination);
  await cp(
    new URL(`./fixtures/${run.framework}/`, import.meta.url),
    destination,
    { recursive: true },
  );
  await writeFile(
    path.join(destination, '.gitignore'),
    'node_modules\n.next\n.output\n.nitro\n.tanstack\ndist\n.env*\n',
  );
  // First prove the checked-in starter lock works unchanged.
  await command(directory, destination, 'pnpm', [
    'install',
    '--frozen-lockfile',
  ]);
  const workspace = YAML.parse(
    await readFile(path.join(destination, 'pnpm-workspace.yaml'), 'utf8'),
  );
  workspace.overrides = overrideMap(directory, run);
  await writeFile(
    path.join(destination, 'pnpm-workspace.yaml'),
    YAML.stringify(workspace),
  );
  await command(directory, destination, 'pnpm', ['install', '--lockfile-only']);
}

function cli(
  directory: string,
  cwd: string,
  args: string[],
  mode = 'artifact',
) {
  return command(
    directory,
    cwd,
    process.execPath,
    [
      path.join(directory, 'tools/node_modules/@edgestore/cli/dist/bin.mjs'),
      ...args,
    ],
    path.join(directory, `home-${mode}`),
  );
}

async function prepare(name: Framework) {
  const directory = await realpath(
    await mkdtemp(path.join(os.tmpdir(), 'edgestore-agent-eval-')),
  );
  console.log(`Preparing ${name}: ${directory}`);
  const artifacts = path.join(directory, 'artifacts');
  await mkdir(artifacts);
  const run: Run = {
    schemaVersion: 1,
    framework: name,
    sourceCommit: (
      await command(directory, root, 'git', ['rev-parse', 'HEAD'])
    ).trim(),
    createdAt: new Date().toISOString(),
    packages: {} as Run['packages'],
    results: initialResults(),
  };
  for (const name of packageNames) {
    const manifest = JSON.parse(
      await readFile(path.join(root, 'packages', name, 'package.json'), 'utf8'),
    );
    await command(directory, root, 'pnpm', [
      '--filter',
      `@edgestore/${name}`,
      'pack',
      '--pack-destination',
      artifacts,
    ]);
    const matches = (await readdir(artifacts)).filter(
      (file) => file.startsWith(`edgestore-${name}-`) && file.endsWith('.tgz'),
    );
    assert.equal(matches.length, 1);
    const file = matches[0]!;
    run.packages[name] = {
      file,
      version: manifest.version,
      sha256: sha256(await readFile(path.join(artifacts, file))),
    };
  }
  await json(path.join(directory, 'run.json'), run);
  const tools = path.join(directory, 'tools');
  await mkdir(tools);
  const overrides = overrideMap(directory, run);
  await json(path.join(tools, 'package.json'), {
    private: true,
    type: 'module',
    dependencies: {
      '@edgestore/cli': overrides['@edgestore/cli'],
      '@edgestore/sdk': overrides['@edgestore/sdk'],
    },
  });
  await writeFile(
    path.join(tools, 'pnpm-workspace.yaml'),
    YAML.stringify({ packages: ['.'], minimumReleaseAge: 1440, overrides }),
  );
  await command(directory, tools, 'pnpm', ['install']);
  for (const mode of ['baseline', 'skill']) {
    const app = path.join(directory, mode);
    await copyFixture(directory, run, app);
    await command(directory, app, 'git', ['init', '--quiet']);
    if (mode === 'skill') {
      const result = JSON.parse(
        await cli(
          directory,
          app,
          [
            'agent',
            'setup',
            '--client',
            'codex',
            '--skills-only',
            '--yes',
            '--json',
          ],
          mode,
        ),
      );
      assert.equal(result.skills.status, 'current');
      assert.equal(result.mcp.reason, 'skills-only');
    }
    await command(directory, app, 'git', ['add', '.']);
    await command(directory, app, 'git', [
      '-c',
      'user.name=EdgeStore Evaluation',
      '-c',
      'user.email=eval@example.invalid',
      'commit',
      '--quiet',
      '-m',
      'Evaluation starting point',
    ]);
    const prompt = await readFile(
      new URL('./prompt.md', import.meta.url),
      'utf8',
    );
    await writeFile(
      path.join(directory, `prompt-${mode}.md`),
      `${prompt}\n\nLocal packed CLI: ${path.join(tools, 'node_modules/@edgestore/cli/dist/bin.mjs')}\n\nUse these exact local package specifiers (the workspace overrides also pin transitive EdgeStore packages):\n${Object.entries(
        overrides,
      )
        .map(([name, value]) => `- ${name}@${value}`)
        .join('\n')}\n`,
    );
  }
  console.log(
    `Prepared matched baseline/skill workspaces. No agent or live test has run.\nRun manifest: ${path.join(directory, 'run.json')}`,
  );
}

async function resolvePackage(
  app: string,
  directory: string,
  run: Run,
  name: PackageName,
) {
  const require = createRequire(path.join(app, 'package.json'));
  const manifestFile = await realpath(
    require.resolve(`@edgestore/${name}/package.json`),
  );
  assert.ok(
    inside(directory, manifestFile),
    `${name} resolved outside the disposable run`,
  );
  assert.ok(
    !inside(root, manifestFile),
    `${name} resolved to source workspace`,
  );
  const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
  assert.equal(manifest.version, run.packages[name].version);
  for (const entry of Object.values(manifest.exports ?? {}) as (
    string | { import?: string; types?: string }
  )[]) {
    for (const target of typeof entry === 'string'
      ? [entry]
      : ([entry.import, entry.types].filter(Boolean) as string[])) {
      await readFile(path.resolve(path.dirname(manifestFile), target));
    }
  }
  if (['server', 'react', 'sdk'].includes(name)) {
    const index = await readFile(
      path.join(path.dirname(manifestFile), 'agent-docs/README.md'),
      'utf8',
    );
    assert.ok(index.includes(manifest.version));
    assert.ok(index.includes(manifest.name));
  }
  return require;
}

async function artifact(directory: string, run: Run) {
  const app = path.join(directory, 'artifact');
  await copyFixture(directory, run, app);
  const overrides = overrideMap(directory, run);
  const server =
    run.framework === 'vite-hono' ? path.join(app, 'apps/api') : app;
  const client =
    run.framework === 'vite-hono' ? path.join(app, 'apps/web') : app;
  await command(directory, server, 'pnpm', [
    'add',
    `@edgestore/server@${overrides['@edgestore/server']}`,
    `@edgestore/sdk@${overrides['@edgestore/sdk']}`,
  ]);
  await command(directory, client, 'pnpm', [
    'add',
    `@edgestore/react@${overrides['@edgestore/react']}`,
  ]);
  const serverRequire = await resolvePackage(server, directory, run, 'server');
  const clientRequire = await resolvePackage(client, directory, run, 'react');
  await resolvePackage(server, directory, run, 'sdk');
  await resolvePackage(
    path.dirname(serverRequire.resolve('@edgestore/server/package.json')),
    directory,
    run,
    'shared',
  );
  await resolvePackage(path.join(directory, 'tools'), directory, run, 'cli');
  const adapter = { next: 'next/app', start: 'start', 'vite-hono': 'hono' }[
    run.framework
  ];
  for (const specifier of [
    '@edgestore/server',
    '@edgestore/server/providers/edgestore',
    `@edgestore/server/adapters/${adapter}`,
  ]) {
    await import(pathToFileURL(serverRequire.resolve(specifier)).href);
  }
  await import(pathToFileURL(clientRequire.resolve('@edgestore/react')).href);
  const context = JSON.parse(
    await cli(directory, server, ['agent', 'context', '--json']),
  );
  assert.equal(context.application.compatibility, 'v1');
  const serverContext = context.application.packages.find(
    (item: { name: string }) => item.name === '@edgestore/server',
  );
  assert.equal(serverContext.status, 'installed');
  assert.equal(serverContext.docs.kind, 'bundled');
  assert.ok(inside(directory, serverContext.root));
  await json(path.join(directory, 'artifact-context.json'), context);
  const setup = JSON.parse(
    await cli(directory, app, [
      'agent',
      'setup',
      '--client',
      'codex',
      '--skills-only',
      '--yes',
      '--json',
    ]),
  );
  assert.equal(setup.skills.status, 'current');
  const second = JSON.parse(
    await cli(directory, app, [
      'agent',
      'setup',
      '--client',
      'codex',
      '--skills-only',
      '--yes',
      '--json',
    ]),
  );
  assert.equal(second.changes.length, 0);
  for (const client of ['codex', 'claude', 'cursor']) {
    const setup = JSON.parse(
      await cli(directory, app, [
        'mcp',
        'setup',
        '--client',
        client,
        '--yes',
        '--json',
      ]),
    );
    assert.equal(setup.status, 'configured');
    const status = JSON.parse(
      await cli(directory, app, [
        'mcp',
        'status',
        '--client',
        client,
        '--json',
      ]),
    );
    assert.equal(status.status, 'configured');
    const removed = JSON.parse(
      await cli(directory, app, [
        'mcp',
        'remove',
        '--client',
        client,
        '--yes',
        '--json',
      ]),
    );
    assert.equal(removed.status, 'not-configured');
  }
  await cli(directory, server, ['doctor', '--offline', '--json']);
  await command(directory, app, 'pnpm', ['build']);
  await command(directory, app, 'pnpm', ['typecheck']);
  run.results.artifact = {
    status: 'passed',
    detail:
      'Packed export targets/imports, reference indexes, isolated CLI/configuration, idempotent skill setup, clean fixture build/typecheck. Not an agent or upload test.',
  };
}

async function check(directory: string, run: Run, mode: string | undefined) {
  assert.ok(
    mode === 'baseline' || mode === 'skill',
    'Choose baseline or skill',
  );
  const app = await realpath(path.join(directory, mode));
  assert.ok(inside(directory, app), 'Application escaped its disposable run');
  await command(directory, app, 'pnpm', ['build']);
  await command(directory, app, 'pnpm', ['typecheck']);
  const packages =
    run.framework === 'vite-hono' ? ['apps/api', 'apps/web'] : ['.'];
  for (const item of packages) {
    await cli(
      directory,
      path.join(app, item),
      ['doctor', '--offline', '--json'],
      mode,
    );
  }
  await command(directory, app, 'git', ['diff', '--check']);
  // This is deliberately not an agent-quality pass: review the diff and task
  // transcript, and complete the separate application-path live protocol.
  run.results[mode] = {
    status: 'not-run',
    detail:
      'Local build/typecheck/offline doctor/diff checks passed; behavior and live verification still require review.',
  };
}

try {
  const [action, target, mode] = process.argv.slice(2);
  if (action === 'prepare') await prepare(framework(target));
  else {
    assert.ok(
      target && ['artifact', 'check'].includes(action ?? ''),
      'Usage: pnpm eval:agents prepare <next|vite-hono|start> | artifact <run-dir> | check <run-dir> <baseline|skill>',
    );
    const directory = await realpath(target);
    const run = await load(directory);
    try {
      if (action === 'artifact') await artifact(directory, run);
      else await check(directory, run, mode);
    } catch (error) {
      const key =
        action === 'artifact'
          ? 'artifact'
          : mode === 'baseline' || mode === 'skill'
            ? mode
            : undefined;
      if (key)
        run.results[key] = {
          status: 'failed',
          detail: sanitize(error instanceof Error ? error.message : 'Failed'),
        };
      throw error;
    } finally {
      await json(path.join(directory, 'run.json'), run);
    }
    console.log(JSON.stringify(run.results, null, 2));
  }
} catch (error) {
  console.error(
    sanitize(error instanceof Error ? error.message : 'Evaluation failed'),
  );
  process.exitCode = 1;
}
