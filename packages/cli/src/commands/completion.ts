import type { Command, Option } from 'commander';
import { usageError } from '../core/errors';
import type { CliRuntime, GlobalFlags } from '../core/runtime';
import { outputFor } from '../core/runtime';

type CompletionModel = {
  candidates: Record<string, string>;
  globalOptions: string;
  valueOptions: string[];
};

const argumentCandidates = new WeakMap<Command, string[]>();

export function withCompletionCandidates(
  command: Command,
  candidates: string[],
): Command {
  argumentCandidates.set(command, candidates);
  return command;
}

export async function completionCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
  input: { shell: string; program: Command },
): Promise<void> {
  const script = completionScript(input.shell, completionModel(input.program));
  outputFor(runtime, flags).result(
    { shell: input.shell, script },
    script,
    script,
  );
}

function completionScript(shell: string, model: CompletionModel): string {
  if (shell === 'bash') {
    return bashCompletionScript(model);
  }
  if (shell === 'zsh') {
    return zshCompletionScript(model);
  }
  if (shell === 'fish') {
    return fishCompletionScript(model);
  }
  throw usageError('unsupported_shell', `Unsupported shell: ${shell}.`, [
    'Choose bash, zsh, or fish.',
  ]);
}

function completionModel(program: Command): CompletionModel {
  const candidates: Record<string, string> = {};
  const valueOptions = new Set<string>();

  const visit = (command: Command, paths: string[], root = false): void => {
    const children = command.commands.flatMap((child) => [
      child.name(),
      ...child.aliases(),
    ]);
    const options = root ? [] : optionNames(command.options);
    const fixedArguments = argumentCandidates.get(command) ?? [];
    const values = [...children, ...fixedArguments, ...options].join(' ');
    for (const commandPath of paths) candidates[commandPath] = values;
    for (const commandPath of paths) {
      for (const argument of fixedArguments) {
        candidates[`${commandPath}:${argument}`] = '';
      }
    }
    for (const option of command.options) {
      if ((option.required || option.optional) && option.long) {
        valueOptions.add(option.long);
      }
    }
    for (const child of command.commands) {
      const names = [child.name(), ...child.aliases()];
      visit(
        child,
        paths.flatMap((parent) =>
          names.map((name) => (parent ? `${parent}:${name}` : name)),
        ),
      );
    }
  };

  visit(program, [''], true);
  const rootOptions = optionNames(program.options).filter(
    (option) => option !== '--version',
  );
  return {
    candidates,
    globalOptions: [...rootOptions, '--help', '--version'].join(' '),
    valueOptions: [...valueOptions],
  };
}

function optionNames(options: readonly Option[]): string[] {
  return options.flatMap((option) => (option.long ? [option.long] : []));
}

function bashCompletionScript(model: CompletionModel): string {
  const commandTransitions = Object.keys(model.candidates)
    .filter(Boolean)
    .map((commandPath) => {
      const segments = commandPath.split(':');
      const command = segments.at(-1);
      const parent = segments.slice(0, -1).join(':');
      return `      '${parent}:${command}') command_path='${commandPath}' ;;`;
    })
    .join('\n');
  const candidateCases = Object.entries(model.candidates)
    .map(
      ([commandPath, candidates]) =>
        `    '${commandPath}') candidates='${model.globalOptions} ${candidates}' ;;`,
    )
    .join('\n');

  return `_edgestore() {
  local current="\${COMP_WORDS[COMP_CWORD]}"
  local command_path=''
  local candidates=''
  local skip_value=0
  local word
  local index

  for ((index = 1; index < COMP_CWORD; index++)); do
    word="\${COMP_WORDS[index]}"
    if ((skip_value)); then
      skip_value=0
      continue
    fi
    case "$word" in
      ${model.valueOptions.join('|')})
        skip_value=1
        continue
        ;;
      --*=*|--*) continue ;;
    esac
    case "$command_path:$word" in
${commandTransitions}
    esac
  done

  case "$command_path" in
${candidateCases}
  esac
  COMPREPLY=( $(compgen -W "$candidates" -- "$current") )
}
complete -F _edgestore edgestore`;
}

function zshCompletionScript(model: CompletionModel): string {
  const commandTransitions = Object.keys(model.candidates)
    .filter(Boolean)
    .map((commandPath) => {
      const segments = commandPath.split(':');
      const command = segments.at(-1);
      const parent = segments.slice(0, -1).join(':');
      return `      '${parent}:${command}') command_path='${commandPath}' ;;`;
    })
    .join('\n');
  const candidateCases = Object.entries(model.candidates)
    .map(
      ([commandPath, candidates]) =>
        `    '${commandPath}') candidate_string='${model.globalOptions} ${candidates}' ;;`,
    )
    .join('\n');

  return `#compdef edgestore
_edgestore() {
  local command_path=''
  local candidate_string=''
  local word
  integer skip_value=0
  integer index

  for ((index = 2; index < CURRENT; index++)); do
    word="\${words[index]}"
    if ((skip_value)); then
      skip_value=0
      continue
    fi
    case "$word" in
      ${model.valueOptions.join('|')})
        skip_value=1
        continue
        ;;
      --*=*|--*) continue ;;
    esac
    case "$command_path:$word" in
${commandTransitions}
    esac
  done

  case "$command_path" in
${candidateCases}
  esac
  compadd -- \${(z)candidate_string}
}
compdef _edgestore edgestore`;
}

function fishCompletionScript(model: CompletionModel): string {
  const commandTransitions = Object.keys(model.candidates)
    .filter(Boolean)
    .map((commandPath) => {
      const segments = commandPath.split(':');
      const command = segments.at(-1);
      const parent = segments.slice(0, -1).join(':');
      return `      case '${parent}:${command}'; set command_path '${commandPath}'`;
    })
    .join('\n');
  const completions = Object.entries(model.candidates)
    .map(
      ([commandPath, candidates]) =>
        `complete -c edgestore -n 'test "$(__edgestore_command_path)" = "${commandPath}"' -a '${model.globalOptions} ${candidates}'`,
    )
    .join('\n');

  return `function __edgestore_command_path
  set -l command_path ''
  set -l skip_value 0
  set -l tokens (commandline -opc)
  set -e tokens[1]

  for word in $tokens
    if test $skip_value -eq 1
      set skip_value 0
      continue
    end
    switch $word
      case ${model.valueOptions.join(' ')}
        set skip_value 1
        continue
      case '--*=*' '--*'
        continue
    end
    switch "$command_path:$word"
${commandTransitions}
    end
  end

  echo $command_path
end

${completions}`;
}
