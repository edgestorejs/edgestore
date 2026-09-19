import { lstat, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { usageError } from '../errors';
import type { AgentClient } from './clients';
import { digest, readOptional, validatePath, type FileChange } from './files';
import type { AgentOptions } from './options';

const bundleSchema = z.object({
  schemaVersion: z.literal(1),
  revision: z.string(),
  files: z.record(z.string(), z.string()),
});
export type SkillBundle = z.infer<typeof bundleSchema>;
const stateSchema = z.object({
  schemaVersion: z.literal(1),
  clients: z.record(
    z.string(),
    z.object({
      location: z.string(),
      revision: z.string(),
      hashes: z.record(z.string(), z.string()),
    }),
  ),
});
export const SKILL_NAME = 'edgestore-setup';

export async function loadSkillBundle(file: string): Promise<SkillBundle> {
  try {
    const bundle = bundleSchema.parse(JSON.parse(await readFile(file, 'utf8')));
    if (
      digest(JSON.stringify(bundle.files)) !== bundle.revision ||
      !bundle.files[`${SKILL_NAME}/SKILL.md`]
    )
      throw new Error();
    for (const name of Object.keys(bundle.files)) validateAssetName(name);
    return bundle;
  } catch {
    throw usageError(
      'invalid_skill_bundle',
      'The CLI skill bundle is missing or invalid. Reinstall a complete CLI artifact.',
    );
  }
}

export function skillDirectory(client: AgentClient, root: string): string {
  return path.join(
    root,
    client === 'codex'
      ? '.agents'
      : client === 'claude'
        ? '.claude'
        : '.cursor',
    'skills',
  );
}

export async function planSkills(
  options: AgentOptions,
  bundle: SkillBundle,
  action: 'setup' | 'update' | 'status',
) {
  const root = options.global ? options.home : options.project;
  const directory = skillDirectory(options.client, root);
  const stateRoot = options.global ? options.stateRoot : options.project;
  const stateFile = path.join(
    stateRoot,
    options.global ? 'skill-assets.json' : '.edgestore/skill-assets.json',
  );
  const stateBefore = await readOptional(stateFile, stateRoot);
  let state: z.infer<typeof stateSchema>;
  try {
    state = stateSchema.parse(
      stateBefore === undefined
        ? { schemaVersion: 1, clients: {} }
        : JSON.parse(stateBefore),
    );
    for (const entry of Object.values(state.clients))
      for (const name of Object.keys(entry.hashes)) validateAssetName(name);
  } catch {
    throw usageError(
      'invalid_skill_state',
      'Skill ownership metadata is invalid; inspect it before continuing.',
    );
  }
  const location = options.global ? directory : path.relative(root, directory);
  const owned = state.clients[options.client];
  const names = new Set([
    ...Object.keys(bundle.files),
    ...Object.keys(owned?.hashes ?? {}),
  ]);
  const current: Record<string, string | undefined> = {};
  for (const name of names)
    current[name] = await readOptional(path.join(directory, name), root);
  const existingFiles = await installedFiles(
    path.join(directory, SKILL_NAME),
    root,
  );
  const untracked = existingFiles.filter((name) => !owned?.hashes[name]);
  const modified =
    owned &&
    (owned.location !== location ||
      Object.entries(owned.hashes).some(
        ([name, hash]) =>
          current[name] === undefined || digest(current[name]) !== hash,
      ));
  const otherSources = await visibleSkills(options, directory);
  let status = existingFiles.length ? 'unmanaged' : 'not-installed';
  if (!existingFiles.length && otherSources.length) status = 'other-source';
  if (owned)
    status =
      owned.revision === bundle.revision ? 'current' : 'update-available';
  if (owned && (modified || untracked.length)) status = 'modified';
  const changes: FileChange[] = [];
  const needsWrite =
    status === 'not-installed' ||
    (status === 'update-available' && action === 'update');
  if (action !== 'status' && (status === 'modified' || status === 'unmanaged'))
    throw usageError(
      'skill_conflict',
      'The skill contains user-owned or modified files. They were preserved; review them before installation or update.',
    );
  if (action !== 'status' && needsWrite) {
    for (const name of names) {
      const after = bundle.files[name];
      if (current[name] !== after)
        changes.push({
          file: path.join(directory, name),
          root,
          before: current[name],
          after,
        });
    }
    state.clients[options.client] = {
      location,
      revision: bundle.revision,
      hashes: Object.fromEntries(
        Object.entries(bundle.files).map(([name, text]) => [
          name,
          digest(text),
        ]),
      ),
    };
    changes.push({
      file: stateFile,
      root: stateRoot,
      before: stateBefore,
      after: `${JSON.stringify(state, null, 2)}\n`,
    });
  }
  return {
    result: {
      status,
      directory: path.join(directory, SKILL_NAME),
      installedRevision: owned?.revision,
      bundledRevision: bundle.revision,
      otherSources,
      discovery: 'visible-files-only',
    },
    changes,
  };
}

function validateAssetName(name: string) {
  if (
    !name.startsWith(`${SKILL_NAME}/`) ||
    name.split('/').some((part) => part === '..' || part === '.' || !part) ||
    name.includes('\\') ||
    path.isAbsolute(name)
  )
    throw new Error('Invalid skill asset path');
}

async function installedFiles(
  directory: string,
  root: string,
): Promise<string[]> {
  const base = path.dirname(directory);
  const files: string[] = [];
  let visited = 0;
  async function visit(directory: string): Promise<void> {
    await validatePath(directory, root);
    if (path.relative(base, directory).split(path.sep).length > 8)
      throw usageError(
        'skill_conflict',
        'Skill directory is too deeply nested to inspect safely.',
      );
    const entries = await readdir(directory, { withFileTypes: true }).catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return [];
        throw usageError(
          'skill_conflict',
          'The skill directory could not be inspected safely.',
        );
      },
    );
    for (const entry of entries) {
      if (++visited > 200)
        throw usageError(
          'skill_conflict',
          'Skill directory is too large to inspect safely.',
        );
      if (entry.isSymbolicLink())
        throw usageError(
          'skill_conflict',
          'A skill entry is symlinked; it was preserved.',
        );
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(file);
      else files.push(path.relative(base, file).replaceAll(path.sep, '/'));
    }
  }
  await visit(directory);
  return files;
}

async function visibleSkills(
  options: AgentOptions,
  target: string,
): Promise<string[]> {
  const candidates = [skillDirectory(options.client, options.home)];
  if (options.client === 'cursor')
    candidates.push(
      path.join(options.project, '.agents/skills'),
      path.join(options.home, '.agents/skills'),
    );
  const visible: string[] = [];
  for (const directory of new Set(candidates)) {
    if (directory === target) continue;
    const file = path.join(directory, SKILL_NAME, 'SKILL.md');
    // Presence only: do not follow another installer's symlink or read its content.
    if (
      await lstat(file).then(
        () => true,
        () => false,
      )
    )
      visible.push(file);
  }
  return visible;
}
