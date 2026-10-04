import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '.');
const generatedDirectory = join(packageDirectory, 'src', 'generated');
const options = parseOptions(process.argv.slice(2));
const invocationDirectory = process.env.INIT_CWD ?? process.cwd();
const repositoryDirectory = resolve(invocationDirectory, options.repo);
const commit = runGit(repositoryDirectory, [
  'rev-parse',
  '--verify',
  `${options.ref}^{commit}`,
]).trim();

if (!/^[\da-f]{40}$/u.test(commit)) {
  throw new Error(`Could not resolve "${options.ref}" to a full commit SHA.`);
}

const repository = normalizeRepositoryUrl(
  runGit(repositoryDirectory, ['remote', 'get-url', 'origin']).trim(),
);
const schema = runGit(repositoryDirectory, [
  'show',
  `${commit}:apps/api/openapi/v2.json`,
]);
const parsedSchema = JSON.parse(schema);

if (
  parsedSchema.openapi !== '3.1.1' ||
  parsedSchema.info?.version !== '2.0.0'
) {
  throw new Error('The selected file is not the expected API v2 schema.');
}

const temporaryDirectory = await mkdtemp(
  join(tmpdir(), 'edgestore-sdk-openapi-'),
);

try {
  const temporarySchema = join(temporaryDirectory, 'openapi-v2.json');
  const temporaryTypes = join(temporaryDirectory, 'api-v2.ts');
  const temporarySource = join(temporaryDirectory, 'source.ts');
  await writeFile(temporarySchema, schema);
  execFileSync(
    'pnpm',
    [
      'exec',
      'openapi-typescript',
      temporarySchema,
      '-o',
      temporaryTypes,
      '--export-type',
    ],
    { cwd: packageDirectory, stdio: 'inherit' },
  );

  const checksum = createHash('sha256').update(schema).digest('hex');
  await writeFile(
    temporarySource,
    `export const API_V2_SOURCE_REPOSITORY =\n` +
      `  ${typescriptString(repository)} as const;\n\n` +
      `export const API_V2_SOURCE_COMMIT =\n` +
      `  ${typescriptString(commit)} as const;\n\n` +
      `export const API_V2_SCHEMA_SHA256 =\n` +
      `  ${typescriptString(checksum)} as const;\n`,
  );

  await Promise.all([
    replaceFile(temporarySchema, join(generatedDirectory, 'openapi-v2.json')),
    replaceFile(temporaryTypes, join(generatedDirectory, 'api-v2.ts')),
    replaceFile(temporarySource, join(generatedDirectory, 'source.ts')),
  ]);
} finally {
  await rm(temporaryDirectory, { force: true, recursive: true });
}

function parseOptions(arguments_) {
  const values = new Map();

  for (let index = 0; index < arguments_.length; index += 2) {
    const name = arguments_[index];
    const value = arguments_[index + 1];
    if (!name?.startsWith('--') || !value) {
      throw new Error(usage());
    }
    values.set(name.slice(2), value);
  }

  const repo = values.get('repo');
  const ref = values.get('ref');
  if (!repo || !ref || values.size !== 2) {
    throw new Error(usage());
  }
  return { repo, ref };
}

function usage() {
  return 'Usage: pnpm schema:sync --repo <repository-path> --ref <git-ref>';
}

function runGit(repositoryDirectory, arguments_) {
  return execFileSync('git', ['-C', repositoryDirectory, ...arguments_], {
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });
}

function normalizeRepositoryUrl(url) {
  const sshMatch = /^git@github\.com:(.+?)(?:\.git)?$/u.exec(url);
  if (sshMatch) return `https://github.com/${sshMatch[1]}`;
  return url.replace(/\.git$/u, '');
}

function typescriptString(value) {
  return `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
}

async function replaceFile(source, destination) {
  const contents = await readFile(source);
  const stagedDestination = `${destination}.sync`;
  await writeFile(stagedDestination, contents);
  await rename(stagedDestination, destination);
}
