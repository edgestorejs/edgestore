import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { runCli } from './cli';
import { account, createFixture, project, projectKey } from './testFixture';

describe('utility', () => {
  let fixture: ReturnType<typeof createFixture>;

  beforeEach(() => {
    fixture = createFixture();
  });

  it('opens the linked project in the dashboard', async () => {
    fixture.repoConfig.config = {
      account: account.id,
      project: project.basePath,
    };

    await runCli(['open', 'project'], fixture.runtime, '0.0.0');

    expect(fixture.openUrl).toHaveBeenCalledWith(
      `https://dashboard.edgestore.dev/projects/${project.basePath}`,
    );
  });

  it('prints dashboard URLs without opening them in plain mode', async () => {
    await runCli(['open', 'billing', '--plain'], fixture.runtime, '0.0.0');

    expect(fixture.openUrl).not.toHaveBeenCalled();
    expect(fixture.stdout()).toBe(
      'https://dashboard.edgestore.dev/settings/billing\n',
    );
  });

  it('keeps the future keys dashboard target out of the live grammar', async () => {
    const exitCode = await runCli(
      ['--json', 'open', 'keys'],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(2);
    expect(fixture.openUrl).not.toHaveBeenCalled();
    expect(JSON.parse(fixture.stderr()).error).toMatchObject({
      code: 'invalid_open_target',
      suggestions: ['Choose account, billing, or project.'],
    });
  });

  it('prints shell completion scripts', async () => {
    await runCli(['completion', 'fish', '--plain'], fixture.runtime, '0.0.0');

    expect(fixture.stdout()).toContain('complete -c edgestore');
    expect(fixture.stdout()).toContain("-a 'project'");
  });

  it('completes Bash commands and registered options', async () => {
    await runCli(['completion', 'bash', '--plain'], fixture.runtime, '0.0.0');

    const script = fixture.stdout();
    const nestedCommands = execFileSync(
      'bash',
      [
        '-c',
        `${script}\nCOMP_WORDS=(edgestore project key ''); COMP_CWORD=3; _edgestore; printf '%s\\n' "\${COMPREPLY[@]}"`,
      ],
      { encoding: 'utf8' },
    );
    const nestedOptions = execFileSync(
      'bash',
      [
        '-c',
        `${script}\nCOMP_WORDS=(edgestore project key rotate old replacement ''); COMP_CWORD=6; _edgestore; printf '%s\\n' "\${COMPREPLY[@]}"`,
      ],
      { encoding: 'utf8' },
    );
    const globalOptions = execFileSync(
      'bash',
      [
        '-c',
        `${script}\nCOMP_WORDS=(edgestore --); COMP_CWORD=1; _edgestore; printf '%s\\n' "\${COMPREPLY[@]}"`,
      ],
      { encoding: 'utf8' },
    ).split('\n');
    const logoutOptions = execFileSync(
      'bash',
      [
        '-c',
        `${script}\nCOMP_WORDS=(edgestore logout --); COMP_CWORD=2; _edgestore; printf '%s\\n' "\${COMPREPLY[@]}"`,
      ],
      { encoding: 'utf8' },
    ).split('\n');
    const projectLinkOptions = execFileSync(
      'bash',
      [
        '-c',
        `${script}\nCOMP_WORDS=(edgestore project link --); COMP_CWORD=3; _edgestore; printf '%s\\n' "\${COMPREPLY[@]}"`,
      ],
      { encoding: 'utf8' },
    ).split('\n');

    expect(nestedCommands.split('\n')).toEqual(
      expect.arrayContaining(['list', 'create', 'rotate', 'revoke']),
    );
    expect(nestedOptions.split('\n')).toEqual(
      expect.arrayContaining(['--name', '--output', '--yes']),
    );
    expect(globalOptions).toEqual(
      expect.arrayContaining(['--no-color', '--no-progress']),
    );
    expect(globalOptions).not.toEqual(
      expect.arrayContaining(['--color', '--progress']),
    );
    expect(logoutOptions).not.toContain('--yes');
    expect(projectLinkOptions).toContain('--env-file');
    expect(script).toContain('--output|--env-file|--bucket');
  });

  it('checks linked project keys without exposing env secrets', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'edgestore-doctor-'));
    fixture.runtime.cwd = directory;
    fixture.repoConfig.config = {
      account: account.id,
      project: project.basePath,
    };
    await writeFile(
      path.join(directory, '.env.local'),
      'EDGE_STORE_ACCESS_KEY=access_test\nEDGE_STORE_SECRET_KEY=do-not-print\n',
    );

    try {
      await runCli(['doctor'], fixture.runtime, '1.2.3');

      expect(fixture.stdout()).toContain('CLI');
      expect(fixture.stdout()).toContain('1.2.3');
      expect(fixture.stdout()).toContain('Linked project');
      expect(fixture.stdout()).not.toContain('do-not-print');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('checks exported and quoted env file assignments', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'edgestore-doctor-'));
    fixture.runtime.cwd = directory;
    fixture.repoConfig.config = {
      account: account.id,
      project: project.basePath,
    };
    await writeFile(
      path.join(directory, '.env.local'),
      [
        'export EDGE_STORE_ACCESS_KEY = "access_test"',
        "EDGE_STORE_SECRET_KEY = 'do-not-print'",
        '',
      ].join('\n'),
    );

    try {
      await runCli(['--json', 'doctor'], fixture.runtime, '1.2.3');

      const checks = JSON.parse(fixture.stdout()).checks;
      expect(checks).toContainEqual({
        name: '.env.local',
        status: 'pass',
        detail: 'EDGE_STORE_ACCESS_KEY present, EDGE_STORE_SECRET_KEY present',
      });
      expect(checks).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Environment project' }),
        ]),
      );
      expect(fixture.stdout()).not.toContain('do-not-print');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('checks the env file remembered by init', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'edgestore-doctor-'));
    fixture.runtime.cwd = directory;
    fixture.readRepoConfig.mockResolvedValueOnce({
      config: {
        account: account.id,
        project: project.basePath,
        envFile: '.env.development.local',
      },
      path: path.join(directory, '.edgestore', 'config.json'),
    });
    await writeFile(
      path.join(directory, '.env.development.local'),
      'EDGE_STORE_ACCESS_KEY=access_test\nEDGE_STORE_SECRET_KEY=secret\n',
    );

    try {
      await runCli(['doctor'], fixture.runtime, '1.2.3');

      expect(fixture.stdout()).toContain('.env.development.local');
      expect(fixture.stdout()).not.toContain('.env.local ');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('warns when the env file remembered by init is missing', async () => {
    fixture.readRepoConfig.mockResolvedValueOnce({
      config: {
        account: account.id,
        project: project.basePath,
        envFile: '.env.development.local',
      },
      path: '/repo/.edgestore/config.json',
    });

    const exitCode = await runCli(
      ['--json', 'doctor'],
      fixture.runtime,
      '1.2.3',
    );

    expect(exitCode).toBe(0);
    expect(JSON.parse(fixture.stdout()).checks).toContainEqual({
      name: '.env.development.local',
      status: 'warn',
      detail: 'Configured env file not found',
    });
  });

  it('warns when the configured environment key has been revoked', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'edgestore-doctor-'));
    fixture.runtime.cwd = directory;
    fixture.repoConfig.config = {
      account: account.id,
      project: project.basePath,
    };
    fixture.listProjectKeys.mockResolvedValueOnce({
      keys: [{ ...projectKey, revokedAt: '2026-08-01T00:00:00.000Z' }],
    });
    await writeFile(
      path.join(directory, '.env.local'),
      'EDGE_STORE_ACCESS_KEY=access_test\nEDGE_STORE_SECRET_KEY=secret\n',
    );

    try {
      await runCli(['--json', 'doctor'], fixture.runtime, '1.2.3');

      expect(JSON.parse(fixture.stdout()).checks).toContainEqual({
        name: 'Environment project',
        status: 'warn',
        detail: '.env.local access key has been revoked',
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('reports malformed repository config as a failed doctor check', async () => {
    fixture.readRepoConfig.mockRejectedValueOnce(
      new Error('Invalid EdgeStore config at /repo/.edgestore/config.json.'),
    );

    const exitCode = await runCli(
      ['--json', 'doctor'],
      fixture.runtime,
      '1.2.3',
    );

    expect(exitCode).toBe(1);
    expect(JSON.parse(fixture.stdout()).checks).toContainEqual({
      name: 'Local config',
      status: 'fail',
      detail: 'Invalid EdgeStore config at /repo/.edgestore/config.json.',
    });
  });

  it('reports doctor cancellation as an interruption in JSON mode', async () => {
    fixture.health.mockImplementationOnce(async () => {
      fixture.abortController.abort();
      throw fixture.abortController.signal.reason;
    });

    const exitCode = await runCli(
      ['--json', 'doctor'],
      fixture.runtime,
      '1.2.3',
    );

    expect(exitCode).toBe(130);
    expect(fixture.stdout()).toBe('');
    expect(JSON.parse(fixture.stderr()).error.code).toBe('interrupted');
  });
});
