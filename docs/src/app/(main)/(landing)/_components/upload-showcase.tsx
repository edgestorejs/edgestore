'use client';

import {
  CloudUpload,
  CodeXml,
  FileSpreadsheet,
  FileText,
  LockKeyhole,
  Pencil,
  Upload,
  X,
} from 'lucide-react';
import Image from 'next/image';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useDemoUpload, type DemoFile } from './use-demo-upload';

const sampleFiles: DemoFile[] = [
  {
    id: 'mountain',
    name: 'mountains.jpg',
    size: '2.4 MB',
    image: '/img/home/mountains.jpg',
  },
  { id: 'hero', name: 'hero.png', size: '1.1 MB', art: 'wave' },
  {
    id: 'chair',
    name: 'product.jpg',
    size: '3.2 MB',
    image: '/img/home/chair.jpg',
  },
  { id: 'code', name: 'snippet.tsx', size: '12 KB', art: 'code' },
];
const documents = [
  {
    name: 'contract.pdf',
    meta: '245 KB · 2 days ago',
    icon: FileText,
    color: 'coral',
  },
  {
    name: 'financials.xlsx',
    meta: '1.8 MB · 1 week ago',
    icon: FileSpreadsheet,
    color: 'mint',
  },
  {
    name: 'notes.txt',
    meta: '12 KB · 3 days ago',
    icon: FileText,
    color: 'slate',
  },
];

const mobilePreviewQuery = '(max-width: 600px)';

