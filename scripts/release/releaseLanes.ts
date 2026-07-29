import { execFileSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const STABLE_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const NEXT_VERSION =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)-next\.(0|[1-9]\d*)$/;
const CANARY_VERSION = /^0\.0\.0-canary-\d{14}$/;
const MAINTENANCE_BRANCH = /^(0|[1-9]\d*)\.x$/;

export type ReleaseLane = 'stable' | 'next' | 'maintenance' | 'canary';

export type PackageVersion = {
  name: string;
  version: string;
};

export type PreState = {
  mode?: string;
  tag?: string;
};

export type ReleaseOptions = {
  branch?: string;
  lane?: ReleaseLane;
  noGitTag: boolean;
  requireExplicitTag?: boolean;
  requirePublishable?: boolean;
  tag?: string;
};

export type ReleaseInspection = {
  branch: string;
  lane: ReleaseLane;
  noGitTag: boolean;
  packages: PackageVersion[];
  publishable: boolean;
  tag: string;
  version: string;
};

export function parseReleaseOptions(args: string[]): ReleaseOptions {
  const options: ReleaseOptions = { noGitTag: false };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--') continue;
    if (arg === '--require-publishable') {
      options.requirePublishable = true;
      continue;
    }
    if (arg === '--require-explicit-tag') {
      options.requireExplicitTag = true;
      continue;
    }
    if (arg === '--no-git-tag') {
      options.noGitTag = true;
      continue;
    }

    if (arg === '--branch' || arg === '--lane' || arg === '--tag') {
      const value = args[index + 1];
      if (!value) {
        throw new Error(`Missing value for ${arg}`);
      }
      index += 1;

      if (arg === '--branch') options.branch = value;
      if (arg === '--tag') options.tag = value;
      if (arg === '--lane') {
        if (!isReleaseLane(value)) {
          throw new Error(`Unknown release lane: ${value}`);
        }
        options.lane = value;
      }
      continue;
    }

    throw new Error(`Unknown release option: ${arg}`);
  }

  return options;
}

function isReleaseLane(value: string): value is ReleaseLane {
  return ['stable', 'next', 'maintenance', 'canary'].includes(value);
}

function inferLane(branch: string, requestedLane?: ReleaseLane): ReleaseLane {
  if (requestedLane) return requestedLane;
  if (branch === 'main') return 'stable';
  if (branch === 'next') return 'next';
  if (MAINTENANCE_BRANCH.test(branch)) return 'maintenance';
  throw new Error(
    `Branch "${branch}" is not a release branch. Canary releases must pass --lane canary.`,
  );
}

function expectedTag(lane: ReleaseLane, branch: string): string {
  if (lane === 'stable') return 'latest';
  if (lane === 'next') return 'next';
  if (lane === 'canary') return 'canary';

  const match = MAINTENANCE_BRANCH.exec(branch);
  if (!match?.[1]) {
    throw new Error(
      `Maintenance releases require a <major>.x branch; received "${branch}".`,
    );
  }
  return `v${match[1]}`;
}

function validateBranch(lane: ReleaseLane, branch: string): void {
  const isMaintenance = MAINTENANCE_BRANCH.test(branch);

  if (lane === 'stable' && branch !== 'main') {
    throw new Error(`Stable releases must run from "main", not "${branch}".`);
  }
  if (lane === 'next' && branch !== 'next') {
    throw new Error(`Next releases must run from "next", not "${branch}".`);
  }
  if (lane === 'maintenance' && !isMaintenance) {
    throw new Error(
      `Maintenance releases require a <major>.x branch, not "${branch}".`,
    );
  }
  if (
    lane === 'canary' &&
    (branch === 'main' || branch === 'next' || isMaintenance)
  ) {
    throw new Error(
      `Canary releases must run from a PR branch, not protected release branch "${branch}".`,
    );
  }
}

function validatePreState(lane: ReleaseLane, preState?: PreState): void {
  if (lane === 'next') {
    if (preState?.mode !== 'pre' || preState.tag !== 'next') {
      throw new Error(
        'The next branch must remain in Changesets prerelease mode with tag "next".',
      );
    }
    return;
  }

  if (lane !== 'canary' && preState) {
    throw new Error(
      `${lane} releases must not have an active Changesets prerelease state.`,
    );
  }
}

