'use client';

import {
  bucketNames,
  categories,
  type BucketName,
  type Category,
} from '@/lib/demo';
import { useEdgeStore } from '@/lib/edgestore';
import {
  EdgeStoreApiClientError,
  UploadAbortedError,
} from '@edgestore/react/errors';
import { formatFileSize } from '@edgestore/react/utils';
import { useMemo, useRef, useState } from 'react';
import { JsonResult } from './json-result';

type UploadStatus = 'queued' | 'uploading' | 'complete' | 'error' | 'aborted';

type UploadItem = {
  id: string;
  file: File;
  progress: number;
  status: UploadStatus;
  result?: { url: string } & Record<string, unknown>;
  error?: unknown;
  controller?: AbortController;
};

export function UploadPlayground({ onChange }: { onChange: () => void }) {
  const { edgestore } = useEdgeStore();
  const [bucket, setBucket] = useState<BucketName>('publicFiles');
  const [category, setCategory] = useState<Category>('tests');
  const [label, setLabel] = useState('browser upload');
  const [manualFileName, setManualFileName] = useState('');
  const [replaceTargetUrl, setReplaceTargetUrl] = useState('');
  const [temporary, setTemporary] = useState(false);
  const [transform, setTransform] = useState(false);
  const [rejectUpload, setRejectUpload] = useState(false);
  const [items, setItems] = useState<UploadItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const completedUrls = useMemo(
    () =>
      items
        .map((item) => item.result?.url)
        .filter((url): url is string => Boolean(url)),
    [items],
  );

  function queueFiles(files: File[]) {
    setItems((current) => [
      ...current,
      ...files.map((file) => ({
        id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
        file,
        progress: 0,
        status: 'queued' as const,
      })),
    ]);
  }

  function updateItem(id: string, patch: Partial<UploadItem>) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  async function upload(item: UploadItem) {
    const controller = new AbortController();
    updateItem(item.id, {
      controller,
      error: undefined,
      progress: 0,
      status: 'uploading',
    });

    const input = {
      category,
      label,
      allowUpload: !rejectUpload,
    };
    const options = {
      manualFileName:
        items.length === 1 && manualFileName ? manualFileName : undefined,
      replaceTargetUrl: replaceTargetUrl || undefined,
      temporary,
      transform: transform
        ? async ({ file, extension }: { file: File; extension: string }) => {
            if (!file.type.startsWith('text/')) return { file, extension };
            return {
              file: new Blob([(await file.text()).toUpperCase()], {
                type: file.type,
              }),
              extension,
            };
          }
        : undefined,
    };
    const common = {
      file: item.file,
      input,
      options,
      signal: controller.signal,
      onProgressChange: (progress: number) => updateItem(item.id, { progress }),
    };

    try {
      const result =
        bucket === 'publicFiles'
          ? await edgestore.publicFiles.upload(common)
          : bucket === 'publicImages'
            ? await edgestore.publicImages.upload(common)
            : await edgestore.privateImages.upload(common);
      updateItem(item.id, {
        progress: 100,
        result,
        status: 'complete',
      });
      onChange();
    } catch (error) {
      updateItem(item.id, {
        error: describeClientError(error),
        status: error instanceof UploadAbortedError ? 'aborted' : 'error',
      });
    }
  }

  async function mutateCompleted(operation: 'confirmMany' | 'deleteMany') {
    if (completedUrls.length === 0) return;
    const result =
      bucket === 'publicFiles'
        ? await edgestore.publicFiles[operation]({ urls: completedUrls })
        : bucket === 'publicImages'
          ? await edgestore.publicImages[operation]({ urls: completedUrls })
          : await edgestore.privateImages[operation]({ urls: completedUrls });
    setItems((current) =>
      current.map((item) => ({ ...item, error: { operation, result } })),
    );
    onChange();
  }

  function generateFixture(name: string, size: number, type: string) {
    queueFiles([new File([new Uint8Array(size)], name, { type })]);
  }

  return (
    <section className="panel" id="uploads">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Client</p>
          <h2>Upload playground</h2>
        </div>
        <span className="badge">Concurrency: 2</span>
      </div>

      <div className="form-grid">
        <label>
          Bucket
          <select
            value={bucket}
            onChange={(event) => setBucket(event.target.value as BucketName)}
          >
            {bucketNames.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        <label>
          Category
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as Category)}
          >
            {categories.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        <label>
          Metadata label
          <input
            value={label}
            maxLength={40}
            onChange={(event) => setLabel(event.target.value)}
          />
        </label>
        <label>
          Manual filename
          <input
            placeholder="Only used for one file"
            value={manualFileName}
            onChange={(event) => setManualFileName(event.target.value)}
          />
        </label>
        <label className="wide">
          Replace target URL
          <input
            placeholder="Leave empty for a new upload"
            value={replaceTargetUrl}
            onChange={(event) => setReplaceTargetUrl(event.target.value)}
          />
        </label>
      </div>

      <div className="check-row">
        <label>
          <input
            type="checkbox"
            checked={temporary}
            onChange={(event) => setTemporary(event.target.checked)}
          />
          Temporary upload
        </label>
        <label>
          <input
            type="checkbox"
            checked={transform}
            onChange={(event) => setTransform(event.target.checked)}
          />
          Uppercase text transform
        </label>
        <label>
          <input
            type="checkbox"
            checked={rejectUpload}
            onChange={(event) => setRejectUpload(event.target.checked)}
          />
          Reject in beforeUpload
        </label>
      </div>

      <button
        className="dropzone"
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          queueFiles([...event.dataTransfer.files]);
        }}
      >
        Drop files here or choose files
        <small>Images are limited to 10 MiB; generic files to 512 MiB.</small>
      </button>
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        multiple
        onChange={(event) => queueFiles([...(event.target.files ?? [])])}
      />

      <div className="button-row">
        <button
          type="button"
          onClick={() =>
            void Promise.all(
              items
                .filter((item) =>
                  ['queued', 'error', 'aborted'].includes(item.status),
                )
                .map(upload),
            )
          }
        >
          Upload queued
        </button>
        <button
          className="secondary"
          type="button"
          onClick={() => generateFixture('wrong-type.txt', 16, 'text/plain')}
        >
          Add MIME error fixture
        </button>
        <button
          className="secondary"
          type="button"
          onClick={() =>
            generateFixture('too-large.png', 11 * 1024 * 1024, 'image/png')
          }
        >
          Add 11 MiB fixture
        </button>
        <button
          className="secondary"
          type="button"
          onClick={() =>
            generateFixture(
              'multipart.bin',
              101 * 1024 * 1024,
              'application/octet-stream',
            )
          }
        >
          Add 101 MiB multipart fixture
        </button>
      </div>

      <div className="upload-list">
        {items.map((item) => (
          <article className="upload-item" key={item.id}>
            <div className="upload-title">
              <strong>{item.file.name}</strong>
              <span>{formatFileSize(item.file.size)}</span>
              <span className={`status ${item.status}`}>{item.status}</span>
            </div>
            <progress value={item.progress} max={100} />
            <div className="button-row compact">
              {item.status === 'uploading' ? (
                <button
                  className="danger"
                  type="button"
                  onClick={() => item.controller?.abort()}
                >
                  Cancel
                </button>
              ) : null}
              {['error', 'aborted'].includes(item.status) ? (
                <button type="button" onClick={() => void upload(item)}>
                  Retry
                </button>
              ) : null}
              <button
                className="quiet"
                type="button"
                onClick={() =>
                  setItems((current) =>
                    current.filter((entry) => entry.id !== item.id),
                  )
                }
              >
                Remove
              </button>
            </div>
            <JsonResult value={item.error ?? item.result} />
          </article>
        ))}
      </div>

      {completedUrls.length > 0 ? (
        <div className="button-row">
          <button
            type="button"
            onClick={() => void mutateCompleted('confirmMany')}
          >
            Confirm all results
          </button>
          <button
            className="danger"
            type="button"
            onClick={() => void mutateCompleted('deleteMany')}
          >
            Delete all results
          </button>
          <button className="quiet" type="button" onClick={() => setItems([])}>
            Clear list
          </button>
        </div>
      ) : null}
    </section>
  );
}

function describeClientError(error: unknown) {
  if (error instanceof EdgeStoreApiClientError) {
    return { name: error.name, message: error.message, data: error.data };
  }
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  return { name: 'UnknownError', message: String(error) };
}
