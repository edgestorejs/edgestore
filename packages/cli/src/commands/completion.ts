import { usageError } from '../core/errors';
import type { CliRuntime, GlobalFlags } from '../core/runtime';
import { outputFor } from '../core/runtime';

const topLevel =
  'login logout whoami doctor init account member project token bucket file open completion';

const globalOptions =
  '--json --plain --api-url --cwd --no-color --no-progress --help --version';

const completionCandidates: Record<string, string> = {
  '': topLevel,
  login: '--token',
  logout: '',
  whoami: '',
  doctor: '',
  init: '--new --link --name --account --create-key --without-key --output --update --bucket --bucket-type --public --protected --install --allow-overage',
  account: 'list ls usage billing current switch use leave',
  'account:list': '',
  'account:ls': '',
  'account:usage': '',
  'account:billing': '',
  'account:current': '',
  'account:switch': '',
  'account:use': '',
  'account:leave': '--yes',
  member: 'list ls invite role remove invitation',
  'member:list': '--page --limit --all',
  'member:ls': '--page --limit --all',
  'member:invite': '--role --allow-overage --yes',
  'member:role': '--yes',
  'member:remove': '--yes',
  'member:invitation': 'list ls revoke resend',
  'member:invitation:list': '--page --limit --all',
  'member:invitation:ls': '--page --limit --all',
  'member:invitation:revoke': '--yes',
  'member:invitation:resend': '',
  project: 'list ls current show create delete rm link unlink key',
  'project:list': '--account',
  'project:ls': '--account',
  'project:current': '',
  'project:show': '',
  'project:create': '--name --account --without-key --allow-overage',
  'project:delete': '--yes',
  'project:rm': '--yes',
  'project:link': '--env-file',
  'project:unlink': '',
  'project:key': 'list ls create rotate revoke',
  'project:key:list': '',
  'project:key:ls': '',
  'project:key:create': '--name --copy --output --update',
  'project:key:rotate': '--name --copy --output --update --yes',
  'project:key:revoke': '--yes',
  token: 'list ls create revoke',
  'token:list': '--user --account --page --limit --all',
  'token:ls': '--user --account --page --limit --all',
  'token:create':
    '--name --user --account --scope --preset --expires-at --copy --output --update',
  'token:revoke': '--yes',
  bucket: 'list ls create show delete rm empty empty-status',
  'bucket:list': '--project',
  'bucket:ls': '--project',
  'bucket:create': '--type --public --protected --project',
  'bucket:show': '--project',
  'bucket:delete': '--project --yes',
  'bucket:rm': '--project --yes',
  'bucket:empty': '--project --retry --wait --yes',
  'bucket:empty-status': '--project --job',
  file: 'list ls info download delete rm upload upload-status upload-cancel',
  'file:list': '--bucket --project --limit --cursor --all',
  'file:ls': '--bucket --project --limit --cursor --all',
  'file:info': '--bucket --project',
  'file:download': '--bucket --project --output',
  'file:delete': '--bucket --project --yes',
  'file:rm': '--bucket --project --yes',
  'file:upload': '--bucket --project --path --keep-name',
  'file:upload-status': '--project',
  'file:upload-cancel': '--project --yes',
  open: 'account billing project',
  'open:account': '',
  'open:billing': '',
  'open:project': '',
  completion: 'bash zsh fish',
  'completion:bash': '',
  'completion:zsh': '',
  'completion:fish': '',
};

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
    return bashCompletionScript();
  }
  if (shell === 'zsh') {
    return zshCompletionScript();
  }
  if (shell === 'fish') {
    return fishCompletionScript();
  }
  throw usageError('unsupported_shell', `Unsupported shell: ${shell}.`, [
    'Choose bash, zsh, or fish.',
  ]);
}

function bashCompletionScript(): string {
  const commandTransitions = Object.keys(completionCandidates)
    .filter(Boolean)
    .map((commandPath) => {
      const segments = commandPath.split(':');
      const command = segments.at(-1);
      const parent = segments.slice(0, -1).join(':');
      return `      '${parent}:${command}') command_path='${commandPath}' ;;`;
    })
    .join('\n');
  const candidateCases = Object.entries(completionCandidates)
    .map(
      ([commandPath, candidates]) =>
        `    '${commandPath}') candidates='${globalOptions} ${candidates}' ;;`,
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
      --api-url|--cwd|--link|--name|--account|--output|--env-file|--bucket|--bucket-type|--page|--limit|--role|--scope|--preset|--expires-at|--type|--retry|--job|--project|--cursor|--path)
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

function zshCompletionScript(): string {
  const commandTransitions = Object.keys(completionCandidates)
    .filter(Boolean)
    .map((commandPath) => {
      const segments = commandPath.split(':');
      const command = segments.at(-1);
      const parent = segments.slice(0, -1).join(':');
      return `      '${parent}:${command}') command_path='${commandPath}' ;;`;
    })
    .join('\n');
  const candidateCases = Object.entries(completionCandidates)
    .map(
      ([commandPath, candidates]) =>
        `    '${commandPath}') candidate_string='${globalOptions} ${candidates}' ;;`,
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
      --api-url|--cwd|--link|--name|--account|--output|--env-file|--bucket|--bucket-type|--page|--limit|--role|--scope|--preset|--expires-at|--type|--retry|--job|--project|--cursor|--path)
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

function fishCompletionScript(): string {
  const commandTransitions = Object.keys(completionCandidates)
    .filter(Boolean)
    .map((commandPath) => {
      const segments = commandPath.split(':');
      const command = segments.at(-1);
      const parent = segments.slice(0, -1).join(':');
      return `      case '${parent}:${command}'; set command_path '${commandPath}'`;
    })
    .join('\n');
  const completions = Object.entries(completionCandidates)
    .map(
      ([commandPath, candidates]) =>
        `complete -c edgestore -n 'test "$(__edgestore_command_path)" = "${commandPath}"' -a '${globalOptions} ${candidates}'`,
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
      case --api-url --cwd --link --name --account --output --env-file --bucket --bucket-type --page --limit --role --scope --preset --expires-at --type --retry --job --project --cursor --path
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
