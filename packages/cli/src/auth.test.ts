import { beforeEach, describe, expect, it } from 'vitest';
import { runCli } from './cli';
import { createFixture } from './testFixture';

describe('auth', () => {
  let fixture: ReturnType<typeof createFixture>;

  beforeEach(() => {
    fixture = createFixture();
  });

  it('validates a token before saving it', async () => {
    await runCli(['login', '--token'], fixture.runtime, '0.0.0');

    expect(fixture.setCredential).toHaveBeenCalledWith(
      'https://api.edgestore.dev',
      'mgmt_test',
    );
    expect(fixture.stdout()).toContain('Logged in as ravi@example.com.');
  });

  it('stores a login for the selected API origin', async () => {
    await runCli(
      ['--api-url', 'https://api-dev.edgestore.dev/v2/', 'login', '--token'],
      fixture.runtime,
      '0.0.0',
    );

    expect(fixture.setCredential).toHaveBeenCalledWith(
      'https://api-dev.edgestore.dev',
      'mgmt_test',
    );
  });

  it('does not prompt for a token in JSON mode', async () => {
    const exitCode = await runCli(
      ['login', '--token', '--json'],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(2);
    expect(fixture.readToken).not.toHaveBeenCalled();
    expect(JSON.parse(fixture.stderr()).error.code).toBe(
      'interactive_input_disabled',
    );
  });
});
