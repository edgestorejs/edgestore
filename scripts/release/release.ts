import { execFileSync } from 'node:child_process';
import { appendFile } from 'node:fs/promises';
import path from 'node:path';
import {
  formatInspection,
  inspectRelease,
  parseReleaseOptions,
  type PackageVersion,
  type ReleaseInspection,
} from './releaseLanes';

type RegistryPackage = {
  'dist-tags'?: Record<string, string>;
  versions?: Record<string, unknown>;
};

const REGISTRY_RETRIES = 6;
const REGISTRY_RETRY_DELAY_MS = 5_000;

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function readRegistryPackage(
  name: string,
): Promise<RegistryPackage | undefined> {
  const response = await fetch(
    `https://registry.npmjs.org/${encodeURIComponent(name)}`,
  );
  if (response.status === 404) return undefined;
  if (!response.ok) {
    throw new Error(
      `npm registry returned ${response.status} for package "${name}".`,
    );
  }
  return (await response.json()) as RegistryPackage;
}

async function readRegistryPackages(
  packages: PackageVersion[],
): Promise<Map<string, RegistryPackage | undefined>> {
  const entries = await Promise.all(
    packages.map(async (pkg) => {
      const registryPackage = await readRegistryPackage(pkg.name);
      return [pkg.name, registryPackage] as const;
    }),
  );
  return new Map(entries);
}

async function allVersionsAlreadyPublished(
  packages: PackageVersion[],
): Promise<boolean> {
  const published = await Promise.all(
    packages.map(async (pkg) => {
      const registryPackage = await readRegistryPackage(pkg.name);
      return Object.hasOwn(registryPackage?.versions ?? {}, pkg.version);
    }),
  );
  return published.every(Boolean);
}

async function verifyTags({
  inspection,
  latestBefore,
  newPackages,
}: {
  inspection: ReleaseInspection;
  latestBefore?: Map<string, string | undefined>;
  newPackages: Set<string>;
}): Promise<void> {
  let lastErrors: string[] = [];

  for (let attempt = 1; attempt <= REGISTRY_RETRIES; attempt += 1) {
    const registryPackages = await readRegistryPackages(inspection.packages);
    lastErrors = [];

    for (const pkg of inspection.packages) {
      const registryPackage = registryPackages.get(pkg.name);
      const tags = registryPackage?.['dist-tags'] ?? {};
      const acceptedFirstPublish =
        newPackages.has(pkg.name) &&
        Object.hasOwn(registryPackage?.versions ?? {}, pkg.version) &&
        tags.latest === pkg.version;
      if (tags[inspection.tag] !== pkg.version && !acceptedFirstPublish) {
        lastErrors.push(
          `${pkg.name}@${inspection.tag} is ${tags[inspection.tag] ?? 'missing'}, expected ${pkg.version}`,
        );
      }
      if (
        latestBefore?.has(pkg.name) &&
        tags.latest !== latestBefore.get(pkg.name)
      ) {
        lastErrors.push(
          `${pkg.name}@latest moved from ${latestBefore.get(pkg.name) ?? 'missing'} to ${tags.latest ?? 'missing'}`,
        );
      }
    }

    if (lastErrors.length === 0) return;
    if (attempt < REGISTRY_RETRIES) {
      await wait(REGISTRY_RETRY_DELAY_MS);
    }
  }

  throw new Error(
    `npm dist-tag verification failed:\n${lastErrors
      .map((error) => `- ${error}`)
      .join('\n')}`,
  );
}

async function writeSummary(inspection: ReleaseInspection): Promise<void> {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;

  const lines = [
    `## ${inspection.lane} release`,
    '',
    `Published to npm tag \`${inspection.tag}\`:`,
    '',
    ...inspection.packages.map((pkg) => `- \`${pkg.name}@${pkg.version}\``),
    '',
  ];
  await appendFile(summaryPath, lines.join('\n'), 'utf8');
}

function run(command: string, args: string[], repoRoot: string): void {
  execFileSync(command, args, {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit',
  });
}

function runAndCapture(
  command: string,
  args: string[],
  repoRoot: string,
): string {
  const output = execFileSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    env: process.env,
    stdio: ['inherit', 'pipe', 'inherit'],
  });
  process.stdout.write(output);
  return output;
}

async function main() {
  const repoRoot = path.resolve(__dirname, '../..');
  const options = parseReleaseOptions(process.argv.slice(2));
  const inspection = await inspectRelease(repoRoot, {
    ...options,
    requireExplicitTag: true,
  });
  console.log(formatInspection(inspection));

  if (!inspection.publishable) {
    if (!(await allVersionsAlreadyPublished(inspection.packages))) {
      throw new Error(
        'The next branch has stable package versions that are not all published. Refusing to continue.',
      );
    }
    console.log(
      'The next branch is in prerelease mode but has no prerelease version yet; nothing will be published.',
    );
    return;
  }

  const registryBefore = await readRegistryPackages(inspection.packages);
  const newPackages = new Set(
    inspection.packages
      .filter((pkg) => registryBefore.get(pkg.name) === undefined)
      .map((pkg) => pkg.name),
  );

  let latestBefore: Map<string, string | undefined> | undefined;
  if (inspection.lane === 'maintenance') {
    latestBefore = new Map(
      inspection.packages.flatMap((pkg) => {
        const registryPackage = registryBefore.get(pkg.name);
        return registryPackage
          ? [[pkg.name, registryPackage['dist-tags']?.latest] as const]
          : [];
      }),
    );
  }

  run('pnpm', ['build'], repoRoot);

  const publishArgs = ['exec', 'changeset', 'publish', '--tag', inspection.tag];
  if (inspection.noGitTag) publishArgs.push('--no-git-tag');
  const publishOutput = runAndCapture('pnpm', publishArgs, repoRoot);

  await verifyTags({ inspection, latestBefore, newPackages });
  if (publishOutput.includes('New tag:')) {
    await writeSummary(inspection);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
