import { usageError } from '../core/errors';
import type { CliRuntime, GlobalFlags } from '../core/runtime';
import { outputFor } from '../core/runtime';

const topLevel =
  'login logout whoami doctor init account member project token bucket file open completion';

export async function completionCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
  shell: string,
): Promise<void> {
  const script = completionScript(shell);
  outputFor(runtime, flags).result({ shell, script }, script, script);
}

function completionScript(shell: string): string {
  if (shell === 'bash') {
    return `_edgestore() {
  local current="\${COMP_WORDS[COMP_CWORD]}"
  COMPREPLY=( $(compgen -W "${topLevel}" -- "$current") )
}
complete -F _edgestore edgestore`;
  }
  if (shell === 'zsh') {
    return `#compdef edgestore
_arguments '1:command:(${topLevel})' '*::argument:->args'`;
  }
  if (shell === 'fish') {
    return topLevel
      .split(' ')
      .map(
        (command) =>
          `complete -c edgestore -n '__fish_use_subcommand' -a '${command}'`,
      )
      .join('\n');
  }
  throw usageError('unsupported_shell', `Unsupported shell: ${shell}.`, [
    'Choose bash, zsh, or fish.',
  ]);
}
