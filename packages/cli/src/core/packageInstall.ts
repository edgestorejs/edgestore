import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Writable } from 'node:stream';
import { detect } from 'package-manager-detector/detect';
import { renderShellCommand } from './command';
import { findGitRoot } from './config';
import { CliError } from './errors';
import type { CliRuntime } from './runtime';
import { findWorkspaceRoot } from './workspace';

export type PackagePlan = {
  framework: 'next' | 'react' | 'node' | 'unknown';
  manager?: 'pnpm' | 'npm' | 'yarn' | 'bun';
  missing: string[];
  installAtWorkspaceRoot?: boolean;
  workspace?: {
    root: string;
    packageName?: string;
  };
};

export async function detectPackages(
  cwd: string,
  options: { installAtWorkspaceRoot?: boolean } = {},
): Promise<PackagePlan> {
  const resolvedCwd = path.resolve(cwd);
  const workspaceRoot = await findWorkspaceRoot(resolvedCwd);
  const packagePath = path.join(cwd, 'package.json');
  let manifest: {
    name?: string;
    packageManager?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  let contents: string;
  try {
    contents = await readFile(packagePath, 'utf8');
  } catch (error) {
    if (!isMissingPathError(error)) {
      throw new CliError(
        'package_manifest_unreadable',
        `Could not read package manifest at ${packagePath}.`,
        {
          details: {
            path: packagePath,
            cause: error instanceof Error ? error.message : String(error),
          },
        },
      );
    }
    return {
      framework: 'unknown',
      manager: await detectPackageManager(cwd),
      missing: [],
    };
  }
  try {
    manifest = JSON.parse(contents) as typeof manifest;
  } catch (error) {
    throw new CliError(
      'invalid_package_manifest',
      `Invalid package manifest at ${packagePath}.`,
      {
        details: {
          path: packagePath,
          cause: error instanceof Error ? error.message : String(error),
        },
        exitCode: 2,
      },
    );
  }
  const dependencies = {
    ...manifest.dependencies,
    ...manifest.devDependencies,
  };
  const framework = dependencies.next
    ? 'next'
    : dependencies.react
      ? 'react'
      : 'node';
  const wanted =
    framework === 'next' || framework === 'react'
      ? ['@edgestore/server', '@edgestore/react']
      : ['@edgestore/server'];
  return {
    framework,
    manager: await detectPackageManager(cwd),
    missing: wanted.filter((name) => !dependencies[name]),
    installAtWorkspaceRoot: options.installAtWorkspaceRoot,
    ...(workspaceRoot && workspaceRoot !== resolvedCwd
      ? {
          workspace: {
            root: workspaceRoot,
            ...(manifest.name ? { packageName: manifest.name } : {}),
          },
        }
      : {}),
  };
}

export async function installPackages(
  runtime: CliRuntime,
  plan: PackagePlan,
  options: {
    cwd: string;
    invocationCwd: string;
    requested?: boolean;
    interactive: boolean;
    structured: boolean;
    json: boolean;
  },
): Promise<{ command?: string; cwd?: string; ran: boolean }> {
  if (!plan.manager || !plan.missing.length) return { ran: false };
  const args = installArgs(
    plan.manager,
    plan.missing,
    plan.installAtWorkspaceRoot,
  );
  const command = renderInstallCommand(plan.manager, args, {
    plan,
    packageCwd: options.cwd,
    invocationCwd: options.invocationCwd,
  });
  const shouldInstall =
    options.requested ??
    (options.interactive
      ? await runtime.prompts.confirm(
          `Install EdgeStore packages with ${plan.manager}?`,
          true,
        )
      : false);
  if (!shouldInstall) return { command, cwd: options.cwd, ran: false };
  const captured = options.structured ? createOutputCapture() : undefined;
  try {
    await runtime.runCommand(plan.manager, args, {
      cwd: options.cwd,
      ...(captured ? { stdout: captured.stream, stderr: captured.stream } : {}),
    });
  } catch (error) {
    const diagnostics = captured?.read().trim();
    if (diagnostics && !options.json) {
      runtime.io.stderr.write(`${diagnostics}\n`);
    }
    throw new CliError(
      'package_install_failed',
      error instanceof Error ? error.message : 'Package installation failed.',
      {
        ...(diagnostics ? { details: { diagnostics } } : {}),
        suggestions: [command],
      },
    );
  }
  const diagnostics = captured?.read();
  if (diagnostics) {
    runtime.io.stderr.write(
      diagnostics.endsWith('\n') ? diagnostics : `${diagnostics}\n`,
    );
  }
  return { command, cwd: options.cwd, ran: true };
}

export function renderInstallCommand(
  manager: NonNullable<PackagePlan['manager']>,
  args: string[],
  context: {
    plan: PackagePlan;
    packageCwd: string;
    invocationCwd: string;
  },
): string {
  const { plan, packageCwd, invocationCwd } = context;
  const workspace = plan.workspace;
  if (invocationCwd === workspace?.root) {
    const workspacePath = path
      .relative(workspace.root, packageCwd)
      .replaceAll(path.sep, '/');
    if (manager === 'pnpm') {
      return renderShellCommand([
        manager,
        '--filter',
        `./${workspacePath}`,
        ...args,
      ]);
    }
    if (manager === 'npm') {
      return renderShellCommand([
        manager,
        ...args,
        '--workspace',
        workspacePath,
      ]);
    }
    if (manager === 'yarn' && workspace.packageName) {
      return renderShellCommand([
        manager,
        'workspace',
        workspace.packageName,
        ...args,
      ]);
    }
  }

  const relativeCwd = path.relative(invocationCwd, packageCwd) || '.';
  if (relativeCwd === '.') return renderShellCommand([manager, ...args]);
  if (manager === 'npm') {
    return renderShellCommand([manager, '--prefix', relativeCwd, ...args]);
  }
  if (manager === 'pnpm') {
    return renderShellCommand([manager, '--dir', relativeCwd, ...args]);
  }
  return renderShellCommand([manager, '--cwd', relativeCwd, ...args]);
}

export function packageNextSteps(
  framework: PackagePlan['framework'],
): string[] {
  if (framework === 'next') {
    return [
      'Next steps:',
      '  Configure an EdgeStore router in your Next.js app.',
      '  Add the EdgeStore provider to your client layout.',
    ];
  }
  if (framework === 'react') {
    return [
      'Next steps:',
      '  Configure an EdgeStore server endpoint.',
      '  Add the EdgeStore provider to your React app.',
    ];
  }
  return [
    'Next steps:',
    '  Configure an EdgeStore router and server endpoint.',
  ];
}

function createOutputCapture(limit = 32_768): {
  stream: NodeJS.WritableStream;
  read(): string;
} {
  let output = '';
  return {
    stream: new Writable({
      write(chunk, _encoding, callback) {
        output = `${output}${Buffer.from(chunk).toString('utf8')}`.slice(
          -limit,
        );
        callback();
      },
    }),
    read: () => output,
  };
}

function isMissingPathError(error: unknown): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    'code' in error &&
    (error.code === 'ENOENT' || error.code === 'ENOTDIR')
  );
}

