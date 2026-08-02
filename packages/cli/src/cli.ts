import { Command, CommanderError } from 'commander';
import {
  accountBillingCommand,
  accountCurrentCommand,
  accountLeaveCommand,
  accountListCommand,
  accountSwitchCommand,
  accountUsageCommand,
} from './commands/account';
import { loginCommand, logoutCommand, whoamiCommand } from './commands/auth';
import {
  bucketCreateCommand,
  bucketDeleteCommand,
  bucketEmptyCommand,
  bucketEmptyStatusCommand,
  bucketListCommand,
  bucketShowCommand,
} from './commands/bucket';
import { completionCommand } from './commands/completion';
import { doctorCommand } from './commands/doctor';
import {
  fileDeleteCommand,
  fileDownloadCommand,
  fileInfoCommand,
  fileListCommand,
} from './commands/file';
import { initCommand } from './commands/init';
import {
  invitationActionCommand,
  invitationListCommand,
  memberInviteCommand,
  memberListCommand,
  memberRemoveCommand,
  memberRoleCommand,
} from './commands/member';
import { openCommand } from './commands/open';
import {
  projectCreateCommand,
  projectCurrentCommand,
  projectDeleteCommand,
  projectLinkCommand,
  projectListCommand,
  projectShowCommand,
  projectUnlinkCommand,
} from './commands/project';
import {
  projectKeyCreateCommand,
  projectKeyListCommand,
  projectKeyRevokeCommand,
  projectKeyRotateCommand,
} from './commands/projectKey';
import {
  tokenCreateCommand,
  tokenListCommand,
  tokenRevokeCommand,
} from './commands/token';
import {
  fileUploadCancelCommand,
  fileUploadCommand,
  fileUploadStatusCommand,
} from './commands/upload';
import { CliError, normalizeError } from './core/errors';
import { outputFor, type CliRuntime, type GlobalFlags } from './core/runtime';

export async function runCli(
  argv: string[],
  runtime: CliRuntime,
  version: string,
): Promise<number> {
  const commanderOutput = new CommanderOutput(runtime);
  const program = createProgram(runtime, version, commanderOutput);

  if (argv.length === 0) {
    program.outputHelp();
    commanderOutput.flush();
    return 0;
  }

  try {
    await program.parseAsync(argv, { from: 'user' });
    commanderOutput.flush();
    return runtime.signal.aborted ? 130 : runtime.exitCode;
  } catch (error) {
    if (error instanceof CommanderError) {
      if (
        error.code === 'commander.helpDisplayed' ||
        error.code === 'commander.version'
      ) {
        commanderOutput.flush();
        return 0;
      }

      if (requestsJson(argv)) {
        outputFor(runtime, {
          color: false,
          progress: false,
          json: true,
        }).error(
          new CliError(
            'invalid_cli_syntax',
            error.message.replace(/^error: /, ''),
            {
              details: { commanderCode: error.code },
              exitCode: 2,
            },
          ),
        );
      } else {
        commanderOutput.flush();
      }
      return 2;
    }

    const normalized = normalizeError(error);
    safeOutput(runtime, program).error(normalized);
    return runtime.signal.aborted ? 130 : normalized.exitCode;
  }
}

