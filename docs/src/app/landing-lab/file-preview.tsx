'use client';

import { ArrowUp, Check, FileText, RotateCcw, X } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';

const files = [
  { name: 'brand-mark.svg', type: 'SVG', size: '2 KB', className: 'brand' },
  {
    name: 'project-brief.pdf',
    type: 'PDF',
    size: '148 KB',
    className: 'brief',
  },
  { name: 'release-notes.txt', type: 'TXT', size: '4 KB', className: 'notes' },
];

export function FilePreview({ gallery = false }: { gallery?: boolean }) {
  const [selected, setSelected] = useState(files.map((file) => file.name));
  const [progress, setProgress] = useState(0);
  const [started, setStarted] = useState(false);
  const complete = progress === 100;
  const running = started && !complete;

  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => {
      setProgress((value) => Math.min(value + 10, 100));
    }, 300);
    return () => window.clearInterval(interval);
  }, [running]);

  function reset() {
    setStarted(false);
    setProgress(0);
  }

  return (
    <div className={`ll-file-preview ${gallery ? 'll-gallery' : 'll-list'}`}>
      <div className="ll-preview-header">
        <span>
          <span className="ll-live-dot" />
          {gallery ? 'A place for every file.' : 'Project files'}
        </span>
        <span>Interactive preview</span>
      </div>
      <div className="ll-file-items">
        {files.map((file) => (
          <label
            key={file.name}
            className={`ll-file ll-file-${file.className}`}
          >
            <input
              type="checkbox"
              aria-label={`Select ${file.name}`}
              checked={selected.includes(file.name)}
              disabled={running || complete}
              onChange={(event) => {
                setProgress(0);
                setSelected(
                  event.target.checked
                    ? [...selected, file.name]
                    : selected.filter((name) => name !== file.name),
                );
              }}
            />
            <span className="ll-check-box" aria-hidden="true">
              <Check size={14} />
            </span>
            <span className="ll-file-art" aria-hidden="true">
              {file.className === 'brand' ? (
                <Image src="/img/logo.svg" width={104} height={104} alt="" />
              ) : file.className === 'brief' ? (
                <span className="ll-document">
                  <span>PROJECT / 2026</span>
                  <strong>
                    Something
                    <br />
                    worth building.
                  </strong>
                  <span className="ll-document-rule" />
                  <span>
                    Design brief
                    <br />
                    Product & engineering
                  </span>
                </span>
              ) : (
                <span className="ll-notes">
                  <span>release-notes.txt</span>
                  <strong>
                    Made to
                    <br />
                    be yours.
                  </strong>
                  <span>
                    + Your interface
                    <br />+ Your upload rules
                    <br />+ Your storage
                  </span>
                </span>
              )}
            </span>
            <span className="ll-file-info">
              <FileText size={19} />
              <span>
                <strong>{file.name}</strong>
                <small>
                  {file.type} · {file.size}
                </small>
              </span>
              {complete && selected.includes(file.name) ? (
                <Check
                  className="ll-file-done"
                  size={18}
                  aria-label="Preview complete"
                />
              ) : null}
            </span>
          </label>
        ))}
      </div>
      <div className="ll-upload-controls">
        <div className="ll-upload-status" role="status">
          {complete
            ? `${selected.length} ${selected.length === 1 ? 'file' : 'files'} ready. Preview complete.`
            : running
              ? `Uploading preview… ${progress}%`
              : `${selected.length} sample files selected`}
        </div>
        {running ? (
          <button className="ll-secondary" onClick={reset}>
            <X size={15} />
            Cancel preview
          </button>
        ) : complete ? (
          <button className="ll-secondary" onClick={reset}>
            <RotateCcw size={15} />
            Reset preview
          </button>
        ) : (
          <button
            className="ll-secondary"
            disabled={selected.length === 0}
            onClick={() => {
              setProgress(0);
              setStarted(true);
            }}
          >
            <ArrowUp size={16} />
            Preview upload
          </button>
        )}
      </div>
      <div
        className="ll-progress"
        role="progressbar"
        aria-label="Simulated upload progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
      >
        <span style={{ transform: `scaleX(${progress / 100})` }} />
      </div>
      <p className="ll-demo-note">Sample files. Nothing is uploaded.</p>
    </div>
  );
}
