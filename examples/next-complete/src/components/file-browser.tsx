'use client';

import {
  createSignedUrlAction,
  listFilesAction,
  lookupFileAction,
  mutateFilesAction,
} from '@/lib/actions';
import {
  bucketNames,
  categories,
  type ActionResult,
  type BucketName,
  type FileItem,
  type FilePage,
} from '@/lib/demo';
import { useEdgeStore } from '@/lib/edgestore';
import { formatFileSize } from '@edgestore/react/utils';
import { useCallback, useEffect, useState } from 'react';
import { JsonResult } from './json-result';

type CategoryFilter = '' | 'avatars' | 'posts' | 'tests';

export function FileBrowser({
  initialPage,
  refreshToken,
}: {
  initialPage: ActionResult<FilePage>;
  refreshToken: number;
}) {
  const { edgestore } = useEdgeStore();
  const [bucket, setBucket] = useState<BucketName>('publicFiles');
  const [category, setCategory] = useState<CategoryFilter>('');
  const [owner, setOwner] = useState('');
  const [label, setLabel] = useState('');
  const [uploadedAfter, setUploadedAfter] = useState('');
  const [page, setPage] = useState(
    initialPage.ok ? initialPage.data : undefined,
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [manualIds, setManualIds] = useState('');
  const [result, setResult] = useState<unknown>(
    initialPage.ok ? undefined : initialPage,
  );
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (append = false) => {
      setLoading(true);
      const response = await listFilesAction({
        bucket,
        category: category || undefined,
        owner,
        label,
        uploadedAfter: uploadedAfter
          ? new Date(uploadedAfter).toISOString()
          : undefined,
        cursor: append ? (page?.nextCursor ?? undefined) : undefined,
      });
      if (response.ok) {
        setPage((current) => ({
          ...response.data,
          items: append
            ? [...(current?.items ?? []), ...response.data.items]
            : response.data.items,
        }));
        setSelected([]);
        setResult(undefined);
      } else {
        setResult(response);
      }
      setLoading(false);
    },
    [bucket, category, label, owner, page?.nextCursor, uploadedAfter],
  );

  useEffect(() => {
    if (refreshToken > 0) void load();
  }, [load, refreshToken]);

  async function runClientMutation(operation: 'confirmMany' | 'deleteMany') {
    const urls = (page?.items ?? [])
      .filter((file) => selected.includes(file.id))
      .map((file) => file.url);
    try {
      const response =
        bucket === 'publicFiles'
          ? await edgestore.publicFiles[operation]({ urls })
          : bucket === 'publicImages'
            ? await edgestore.publicImages[operation]({ urls })
            : await edgestore.privateImages[operation]({ urls });
      setResult(response);
      if (operation === 'deleteMany') await load();
    } catch (error) {
      setResult(describeError(error));
    }
  }

  async function runServerMutation(
    operation: 'confirm' | 'delete' | 'restore',
  ) {
    const ids = manualIds
      .split(/[\s,]+/)
      .filter(Boolean)
      .concat(selected)
      .filter((id, index, all) => all.indexOf(id) === index);
    const response = await mutateFilesAction({ bucket, operation, ids });
    setResult(response);
    if (response.ok) await load();
  }

  async function inspect(file: FileItem) {
    setResult(await lookupFileAction({ bucket, id: file.id }));
  }

  return (
    <section className="panel" id="files">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Backend reads + client mutations</p>
          <h2>File browser</h2>
        </div>
        <span className="badge">Cursor pagination</span>
      </div>

      <div className="form-grid filters">
        <label>
          Bucket
          <select
            value={bucket}
            onChange={(event) => {
              setBucket(event.target.value as BucketName);
              setPage(undefined);
            }}
          >
            {bucketNames.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        <label>
          Path: category
          <select
            value={category}
            onChange={(event) =>
              setCategory(event.target.value as CategoryFilter)
            }
          >
            <option value="">Any</option>
            {categories.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        <label>
          Path: owner
          <input
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
          />
        </label>
        <label>
          Metadata: label
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
        </label>
        <label>
          Uploaded after
          <input
            type="datetime-local"
            value={uploadedAfter}
            onChange={(event) => setUploadedAfter(event.target.value)}
          />
        </label>
      </div>
      <div className="button-row">
        <button type="button" disabled={loading} onClick={() => void load()}>
          {loading ? 'Loading…' : 'Apply filters'}
        </button>
        <button
          className="secondary"
          type="button"
          disabled={!page?.hasMore || loading}
          onClick={() => void load(true)}
        >
          Load next page
        </button>
      </div>

      <div className="file-grid">
        {(page?.items ?? []).map((file) => (
          <article className="file-card" key={file.id}>
            {file.thumbnailUrl ? (
              // Protected development URLs need cookies, which next/image does not forward.
              <img src={file.thumbnailUrl} alt="" />
            ) : (
              <div className="file-placeholder">FILE</div>
            )}
            <div className="file-body">
              <label className="select-file">
                <input
                  type="checkbox"
                  checked={selected.includes(file.id)}
                  onChange={(event) =>
                    setSelected((current) =>
                      event.target.checked
                        ? [...current, file.id]
                        : current.filter((id) => id !== file.id),
                    )
                  }
                />
                Select
              </label>
              <strong title={file.name}>{file.name}</strong>
              <small>
                {formatFileSize(file.sizeBytes)} · {file.state}
                {file.temporary ? ' · temporary' : ''}
              </small>
              <small>{Object.values(file.path).join(' / ')}</small>
              <button
                className="quiet"
                type="button"
                onClick={() => void inspect(file)}
              >
                Inspect by ID
              </button>
            </div>
          </article>
        ))}
      </div>

      <div className="button-row">
        <button
          type="button"
          disabled={selected.length === 0}
          onClick={() => void runClientMutation('confirmMany')}
        >
          Client confirm selected
        </button>
        <button
          className="danger"
          type="button"
          disabled={selected.length === 0}
          onClick={() => void runClientMutation('deleteMany')}
        >
          Client delete selected
        </button>
        <button
          className="secondary"
          type="button"
          disabled={bucket !== 'privateImages' || selected.length !== 1}
          onClick={async () => {
            setResult(
              await createSignedUrlAction({ id: selected[0]!, expiresIn: 60 }),
            );
          }}
        >
          Sign private URL (60s)
        </button>
      </div>

      <div className="mutation-box">
        <label>
          File IDs for backend mutation
          <textarea
            rows={2}
            placeholder="Paste deleted IDs here to test restore"
            value={manualIds}
            onChange={(event) => setManualIds(event.target.value)}
          />
        </label>
        <div className="button-row compact">
          <button
            type="button"
            onClick={() => void runServerMutation('confirm')}
          >
            Backend confirm
          </button>
          <button
            className="danger"
            type="button"
            onClick={() => void runServerMutation('delete')}
          >
            Backend delete
          </button>
          <button
            className="secondary"
            type="button"
            onClick={() => void runServerMutation('restore')}
          >
            Backend restore
          </button>
        </div>
      </div>

      <JsonResult value={result} />
    </section>
  );
}

function describeError(error: unknown) {
  return error instanceof Error
    ? { name: error.name, message: error.message }
    : { name: 'UnknownError', message: String(error) };
}
