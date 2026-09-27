'use client';

import { cn } from '@/lib/utils';
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
    color: 'bg-[linear-gradient(140deg,#f99c9d,#d14a66)]',
  },
  {
    name: 'financials.xlsx',
    meta: '1.8 MB · 1 week ago',
    icon: FileSpreadsheet,
    color: 'bg-[linear-gradient(140deg,#8cd3b8,#359973)]',
  },
  {
    name: 'notes.txt',
    meta: '12 KB · 3 days ago',
    icon: FileText,
    color: 'bg-[linear-gradient(140deg,#b9c4dd,#73809b)]',
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
      className="relative isolate w-full max-w-[660px] min-w-0 [--showcase-unit:0px] before:block before:pt-[88.4375%] before:content-[''] max-[981px]:mt-3 max-[981px]:justify-self-center max-[601px]:mt-1"
      role={readOnly ? 'img' : undefined}
      aria-label={
        readOnly
          ? 'Upload component examples: project images, a profile photo, and private documents.'
          : 'Try the upload components'
      }
    >
      <div
        className="absolute inset-0 before:pointer-events-none before:absolute before:inset-x-0 before:top-[20%] before:bottom-[8%] before:-z-1 before:rounded-full before:bg-[radial-gradient(ellipse,#8260ff24,#8260ff00_68%)] before:content-[''] max-[601px]:pointer-events-none max-[601px]:select-none"
        inert={readOnly}
        aria-hidden={readOnly}
      >
        <section
          className="absolute top-0 right-[calc(10*var(--showcase-unit))] min-h-[calc(362*var(--showcase-unit))] w-[87%] rounded-[calc(15*var(--showcase-unit))] border-[length:calc(1*var(--showcase-unit))] border-[color-mix(in_srgb,var(--site-accent)_55%,var(--site-line))] bg-[linear-gradient(140deg,color-mix(in_srgb,var(--site-panel)_75%,var(--site-bg)),var(--site-bg))] px-[calc(13*var(--showcase-unit))] pb-[calc(14*var(--showcase-unit))] shadow-(--site-panel-shadow)"
          aria-labelledby="ya-project-title"
        >
          <div
            className="flex h-[calc(27*var(--showcase-unit))] items-center gap-[calc(5*var(--showcase-unit))]"
            aria-hidden="true"
          >
            <i className="size-[calc(8*var(--showcase-unit))] rounded-full border-[length:calc(1*var(--showcase-unit))] border-[color-mix(in_srgb,var(--site-muted)_25%,transparent)] bg-[color-mix(in_srgb,var(--site-muted)_32%,var(--site-panel))]" />
            <i className="size-[calc(8*var(--showcase-unit))] rounded-full border-[length:calc(1*var(--showcase-unit))] border-[color-mix(in_srgb,var(--site-muted)_25%,transparent)] bg-[color-mix(in_srgb,var(--site-muted)_32%,var(--site-panel))]" />
            <i className="size-[calc(8*var(--showcase-unit))] rounded-full border-[length:calc(1*var(--showcase-unit))] border-[color-mix(in_srgb,var(--site-muted)_25%,transparent)] bg-[color-mix(in_srgb,var(--site-muted)_32%,var(--site-panel))]" />
          </div>
          <div className="rounded-[calc(9*var(--showcase-unit))] border-[length:calc(1*var(--showcase-unit))] border-site-line bg-[color-mix(in_srgb,var(--site-panel)_40%,var(--site-bg))] p-[calc(15*var(--showcase-unit))]">
            <div className="mb-[calc(15*var(--showcase-unit))] flex items-center justify-between gap-[calc(12*var(--showcase-unit))]">
              <h2
                className="text-[length:calc(16*var(--showcase-unit))] leading-[1.3] font-[650] tracking-[-0.025em]"
                id="ya-project-title"
              >
                Project assets
              </h2>
              <button
                type="button"
                className="inline-flex items-center gap-[calc(7*var(--showcase-unit))] rounded-[calc(6*var(--showcase-unit))] border-[length:calc(1*var(--showcase-unit))] border-[#bdabff66] bg-[linear-gradient(120deg,var(--site-button-start),var(--site-button-end))] px-[calc(12*var(--showcase-unit))] py-[calc(9*var(--showcase-unit))] text-[length:calc(12*var(--showcase-unit))] font-[550] text-white"
                onClick={() => fileInput.current?.click()}
              >
                <Upload
                  className="size-[calc(16*var(--showcase-unit))]"
                  size={16}
                />
                Upload images
              </button>
            </div>
            <input
              ref={fileInput}
              className="hidden"
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
              className="flex min-h-[calc(137*var(--showcase-unit))] w-full flex-col items-center justify-center rounded-[calc(6*var(--showcase-unit))] border-[length:calc(1*var(--showcase-unit))] border-dashed border-site-accent bg-transparent px-[calc(10*var(--showcase-unit))] py-[calc(18*var(--showcase-unit))] text-site-text transition-colors duration-150 hover:bg-site-accent/10 data-[dragging=true]:bg-site-accent/10 motion-reduce:transition-none"
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
              <CloudUpload
                className="mb-[calc(12*var(--showcase-unit))] size-[calc(37*var(--showcase-unit))]"
                size={37}
                strokeWidth={1.6}
              />
              <strong className="text-[length:calc(12*var(--showcase-unit))] font-medium">
                {dragging
                  ? 'Drop to upload your images'
                  : 'Drag & drop images here'}
              </strong>
              <span className="mt-[calc(3*var(--showcase-unit))] text-[length:calc(10*var(--showcase-unit))] text-site-muted">
                JPG, PNG or WebP. Up to 4 images, 5 MB each.
              </span>
              <span className="mt-[calc(3*var(--showcase-unit))] text-[length:calc(10*var(--showcase-unit))] text-site-muted">
                Public demo uploads. Deleted after 24 hours.
              </span>
            </button>
            <ul className="mt-[calc(14*var(--showcase-unit))] grid min-h-[calc(115*var(--showcase-unit))] grid-cols-4 gap-[calc(10*var(--showcase-unit))]">
              {files.map((file) => (
                <li className="min-w-0" key={file.id}>
                  <div
                    className={cn(
                      'relative h-[calc(79*var(--showcase-unit))] overflow-hidden rounded-[calc(5*var(--showcase-unit))] border-[length:calc(1*var(--showcase-unit))] border-site-line bg-site-bg',
                      file.art === 'wave' && 'bg-[#0b0924]',
                      file.art === 'code' &&
                        'grid place-items-center text-site-accent',
                    )}
                  >
                    {file.image && (
                      <Image
                        className="object-cover"
                        src={file.image}
                        alt=""
                        fill
                        unoptimized
                        sizes="150px"
                      />
                    )}
                    {file.art === 'code' && (
                      <CodeXml
                        className="size-[calc(33*var(--showcase-unit))]"
                        size={33}
                        strokeWidth={1.5}
                      />
                    )}
                    {file.art === 'wave' && (
                      <svg
                        className="size-full"
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
                        className="absolute inset-0"
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Open uploaded ${file.name}`}
                      />
                    )}
                    <button
                      type="button"
                      className="absolute top-[calc(4*var(--showcase-unit))] right-[calc(4*var(--showcase-unit))] grid place-items-center rounded-[calc(4*var(--showcase-unit))] border-[length:calc(1*var(--showcase-unit))] border-[#e6dfff55] bg-[#0a1026b3] p-[calc(4*var(--showcase-unit))] text-white hover:bg-[#453775]"
                      aria-label={`${file.progress !== undefined ? 'Cancel upload of' : 'Remove preview of'} ${file.name}`}
                      onClick={() => gallery.remove(file.id)}
                    >
                      <X
                        className="size-[calc(12*var(--showcase-unit))]"
                        size={12}
                      />
                    </button>
                  </div>
                  {file.url ? (
                    <a
                      className="mt-[calc(5*var(--showcase-unit))] block truncate text-[length:calc(10*var(--showcase-unit))] text-site-accent underline underline-offset-[calc(2*var(--showcase-unit))]"
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                      title={`Open ${file.name}`}
                    >
                      {file.name}
                    </a>
                  ) : (
                    <span
                      className="mt-[calc(5*var(--showcase-unit))] block truncate text-[length:calc(10*var(--showcase-unit))]"
                      title={file.name}
                    >
                      {file.name}
                    </span>
                  )}
                  <span
                    className="mt-[calc(2*var(--showcase-unit))] block text-[length:calc(9*var(--showcase-unit))] text-site-muted"
                    role="status"
                  >
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
                <li className="col-span-full self-center p-[calc(24*var(--showcase-unit))] text-center text-[length:calc(12*var(--showcase-unit))] text-site-muted">
                  Choose an image to upload it.
                </li>
              )}
            </ul>
          </div>
        </section>
        <section
          className="absolute bottom-[calc(16*var(--showcase-unit))] left-0 w-[32%] rounded-[calc(15*var(--showcase-unit))] border-[length:calc(1*var(--showcase-unit))] border-[color-mix(in_srgb,var(--site-accent)_55%,var(--site-line))] bg-[linear-gradient(140deg,color-mix(in_srgb,var(--site-panel)_75%,var(--site-bg)),var(--site-bg))] px-[calc(16*var(--showcase-unit))] pt-[calc(17*var(--showcase-unit))] pb-[calc(12*var(--showcase-unit))] shadow-(--site-panel-shadow)"
          aria-labelledby="ya-profile-title"
        >
          <h2
            className="text-[length:calc(16*var(--showcase-unit))] leading-[1.3] font-[650] tracking-[-0.025em]"
            id="ya-profile-title"
          >
            Profile photo
          </h2>
          <div className="relative mx-auto mt-[calc(14*var(--showcase-unit))] mb-[calc(15*var(--showcase-unit))] size-[calc(91*var(--showcase-unit))]">
            <Image
              className="rounded-full border-[length:calc(1*var(--showcase-unit))] border-site-line object-cover"
              src={avatar.image!}
              alt="Sample profile preview"
              fill
              unoptimized
              sizes="100px"
            />
            <span
              className="absolute right-[calc(-1*var(--showcase-unit))] bottom-0 grid size-[calc(29*var(--showcase-unit))] place-items-center rounded-full border-[length:calc(1*var(--showcase-unit))] border-site-accent bg-site-bg text-site-accent"
              aria-hidden="true"
            >
              <Pencil
                className="size-[calc(13*var(--showcase-unit))]"
                size={13}
              />
            </span>
          </div>
          <input
            ref={avatarInput}
            className="hidden"
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
            className="flex min-h-[calc(32*var(--showcase-unit))] w-full items-center justify-center gap-[calc(7*var(--showcase-unit))] rounded-[calc(5*var(--showcase-unit))] border-[length:calc(1*var(--showcase-unit))] border-[color-mix(in_srgb,var(--site-accent)_55%,var(--site-line))] bg-site-panel text-[length:calc(11*var(--showcase-unit))] text-site-text hover:bg-[color-mix(in_srgb,var(--site-panel)_80%,var(--site-accent))]"
            onClick={() => avatarInput.current?.click()}
          >
            <Upload
              className="size-[calc(15*var(--showcase-unit))]"
              size={15}
            />
            {avatar.progress !== undefined
              ? `Uploading ${Math.round(avatar.progress)}%`
              : 'Upload photo'}
          </button>
          <p className="mt-[calc(9*var(--showcase-unit))] text-center text-[length:calc(8*var(--showcase-unit))] whitespace-nowrap text-site-muted">
            Public demo. Deleted after 24 hours.
          </p>
          {avatar.url && (
            <a
              className="mt-[calc(6*var(--showcase-unit))] block text-center text-[length:calc(9*var(--showcase-unit))] text-site-accent underline underline-offset-[calc(2*var(--showcase-unit))]"
              href={avatar.url}
              target="_blank"
              rel="noreferrer"
            >
              Open uploaded photo
            </a>
          )}
        </section>
        <section
          className="absolute right-0 bottom-0 w-[56%] rounded-[calc(15*var(--showcase-unit))] border-[length:calc(1*var(--showcase-unit))] border-[color-mix(in_srgb,var(--site-accent)_55%,var(--site-line))] bg-[linear-gradient(140deg,color-mix(in_srgb,var(--site-panel)_75%,var(--site-bg)),var(--site-bg))] px-[calc(16*var(--showcase-unit))] pt-[calc(17*var(--showcase-unit))] pb-[calc(13*var(--showcase-unit))] shadow-(--site-panel-shadow)"
          aria-labelledby="ya-documents-title"
        >
          <h2
            className="text-[length:calc(16*var(--showcase-unit))] leading-[1.3] font-[650] tracking-[-0.025em]"
            id="ya-documents-title"
          >
            Private documents
          </h2>
          <ul className="mt-[calc(14*var(--showcase-unit))] grid gap-[calc(7*var(--showcase-unit))]">
            {documents.map(({ name, meta, icon: Icon, color }) => (
              <li
                className="flex items-center gap-[calc(10*var(--showcase-unit))] rounded-[calc(6*var(--showcase-unit))] border-[length:calc(1*var(--showcase-unit))] border-site-line bg-site-panel px-[calc(10*var(--showcase-unit))] py-[calc(8*var(--showcase-unit))]"
                key={name}
              >
                <span
                  className={cn(
                    'grid h-[calc(36*var(--showcase-unit))] w-[calc(30*var(--showcase-unit))] shrink-0 place-items-center rounded-[calc(3*var(--showcase-unit))_calc(8*var(--showcase-unit))_calc(3*var(--showcase-unit))_calc(3*var(--showcase-unit))] text-white shadow-[inset_0_calc(1*var(--showcase-unit))_calc(1*var(--showcase-unit))_#ffffff40]',
                    color,
                  )}
                >
                  <Icon
                    className="size-[calc(23*var(--showcase-unit))]"
                    size={23}
                    strokeWidth={1.5}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <strong className="block text-[length:calc(10*var(--showcase-unit))] font-medium">
                    {name}
                  </strong>
                  <span className="mt-[calc(4*var(--showcase-unit))] block text-[length:calc(9*var(--showcase-unit))] text-site-muted">
                    {meta}
                  </span>
                </div>
                <LockKeyhole
                  className="size-[calc(15*var(--showcase-unit))] text-site-muted"
                  size={15}
                  aria-label="Private file example"
                />
              </li>
            ))}
          </ul>
        </section>
      </div>
      {!readOnly && (
        <p
          className="absolute top-full left-0 mt-3 w-full text-xs/normal text-site-muted"
          role="status"
        >
          {gallery.error || profile.error}
        </p>
      )}
    </div>
  );
}
