import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { runCli } from './cli';
import { DEFAULT_API_ORIGIN } from './core/apiUrl';
import { serializeOAuthCredential } from './core/credentials';
import { inspectSource, localApplicationChecks } from './core/doctorLocal';
import { detectPackages } from './core/packageInstall';
import { createFixture } from './testFixture';

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function application(
  dependencies: Record<string, string | undefined> = { next: '16' },
) {
  const directory = await realpath(
    await mkdtemp(path.join(os.tmpdir(), 'edgestore-doctor-')),
  );
  directories.push(directory);
  await mkdir(path.join(directory, '.git'));
  await writeFile(
    path.join(directory, 'package.json'),
    JSON.stringify({ dependencies }),
  );
  const fixture = createFixture();
  fixture.runtime.setCwd(directory);
  return { directory, fixture };
}

it('offline never accesses credentials, OAuth, APIs, or command execution', async () => {
  const { directory, fixture } = await application();
  const get = vi.spyOn(fixture.credentials, 'get');
  const available = vi.spyOn(fixture.credentials, 'available');
  await writeFile(
    path.join(directory, '.env'),
    'EDGE_STORE_ACCESS_KEY=access-sentinel\nEDGE_STORE_SECRET_KEY=secret-sentinel',
  );
  const before = await readFile(path.join(directory, '.env'), 'utf8');
  expect(
    await runCli(['doctor', '--offline', '--json'], fixture.runtime, '1'),
  ).toBe(0);
  expect(fixture.runtime.sdkFactory).not.toHaveBeenCalled();
  expect(get).not.toHaveBeenCalled();
  expect(available).not.toHaveBeenCalled();
  expect(fixture.oauthLogin).not.toHaveBeenCalled();
  expect(fixture.oauthRefresh).not.toHaveBeenCalled();
  expect(fixture.runCommand).not.toHaveBeenCalled();
  expect(fixture.stdout() + fixture.stderr()).not.toContain('sentinel');
  expect(await readFile(path.join(directory, '.env'), 'utf8')).toBe(before);
  expect(JSON.parse(fixture.stdout()).checks).toContainEqual(
    expect.objectContaining({ name: '.env', status: 'pass' }),
  );
});

it('skips all network without a usable credential', async () => {
  const { fixture } = await application();
  await fixture.credentials.delete(DEFAULT_API_ORIGIN);
  expect(await runCli(['doctor', '--json'], fixture.runtime, '1')).toBe(0);
  expect(fixture.runtime.sdkFactory).not.toHaveBeenCalled();
  expect(fixture.stdout()).toContain('No usable existing credential');
});

it('never refreshes an expired OAuth credential', async () => {
  const { fixture } = await application();
  const stored = serializeOAuthCredential({
    version: 1,
    kind: 'oauth',
    accessToken: 'secret-sentinel',
    refreshToken: 'refresh-sentinel',
    expiresAt: 1,
    clientId: 'test-client',
    issuer: 'https://api.edgestore.dev',
    resource: 'https://api.edgestore.dev',
  });
  await fixture.credentials.set(DEFAULT_API_ORIGIN, stored);
  expect(await runCli(['doctor', '--json'], fixture.runtime, '1')).toBe(0);
  expect(fixture.oauthRefresh).not.toHaveBeenCalled();
  expect(fixture.runtime.sdkFactory).not.toHaveBeenCalled();
  expect(await fixture.credentials.get(DEFAULT_API_ORIGIN)).toBe(stored);
  expect(fixture.stdout() + fixture.stderr()).not.toContain('sentinel');
});

it('sanitizes remote errors instead of echoing request credentials', async () => {
  const { fixture } = await application();
  fixture.health.mockRejectedValueOnce(new Error('secret-sentinel'));
  expect(await runCli(['doctor', '--json'], fixture.runtime, '1')).toBe(1);
  expect(fixture.stdout() + fixture.stderr()).not.toContain('secret-sentinel');
});