async function detectPackageManager(
  cwd: string,
): Promise<'pnpm' | 'npm' | 'yarn' | 'bun'> {
  const start = path.resolve(cwd);
  const boundary =
    (await findWorkspaceRoot(start)) ?? (await findGitRoot(start)) ?? start;
  let directory = start;
  while (true) {
    for (const strategy of [
      'packageManager-field',
      'lockfile',
      'devEngines-field',
    ] as const) {
      const result = await detect({
        cwd: directory,
        stopDir: directory,
        strategies: [strategy],
        packageJsonParser: (contents) =>
          packageJsonForStrategy(contents, strategy),
      });
      if (
        result?.name === 'pnpm' ||
        result?.name === 'npm' ||
        result?.name === 'yarn' ||
        result?.name === 'bun'
      ) {
        return result.name;
      }
    }
    if (directory === boundary) break;
    directory = path.dirname(directory);
  }
  return 'npm';
}

function packageJsonForStrategy(
  contents: string,
  strategy: 'packageManager-field' | 'lockfile' | 'devEngines-field',
): Record<string, unknown> {
  const manifest = JSON.parse(contents) as Record<string, unknown>;
  if (strategy !== 'packageManager-field') delete manifest.packageManager;
  if (strategy !== 'devEngines-field') delete manifest.devEngines;
  return manifest;
}

function installArgs(
  manager: 'pnpm' | 'npm' | 'yarn' | 'bun',
  packages: string[],
  installAtWorkspaceRoot = false,
): string[] {
  if (manager === 'npm') return ['install', ...packages];
  if (manager === 'pnpm' && installAtWorkspaceRoot) {
    return ['add', '-w', ...packages];
  }
  return ['add', ...packages];
}
