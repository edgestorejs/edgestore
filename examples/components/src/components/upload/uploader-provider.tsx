'use client';

import * as React from 'react';

// Types
export type FileStatus = 'PENDING' | 'UPLOADING' | 'COMPLETE' | 'ERROR';

export type FileState = {
  file: File;
  key: string;
  progress: number;
  status: FileStatus;
  error?: string;
  abortController?: AbortController;
};

export type UploadFn = (options: {
  file: File;
  signal: AbortSignal;
  onProgressChange: (progress: number) => void | Promise<void>;
}) => Promise<any>;

type UploaderContextType = {
  fileStates: FileState[];
  addFiles: (files: File[]) => void;
  updateFileState: (key: string, changes: Partial<FileState>) => void;
  removeFile: (key: string) => void;
  cancelUpload: (key: string) => void;
  uploadFiles: () => Promise<void>;
  resetFiles: () => void;
  isUploading: boolean;
};

type ProviderProps = {
  children:
    | React.ReactNode
    | ((context: UploaderContextType) => React.ReactNode);
  onChange?: (files: FileState[]) => void | Promise<void>;
  uploadFn: UploadFn;
  value?: FileState[];
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
}) => {
  const [fileStates, setFileStates] = React.useState<FileState[]>(
    externalValue ?? [],
  );
  const [isUploading, setIsUploading] = React.useState(false);

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

  const addFiles = React.useCallback((files: File[]) => {
    const newFileStates = files.map<FileState>((file) => ({
      file,
      key: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      progress: 0,
      status: 'PENDING',
    }));
    setFileStates((prev) => [...prev, ...newFileStates]);
  }, []);

  const removeFile = React.useCallback((key: string) => {
    setFileStates((prev) => prev.filter((fileState) => fileState.key !== key));
  }, []);

  const cancelUpload = React.useCallback(
    (key: string) => {
      const fileState = fileStates.find((f) => f.key === key);
      if (fileState?.abortController) {
        fileState.abortController.abort();
        updateFileState(key, { status: 'PENDING', progress: 0 });
      }
    },
    [fileStates, updateFileState],
  );

  const resetFiles = React.useCallback(() => {
    setFileStates([]);
  }, []);

  const uploadFiles = React.useCallback(async () => {
    setIsUploading(true);

    try {
      await Promise.all(
        fileStates
          .filter((fileState) => fileState.status === 'PENDING')
          .map(async (fileState) => {
            try {
              const abortController = new AbortController();
              updateFileState(fileState.key, {
                abortController,
                status: 'UPLOADING',
                progress: 0,
              });

              await uploadFn({
                file: fileState.file,
                signal: abortController.signal,
                onProgressChange: async (progress) => {
                  updateFileState(fileState.key, { progress });
                  if (progress === 100) {
                    // wait a moment before updating status to complete
                    await new Promise((resolve) => setTimeout(resolve, 500));
                    updateFileState(fileState.key, {
                      status: 'COMPLETE',
                      progress: 100,
                    });
                  }
                },
              });
            } catch (err: unknown) {
              console.error(err);
              if (err instanceof Error && err.name === 'AbortError') {
                updateFileState(fileState.key, {
                  status: 'PENDING',
                  progress: 0,
                  error: 'Upload canceled',
                });
              } else {
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
    } finally {
      setIsUploading(false);
    }
  }, [fileStates, updateFileState, uploadFn]);

  React.useEffect(() => {
    void onChange?.(fileStates);
  }, [fileStates, onChange]);

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
    ],
  );

  return (
    <UploaderContext.Provider value={value}>
      {typeof children === 'function' ? children(value) : children}
    </UploaderContext.Provider>
  );
};
