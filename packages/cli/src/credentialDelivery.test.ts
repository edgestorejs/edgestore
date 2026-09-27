import {
  mkdtemp,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runCli } from './cli';
import { protectSecretFile, resolveSecretOutput } from './core/secretFile';
import { createFixture, project, projectKey } from './testFixture';

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});
async function directory() {
  const result = await mkdtemp(
    path.join(os.tmpdir(), 'edgestore-key-delivery-'),
  );
  directories.push(result);
  return result;
}

describe('agent project-key delivery', () => {
  it.each(['create', 'rotate'])(
    'keeps %s JSON and stdout/stderr secret-free',
    async (operation) => {
      const root = await directory();
      const fixture = createFixture();
      fixture.runtime.setCwd(root);
      fixture.createProjectKey.mockResolvedValueOnce({
        key: projectKey,
        secretKey: 'secret-sentinel',
      });
      const args = [
        '--json',
        'project',
        'key',
        operation,
        project.basePath,
        ...(operation === 'rotate' ? [projectKey.id, '--yes'] : []),
        '--name',
        'local',
        '--output',
        '.env.local',
      ];
      expect(await runCli(args, fixture.runtime, '1')).toBe(0);
      expect(fixture.stdout() + fixture.stderr()).not.toContain(
        'secret-sentinel',
      );
      expect(fixture.stdout()).not.toContain('secretKey');
      expect(await readFile(path.join(root, '.env.local'), 'utf8')).toContain(
        'secret-sentinel',
      );
      expect(await readFile(path.join(root, '.gitignore'), 'utf8')).toBe(
        '/.env.local\n',
      );
      if (process.platform !== 'win32')
        expect((await stat(path.join(root, '.env.local'))).mode & 0o777).toBe(
          0o600,
        );
    },
  );

  it.each([{ flags: ['--json'] }, { flags: ['--plain'] }, { flags: [] }])(
    'requires file delivery for automated flags %j before creating keys',
    async ({ flags }) => {
      const fixture = createFixture();
      fixture.runtime.io.inputIsTty = false;
      expect(
        await runCli(
          [
            ...flags,
            'project',
            'key',
            'create',
            project.basePath,
            '--name',
            'local',
          ],
          fixture.runtime,
          '1',
        ),
      ).toBe(2);
      expect(fixture.createProjectKey).not.toHaveBeenCalled();
      expect(fixture.stdout() + fixture.stderr()).not.toContain('secret_test');
    },
  );

  it('does not leak a new secret when delivery and rollback both fail', async () => {
    const root = await directory();
    const fixture = createFixture();
    fixture.runtime.setCwd(root);
    fixture.createProjectKey.mockImplementationOnce(async () => {
      await writeFile(
        path.join(root, '.env.local'),
        'EDGE_STORE_SECRET_KEY=existing',
      );
      return { key: projectKey, secretKey: 'secret-sentinel' };
    });
    fixture.revokeProjectKey.mockRejectedValueOnce(
      new Error('Revocation unavailable'),
    );
    expect(
      await runCli(
        [
          '--json',
          'project',
          'key',
          'create',
          project.basePath,
          '--name',
          'local',
          '--output',
          '.env.local',
        ],
        fixture.runtime,
        '1',
      ),
    ).toBe(2);
    expect(fixture.stdout() + fixture.stderr()).not.toContain(
      'secret-sentinel',
    );
    expect(JSON.parse(fixture.stderr()).error.details.rollback.status).toBe(
      'failed',
    );
  });
});

describe('environment destination selection', () => {
  it('reuses configured destinations and discovers the existing local env file before defaulting', async () => {
    const root = await directory();
    const fixture = createFixture();
    fixture.runtime.setCwd(root);
    expect(await resolveSecretOutput(fixture.runtime, undefined, false)).toBe(
      '.env.local',
    );
    await writeFile(path.join(root, '.env'), '');
    expect(await resolveSecretOutput(fixture.runtime, undefined, false)).toBe(
      '.env',
    );
    await writeFile(path.join(root, '.env.local'), '');
    await expect(
      resolveSecretOutput(fixture.runtime, undefined, false),
    ).rejects.toMatchObject({ code: 'secret_output_required' });
    fixture.repoConfig.config = {
      account: 'account',
      project: 'project',
      envFile: '.env.development.local',
    };
    expect(await resolveSecretOutput(fixture.runtime, undefined, false)).toBe(
      '.env.development.local',
    );
    expect(
      await resolveSecretOutput(fixture.runtime, '.env.explicit', false),
    ).toBe('.env.explicit');
  });

  it('does not infer a production-only destination for local automation', async () => {
    const root = await directory();
    const fixture = createFixture();
    fixture.runtime.setCwd(root);
    await writeFile(path.join(root, '.env.production'), '');
    await expect(
      resolveSecretOutput(fixture.runtime, undefined, false),
    ).rejects.toMatchObject({ code: 'secret_output_required' });
  });

  it('rejects output and gitignore symlinks before modifying their targets', async () => {
    const root = await directory();
    const outside = await directory();
    await writeFile(path.join(outside, 'target'), 'untouched');
    await symlink(path.join(outside, 'target'), path.join(root, '.env.local'));
    await expect(protectSecretFile(root, '.env.local')).rejects.toMatchObject({
      code: 'secret_output_unprotected',
    });
    await symlink(path.join(outside, 'target'), path.join(root, '.gitignore'));
    await expect(protectSecretFile(root, '.env.other')).rejects.toMatchObject({
      code: 'secret_output_unprotected',
    });
    await symlink(outside, path.join(root, 'linked'), 'junction');
    await expect(protectSecretFile(root, 'linked/.env')).rejects.toMatchObject({
      code: 'secret_output_unprotected',
    });
    expect(await readFile(path.join(outside, 'target'), 'utf8')).toBe(
      'untouched',
    );
  });
});
