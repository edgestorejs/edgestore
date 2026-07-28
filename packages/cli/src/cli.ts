import { Command, CommanderError } from 'commander';
import {
  accountCurrentCommand,
  accountListCommand,
  accountSwitchCommand,
} from './commands/account';
import { loginCommand, logoutCommand, whoamiCommand } from './commands/auth';
import {
  bucketCreateCommand,
  bucketDeleteCommand,
  bucketListCommand,
  bucketShowCommand,
} from './commands/bucket';
import { doctorCommand } from './commands/doctor';
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
import { normalizeError } from './core/errors';
import { outputFor, type CliRuntime, type GlobalFlags } from './core/runtime';

export async function runCli(
  argv: string[],
  runtime: CliRuntime,
  version: string,
): Promise<number> {
  const program = createProgram(runtime, version);

  if (argv.length === 0) {
    program.outputHelp();
    return 0;
  }

  try {
    await program.parseAsync(argv, { from: 'user' });
    return runtime.signal.aborted ? 130 : runtime.exitCode;
  } catch (error) {
    if (error instanceof CommanderError) {
      return error.code === 'commander.helpDisplayed' ||
        error.code === 'commander.version'
        ? 0
        : 2;
    }

    const normalized = normalizeError(error);
    safeOutput(runtime, program).error(normalized);
    return runtime.signal.aborted ? 130 : normalized.exitCode;
  }
}

function createProgram(runtime: CliRuntime, version: string): Command {
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
      writeOut: (value) => runtime.io.stdout.write(value),
      writeErr: (value) => runtime.io.stderr.write(value),
    });

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
      await doctorCommand(runtime, globalFlags(program));
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
