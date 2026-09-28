'use client';

import * as React from 'react';

/**
 * Represents the possible statuses of a file in the uploader.
 */
export type FileStatus = 'PENDING' | 'UPLOADING' | 'COMPLETE' | 'ERROR';

/**
 * Represents the state of a file in the uploader.
 */
export type FileState = {
  /** The file object being uploaded */
  file: File;

  /** Unique identifier for the file */
  key: string;

  /** Upload progress (0-100) */
  progress: number;

  /** Current status of the file */
  status: FileStatus;

  /** URL of the uploaded file (available when status is COMPLETE) */
  url?: string;

  /** Error message if the upload failed */
  error?: string;
};

/**
 * Represents a file that has completed uploading.
 */
export type CompletedFileState = Omit<FileState, 'status' | 'url'> & {
  /** Status is guaranteed to be 'COMPLETE' */
  status: 'COMPLETE';

  /** URL is guaranteed to be available */
  url: string;
};

/**
 * Function type for handling file uploads.
 */
export type UploadFn<TOptions = unknown> = (props: {
  /** The file to be uploaded */
  file: File;

  /** AbortSignal to cancel the upload */
  signal: AbortSignal;

  /** Callback to update progress */
  onProgressChange: (progress: number) => void | Promise<void>;

  /** Additional options */
  options?: TOptions;
}) => Promise<{ url: string }>;

/**
 * Context type for the UploaderProvider.
 */
type UploaderContextType<TOptions = unknown> = {
  /** List of all files in the uploader */
  fileStates: FileState[];

  /** Add files to the uploader. Returns the new file states. */
  addFiles: (files: File[]) => FileState[];

  /** Update a file's state */
  updateFileState: (key: string, changes: Partial<FileState>) => void;

  /** Remove a file from the uploader, aborting its upload if it is running */
  removeFile: (key: string) => void;

  /**
   * Cancel an ongoing upload. With `autoUpload` the file is removed,
   * otherwise it goes back to `PENDING`.
   */
  cancelUpload: (key: string) => void;

  /**
   * Upload files that are `PENDING` or `ERROR` (so it also retries failed uploads).
   * Pass keys to upload only those files.
   */
  uploadFiles: (keysToUpload?: string[], options?: TOptions) => Promise<void>;

  /** Remove all files, aborting any running uploads */
  resetFiles: () => void;

  /** Whether any file is currently uploading */
  isUploading: boolean;

  /** Whether files are uploaded as soon as they are added */
  autoUpload: boolean;
};

/**
 * Props for the UploaderProvider component.
 */
type ProviderProps<TOptions = unknown> = {
  /** React children or render function */
  children:
    | React.ReactNode
    | ((context: UploaderContextType<TOptions>) => React.ReactNode);

  /** Callback when files change */
  onChange?: (args: {
    allFiles: FileState[];
    completedFiles: CompletedFileState[];
  }) => void | Promise<void>;

  /** Callback when a file is added */
  onFileAdded?: (file: FileState) => void | Promise<void>;

  /** Callback when a file is removed */
  onFileRemoved?: (key: string) => void | Promise<void>;

  /** Callback when a file upload completes */
  onUploadCompleted?: (file: CompletedFileState) => void | Promise<void>;

  /** Function to handle the actual upload */
  uploadFn: UploadFn<TOptions>;

  /** External value to control the file states */
  value?: FileState[];

  /** Whether files should be automatically uploaded when added */
  autoUpload?: boolean;
};

const UploaderContext =
  React.createContext<UploaderContextType<unknown> | null>(null);

/**
 * Hook to access the uploader context.
 *
 * @throws Error if used outside of UploaderProvider
 *
 * @example
 * ```tsx
 * const { fileStates, addFiles, uploadFiles } = useUploader();
 * ```
 */
export function useUploader<TOptions = unknown>() {
  const context = React.useContext(UploaderContext);
  if (!context) {
    throw new Error('useUploader must be used within a UploaderProvider');
  }
  return context as UploaderContextType<TOptions>;
}

/**
 * Holds the files of an uploader and runs their uploads.
 *
 * @example
 * ```tsx
 * <UploaderProvider
 *   uploadFn={async ({ file, signal, onProgressChange }) => {
 *     // Upload implementation
 *     return { url: 'https://example.com/uploads/image.jpg' };
 *   }}
 *   autoUpload
 * >
 *   <ImageUploader maxFiles={5} maxSize={1024 * 1024 * 2} />
 * </UploaderProvider>
 * ```
 */
