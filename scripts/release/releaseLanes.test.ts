import { describe, expect, it } from 'vitest';
import {
  validateRelease,
  type PackageVersion,
  type PreState,
  type ReleaseLane,
} from './releaseLanes';

const stablePackages: PackageVersion[] = [
  { name: '@edgestore/react', version: '2.0.0' },
  { name: '@edgestore/server', version: '2.0.0' },
  { name: '@edgestore/shared', version: '2.0.0' },
];

function request({
  branch,
  lane,
  noGitTag = false,
  packages = stablePackages,
  preState,
  requireExplicitTag,
  tag,
}: {
  branch: string;
  lane?: ReleaseLane;
  noGitTag?: boolean;
  packages?: PackageVersion[];
  preState?: PreState;
  requireExplicitTag?: boolean;
  tag?: string;
}) {
  return validateRelease({
    branch,
    lane,
    noGitTag,
    packages,
    preState,
    requireExplicitTag,
    tag,
  });
}

describe('release lane guards', () => {
  it('allows stable versions from main under latest', () => {
    expect(request({ branch: 'main' })).toMatchObject({
      lane: 'stable',
      publishable: true,
      tag: 'latest',
      version: '2.0.0',
    });
  });

  it('rejects prerelease versions from main', () => {
    expect(() =>
      request({
        branch: 'main',
        packages: stablePackages.map((pkg) => ({
          ...pkg,
          version: '2.0.0-next.0',
        })),
      }),
    ).toThrow('Stable releases require a stable version');
  });

  it('allows next prereleases only with matching prerelease state and tag', () => {
    expect(
      request({
        branch: 'next',
        packages: stablePackages.map((pkg) => ({
          ...pkg,
          version: '2.0.0-next.3',
        })),
        preState: { mode: 'pre', tag: 'next' },
      }),
    ).toMatchObject({
      lane: 'next',
      publishable: true,
      tag: 'next',
    });
  });

  it('treats an uninitialized or newly entered next cycle as a safe no-op', () => {
    expect(request({ branch: 'next' })).toMatchObject({
      lane: 'next',
      publishable: false,
    });

    expect(
      request({
        branch: 'next',
        preState: { mode: 'pre', tag: 'next' },
      }),
    ).toMatchObject({
      lane: 'next',
      publishable: false,
    });
  });

  it('rejects next when prerelease state is absent or wrong', () => {
    expect(() =>
      request({
        branch: 'next',
        packages: stablePackages.map((pkg) => ({
          ...pkg,
          version: '2.0.0-next.0',
        })),
      }),
    ).toThrow('must remain in Changesets prerelease mode');

    expect(() =>
      request({
        branch: 'next',
        packages: stablePackages.map((pkg) => ({
          ...pkg,
          version: '2.0.0-next.0',
        })),
        preState: { mode: 'pre', tag: 'beta' },
      }),
    ).toThrow('must remain in Changesets prerelease mode');
  });

  it('rejects a mismatched next npm tag', () => {
    expect(() =>
      request({
        branch: 'next',
        packages: stablePackages.map((pkg) => ({
          ...pkg,
          version: '2.0.0-next.0',
        })),
        preState: { mode: 'pre', tag: 'next' },
        tag: 'latest',
      }),
    ).toThrow('require npm tag "next"');
  });

  it('allows matching maintenance branches, majors, and tags', () => {
    expect(
      request({
        branch: '2.x',
        tag: 'v2',
      }),
    ).toMatchObject({
      lane: 'maintenance',
      tag: 'v2',
    });
  });

  it('rejects maintenance versions or tags that do not match the branch', () => {
    expect(() =>
      request({
        branch: '2.x',
        requireExplicitTag: true,
      }),
    ).toThrow('require an explicit npm tag');

    expect(() =>
      request({
        branch: '1.x',
        tag: 'v1',
      }),
    ).toThrow('cannot publish version "2.0.0"');

    expect(() =>
      request({
        branch: '2.x',
        tag: 'latest',
      }),
    ).toThrow('require npm tag "v2"');
  });

  it('allows snapshot canaries from PR branches without Git tags', () => {
    expect(
      request({
        branch: 'feat/new-upload',
        lane: 'canary',
        noGitTag: true,
        packages: stablePackages.map((pkg) => ({
          ...pkg,
          version: '0.0.0-canary-20260729123456',
        })),
        tag: 'canary',
      }),
    ).toMatchObject({
      lane: 'canary',
      tag: 'canary',
    });
  });

  it('rejects canaries on release branches, with Git tags, or wrong versions', () => {
    expect(() =>
      request({
        branch: 'feat/new-upload',
        lane: 'canary',
        noGitTag: true,
        packages: stablePackages.map((pkg) => ({
          ...pkg,
          version: '0.0.0-canary-20260729123456',
        })),
        requireExplicitTag: true,
      }),
    ).toThrow('require an explicit npm tag');

    expect(() =>
      request({
        branch: 'main',
        lane: 'canary',
        noGitTag: true,
        packages: stablePackages.map((pkg) => ({
          ...pkg,
          version: '0.0.0-canary-20260729123456',
        })),
        tag: 'canary',
      }),
    ).toThrow('must run from a PR branch');

    expect(() =>
      request({
        branch: 'feat/new-upload',
        lane: 'canary',
        packages: stablePackages.map((pkg) => ({
          ...pkg,
          version: '0.0.0-canary-20260729123456',
        })),
        tag: 'canary',
      }),
    ).toThrow('must pass --no-git-tag');

    expect(() =>
      request({
        branch: 'feat/new-upload',
        lane: 'canary',
        noGitTag: true,
        tag: 'canary',
      }),
    ).toThrow('require a 0.0.0-canary');
  });

  it('rejects divergent public package versions in every lane', () => {
    expect(() =>
      request({
        branch: 'main',
        packages: [
          ...stablePackages.slice(0, 2),
          { name: '@edgestore/shared', version: '2.0.1' },
        ],
      }),
    ).toThrow('must share one version');
  });
});
