import { Command, CommanderError } from 'commander';
import {
  accountCurrentCommand,
  accountListCommand,
  accountSwitchCommand,
} from './commands/account';
import { loginCommand, logoutCommand, whoamiCommand } from './commands/auth';
import { doctorCommand } from './commands/doctor';
import {
  projectCurrentCommand,
  projectLinkCommand,
  projectListCommand,
  projectUnlinkCommand,
} from './commands/project';
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