function createProgram(
  runtime: CliRuntime,
  version: string,
  commanderOutput: CommanderOutput,
): Command {
  const program = new Command()
    .name('edgestore')
    .description('Manage EdgeStore accounts and projects')
    .version(version)
    .option('--json', 'emit structured JSON')
    .option('--plain', 'emit a single plain-text value')
    .option('--api-url <url>', 'override the EdgeStore API URL')
    .option('--no-color', 'disable color output')
    .option('--no-progress', 'disable progress output')
    .showHelpAfterError()
    .exitOverride()
    .configureOutput({
      writeOut: (value) => commanderOutput.writeOut(value),
      writeErr: (value) => commanderOutput.writeErr(value),
    })
    .addHelpText(
      'after',
      `
Common workflows:
  edgestore login --token
  edgestore init
  edgestore project list
  edgestore file upload ./logo.png --bucket publicImages
  edgestore project key rotate x36t1ejdlz key_123 --output .env.local --update
`,
    );

  program.hook('preAction', () => {
    outputFor(runtime, globalFlags(program));
  });

  program
    .command('login')
    .description('Log in with a management credential')
    .option('--token', 'read and securely store a management token')
    .action(async (options: { token?: boolean }) => {
      await loginCommand(runtime, globalFlags(program), options);
    });

  program
    .command('logout')
    .description('Remove the stored login')
    .action(async () => {
      await logoutCommand(runtime, globalFlags(program));
    });

  program
    .command('whoami')
    .description('Show the current identity and context')
    .action(async () => {
      await whoamiCommand(runtime, globalFlags(program));
    });

  program
    .command('doctor')
    .description('Check local configuration and API connectivity')
    .action(async () => {
      await doctorCommand(runtime, globalFlags(program), version);
    });

  program
    .command('init')
    .description('Configure EdgeStore for the current project')
    .option('--new', 'create a new project')
    .option('--link <project>', 'link an existing project')
    .option('--name <name>', 'new project name')
    .option('--account <account-id>', 'override the active account')
    .option('--create-key', 'create a new local project key')
    .option('--without-key', 'do not create a project key')
    .option('--output <file>', 'write project keys to an env file')
    .option('--update', 'replace existing values in the output file')
    .option('--bucket <bucket>', 'create a bucket')
    .option('--bucket-type <type>', 'bucket type: file or image')
    .option('--public', 'make the new bucket public')
    .option('--protected', 'make the new bucket protected')
    .option('--install', 'install detected EdgeStore packages')
    .option('--allow-overage', 'allow billable project overage')
    .addHelpText(
      'after',
      `
Examples:
  edgestore init --new --name "Marketing Site" --output .env.local
  edgestore init --link x36t1ejdlz
  edgestore init --link x36t1ejdlz --create-key --output .env.local
`,
    )
    .action(async (options) => {
      await initCommand(runtime, globalFlags(program), options);
    });

  program
    .command('open [target] [project]')
    .description('Open the EdgeStore dashboard')
    .addHelpText(
      'after',
      `
Targets:
  account
  billing
  project [basePath]
  keys [basePath]
`,
    )
    .action(async (target?: string, project?: string) => {
      await openCommand(runtime, globalFlags(program), { target, project });
    });

  program
    .command('completion <shell>')
    .description('Print shell completion for bash, zsh, or fish')
    .action(async (shell: string) => {
      await completionCommand(runtime, globalFlags(program), shell);
    });

  const account = program
    .command('account')
    .description('Manage account context');

  account
    .command('list')
    .alias('ls')
    .description('List accessible accounts')
    .action(async () => {
      await accountListCommand(runtime, globalFlags(program));
    });

  account
    .command('usage')
    .description('Show account usage and limits')
    .action(async () => {
      await accountUsageCommand(runtime, globalFlags(program));
    });

  account
    .command('billing')
    .description('Show billing plan and limits')
    .action(async () => {
      await accountBillingCommand(runtime, globalFlags(program));
    });

  account
    .command('leave')
    .description('Leave the active team account')
    .option('--yes', 'skip interactive confirmation')
    .action(async (options) => {
      await accountLeaveCommand(runtime, globalFlags(program), options);
    });

  account
    .command('current')
    .description('Show the active account')
    .action(async () => {
      await accountCurrentCommand(runtime, globalFlags(program));
    });

  account
    .command('switch <account-id>')
    .alias('use')
    .description('Set the active account')
    .action(async (accountId: string) => {
      await accountSwitchCommand(runtime, globalFlags(program), accountId);
    });

  const project = program
    .command('project')
    .description('Inspect and link projects');

  const member = program.command('member').description('Manage team members');

  member
    .command('list')
    .alias('ls')
    .description('List team members')
    .option('--page <number>', 'page number', parsePositiveInteger)
    .option('--limit <number>', 'page size', parsePositiveInteger)
    .option('--all', 'fetch every page')
    .action(async (options) => {
      await memberListCommand(runtime, globalFlags(program), options);
    });

  member
    .command('invite <email...>')
    .description('Invite one or more team members')
    .option('--role <role>', 'owner, member, or viewer', 'member')
    .option('--allow-overage', 'allow billable member overage')
    .option('--yes', 'skip owner-role confirmation')
    .action(async (emails: string[], options) => {
      await memberInviteCommand(runtime, globalFlags(program), {
        emails,
        ...options,
      });
    });

  member
    .command('role <user-id> <role>')
    .description('Change a team member role')
    .option('--yes', 'skip owner-role confirmation')
    .action(async (userId: string, role: string, options) => {
      await memberRoleCommand(runtime, globalFlags(program), {
        userId,
        role,
        ...options,
      });
    });

  member
    .command('remove <user-id>')
    .description('Remove a team member')
    .option('--yes', 'skip interactive confirmation')
    .action(async (userId: string, options) => {
      await memberRemoveCommand(runtime, globalFlags(program), {
        userId,
        ...options,
      });
    });

  const invitation = member
    .command('invitation')
    .description('Manage pending invitations');

  invitation
    .command('list')
    .alias('ls')
    .description('List pending invitations')
    .option('--page <number>', 'page number', parsePositiveInteger)
    .option('--limit <number>', 'page size', parsePositiveInteger)
    .option('--all', 'fetch every page')
    .action(async (options) => {
      await invitationListCommand(runtime, globalFlags(program), options);
    });

  invitation
    .command('revoke <invite-id>')
    .description('Revoke a pending invitation')
    .option('--yes', 'skip interactive confirmation')
    .action(async (invitationId: string, options) => {
      await invitationActionCommand(runtime, globalFlags(program), {
        invitationId,
        action: 'revoke',
        ...options,
      });
    });

  invitation
    .command('resend <invite-id>')
    .description('Resend a pending invitation')
    .action(async (invitationId: string) => {
      await invitationActionCommand(runtime, globalFlags(program), {
        invitationId,
        action: 'resend',
      });
    });

  project
    .command('list')
    .alias('ls')
    .description('List projects in an account')
    .option('--account <account-id>', 'override the active account')
    .action(async (options: { account?: string }) => {
      await projectListCommand(runtime, globalFlags(program), options);
    });

  project
    .command('current')
    .description('Show the locally linked project')
    .action(async () => {
      await projectCurrentCommand(runtime, globalFlags(program));
    });

  project
    .command('show [project]')
    .description('Show a project by base path or ID')
    .action(async (projectRef?: string) => {
      await projectShowCommand(runtime, globalFlags(program), projectRef);
    });

  project
    .command('create')
    .description('Create a project')
    .requiredOption('--name <name>', 'project name')
    .option('--account <account-id>', 'override the active account')
    .option('--without-key', 'create the project without an initial key')
    .option('--allow-overage', 'allow billable project overage')
    .action(
      async (options: {
        name: string;
        account?: string;
        withoutKey?: boolean;
        allowOverage?: boolean;
      }) => {
        await projectCreateCommand(runtime, globalFlags(program), options);
      },
    );

  project
    .command('delete <project>')
    .alias('rm')
    .description('Delete a project')
    .option('--yes', 'skip interactive confirmation')
    .action(async (projectRef: string, options: { yes?: boolean }) => {
      await projectDeleteCommand(runtime, globalFlags(program), {
        project: projectRef,
        ...options,
      });
    });

  project
    .command('link <project>')
    .description('Link this repository to a project base path or ID')
    .action(async (projectRef: string) => {
      await projectLinkCommand(runtime, globalFlags(program), projectRef);
    });

  project
    .command('unlink')
    .description('Remove the local project link')
    .action(async () => {
      await projectUnlinkCommand(runtime, globalFlags(program));
    });

  const projectKey = project.command('key').description('Manage project keys');

  projectKey
    .command('list <project>')
    .alias('ls')
    .description('List project key metadata')
    .action(async (projectRef: string) => {
      await projectKeyListCommand(runtime, globalFlags(program), projectRef);
    });

  projectKey
    .command('create <project>')
    .description('Create a named project key')
    .requiredOption('--name <name>', 'key name')
    .option('--copy', 'copy the key pair to the clipboard')
    .option('--output <file>', 'write the key pair to an env file')
    .option('--update', 'replace existing key values in the output file')
    .addHelpText(
      'after',
      `
The secret is shown only once.

Examples:
  edgestore project key create x36t1ejdlz --name production
  edgestore project key create x36t1ejdlz --name ci --copy
  edgestore project key create x36t1ejdlz --name local --output .env.local
`,
    )
    .action(async (projectRef: string, options) => {
      await projectKeyCreateCommand(runtime, globalFlags(program), {
        project: projectRef,
        ...options,
      });
    });

  projectKey
    .command('revoke <project> <key-id>')
    .description('Revoke a project key')
    .option('--yes', 'skip interactive confirmation')
    .action(async (projectRef: string, keyId: string, options) => {
      await projectKeyRevokeCommand(runtime, globalFlags(program), {
        project: projectRef,
        keyId,
        ...options,
      });
    });

  projectKey
    .command('rotate <project> <key-id>')
    .description('Create a replacement key and revoke the old key')
    .requiredOption('--name <name>', 'replacement key name')
    .option('--copy', 'copy the replacement key pair to the clipboard')
    .option('--output <file>', 'write the replacement key pair to an env file')
    .option('--update', 'replace existing key values in the output file')
    .option('--yes', 'confirm non-interactive rotation')
    .action(async (projectRef: string, keyId: string, options) => {
      await projectKeyRotateCommand(runtime, globalFlags(program), {
        project: projectRef,
        keyId,
        ...options,
      });
    });

  const token = program
    .command('token')
    .description('Manage account and user management tokens');

  token
    .command('list')
    .alias('ls')
    .description('List management token metadata')
    .option('--user', 'list user-owned tokens')
    .option('--account <account-id>', 'override the active account')
    .option('--page <number>', 'page number', parsePositiveInteger)
    .option('--limit <number>', 'page size', parsePositiveInteger)
    .option('--all', 'fetch every page')
    .action(async (options) => {
      await tokenListCommand(runtime, globalFlags(program), options);
    });

  token
    .command('create')
    .description('Create a management token')
    .requiredOption('--name <name>', 'token name')
    .option('--user', 'create a user-owned token')
    .option('--account <account-id>', 'override the active account')
    .option(
      '--preset <preset>',
      'permission preset: deploy, read-only, or full-access',
    )
    .option('--scope <scope>', 'explicit permission scope', collectValue, [])
    .option('--expires-at <timestamp>', 'ISO 8601 expiration timestamp')
    .option('--copy', 'copy the token to the clipboard')
    .option('--output <file>', 'write the token to an env file')
    .option('--update', 'replace an existing token in the output file')
    .action(async (options) => {
      await tokenCreateCommand(runtime, globalFlags(program), options);
    });

  token
    .command('revoke <token-id>')
    .description('Revoke a management token')
    .option('--yes', 'skip interactive confirmation')
    .action(async (tokenId: string, options) => {
      await tokenRevokeCommand(runtime, globalFlags(program), {
        tokenId,
        ...options,
      });
    });

  const bucket = program
    .command('bucket')
    .description('Manage project buckets');

  bucket
    .command('list')
    .alias('ls')
    .description('List buckets in a project')
    .option('--project <project>', 'override the linked project')
    .action(async (options: { project?: string }) => {
      await bucketListCommand(runtime, globalFlags(program), options.project);
    });

  const file = program.command('file').description('Manage project files');

  file
    .command('list')
    .alias('ls')
    .description('List files in one bucket')
    .requiredOption('--bucket <bucket>', 'bucket name')
    .option('--project <project>', 'override the linked project')
    .option('--limit <number>', 'page size', parsePositiveInteger)
    .option('--cursor <cursor>', 'opaque continuation cursor')
    .option('--all', 'fetch every page')
    .action(async (options) => {
      await fileListCommand(runtime, globalFlags(program), options);
    });

  file
    .command('info <file>')
    .description('Show file metadata')
    .option('--project <project>', 'override the linked project')
    .option('--bucket <bucket>', 'treat the file argument as a bucket path')
    .action(async (reference: string, options) => {
      await fileInfoCommand(runtime, globalFlags(program), {
        reference,
        ...options,
      });
    });

  file
    .command('download <file>')
    .description('Download a file')
    .requiredOption('--output <path>', 'local output path')
    .option('--project <project>', 'override the linked project')
    .option('--bucket <bucket>', 'treat the file argument as a bucket path')
    .action(async (reference: string, options) => {
      await fileDownloadCommand(runtime, globalFlags(program), {
        reference,
        ...options,
      });
    });

  file
    .command('delete <file...>')
    .alias('rm')
    .description('Delete one or more files')
    .option('--project <project>', 'override the linked project')
    .option('--bucket <bucket>', 'treat file arguments as bucket paths')
    .option('--yes', 'skip interactive confirmation')
    .action(async (references: string[], options) => {
      await fileDeleteCommand(runtime, globalFlags(program), {
        references,
        ...options,
      });
    });

  file
    .command('upload <path...>')
    .description('Upload one or more local files')
    .requiredOption('--bucket <bucket>', 'existing bucket name')
    .option('--project <project>', 'override the linked project')
    .option('--path <path>', 'destination path or prefix')
    .option('--keep-name', 'preserve original file names')
    .action(async (paths: string[], options) => {
      await fileUploadCommand(runtime, globalFlags(program), {
        paths,
        ...options,
      });
    });

  file
    .command('upload-status <upload-id>')
    .description('Show upload processing status')
    .option('--project <project>', 'override the linked project')
    .action(async (uploadId: string, options) => {
      await fileUploadStatusCommand(runtime, globalFlags(program), {
        uploadId,
        ...options,
      });
    });

  file
    .command('upload-cancel <upload-id>')
    .description('Cancel an incomplete upload')
    .option('--project <project>', 'override the linked project')
    .option('--yes', 'skip interactive confirmation')
    .action(async (uploadId: string, options) => {
      await fileUploadCancelCommand(runtime, globalFlags(program), {
        uploadId,
        ...options,
      });
    });

  bucket
    .command('show <bucket>')
    .description('Show bucket details')
    .option('--project <project>', 'override the linked project')
    .action(async (bucketName: string, options: { project?: string }) => {
      await bucketShowCommand(runtime, globalFlags(program), {
        bucket: bucketName,
        ...options,
      });
    });

  bucket
    .command('create <bucket>')
    .description('Create a bucket')
    .requiredOption('--type <type>', 'bucket type: file or image')
    .option('--project <project>', 'override the linked project')
    .option('--public', 'allow public reads')
    .option('--protected', 'require signed reads')
    .action(async (bucketName: string, options) => {
      await bucketCreateCommand(runtime, globalFlags(program), {
        bucket: bucketName,
        ...options,
      });
    });

  bucket
    .command('delete <bucket>')
    .alias('rm')
    .description('Delete an empty bucket')
    .option('--project <project>', 'override the linked project')
    .option('--yes', 'skip interactive confirmation')
    .action(async (bucketName: string, options) => {
      await bucketDeleteCommand(runtime, globalFlags(program), {
        bucket: bucketName,
        ...options,
      });
    });

  bucket
    .command('empty <bucket>')
    .description('Asynchronously delete every file in a bucket')
    .option('--project <project>', 'override the linked project')
    .option('--retry <job-id>', 'retry the latest failed job')
    .option('--wait', 'wait for the job to finish')
    .option('--yes', 'skip interactive confirmation')
    .action(async (bucketName: string, options) => {
      await bucketEmptyCommand(runtime, globalFlags(program), {
        bucket: bucketName,
        ...options,
      });
    });

  bucket
    .command('empty-status <bucket>')
    .description('Show empty-bucket job status')
    .option('--project <project>', 'override the linked project')
    .option('--job <job-id>', 'inspect a specific job')
    .action(async (bucketName: string, options) => {
      await bucketEmptyStatusCommand(runtime, globalFlags(program), {
        bucket: bucketName,
        ...options,
      });
    });

  return program;
}

