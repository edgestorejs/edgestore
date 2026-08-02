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
  args.push(...command);
  if (options.project) args.push('--project', options.project);
  return args.map(quoteShellArgument).join(' ');
}

function quoteShellArgument(value: string): string {
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(value)) return value;
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}
