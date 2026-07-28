import { createColors } from 'picocolors';
import { CliError } from './errors';

export type OutputMode = 'human' | 'json' | 'plain';

export type OutputOptions = {
  mode: OutputMode;
  color: boolean;
};

export type OutputStreams = {
  stdout: NodeJS.WritableStream;
  stderr: NodeJS.WritableStream;
};

export class CliOutput {
  readonly colors;

  constructor(
    private readonly streams: OutputStreams,
    readonly options: OutputOptions,
  ) {
    this.colors = createColors(options.color && options.mode === 'human');
  }

  result(value: unknown, human: string, plain?: string): void {
    if (this.options.mode === 'json') {
      this.writeStdout(JSON.stringify(value, null, 2));
      return;
    }

    if (this.options.mode === 'plain') {
      if (plain === undefined) {
        throw new CliError(
          'plain_output_unavailable',
          'This command does not have a single plain-text value.',
          { exitCode: 2 },
        );
      }
      this.writeStdout(plain);
      return;
    }

    this.writeStdout(human);
  }

  message(message: string): void {
    this.writeStdout(message);
  }

  warning(message: string): void {
    this.writeStderr(`${this.colors.yellow('Warning:')} ${message}`);
  }

  error(error: CliError): void {
    if (this.options.mode === 'json') {
      this.writeStderr(
        JSON.stringify(
          {
            error: {
              code: error.code,
              message: error.message,
              ...(error.options.details === undefined
                ? {}
                : { details: error.options.details }),
              ...(error.options.requestId === undefined
                ? {}
                : { requestId: error.options.requestId }),
              ...(error.options.suggestions === undefined
                ? {}
                : { suggestions: error.options.suggestions }),
            },
          },
          null,
          2,
        ),
      );
      return;
    }

    const lines = [this.colors.red(error.message)];
    if (error.options.suggestions?.length) {
      lines.push(
        '',
        'Run:',
        ...error.options.suggestions.map((item) => `  ${item}`),
      );
    }
    if (error.options.requestId) {
      lines.push('', `Request ID: ${error.options.requestId}`);
    }
    this.writeStderr(lines.join('\n'));
  }

  private writeStdout(value: string): void {
    this.streams.stdout.write(`${value}\n`);
  }

  private writeStderr(value: string): void {
    this.streams.stderr.write(`${value}\n`);
  }
}

export function renderTable(
  headers: string[],
  rows: (string | number)[][],
): string {
  const stringRows = rows.map((row) => row.map(String));
  const widths = headers.map((header, columnIndex) =>
    Math.max(
      header.length,
      ...stringRows.map((row) => row[columnIndex]?.length ?? 0),
    ),
  );
  const renderRow = (row: string[]) =>
    row
      .map((value, index) => value.padEnd(widths[index] ?? value.length))
      .join('  ')
      .trimEnd();

  return [renderRow(headers), ...stringRows.map((row) => renderRow(row))].join(
    '\n',
  );
}