export function UploaderProvider<TOptions = unknown>({
  children,
  onChange,
  onFileAdded,
  onFileRemoved,
  onUploadCompleted,
  uploadFn,
  value: externalValue,
  autoUpload = false,
}: ProviderProps<TOptions>) {
  const [fileStates, setFileStates] = React.useState<FileState[]>(
    externalValue ?? [],
  );
  // Abort controllers of running uploads, by file key.
  const controllers = React.useRef(new Map<string, AbortController>());

  // Sync with external value if provided
  React.useEffect(() => {
    if (externalValue) {
      setFileStates(externalValue);
    }
  }, [externalValue]);

  const updateFileState = React.useCallback(
    (key: string, changes: Partial<FileState>) => {
      setFileStates((prev) =>
        prev.map((fileState) =>
          fileState.key === key ? { ...fileState, ...changes } : fileState,
        ),
      );
    },
    [],
  );

  const upload = React.useCallback(
    async (fileState: FileState, options?: TOptions) => {
      const { key, file } = fileState;
      const controller = new AbortController();
      controllers.current.set(key, controller);
      updateFileState(key, {
        status: 'UPLOADING',
        progress: 0,
        error: undefined,
      });

      try {
        const { url } = await uploadFn({
          file,
          signal: controller.signal,
          onProgressChange: (progress) => {
            if (!controller.signal.aborted) updateFileState(key, { progress });
          },
          options,
        });

        // Let the progress bar reach 100% before showing the completed state.
        await new Promise((resolve) => setTimeout(resolve, 500));
        if (controller.signal.aborted) return;

        updateFileState(key, { status: 'COMPLETE', progress: 100, url });
        void onUploadCompleted?.({
          ...fileState,
          status: 'COMPLETE',
          progress: 100,
          url,
          error: undefined,
        });
      } catch (err: unknown) {
        // cancelUpload/removeFile already updated the state.
        if (controller.signal.aborted) return;
        if (process.env.NODE_ENV === 'development') {
          console.error(err);
        }
        updateFileState(key, {
          status: 'ERROR',
          error: err instanceof Error ? err.message : 'Upload failed',
        });
      } finally {
        if (controllers.current.get(key) === controller) {
          controllers.current.delete(key);
        }
      }
    },
    [updateFileState, uploadFn, onUploadCompleted],
  );

  const uploadFiles = React.useCallback(
    async (keysToUpload?: string[], options?: TOptions) => {
      const filesToUpload = fileStates.filter(
        (fileState) =>
          (fileState.status === 'PENDING' || fileState.status === 'ERROR') &&
          (!keysToUpload || keysToUpload.includes(fileState.key)),
      );
      await Promise.all(
        filesToUpload.map((fileState) => upload(fileState, options)),
      );
    },
    [fileStates, upload],
  );

  const addFiles = React.useCallback(
    (files: File[]) => {
      if (files.length === 0) return [];
      const newFileStates = files.map<FileState>((file) => ({
        file,
        key: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        progress: 0,
        status: 'PENDING',
      }));
      setFileStates((prev) => [...prev, ...newFileStates]);
      newFileStates.forEach((fileState) => {
        void onFileAdded?.(fileState);
        if (autoUpload) void upload(fileState);
      });
      return newFileStates;
    },
    [autoUpload, onFileAdded, upload],
  );

  const removeFile = React.useCallback(
    (key: string) => {
      controllers.current.get(key)?.abort();
      setFileStates((prev) =>
        prev.filter((fileState) => fileState.key !== key),
      );
      void onFileRemoved?.(key);
    },
    [onFileRemoved],
  );

  const cancelUpload = React.useCallback(
    (key: string) => {
      const controller = controllers.current.get(key);
      if (!controller) return;
      controller.abort();
      if (autoUpload) {
        removeFile(key);
      } else {
        updateFileState(key, { status: 'PENDING', progress: 0 });
      }
    },
    [autoUpload, removeFile, updateFileState],
  );

  const resetFiles = React.useCallback(() => {
    controllers.current.forEach((controller) => controller.abort());
    setFileStates([]);
  }, []);

  // Abort running uploads when the provider unmounts.
  React.useEffect(() => {
    const running = controllers.current;
    return () => {
      running.forEach((controller) => controller.abort());
    };
  }, []);

  React.useEffect(() => {
    const completedFiles = fileStates.filter(
      (fs): fs is CompletedFileState => fs.status === 'COMPLETE' && !!fs.url,
    );
    void onChange?.({ allFiles: fileStates, completedFiles });
  }, [fileStates, onChange]);

  const isUploading = fileStates.some((fs) => fs.status === 'UPLOADING');

  const value = React.useMemo(
    () => ({
      fileStates,
      addFiles,
      updateFileState,
      removeFile,
      cancelUpload,
      uploadFiles,
      resetFiles,
      isUploading,
      autoUpload,
    }),
    [
      fileStates,
      addFiles,
      updateFileState,
      removeFile,
      cancelUpload,
      uploadFiles,
      resetFiles,
      isUploading,
      autoUpload,
    ],
  );

  return (
    <UploaderContext.Provider value={value as UploaderContextType<unknown>}>
      {typeof children === 'function' ? children(value) : children}
    </UploaderContext.Provider>
  );
}
