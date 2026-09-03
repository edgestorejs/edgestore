import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, isAbsolute, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const { apiUrl, projectRef } = configuration();
const packageRoot = fileURLToPath(new URL('.', import.meta.url));
const cli = resolveCli(process.env.EDGESTORE_SMOKE_CLI, packageRoot);
const runId = `${Date.now().toString(36)}_${randomBytes(3).toString('hex')}`;
const bucketName = `cli_smoke_${runId}`;
const projectArgs = ['--project', projectRef];
const bucketArgs = ['--bucket', bucketName, ...projectArgs];
const remotePath = `smoke/${runId}.txt`;
const workDir = mkdtempSync(join(tmpdir(), 'edgestore-cli-smoke-'));
const sourcePath = join(workDir, 'source.txt');
const downloadPath = join(workDir, 'download.txt');
const projectKeyPath = join(workDir, 'project-key.env');
const accountTokenPath = join(workDir, 'account-token.env');
const ledger = {
  bucket: undefined,
  projectKeyId: undefined,
  accountTokenId: undefined,
};
const cleanupFailures = [];
let checks = 0;
let failure;
let projectKeySecrets = [];
let accountTokenSecrets = [];

writeFileSync(sourcePath, `EdgeStore CLI smoke ${runId}\n`, { mode: 0o600 });

console.log('EdgeStore CLI development smoke test');
console.log(`CLI: ${cli.display}`);
console.log(`API: ${apiUrl}`);
console.log(`Project: ${projectRef}`);
console.log(`Run: ${runId}`);

try {
  smoke();
} catch (error) {
  failure = error;
} finally {
  cleanupRemoteResources();
  rmSync(workDir, { recursive: true, force: true });
}

if (failure || cleanupFailures.length) {
  if (failure) console.error(`\nSmoke test failed: ${failure.message}`);
  for (const cleanupFailure of cleanupFailures) {
    console.error(`Cleanup failed: ${cleanupFailure}`);
  }
  process.exitCode = 1;
} else {
  console.log(`\nPASS: ${checks} checks completed; cleanup succeeded.`);
}

