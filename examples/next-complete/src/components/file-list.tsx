'use client';

import {
  createSignedUrl,
  listFiles,
  restoreFile,
  softDeleteFile,
} from '@/lib/actions';
import { useEdgeStore } from '@/lib/edgestore';
import type { BucketName } from '@/lib/edgestore-server';
import { formatFileSize } from '@edgestore/react/utils';
import { useEffect, useState } from 'react';
import { Button, OutcomeLine, Row, Step, unwrap, useScenario } from './ui';

const buckets: BucketName[] = ['publicFiles', 'publicImages', 'privateImages'];

type ListResult = Extract<
  Awaited<ReturnType<typeof listFiles>>,
  { ok: true }
>['data'];
type FileItem = ListResult['items'][number];
type Page = Omit<ListResult, 'items'> & { items: FileItem[] };

export function FileListStep({ version }: { version: number }) {
  const { edgestore } = useEdgeStore();
  const { running, outcome, run } = useScenario();
  const [bucket, setBucket] = useState<BucketName>('publicFiles');
  const [onlyMine, setOnlyMine] = useState(false);
  const [page, setPage] = useState<Page>();
  const [deletedIds, setDeletedIds] = useState<string[]>([]);

  async function load(cursor?: string) {
    const next = unwrap(await listFiles({ bucket, onlyMine, cursor }));
    setPage((current) =>
      cursor && current
        ? { ...next, items: [...current.items, ...next.items] }
        : next,
    );
  }

  useEffect(() => {
    // Reload whenever the filters change or another step uploads a file.
    void run(async () => {
      await load();
      setDeletedIds([]);
      return { ok: true, text: 'Loaded with the backend client.' };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucket, onlyMine, version]);

  const actions = {
    deleteInBrowser: (file: FileItem) =>
      run(async () => {
        await edgestore[bucket].delete({ url: file.url });
        await load();
        return { ok: true, text: `Deleted ${file.name} from the browser.` };
      }),
    softDelete: (file: FileItem) =>
      run(async () => {
        unwrap(await softDeleteFile({ bucket, id: file.id }));
        setDeletedIds((ids) => [...ids, file.id]);
        return { ok: true, text: `Deleted ${file.name}. You can restore it.` };
      }),
    restore: (file: FileItem) =>
      run(async () => {
        unwrap(await restoreFile({ bucket, id: file.id }));
        setDeletedIds((ids) => ids.filter((id) => id !== file.id));
        return { ok: true, text: `Restored ${file.name}.` };
      }),
    signUrl: (file: FileItem) =>
      run(async () => {
        const { signedUrl } = unwrap(await createSignedUrl(file.id));
        return {
          ok: true,
          text: 'Anyone can open this link for 60 seconds.',
          url: signedUrl,
        };
      }),
  };

  return (
    <Step
      number={7}
      title="Browse and manage files"
      description={
        <>
          The list comes from the backend client, which ignores access control.
          Deleting in the browser runs <code>beforeDelete</code>, so only the
          owner succeeds. Server deletes are soft deletes and can be restored.
        </>
      }
    >
      <Row>
        {buckets.map((name) => (
          <Button
            key={name}
            variant={name === bucket ? 'primary' : 'secondary'}
            onClick={() => setBucket(name)}
          >
            {name}
          </Button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={onlyMine}
            onChange={(event) => setOnlyMine(event.target.checked)}
          />
          Only my files
        </label>
      </Row>

      <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {page?.items.length === 0 ? (
          <li className="p-3 text-sm text-zinc-500">No files yet.</li>
        ) : null}
        {page?.items.map((file) => {
          const deleted = deletedIds.includes(file.id);
          return (
            <li
              key={file.id}
              className={`flex flex-wrap items-center gap-3 p-3 text-sm ${deleted ? 'opacity-50' : ''}`}
            >
              {file.thumbnailUrl || bucket !== 'publicFiles' ? (
                <Preview src={file.thumbnailUrl ?? file.url} />
              ) : null}
              <div className="min-w-0 flex-1">
                <a
                  className="block truncate font-medium underline"
                  href={file.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {file.name}
                </a>
                <span className="text-zinc-500">
                  {file.path.owner} · {formatFileSize(file.sizeBytes)}
                  {file.temporary ? ' · temporary' : ''}
                </span>
              </div>
              <Row>
                {deleted ? (
                  <Button
                    variant="secondary"
                    disabled={running}
                    onClick={() => void actions.restore(file)}
                  >
                    Restore
                  </Button>
                ) : (
                  <>
                    {bucket === 'privateImages' ? (
                      <Button
                        variant="secondary"
                        disabled={running}
                        onClick={() => void actions.signUrl(file)}
                      >
                        Signed URL
                      </Button>
                    ) : null}
                    <Button
                      variant="secondary"
                      disabled={running}
                      onClick={() => void actions.deleteInBrowser(file)}
                    >
                      Delete in browser
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={running}
                      onClick={() => void actions.softDelete(file)}
                    >
                      Delete on server
                    </Button>
                  </>
                )}
              </Row>
            </li>
          );
        })}
      </ul>

      {page?.hasMore ? (
        <Button
          variant="secondary"
          disabled={running}
          onClick={() =>
            void run(async () => {
              await load(page.nextCursor ?? undefined);
              return { ok: true, text: 'Loaded the next page.' };
            })
          }
        >
          Load more
        </Button>
      ) : null}
      <OutcomeLine outcome={outcome} />
    </Step>
  );
}

/** Protected images fail to load for anyone except their owner. */
function Preview({ src }: { src: string }) {
  const [blocked, setBlocked] = useState(false);

  if (blocked) {
    return (
      <span className="flex size-12 items-center justify-center rounded bg-red-50 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
        Blocked
      </span>
    );
  }
  return (
    // next/image does not forward the access cookie, so use a plain <img>.
    <img
      src={src}
      alt=""
      className="size-12 rounded object-cover"
      onError={() => setBlocked(true)}
    />
  );
}