it.each([
  {
    dependencies: { vite: '8', react: '19' },
    env: 'EDGE_STORE_SECRET_KEY=secret-sentinel',
  },
  {
    dependencies: { next: '16' },
    env: 'NEXT_PUBLIC_EDGE_STORE_SECRET_KEY=secret-sentinel',
  },
])(
  'fails exposed environment boundaries without values',
  async ({ dependencies, env }) => {
    const { directory, fixture } = await application(dependencies);
    await writeFile(path.join(directory, '.env.local'), env);
    expect(
      await runCli(['doctor', '--offline', '--json'], fixture.runtime, '1'),
    ).toBe(1);
    expect(fixture.stdout()).toContain('Environment boundary');
    expect(fixture.stdout() + fixture.stderr()).not.toContain(
      'secret-sentinel',
    );
  },
);

it('does not follow source or env symlinks or execute modules', async () => {
  const { directory, fixture } = await application();
  await mkdir(path.join(directory, 'src'));
  await writeFile(
    path.join(directory, 'outside.txt'),
    'throw new Error("secret-sentinel")',
  );
  await symlink(
    path.join(directory, 'outside.txt'),
    path.join(directory, 'src/ignored.ts'),
  );
  await symlink(
    path.join(directory, 'outside.txt'),
    path.join(directory, '.env.local'),
  );
  const checks = await localApplicationChecks(directory);
  expect(checks).toContainEqual(
    expect.objectContaining({ name: 'Environment inspection', status: 'skip' }),
  );
  expect(JSON.stringify(checks)).not.toContain('secret-sentinel');
  expect(
    await runCli(['doctor', '--offline', '--json'], fixture.runtime, '1'),
  ).toBe(0);
  expect(fixture.stdout()).toContain('Symlinked or out-of-scope');
  expect(fixture.stdout()).not.toContain('secret-sentinel');
});

it('checks code, not comments or strings, and tolerates unsupported syntax', () => {
  expect(
    inspectSource(
      '// import { x } from "@edgestore/server"\nconst x="<EdgeStoreProvider>";',
      true,
    ),
  ).toEqual({ adapter: false, provider: false, warnings: [] });
  expect(inspectSource('not valid code !!', true)).toBeUndefined();
  expect(
    inspectSource('import type { EdgeStoreRouter } from "../api";', true)
      ?.warnings,
  ).toEqual([]);
  expect(
    inspectSource('import { type EdgeStoreRouter } from "../api";', true)
      ?.warnings,
  ).toEqual([]);
  expect(
    inspectSource('import { EdgeStoreRouter } from "../api";', true)?.warnings,
  ).toHaveLength(1);
});

it('recognizes direct and aliased CORS calls without claiming dynamic policies are safe', () => {
  for (const origin of ['"*"', '(origin) => origin']) {
    expect(
      inspectSource(
        `import { cors as middleware } from "hono/cors"; middleware({ origin: ${origin}, credentials: true });`,
        false,
      )?.warnings,
    ).toHaveLength(1);
  }
  expect(
    inspectSource(
      'import { cors } from "hono/cors"; cors({ origin: trustedOrigin, credentials: true });',
      false,
    )?.warnings,
  ).toEqual([]);
});

it('identifies legacy handler wiring and provider JSX as observations only', () => {
  const facts = inspectSource(
    'import { createEdgeStoreNextHandler as handler } from "@edgestore/server/adapters/next/app"; handler({ router }); const UI = <EdgeStoreProvider><App /></EdgeStoreProvider>;',
    false,
  );
  expect(facts).toMatchObject({ adapter: true, provider: true });
  expect(facts?.warnings).toHaveLength(1);
});

it.each([
  {
    dependencies: { vite: '8', react: '19' },
    framework: 'vite',
    missing: ['@edgestore/react'],
  },
  {
    dependencies: { '@tanstack/react-start': '1', vite: '8', react: '19' },
    framework: 'tanstack-start',
    missing: ['@edgestore/server', '@edgestore/react'],
  },
  {
    dependencies: { hono: '4' },
    framework: 'hono',
    missing: ['@edgestore/server'],
  },
])(
  'installs packages for the actual $framework application role',
  async ({ dependencies, framework, missing }) => {
    const { directory } = await application(dependencies);
    expect(await detectPackages(directory)).toMatchObject({
      framework,
      missing,
    });
  },
);
