import * as React from 'react';

// Types
export type FileStatus = 'PENDING' | 'UPLOADING' | 'COMPLETE' | 'ERROR';

export type FileState = {
  file: File;
  key: string;
  progress: number;
  status: FileStatus;
  url?: string;
  error?: string;
  abortController?: AbortController;
  autoUpload?: boolean;
};

// Define a type for completed files where URL is guaranteed
export type CompletedFileState = Omit<FileState, 'status' | 'url'> & {
  status: 'COMPLETE';
  url: string;
};

export type UploadFn = (options: {
  file: File;
  signal: AbortSignal;
  onProgressChange: (progress: number) => void | Promise<void>;
}) => Promise<{ url: string }>;

type UploaderContextType = {
  fileStates: FileState[];
  addFiles: (files: File[]) => void;
  updateFileState: (key: string, changes: Partial<FileState>) => void;
  removeFile: (key: string) => void;
  cancelUpload: (key: string) => void;
  uploadFiles: (keysToUpload?: string[]) => Promise<void>;
  resetFiles: () => void;
  isUploading: boolean;
  autoUpload?: boolean;
};

type ProviderProps = {
  children:
    | React.ReactNode
    | ((context: UploaderContextType) => React.ReactNode);
  onChange?: (args: {
    allFiles: FileState[];
    completedFiles: CompletedFileState[];
  }) => void | Promise<void>;
  uploadFn: UploadFn;
  value?: FileState[];
  autoUpload?: boolean;
};

// Context
const UploaderContext = React.createContext<UploaderContextType | null>(null);

// Hook
export const useUploader = () => {
  const context = React.useContext(UploaderContext);
  if (!context) {
    throw new Error('useUploader must be used within a UploaderProvider');
  }
  return context;
};

// Provider Component
export const UploaderProvider: React.FC<ProviderProps> = ({
  children,
  onChange,
  uploadFn,
  value: externalValue,
  autoUpload = false,
}) => {
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
    async (keysToUpload?: string[]) => {
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
              onProgressChange: async (progress) => {
                updateFileState(fileState.key, { progress });
              },
            });

            // Wait a bit to show the bar at 100%
            await new Promise((resolve) => setTimeout(resolve, 500));
            updateFileState(fileState.key, {
              status: 'COMPLETE',
              progress: 100,
              url: uploadResult?.url,
            });
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
    [fileStates, updateFileState, uploadFn],
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
      if (autoUpload) {
        setPendingAutoUploadKeys(newFileStates.map((fs) => fs.key));
      }
    },
    [autoUpload],
  );

  const removeFile = React.useCallback((key: string) => {
    setFileStates((prev) => prev.filter((fileState) => fileState.key !== key));
  }, []);

  const cancelUpload = React.useCallback(
    (key: string) => {
      const fileState = fileStates.find((f) => f.key === key);
      if (fileState?.abortController && fileState.progress < 100) {
        fileState.abortController.abort();
        updateFileState(key, { status: 'PENDING', progress: 0 });
      }
      // Remove file if it was an auto-upload
      if (fileState?.autoUpload) {
        removeFile(key);
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
    <UploaderContext.Provider value={value}>
      {typeof children === 'function' ? children(value) : children}
    </UploaderContext.Provider>
  );
};