function validateVersions(
  lane: ReleaseLane,
  branch: string,
  packages: PackageVersion[],
): { publishable: boolean; version: string } {
  if (packages.length === 0) {
    throw new Error('No public @edgestore/* packages were found.');
  }

  const versions = new Set(packages.map((pkg) => pkg.version));
  if (versions.size !== 1) {
    throw new Error(
      `All public @edgestore/* packages must share one version: ${packages
        .map((pkg) => `${pkg.name}@${pkg.version}`)
        .join(', ')}`,
    );
  }

  const version = packages[0]?.version;
  if (!version) {
    throw new Error('Could not resolve the package version.');
  }

  if (lane === 'stable' && !STABLE_VERSION.test(version)) {
    throw new Error(
      `Stable releases require a stable version, got "${version}".`,
    );
  }

  if (lane === 'next') {
    if (NEXT_VERSION.test(version)) {
      return { publishable: true, version };
    }
    if (STABLE_VERSION.test(version)) {
      return { publishable: false, version };
    }
    throw new Error(
      `Next releases require a stable bootstrap version or an x.y.z-next.N version, got "${version}".`,
    );
  }

  if (lane === 'maintenance') {
    const branchMajor = MAINTENANCE_BRANCH.exec(branch)?.[1];
    const versionMajor = STABLE_VERSION.exec(version)?.[1];
    if (!versionMajor) {
      throw new Error(
        `Maintenance releases require a stable version, got "${version}".`,
      );
    }
    if (versionMajor !== branchMajor) {
      throw new Error(
        `Maintenance branch "${branch}" cannot publish version "${version}".`,
      );
    }
  }

  if (lane === 'canary' && !CANARY_VERSION.test(version)) {
    throw new Error(
      `Canary releases require a 0.0.0-canary-YYYYMMDDHHMMSS snapshot version, got "${version}".`,
    );
  }

  return { publishable: true, version };
}

export function validateRelease({
  branch,
  lane: requestedLane,
  noGitTag,
  packages,
  preState,
  requireExplicitTag,
  tag: requestedTag,
}: ReleaseOptions & {
  branch: string;
  packages: PackageVersion[];
  preState?: PreState;
}): ReleaseInspection {
  const lane = inferLane(branch, requestedLane);
  validateBranch(lane, branch);

  if (
    requireExplicitTag &&
    (lane === 'maintenance' || lane === 'canary') &&
    requestedTag === undefined
  ) {
    throw new Error(`${lane} releases require an explicit npm tag.`);
  }

  const tag = requestedTag ?? expectedTag(lane, branch);
  const requiredTag = expectedTag(lane, branch);
  if (tag !== requiredTag) {
    throw new Error(
      `${lane} releases from "${branch}" require npm tag "${requiredTag}", got "${tag}".`,
    );
  }

  if (lane === 'canary' && !noGitTag) {
    throw new Error('Canary releases must pass --no-git-tag.');
  }
  if (lane !== 'canary' && noGitTag) {
    throw new Error(`Only canary releases may pass --no-git-tag.`);
  }

  validatePreState(lane, preState);
  const { publishable, version } = validateVersions(lane, branch, packages);

  return {
    branch,
    lane,
    noGitTag,
    packages,
    publishable,
    tag,
    version,
  };
}

async function readPreState(repoRoot: string): Promise<PreState | undefined> {
  try {
    const contents = await readFile(
      path.join(repoRoot, '.changeset', 'pre.json'),
      'utf8',
    );
    return JSON.parse(contents) as PreState;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
}

async function readPublishedPackages(
  repoRoot: string,
): Promise<PackageVersion[]> {
  const packagesDir = path.join(repoRoot, 'packages');
  const entries = await readdir(packagesDir, { withFileTypes: true });
  const packages: PackageVersion[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const packagePath = path.join(packagesDir, entry.name, 'package.json');
    try {
      const packageJson = JSON.parse(await readFile(packagePath, 'utf8')) as {
        name?: string;
        private?: boolean;
        version?: string;
      };
      if (
        packageJson.name?.startsWith('@edgestore/') &&
        packageJson.private !== true &&
        packageJson.version
      ) {
        packages.push({
          name: packageJson.name,
          version: packageJson.version,
        });
      }
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        continue;
      }
      throw error;
    }
  }

  return packages.sort((left, right) => left.name.localeCompare(right.name));
}

function currentBranch(repoRoot: string): string {
  return execFileSync('git', ['branch', '--show-current'], {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim();
}

export async function inspectRelease(
  repoRoot: string,
  options: ReleaseOptions,
): Promise<ReleaseInspection> {
  const branch =
    options.branch ??
    process.env.RELEASE_BRANCH ??
    process.env.GITHUB_REF_NAME ??
    currentBranch(repoRoot);

  if (!branch) {
    throw new Error(
      'Could not determine the release branch. Pass --branch or set RELEASE_BRANCH.',
    );
  }

  const configuredTag = options.tag ?? process.env.NPM_TAG;
  const inspection = validateRelease({
    ...options,
    branch,
    packages: await readPublishedPackages(repoRoot),
    preState: await readPreState(repoRoot),
    tag: configuredTag === '' ? undefined : configuredTag,
  });

  if (options.requirePublishable && !inspection.publishable) {
    throw new Error(
      `The ${inspection.lane} branch does not contain a publishable prerelease version.`,
    );
  }

  return inspection;
}

export function formatInspection(inspection: ReleaseInspection): string {
  const packageList = inspection.packages
    .map((pkg) => `${pkg.name}@${pkg.version}`)
    .join(', ');
  const disposition = inspection.publishable
    ? 'publishable'
    : 'safe no-op until a prerelease version exists';

  return [
    `Release lane: ${inspection.lane}`,
    `Branch: ${inspection.branch}`,
    `npm tag: ${inspection.tag}`,
    `Version state: ${disposition}`,
    `Packages: ${packageList}`,
  ].join('\n');
}