function smoke() {
  json('Authenticate with the selected environment', ['whoami'], (identity) => {
    assert.ok(identity.actor, 'whoami omitted actor');
    assert.ok(identity.credentialSource, 'whoami omitted credentialSource');
  });

  const shown = json(
    'Read the pre-provisioned project',
    ['project', 'show', projectRef],
    (value) => {
      assert.equal(value.project?.basePath, projectRef);
      assert.ok(value.project.accountId, 'project omitted accountId');
    },
  );
  const accountId = shown.project.accountId;

  json('Read the project account context', ['account', 'list'], (accounts) => {
    assert.ok(
      accounts.accounts?.some((account) => account.id === accountId),
      'project account was not available to the credential',
    );
  });

  json(
    'Create one protected file bucket',
    [
      'bucket',
      'create',
      bucketName,
      '--type',
      'file',
      '--protected',
      ...projectArgs,
    ],
    (value) => {
      assert.equal(value.bucket?.name, bucketName);
      assert.equal(value.bucket?.visibility, 'protected');
    },
    { onSuccess: () => (ledger.bucket = bucketName) },
  );

  const uploaded = json(
    'Upload one file to an exact destination',
    ['file', 'upload', sourcePath, ...bucketArgs, '--path', remotePath],
    (value) =>
      assert.ok(value.uploads?.[0]?.file?.id, 'upload omitted file ID'),
  );
  const fileId = uploaded.uploads[0].file.id;

  json(
    'List the uploaded file',
    ['file', 'list', ...bucketArgs, '--all'],
    (listed) =>
      assert.ok(
        listed.files?.some((file) => file.id === fileId),
        'uploaded file was absent from listing',
      ),
  );
  json(
    'Look up the uploaded file by bucket path',
    ['file', 'info', remotePath, ...bucketArgs],
    (lookedUp) => assert.equal(lookedUp.file?.id, fileId),
  );
  command(
    'Download the protected file',
    ['file', 'download', remotePath, ...bucketArgs, '--output', downloadPath],
    () =>
      assert.deepEqual(readFileSync(downloadPath), readFileSync(sourcePath)),
  );

  expectJsonError(
    'Require confirmation for non-interactive bucket deletion',
    ['bucket', 'delete', bucketName, ...projectArgs],
    2,
    'confirmation_required',
  );
  expectJsonError(
    'Refuse deletion while the protected bucket is non-empty',
    ['bucket', 'delete', bucketName, ...projectArgs, '--yes'],
    1,
    'bucket_not_empty',
  );

  plain(
    'Create a project key with file-only delivery',
    [
      'project',
      'key',
      'create',
      projectRef,
      '--name',
      `cli-smoke-${runId}`,
      '--output',
      projectKeyPath,
    ],
    (id, result) => {
      assert.ok(id, 'project key ID was empty');
      const values = assertSecretFile(projectKeyPath, [
        'EDGE_STORE_ACCESS_KEY',
        'EDGE_STORE_SECRET_KEY',
      ]);
      projectKeySecrets = [values.EDGE_STORE_SECRET_KEY];
      assert.ok(!result.stdout.includes('EDGE_STORE_SECRET_KEY='));
    },
    { onValue: (id) => (ledger.projectKeyId = id) },
  );
  json(
    'List project-key metadata without secrets',
    ['project', 'key', 'list', projectRef],
    (projectKeys) => {
      const key = projectKeys.keys?.find(
        (item) => item.id === ledger.projectKeyId,
      );
      assert.ok(key, 'created project key was absent from listing');
      assert.ok(!('secretKey' in key));
      assertNoSecretValues(projectKeys, projectKeySecrets);
    },
  );
  plain(
    'Revoke the temporary project key',
    ['project', 'key', 'revoke', projectRef, ledger.projectKeyId, '--yes'],
    (id) => assert.equal(id, ledger.projectKeyId),
  );
  ledger.projectKeyId = undefined;

  plain(
    'Create an account token with file-only delivery',
    [
      'token',
      'create',
      '--name',
      `cli-smoke-${runId}`,
      '--account',
      accountId,
      '--preset',
      'read-only',
      '--output',
      accountTokenPath,
    ],
    (id, result) => {
      assert.ok(id, 'account token ID was empty');
      const values = assertSecretFile(accountTokenPath, ['EDGESTORE_TOKEN']);
      accountTokenSecrets = [values.EDGESTORE_TOKEN];
      assert.ok(!result.stdout.includes('EDGESTORE_TOKEN='));
    },
    { onValue: (id) => (ledger.accountTokenId = id) },
  );
  json(
    'List account-token metadata without secrets',
    ['token', 'list', '--account', accountId],
    (accountTokens) => {
      const token = accountTokens.tokens?.find(
        (item) => item.id === ledger.accountTokenId,
      );
      assert.ok(token, 'created account token was absent from listing');
      assert.ok(!('secret' in token));
      assertNoSecretValues(accountTokens, accountTokenSecrets);
    },
  );
  plain(
    'Revoke the temporary account token',
    ['token', 'revoke', ledger.accountTokenId, '--yes'],
    (id) => assert.equal(id, ledger.accountTokenId),
  );
  ledger.accountTokenId = undefined;

  json(
    'Empty the protected bucket and wait for completion',
    ['bucket', 'empty', bucketName, ...projectArgs, '--wait', '--yes'],
    (emptied) => assert.equal(emptied.job?.status, 'SUCCEEDED'),
    { timeout: 240_000 },
  );
  plain(
    'Delete the empty test bucket',
    ['bucket', 'delete', bucketName, ...projectArgs, '--yes'],
    (deleted) => assert.equal(deleted, bucketName),
  );
  ledger.bucket = undefined;
}

function json(label, args, validate, options = {}) {
  const result = invoke(label, ['--json', ...args], options);
  let value;
  try {
    value = JSON.parse(result.stdout);
  } catch {
    throw new Error(`${label} returned invalid JSON.`);
  }
  validate(value, result);
  pass(label);
  return value;
}

function plain(label, args, validate, options = {}) {
  const result = invoke(label, ['--plain', ...args], options);
  const value = result.stdout.trim();
  options.onValue?.(value);
  validate(value, result);
  pass(label);
  return value;
}

function command(label, args, validate = () => undefined, options = {}) {
  const result = invoke(label, args, options);
  validate(result);
  pass(label);
  return result;
}

function expectJsonError(label, args, expectedStatus, expectedCode) {
  const result = invoke(label, ['--json', ...args], { expectedStatus });
  let value;
  try {
    value = JSON.parse(result.stderr);
  } catch {
    throw new Error(`${label} returned an invalid JSON error.`);
  }
  assert.equal(value.error?.code, expectedCode);
  pass(label);
}

function invoke(label, args, options = {}) {
  const result = spawnCli(args, options.timeout);
  const status = result.status ?? (result.error ? 127 : 1);
  const expectedStatus = options.expectedStatus ?? 0;
  if (status !== expectedStatus) {
    const detail = redact(
      result.stderr || result.stdout || result.error?.message || '',
    ).trim();
    throw new Error(
      `${label} exited ${status}; expected ${expectedStatus}.${detail ? `\n${detail}` : ''}`,
    );
  }
  options.onSuccess?.(result);
  return result;
}

function spawnCli(args, timeout = 120_000) {
  return spawnSync(
    cli.command,
    [
      ...cli.prefix,
      '--api-url',
      apiUrl,
      '--no-color',
      '--no-progress',
      ...args,
    ],
    {
      cwd: workDir,
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1' },
      timeout,
    },
  );
}

function pass(label) {
  checks += 1;
  console.log(`PASS ${String(checks).padStart(2, '0')}: ${label}`);
}

