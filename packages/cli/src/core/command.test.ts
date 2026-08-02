import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderCliCommand } from './command';

const flags = {
  apiUrl: 'http://[::1]:3000',
  color: false,
  progress: false,
};

describe('renderCliCommand', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('preserves output, API, and project context', () => {
    expect(
      renderCliCommand(
        {
          json: true,
          apiUrl: 'https://api-dev.edgestore.dev',
          color: false,
          progress: false,
        },
        ['bucket', 'empty-status', 'publicFiles', '--job', 'job_123'],
        { project: 'x36t1ejdlz' },
      ),
    ).toBe(
      'edgestore --json --api-url https://api-dev.edgestore.dev bucket empty-status publicFiles --job job_123 --project x36t1ejdlz',
    );
  });

  it('quotes unsafe argument values', () => {
    expect(
      renderCliCommand({ color: false, progress: false }, [
        'project',
        'show',
        "project's name",
      ]),
    ).toBe(`edgestore project show 'project'"'"'s name'`);
  });

  it('quotes follow-up arguments for POSIX shells', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin');

    expect(
      renderCliCommand(flags, ['bucket', 'empty-status', 'my files']),
    ).toBe(
      "edgestore --api-url 'http://[::1]:3000' bucket empty-status 'my files'",
    );
  });

  it('quotes follow-up arguments for Windows shells', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');

    expect(
      renderCliCommand(flags, ['bucket', 'empty-status', 'my files']),
    ).toBe(
      'edgestore --api-url "http://[::1]:3000" bucket empty-status "my files"',
    );
  });
});
