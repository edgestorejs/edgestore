import { describe, expect, it } from 'vitest';
import { renderCliCommand } from './command';

describe('renderCliCommand', () => {
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
});
