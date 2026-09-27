import type { GlobalFlags } from './runtime';

export function renderCliCommand(
  flags: GlobalFlags,
  command: string[],
  options: {
    project?: string;
    preserveOutputMode?: boolean;
  } = {},
): string {
  const args = ['edgestore'];
  if (options.preserveOutputMode !== false) {
    if (flags.json) args.push('--json');
    if (flags.plain) args.push('--plain');
  }
  if (flags.apiUrl) args.push('--api-url', flags.apiUrl);
  if (flags.cwd) args.push('--cwd', flags.cwd);
  args.push(...command);
  if (options.project) args.push('--project', options.project);
  return renderShellCommand(args);
}

export function renderShellCommand(args: string[]): string {
  return args.map(quoteShellArgument).join(' ');
}

function quoteShellArgument(value: string): string {
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(value)) return value;
  if (process.platform === 'win32') {
    return `"${value.replaceAll('"', '\\"')}"`;
  }
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}
