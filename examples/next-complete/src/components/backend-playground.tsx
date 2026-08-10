'use client';

import {
  backendUploadAction,
  inspectSdkAction,
  type BackendUploadInput,
} from '@/lib/actions';
import { categories, type Category } from '@/lib/demo';
import { useState } from 'react';
import { JsonResult } from './json-result';

export function BackendPlayground({ onChange }: { onChange: () => void }) {
  const [client, setClient] = useState<'backend' | 'sdk'>('backend');
  const [source, setSource] = useState<'text' | 'blob' | 'url'>('text');
  const [content, setContent] = useState('EdgeStore backend upload');
  const [category, setCategory] = useState<Category>('tests');
  const [label, setLabel] = useState('server upload');
  const [manualFileName, setManualFileName] = useState('server-example.txt');
  const [replaceTargetUrl, setReplaceTargetUrl] = useState('');
  const [temporary, setTemporary] = useState(false);
  const [transform, setTransform] = useState(false);
  const [result, setResult] = useState<unknown>();
  const [pending, setPending] = useState(false);

  async function upload() {
    setPending(true);
    const input: BackendUploadInput = {
      client,
      source,
      content,
      category,
      label,
      manualFileName,
      replaceTargetUrl,
      temporary,
      transform,
    };
    const response = await backendUploadAction(input);
    setResult(response);
    setPending(false);
    if (response.ok) onChange();
  }

  return (
    <section className="panel" id="backend">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Server only</p>
          <h2>Backend and SDK</h2>
        </div>
        <span className="badge">Explicit authorization</span>
      </div>

      <p className="lede small">
        Compare the router-derived backend client with the low-level SDK. Both
        paths report upload phases; the backend client also applies router
        input, validation, path, metadata, and transforms.
      </p>

      <div className="form-grid">
        <label>
          Client
          <select
            value={client}
            onChange={(event) =>
              setClient(event.target.value as 'backend' | 'sdk')
            }
          >
            <option value="backend">Router backend client</option>
            <option value="sdk">Low-level SDK</option>
          </select>
        </label>
        <label>
          Source
          <select
            value={source}
            onChange={(event) =>
              setSource(event.target.value as 'text' | 'blob' | 'url')
            }
          >
            <option value="text">String</option>
            <option value="blob">Blob</option>
            <option value="url">Remote URL</option>
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
            onChange={(event) => setLabel(event.target.value)}
          />
        </label>
        <label>
          Manual filename
          <input
            value={manualFileName}
            onChange={(event) => setManualFileName(event.target.value)}
          />
        </label>
        <label className="wide">
          Replace target URL
          <input
            value={replaceTargetUrl}
            onChange={(event) => setReplaceTargetUrl(event.target.value)}
          />
        </label>
        <label className="wide">
          {source === 'url' ? 'Public source URL' : 'Content'}
          <textarea
            rows={4}
            value={content}
            onChange={(event) => setContent(event.target.value)}
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
            disabled={client === 'sdk' || source === 'url'}
            onChange={(event) => setTransform(event.target.checked)}
          />
          Uppercase backend transform
        </label>
      </div>
      <div className="button-row">
        <button type="button" disabled={pending} onClick={() => void upload()}>
          {pending ? 'Uploading…' : 'Run server upload'}
        </button>
        <button
          className="secondary"
          type="button"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            setResult(await inspectSdkAction());
            setPending(false);
          }}
        >
          Inspect SDK health, project, buckets
        </button>
      </div>
      <JsonResult value={result} />
    </section>
  );
}
