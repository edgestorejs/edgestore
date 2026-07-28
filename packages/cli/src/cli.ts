import { Command, CommanderError } from 'commander';
import {
  accountCurrentCommand,
  accountListCommand,
  accountSwitchCommand,
} from './commands/account';
import { loginCommand, logoutCommand, whoamiCommand } from './commands/auth';
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

  return program;
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
