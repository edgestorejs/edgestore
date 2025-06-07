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

  /** AbortController to cancel the upload */
  abortController?: AbortController;

  /** Whether the file should be automatically uploaded */
  autoUpload?: boolean;
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

  /** Add files to the uploader */
  addFiles: (files: File[]) => void;

  /** Update a file's state */
  updateFileState: (key: string, changes: Partial<FileState>) => void;

  /** Remove a file from the uploader */
  removeFile: (key: string) => void;

  /** Cancel an ongoing upload */
  cancelUpload: (key: string) => void;

  /** Start uploading files */
  uploadFiles: (keysToUpload?: string[], options?: TOptions) => Promise<void>;

  /** Reset all files */
  resetFiles: () => void;

  /** Whether any file is currently uploading */
  isUploading: boolean;

  /** Whether files should be automatically uploaded */
  autoUpload?: boolean;
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

// Context
const UploaderContext =
  React.createContext<UploaderContextType<unknown> | null>(null);

/**
 * Hook to access the uploader context.
 *
 * @returns The uploader context
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
 * Provider component for file upload functionality.
 *
 * @component
 * @example
 * ```tsx
 * <UploaderProvider
 *   uploadFn={async ({ file, signal, onProgressChange }) => {
 *     // Upload implementation
 *     return { url: 'https://example.com/uploads/image.jpg' };
 *   }}
 *   autoUpload={true}
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
  const [pendingAutoUploadKeys, setPendingAutoUploadKeys] = React.useState<
    string[] | null
  >(null);

  // Sync with external value if provided
  React.useEffect(() => {
    if (externalValue) {
      setFileStates(externalValue);
    }
  }, [externalValue]);

  const updateFileState = React.useCallback(
    (key: string, changes: Partial<FileState>) => {
      setFileStates((prevStates) => {
        return prevStates.map((fileState) => {
          if (fileState.key === key) {
            return { ...fileState, ...changes };
          }
          return fileState;
        });
      });
    },
    [],
  );

  const uploadFiles = React.useCallback(
    async (keysToUpload?: string[], options?: TOptions) => {
      const filesToUpload = fileStates.filter(
        (fileState) =>
          fileState.status === 'PENDING' &&
          (!keysToUpload || keysToUpload.includes(fileState.key)),
      );

      if (filesToUpload.length === 0) return;

      await Promise.all(
        filesToUpload.map(async (fileState) => {
          try {
            const abortController = new AbortController();
            updateFileState(fileState.key, {
              abortController,
              status: 'UPLOADING',
              progress: 0,
            });

            const uploadResult = await uploadFn({
              file: fileState.file,
              signal: abortController.signal,
              onProgressChange: (progress) => {
                updateFileState(fileState.key, { progress });
              },
              options,
            });

            // Wait a bit to show the bar at 100%
            await new Promise((resolve) => setTimeout(resolve, 500));

            const completedFile = {
              ...fileState,
              status: 'COMPLETE' as const,
              progress: 100,
              url: uploadResult?.url,
            };

            updateFileState(fileState.key, {
              status: 'COMPLETE',
              progress: 100,
              url: uploadResult?.url,
            });

            // Call onUploadCompleted when a file upload is completed
            if (onUploadCompleted) {
              void onUploadCompleted(completedFile);
            }
          } catch (err: unknown) {
            if (
              err instanceof Error &&
              // if using with EdgeStore, the error name is UploadAbortedError
              (err.name === 'AbortError' || err.name === 'UploadAbortedError')
            ) {
              updateFileState(fileState.key, {
                status: 'PENDING',
                progress: 0,
                error: 'Upload canceled',
              });
            } else {
              if (process.env.NODE_ENV === 'development') {
                console.error(err);
              }
              const errorMessage =
                err instanceof Error ? err.message : 'Upload failed';
              updateFileState(fileState.key, {
                status: 'ERROR',
                error: errorMessage,
              });
            }
          }
        }),
      );
    },
    [fileStates, updateFileState, uploadFn, onUploadCompleted],
  );

  const addFiles = React.useCallback(
    (files: File[]) => {
      const newFileStates = files.map<FileState>((file) => ({
        file,
        key: `${file.name}-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}`,
        progress: 0,
        status: 'PENDING',
        autoUpload,
      }));
      setFileStates((prev) => [...prev, ...newFileStates]);

      // Call onFileAdded for each new file
      if (onFileAdded) {
        newFileStates.forEach((fileState) => {
          void onFileAdded(fileState);
        });
      }

      if (autoUpload) {
        setPendingAutoUploadKeys(newFileStates.map((fs) => fs.key));
      }
    },
    [autoUpload, onFileAdded],
  );

  const removeFile = React.useCallback(
    (key: string) => {
      setFileStates((prev) =>
        prev.filter((fileState) => fileState.key !== key),
      );

      // Call onFileRemoved when a file is removed
      if (onFileRemoved) {
        void onFileRemoved(key);
      }
    },
    [onFileRemoved],
  );

  const cancelUpload = React.useCallback(
    (key: string) => {
      const fileState = fileStates.find((f) => f.key === key);
      if (fileState?.abortController && fileState.progress < 100) {
        fileState.abortController.abort();
        if (fileState?.autoUpload) {
          // Remove file if it was an auto-upload
          removeFile(key);
        } else {
          // If it was not an auto-upload, reset the file state
          updateFileState(key, { status: 'PENDING', progress: 0 });
        }
      }
    },
    [fileStates, updateFileState, removeFile],
  );

  const resetFiles = React.useCallback(() => {
    setFileStates([]);
  }, []);

  React.useEffect(() => {
    const completedFileStates = fileStates.filter(
      (fs): fs is CompletedFileState => fs.status === 'COMPLETE' && !!fs.url,
    );
    void onChange?.({
      allFiles: fileStates,
      completedFiles: completedFileStates,
    });
  }, [fileStates, onChange]);

  // Handle auto-uploading files added to the queue
  React.useEffect(() => {
    if (pendingAutoUploadKeys && pendingAutoUploadKeys.length > 0) {
      void uploadFiles(pendingAutoUploadKeys);
      setPendingAutoUploadKeys(null);
    }
  }, [pendingAutoUploadKeys, uploadFiles]);

  const isUploading = React.useMemo(
    () => fileStates.some((fs) => fs.status === 'UPLOADING'),
    [fileStates],
  );

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

/**
 * Formats a file size in bytes to a human-readable string.
 *
 * @param bytes - The file size in bytes
 * @returns A formatted string (e.g., "1.5 MB")
 *
 * @example
 * ```ts
 * formatFileSize(1024); // "1 KB"
 * formatFileSize(1024 * 1024 * 2.5); // "2.5 MB"
 * ```
 */
export function formatFileSize(bytes?: number) {
  if (!bytes) return '0 B';
  const k = 1024;
  const dm = 2;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