function assertSecretFile(path, names) {
  const contents = readFileSync(path, 'utf8');
  const values = {};
  for (const name of names) {
    const line = contents
      .split(/\r?\n/)
      .find((candidate) => candidate.startsWith(`${name}=`));
    assert.ok(line, `${path} omitted ${name}`);
    values[name] = line.slice(name.length + 1);
  }
  if (process.platform !== 'win32') {
    assert.equal(
      statSync(path).mode & 0o777,
      0o600,
      `${path} was not mode 0600`,
    );
  }
  return values;
}

function assertNoSecretValues(value, secrets) {
  const serialized = JSON.stringify(value);
  for (const secret of secrets) {
    assert.ok(
      secret && !serialized.includes(secret),
      'listing exposed a secret',
    );
  }
}

function cleanupRemoteResources() {
  if (ledger.accountTokenId) {
    cleanup('revoke account token', [
      '--plain',
      'token',
      'revoke',
      ledger.accountTokenId,
      '--yes',
    ]);
  }
  if (ledger.projectKeyId) {
    cleanup('revoke project key', [
      '--plain',
      'project',
      'key',
      'revoke',
      projectRef,
      ledger.projectKeyId,
      '--yes',
    ]);
  }
  if (ledger.bucket) {
    cleanup(
      'empty bucket',
      [
        '--json',
        'bucket',
        'empty',
        ledger.bucket,
        ...projectArgs,
        '--wait',
        '--yes',
      ],
      240_000,
    );
    cleanup('delete bucket', [
      '--plain',
      'bucket',
      'delete',
      ledger.bucket,
      ...projectArgs,
      '--yes',
    ]);
  }
}

function cleanup(label, args, timeout = 120_000) {
  const result = spawnCli(args, timeout);
  if (result.status !== 0) {
    cleanupFailures.push(
      `${label} exited ${result.status}: ${redact(result.stderr || result.stdout).trim()}`,
    );
  } else {
    console.log(`CLEANUP: ${label}`);
  }
}

function configuration() {
  if (process.env.EDGESTORE_SMOKE_ALLOW_MUTATIONS !== '1') {
    configurationError(
      'Set EDGESTORE_SMOKE_ALLOW_MUTATIONS=1 to acknowledge remote mutations.',
    );
  }
  const configuredApiUrl = process.env.EDGESTORE_SMOKE_API_URL?.trim();
  const configuredProject = process.env.EDGESTORE_SMOKE_PROJECT?.trim();
  if (!configuredApiUrl)
    configurationError('EDGESTORE_SMOKE_API_URL is required.');
  if (!configuredProject)
    configurationError('EDGESTORE_SMOKE_PROJECT is required.');
  if (!/^[a-z0-9]+$/.test(configuredProject)) {
    configurationError('EDGESTORE_SMOKE_PROJECT must be a project base path.');
  }
  return {
    apiUrl: developmentApiUrl(configuredApiUrl),
    projectRef: configuredProject,
  };
}

function developmentApiUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    configurationError('EDGESTORE_SMOKE_API_URL must be a valid URL.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    configurationError('EDGESTORE_SMOKE_API_URL must use HTTP or HTTPS.');
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  const developmentHost =
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === 'localhost' ||
    hostname.includes('dev') ||
    hostname.includes('staging') ||
    hostname.includes('preview') ||
    hostname.endsWith('.test');
  if (!developmentHost || hostname === 'api.edgestore.dev') {
    configurationError(
      `Refusing to run mutations against non-development API host ${hostname}.`,
    );
  }
  return value;
}

function configurationError(message) {
  console.error(`Configuration error: ${message}`);
  process.exit(2);
}

function resolveCli(configured, root) {
  if (!configured?.trim()) {
    const entry = join(root, 'dist', 'bin.mjs');
    return {
      command: process.execPath,
      prefix: [entry],
      display: `${basename(process.execPath)} ${entry}`,
    };
  }
  const value = configured.trim();
  const pathLike =
    isAbsolute(value) || value.includes('/') || value.includes(sep);
  const command = pathLike ? resolve(value) : value;
  if (command.endsWith('.js') || command.endsWith('.mjs')) {
    return {
      command: process.execPath,
      prefix: [command],
      display: `${basename(process.execPath)} ${command}`,
    };
  }
  return { command, prefix: [], display: command };
}

function redact(value) {
  return String(value)
    .replace(/es_(?:usr|acc)_[A-Za-z0-9_-]+/g, 'es_[REDACTED]')
    .replace(/(EDGE_STORE_SECRET_KEY=)[^\s]+/g, '$1[REDACTED]')
    .replace(/(EDGESTORE_TOKEN=)[^\s]+/g, '$1[REDACTED]')
    .replace(/([?&](?:X-Amz-Signature|Signature)=)[^&\s]+/gi, '$1[REDACTED]');
}
