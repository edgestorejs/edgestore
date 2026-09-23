'use client';

import { useEdgeStore } from '@/lib/edgestore';
import { useEffect, useRef, useState } from 'react';
import { formatFileSize, selectPreviewImages } from './preview-files';

export type DemoFile = {
  id: string;
  name: string;
  size: string;
  image?: string;
  art?: 'wave' | 'code';
  progress?: number;
  url?: string;
  failed?: boolean;
};

export function useDemoUpload(initialFiles: DemoFile[], limit: number) {
  const { edgestore } = useEdgeStore();
  const [files, setFiles] = useState(initialFiles);
  const [error, setError] = useState('');
  const jobs = useRef(new Map<string, AbortController>());
  const previews = useRef(new Set<string>());

  useEffect(() => {
    const controllers = jobs.current;
    const urls = previews.current;
    return () => {
      for (const controller of controllers.values()) controller.abort();
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, []);

  function release(id: string) {
    jobs.current.get(id)?.abort();
    jobs.current.delete(id);
    if (previews.current.delete(id)) URL.revokeObjectURL(id);
  }

  function remove(id: string) {
    release(id);
    setFiles((current) => current.filter((file) => file.id !== id));
  }

  function upload(selected: FileList | null) {
    if (!selected?.length) return;
    const accepted = selectPreviewImages(Array.from(selected), limit);
    setError(
      accepted.length < selected.length
        ? `Choose up to ${limit} JPG, PNG or WebP image${limit === 1 ? '' : 's'}, 5 MB each.`
        : '',
    );
    if (!accepted.length) return;

    for (const id of previews.current) release(id);
    const nextFiles = accepted.map((file) => {
      const image = URL.createObjectURL(file);
      previews.current.add(image);
      return {
        id: image,
        name: file.name,
        size: formatFileSize(file.size),
        image,
        progress: 0,
      };
    });
    setFiles(nextFiles);

    accepted.forEach((file, index) => {
      const { id } = nextFiles[index]!;
      const controller = new AbortController();
      jobs.current.set(id, controller);
      const update = (changes: Partial<DemoFile>) => {
        if (!controller.signal.aborted) {
          setFiles((current) =>
            current.map((item) =>
              item.id === id ? { ...item, ...changes } : item,
            ),
          );
        }
      };
      void edgestore.myPublicFiles
        .upload({
          file,
          signal: controller.signal,
          options: { temporary: true },
          onProgressChange: (progress) => update({ progress }),
        })
        .then(({ url }) => {
          update({ url, progress: undefined });
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          update({ failed: true, progress: undefined });
          setError('Upload failed. Choose the image again to retry.');
        })
        .finally(() => jobs.current.delete(id));
    });
  }

  return { files, upload, remove, error };
}
