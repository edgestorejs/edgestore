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
import { useEffect, useRef, useState } from 'react';
import { formatFileSize, selectPreviewImages } from './preview-files';

type PreviewFile = {
  id: string;
  name: string;
  size: string;
  image?: string;
  art?: 'wave' | 'code';
};
const sampleFiles: PreviewFile[] = [
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

export function UploadShowcase() {
  const [files, setFiles] = useState(sampleFiles);
  const [avatar, setAvatar] = useState('/img/home/avatar.jpg');
  const [message, setMessage] = useState(
    'Interactive preview. Files stay in your browser.',
  );
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const avatarInput = useRef<HTMLInputElement>(null);
  const objectUrls = useRef(new Set<string>());

  useEffect(() => {
    const urls = objectUrls.current;
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, []);

  function release(url: string | undefined) {
    if (url && objectUrls.current.delete(url)) URL.revokeObjectURL(url);
  }

  function previewImages(selected: FileList | null, profile = false) {
    if (!selected?.length) return;
    const accepted = selectPreviewImages(Array.from(selected), profile ? 1 : 4);
    if (!accepted.length) {
      setMessage(
        'Choose a JPG, PNG or WebP image up to 5 MB. Nothing was uploaded.',
      );
      return;
    }
    const previews = accepted.map((file) => {
      const url = URL.createObjectURL(file);
      objectUrls.current.add(url);
      return {
        id: url,
        name: file.name,
        size: formatFileSize(file.size),
        image: url,
      };
    });
    if (profile) {
      release(avatar);
      setAvatar(previews[0]!.image);
    } else {
      files.forEach((file) => release(file.image));
      setFiles(previews);
    }
    setMessage(
      profile
        ? 'Profile photo updated locally. Nothing was uploaded.'
        : `Previewing ${previews.length} image${previews.length === 1 ? '' : 's'} locally.${accepted.length < selected.length ? ' Up to 4 JPG, PNG or WebP files under 5 MB are supported.' : ''} Nothing was uploaded.`,
    );
  }

  function remove(file: PreviewFile) {
    release(file.image);
    setFiles((current) => current.filter((item) => item.id !== file.id));
    setMessage(`${file.name} removed from this preview.`);
  }

  return (
    <div className="ya-showcase" aria-label="Try the upload components">
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
              Choose images
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
              previewImages(event.target.files);
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
              previewImages(event.dataTransfer.files);
            }}
          >
            <CloudUpload size={37} strokeWidth={1.6} />
            <strong>
              {dragging
                ? 'Drop to preview your images'
                : 'Drag & drop images here'}
            </strong>
            <span>JPG, PNG or WebP. Up to 4 images, 5 MB each.</span>
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
                  <button
                    type="button"
                    className="ya-remove-file"
                    aria-label={`Remove ${file.name}`}
                    onClick={() => remove(file)}
                  >
                    <X size={12} />
                  </button>
                </div>
                <span className="ya-file-name" title={file.name}>
                  {file.name}
                </span>
                <span className="ya-file-size">{file.size}</span>
              </li>
            ))}
            {!files.length && (
              <li className="ya-empty-files">
                Your canvas is clear. Add an image to try it.
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
            src={avatar}
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
            previewImages(event.target.files, true);
            event.target.value = '';
          }}
        />
        <button
          type="button"
          className="ya-change-photo"
          onClick={() => avatarInput.current?.click()}
        >
          <Upload size={15} />
          Change photo
        </button>
        <p>JPG, PNG or WebP. Max 5 MB.</p>
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
      <p className="ya-demo-note" role="status">
        {message}
      </p>
    </div>
  );
}