function collectValue(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function parsePositiveInteger(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new CommanderError(
      2,
      'invalid_number',
      'Expected a positive integer.',
    );
  }
  return parsed;
}

class CommanderOutput {
  private readonly stdout: string[] = [];
  private readonly stderr: string[] = [];

  constructor(private readonly runtime: CliRuntime) {}

  writeOut(value: string): void {
    this.stdout.push(value);
  }

  writeErr(value: string): void {
    this.stderr.push(value);
  }

  flush(): void {
    for (const value of this.stdout.splice(0)) {
      this.runtime.io.stdout.write(value);
    }
    for (const value of this.stderr.splice(0)) {
      this.runtime.io.stderr.write(value);
    }
  }
}

function requestsJson(argv: string[]): boolean {
  const endOfOptions = argv.indexOf('--');
  const options = endOfOptions === -1 ? argv : argv.slice(0, endOfOptions);
  return options.includes('--json');
}

function globalFlags(program: Command): GlobalFlags {
  const options = program.opts<{
    json?: boolean;
    plain?: boolean;
    apiUrl?: string;
    color: boolean;
    progress: boolean;
  }>();

  return {
    json: options.json,
    plain: options.plain,
    apiUrl: options.apiUrl,
    color: options.color,
    progress: options.progress,
  };
}

function safeOutput(runtime: CliRuntime, program: Command) {
  try {
    return outputFor(runtime, globalFlags(program));
  } catch {
    return outputFor(runtime, {
      color: globalFlags(program).color,
      progress: globalFlags(program).progress,
    });
  }
}
