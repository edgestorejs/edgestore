import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { runCli } from './cli';
import { createFixture } from './testFixture';

describe('runCli', () => {
  let fixture: ReturnType<typeof createFixture>;

  beforeEach(() => {
    fixture = createFixture();
  });

  it('emits stable JSON errors on stderr', async () => {
    fixture.globalConfig.activeAccount = undefined;

    const exitCode = await runCli(
      ['--json', 'project', 'list'],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(2);
    expect(fixture.stdout()).toBe('');
    expect(JSON.parse(fixture.stderr())).toEqual({
      error: {
        code: 'account_context_required',
        message: 'No active account selected.',
        suggestions: [
          'edgestore account list',
          'edgestore account switch <account-id>',
        ],
      },
    });
  });

  it('rejects conflicting output modes', async () => {
    const exitCode = await runCli(
      ['--json', '--plain', 'account', 'list'],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(2);
    expect(fixture.stderr()).toContain(
      '--json and --plain cannot be used together.',
    );
  });

  it.each([
    {
      name: 'unknown option',
      argv: ['--json', 'account', 'list', '--wat'],
      commanderCode: 'commander.unknownOption',
    },
    {
      name: 'missing argument with a trailing global option',
      argv: ['project', 'link', '--json'],
      commanderCode: 'commander.missingArgument',
    },
  ])(
    'emits one JSON syntax error for $name',
    async ({ argv, commanderCode }) => {
      const exitCode = await runCli(argv, fixture.runtime, '0.0.0');

      expect(exitCode).toBe(2);
      expect(fixture.stdout()).toBe('');
      expect(JSON.parse(fixture.stderr())).toMatchObject({
        error: {
          code: 'invalid_cli_syntax',
          details: { commanderCode },
        },
      });
    },
  );

  it('preserves Commander diagnostics in human mode', async () => {
    const exitCode = await runCli(
      ['account', 'list', '--wat'],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(2);
    expect(fixture.stdout()).toBe('');
    expect(fixture.stderr()).toContain("unknown option '--wat'");
  });

  it.each([
    { argv: ['--help'], expected: 'Usage: edgestore' },
    { argv: ['--version'], expected: '0.0.0' },
  ])(
    'keeps $argv successful and human-readable',
    async ({ argv, expected }) => {
      const exitCode = await runCli(argv, fixture.runtime, '0.0.0');

      expect(exitCode).toBe(0);
      expect(fixture.stdout()).toContain(expected);
      expect(fixture.stderr()).toBe('');
    },
  );

  it('applies an explicit working directory before running a command', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'edgestore-cwd-'));
    try {
      const exitCode = await runCli(
        ['--cwd', directory, 'account', 'list'],
        fixture.runtime,
        '0.0.0',
      );

      expect(exitCode).toBe(0);
      expect(fixture.runtime.cwd).toBe(directory);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('rejects a missing working directory', async () => {
    const exitCode = await runCli(
      ['--json', '--cwd', '/missing/edgestore-app', 'account', 'list'],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(2);
    expect(JSON.parse(fixture.stderr()).error).toMatchObject({
      code: 'working_directory_not_found',
    });
  });
});