function subscribeToViewport(onChange: () => void) {
  const query = window.matchMedia(mobilePreviewQuery);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function isMobilePreview() {
  return window.matchMedia(mobilePreviewQuery).matches;
}

export function UploadShowcase() {
  const readOnly = useSyncExternalStore(
    subscribeToViewport,
    isMobilePreview,
    () => true,
  );
  const gallery = useDemoUpload(sampleFiles, 4);
  const profile = useDemoUpload(
    [
      {
        id: 'avatar',
        name: 'Profile photo',
        size: '',
        image: '/img/home/avatar.jpg',
      },
    ],
    1,
  );
  const avatar = profile.files[0]!;
  const files = gallery.files;
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const avatarInput = useRef<HTMLInputElement>(null);
  const showcase = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = showcase.current;
    if (!element) return;
    // Scale actual lengths rather than zooming a composited layer. Safari can
    // lose that layer after resizing or scrolling it out of view.
    const resize = (width: number) => {
      element.style.setProperty('--showcase-unit', `${width / 640}px`);
    };
    resize(element.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => {
      if (entry) resize(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={showcase}
      className="ya-showcase"
      role={readOnly ? 'img' : undefined}
      aria-label={
        readOnly
          ? 'Upload component examples: project images, a profile photo, and private documents.'
          : 'Try the upload components'
      }
    >
      <div
        className="ya-showcase-scene"
        inert={readOnly}
        aria-hidden={readOnly}
      >
        <section
          className="ya-project ya-panel"
          aria-labelledby="ya-project-title"
        >
          <div className="ya-window-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <div className="ya-project-content">
            <div className="ya-panel-heading">
              <h2 id="ya-project-title">Project assets</h2>
              <button
                type="button"
                className="ya-add-files"
                onClick={() => fileInput.current?.click()}
              >
                <Upload size={16} />
                Upload images
              </button>
            </div>
            <input
              ref={fileInput}
              className="ya-hidden-input"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              aria-label="Choose project images"
              onChange={(event) => {
                gallery.upload(event.target.files);
                event.target.value = '';
              }}
            />
            <button
              type="button"
              className="ya-dropzone"
              data-dragging={dragging}
              onClick={() => fileInput.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                gallery.upload(event.dataTransfer.files);
              }}
            >
              <CloudUpload size={37} strokeWidth={1.6} />
              <strong>
                {dragging
                  ? 'Drop to upload your images'
                  : 'Drag & drop images here'}
              </strong>
              <span>JPG, PNG or WebP. Up to 4 images, 5 MB each.</span>
              <span>Public demo uploads. Deleted after 24 hours.</span>
            </button>
            <ul className="ya-file-grid">
              {files.map((file) => (
                <li className="ya-file-tile" key={file.id}>
                  <div
                    className={`ya-thumbnail ${file.art ? `ya-art-${file.art}` : ''}`}
                  >
                    {file.image && (
                      <Image
                        src={file.image}
                        alt=""
                        fill
                        unoptimized
                        sizes="150px"
                      />
                    )}
                    {file.art === 'code' && (
                      <CodeXml size={33} strokeWidth={1.5} />
                    )}
                    {file.art === 'wave' && (
                      <svg
                        viewBox="0 0 180 120"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                      >
                        <defs>
                          <linearGradient
                            id="ya-wave"
                            x1="0"
                            y1="0"
                            x2="1"
                            y2="1"
                          >
                            <stop stopColor="#402e93" />
                            <stop offset=".5" stopColor="#a08bf9" />
                            <stop offset="1" stopColor="#5534c1" />
                          </linearGradient>
                        </defs>
                        <path
                          d="M0 96C45 1 84 146 180 27V120H0Z"
                          fill="url(#ya-wave)"
                        />
                        <path
                          d="M0 97C45 2 84 147 180 28"
                          fill="none"
                          stroke="#bfaaff"
                          strokeWidth="1"
                        />
                      </svg>
                    )}
                    {file.url && (
                      <a
                        className="ya-open-upload"
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Open uploaded ${file.name}`}
                      />
                    )}
                    <button
                      type="button"
                      className="ya-remove-file"
                      aria-label={`${file.progress !== undefined ? 'Cancel upload of' : 'Remove preview of'} ${file.name}`}
                      onClick={() => gallery.remove(file.id)}
                    >
                      <X size={12} />
                    </button>
                  </div>
                  {file.url ? (
                    <a
                      className="ya-file-name ya-uploaded-file"
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                      title={`Open ${file.name}`}
                    >
                      {file.name}
                    </a>
                  ) : (
                    <span className="ya-file-name" title={file.name}>
                      {file.name}
                    </span>
                  )}
                  <span className="ya-file-size" role="status">
                    {file.failed
                      ? 'Upload failed'
                      : file.progress !== undefined
                        ? `Uploading ${Math.round(file.progress)}%`
                        : file.url
                          ? 'Uploaded'
                          : file.size}
                  </span>
                </li>
              ))}
              {!files.length && (
                <li className="ya-empty-files">
                  Choose an image to upload it.
                </li>
              )}
            </ul>
          </div>
        </section>
        <section
          className="ya-profile ya-panel"
          aria-labelledby="ya-profile-title"
        >
          <h2 id="ya-profile-title">Profile photo</h2>
          <div className="ya-avatar">
            <Image
              src={avatar.image!}
              alt="Sample profile preview"
              fill
              unoptimized
              sizes="100px"
            />
            <span className="ya-avatar-edit" aria-hidden="true">
              <Pencil size={13} />
            </span>
          </div>
          <input
            ref={avatarInput}
            className="ya-hidden-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label="Choose profile photo"
            onChange={(event) => {
              profile.upload(event.target.files);
              event.target.value = '';
            }}
          />
          <button
            type="button"
            className="ya-change-photo"
            onClick={() => avatarInput.current?.click()}
          >
            <Upload size={15} />
            {avatar.progress !== undefined
              ? `Uploading ${Math.round(avatar.progress)}%`
              : 'Upload photo'}
          </button>
          <p>Public demo. Deleted after 24 hours.</p>
          {avatar.url && (
            <a
              className="ya-profile-link"
              href={avatar.url}
              target="_blank"
              rel="noreferrer"
            >
              Open uploaded photo
            </a>
          )}
        </section>
        <section
          className="ya-documents ya-panel"
          aria-labelledby="ya-documents-title"
        >
          <h2 id="ya-documents-title">Private documents</h2>
          <ul>
            {documents.map(({ name, meta, icon: Icon, color }) => (
              <li key={name}>
                <span className={`ya-document-icon ya-document-${color}`}>
                  <Icon size={23} strokeWidth={1.5} />
                </span>
                <div>
                  <strong>{name}</strong>
                  <span>{meta}</span>
                </div>
                <LockKeyhole size={15} aria-label="Private file example" />
              </li>
            ))}
          </ul>
        </section>
      </div>
      {!readOnly && (
        <p className="ya-preview-error" role="status">
          {gallery.error || profile.error}
        </p>
      )}
    </div>
  );
}
