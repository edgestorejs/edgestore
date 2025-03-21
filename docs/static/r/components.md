# Dependencies

```bash
npm install tailwind-merge react-dropzone lucide-react
```

# Single-image Dropzone

## Component

```tsx
'use client';

import { formatFileSize } from '@edgestore/react/utils';
import { UploadCloudIcon, X } from 'lucide-react';
import * as React from 'react';
import { useDropzone, type DropzoneOptions } from 'react-dropzone';
import { twMerge } from 'tailwind-merge';

const variants = {
  base: 'relative rounded-md flex justify-center items-center flex-col cursor-pointer min-h-[150px] min-w-[200px] border border-dashed border-gray-400 dark:border-gray-300 transition-colors duration-200 ease-in-out',
  image:
    'border-0 p-0 min-h-0 min-w-0 relative shadow-md bg-slate-200 dark:bg-slate-900 rounded-md',
  active: 'border-2',
  disabled:
    'bg-gray-200 border-gray-300 cursor-default pointer-events-none bg-opacity-30 dark:bg-gray-700',
  accept: 'border border-blue-500 bg-blue-500 bg-opacity-10',
  reject: 'border border-red-700 bg-red-700 bg-opacity-10',
};

type InputProps = {
  width: number;
  height: number;
  className?: string;
  value?: File | string;
  onChange?: (file?: File) => void | Promise<void>;
  disabled?: boolean;
  dropzoneOptions?: Omit<DropzoneOptions, 'disabled'>;
};

const ERROR_MESSAGES = {
  fileTooLarge(maxSize: number) {
    return `The file is too large. Max size is ${formatFileSize(maxSize)}.`;
  },
  fileInvalidType() {
    return 'Invalid file type.';
  },
  tooManyFiles(maxFiles: number) {
    return `You can only add ${maxFiles} file(s).`;
  },
  fileNotSupported() {
    return 'The file is not supported.';
  },
};

const SingleImageDropzone = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { dropzoneOptions, width, height, value, className, disabled, onChange },
    ref,
  ) => {
    const imageUrl = React.useMemo(() => {
      if (typeof value === 'string') {
        // in case an url is passed in, use it to display the image
        return value;
      } else if (value) {
        // in case a file is passed in, create a base64 url to display the image
        return URL.createObjectURL(value);
      }
      return null;
    }, [value]);

    // dropzone configuration
    const {
      getRootProps,
      getInputProps,
      acceptedFiles,
      fileRejections,
      isFocused,
      isDragAccept,
      isDragReject,
    } = useDropzone({
      accept: { 'image/*': [] },
      multiple: false,
      disabled,
      onDrop: (acceptedFiles) => {
        const file = acceptedFiles[0];
        if (file) {
          void onChange?.(file);
        }
      },
      ...dropzoneOptions,
    });

    // styling
    const dropZoneClassName = React.useMemo(
      () =>
        twMerge(
          variants.base,
          isFocused && variants.active,
          disabled && variants.disabled,
          imageUrl && variants.image,
          (isDragReject ?? fileRejections[0]) && variants.reject,
          isDragAccept && variants.accept,
          className,
        ).trim(),
      [\
        isFocused,\
        imageUrl,\
        fileRejections,\
        isDragAccept,\
        isDragReject,\
        disabled,\
        className,\
      ],
    );

    // error validation messages
    const errorMessage = React.useMemo(() => {
      if (fileRejections[0]) {
        const { errors } = fileRejections[0];
        if (errors[0]?.code === 'file-too-large') {
          return ERROR_MESSAGES.fileTooLarge(dropzoneOptions?.maxSize ?? 0);
        } else if (errors[0]?.code === 'file-invalid-type') {
          return ERROR_MESSAGES.fileInvalidType();
        } else if (errors[0]?.code === 'too-many-files') {
          return ERROR_MESSAGES.tooManyFiles(dropzoneOptions?.maxFiles ?? 0);
        } else {
          return ERROR_MESSAGES.fileNotSupported();
        }
      }
      return undefined;
    }, [fileRejections, dropzoneOptions]);

    return (
      <div>
        <div
          {...getRootProps({
            className: dropZoneClassName,
            style: {
              width,
              height,
            },
          })}
        >
          {/* Main File Input */}
          <input ref={ref} {...getInputProps()} />

          {imageUrl ? (
            // Image Preview
            <img
              className="h-full w-full rounded-md object-cover"
              src={imageUrl}
              alt={acceptedFiles[0]?.name}
            />
          ) : (
            // Upload Icon
            <div className="flex flex-col items-center justify-center text-xs text-gray-400">
              <UploadCloudIcon className="mb-2 h-7 w-7" />
              <div className="text-gray-400">drag & drop to upload</div>
              <div className="mt-3">
                <Button type="button" disabled={disabled}>
                  select
                </Button>
              </div>
            </div>
          )}

          {/* Remove Image Icon */}
          {imageUrl && !disabled && (
            <div
              className="group absolute right-0 top-0 -translate-y-1/4 translate-x-1/4 transform"
              onClick={(e) => {
                e.stopPropagation();
                void onChange?.(undefined);
              }}
            >
              <div className="flex h-5 w-5 items-center justify-center rounded-md border border-solid border-gray-500 bg-white transition-all duration-300 hover:h-6 hover:w-6 dark:border-gray-400 dark:bg-black">
                <X
                  className="text-gray-500 dark:text-gray-400"
                  width={16}
                  height={16}
                />
              </div>
            </div>
          )}
        </div>

        {/* Error Text */}
        <div className="mt-1 text-xs text-red-500">{errorMessage}</div>
      </div>
    );
  },
);
SingleImageDropzone.displayName = 'SingleImageDropzone';

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => {
  return (
    <button
      className={twMerge(
        // base
        'focus-visible:ring-ring inline-flex cursor-pointer items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50',
        // color
        'border border-gray-400 text-gray-400 shadow hover:bg-gray-100 hover:text-gray-500 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700',
        // size
        'h-6 rounded-md px-2 text-xs',
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Button.displayName = 'Button';

export { SingleImageDropzone };
```

## Usage

```tsx
'use client';

import { SingleImageDropzone } from '@/components/SingleImageDropzone';
import { useEdgeStore } from '@/lib/edgestore';
import { useState } from 'react';

export function SingleImageDropzoneUsage() {
  const [file, setFile] = useState<File>();
  const { edgestore } = useEdgeStore();

  return (
    <div>
      <SingleImageDropzone
        width={200}
        height={200}
        value={file}
        onChange={(file) => {
          setFile(file);
        }}
      />
      <button
        onClick={async () => {
          if (file) {
            const res = await edgestore.publicFiles.upload({
              file,
              onProgressChange: (progress) => {
                // you can use this to show a progress bar
                console.log(progress);
              },
            });
            // you can run some server action or api here
            // to add the necessary data to your database
            console.log(res);
          }
        }}
      >
        Upload
      </button>
    </div>
  );
}
```

# Multi-image Dropzone

## Component

```tsx
'use client';

import { formatFileSize } from '@edgestore/react/utils';
import { UploadCloudIcon, X } from 'lucide-react';
import * as React from 'react';
import { useDropzone, type DropzoneOptions } from 'react-dropzone';
import { twMerge } from 'tailwind-merge';

const variants = {
  base: 'relative rounded-md aspect-square flex justify-center items-center flex-col cursor-pointer min-h-[150px] min-w-[200px] border border-dashed border-gray-400 dark:border-gray-300 transition-colors duration-200 ease-in-out',
  image:
    'border-0 p-0 w-full h-full relative shadow-md bg-slate-200 dark:bg-slate-900 rounded-md',
  active: 'border-2',
  disabled:
    'bg-gray-200 border-gray-300 cursor-default pointer-events-none bg-opacity-30 dark:bg-gray-700',
  accept: 'border border-blue-500 bg-blue-500 bg-opacity-10',
  reject: 'border border-red-700 bg-red-700 bg-opacity-10',
};

export type FileState = {
  file: File | string;
  key: string; // used to identify the file in the progress callback
  progress: 'PENDING' | 'COMPLETE' | 'ERROR' | number;
};

type InputProps = {
  className?: string;
  value?: FileState[];
  onChange?: (files: FileState[]) => void | Promise<void>;
  onFilesAdded?: (addedFiles: FileState[]) => void | Promise<void>;
  disabled?: boolean;
  dropzoneOptions?: Omit<DropzoneOptions, 'disabled'>;
};

const ERROR_MESSAGES = {
  fileTooLarge(maxSize: number) {
    return `The file is too large. Max size is ${formatFileSize(maxSize)}.`;
  },
  fileInvalidType() {
    return 'Invalid file type.';
  },
  tooManyFiles(maxFiles: number) {
    return `You can only add ${maxFiles} file(s).`;
  },
  fileNotSupported() {
    return 'The file is not supported.';
  },
};

const MultiImageDropzone = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { dropzoneOptions, value, className, disabled, onChange, onFilesAdded },
    ref,
  ) => {
    const [customError, setCustomError] = React.useState<string>();

    const imageUrls = React.useMemo(() => {
      if (value) {
        return value.map((fileState) => {
          if (typeof fileState.file === 'string') {
            // in case an url is passed in, use it to display the image
            return fileState.file;
          } else {
            // in case a file is passed in, create a base64 url to display the image
            return URL.createObjectURL(fileState.file);
          }
        });
      }
      return [];
    }, [value]);

    // dropzone configuration
    const {
      getRootProps,
      getInputProps,
      fileRejections,
      isFocused,
      isDragAccept,
      isDragReject,
    } = useDropzone({
      accept: { 'image/*': [] },
      disabled,
      onDrop: (acceptedFiles) => {
        const files = acceptedFiles;
        setCustomError(undefined);
        if (
          dropzoneOptions?.maxFiles &&
          (value?.length ?? 0) + files.length > dropzoneOptions.maxFiles
        ) {
          setCustomError(ERROR_MESSAGES.tooManyFiles(dropzoneOptions.maxFiles));
          return;
        }
        if (files) {
          const addedFiles = files.map<FileState>((file) => ({
            file,
            key: Math.random().toString(36).slice(2),
            progress: 'PENDING',
          }));
          void onFilesAdded?.(addedFiles);
          void onChange?.([...(value ?? []), ...addedFiles]);
        }
      },
      ...dropzoneOptions,
    });

    // styling
    const dropZoneClassName = React.useMemo(
      () =>
        twMerge(
          variants.base,
          isFocused && variants.active,
          disabled && variants.disabled,
          (isDragReject ?? fileRejections[0]) && variants.reject,
          isDragAccept && variants.accept,
          className,
        ).trim(),
      [\
        isFocused,\
        fileRejections,\
        isDragAccept,\
        isDragReject,\
        disabled,\
        className,\
      ],
    );

    // error validation messages
    const errorMessage = React.useMemo(() => {
      if (fileRejections[0]) {
        const { errors } = fileRejections[0];
        if (errors[0]?.code === 'file-too-large') {
          return ERROR_MESSAGES.fileTooLarge(dropzoneOptions?.maxSize ?? 0);
        } else if (errors[0]?.code === 'file-invalid-type') {
          return ERROR_MESSAGES.fileInvalidType();
        } else if (errors[0]?.code === 'too-many-files') {
          return ERROR_MESSAGES.tooManyFiles(dropzoneOptions?.maxFiles ?? 0);
        } else {
          return ERROR_MESSAGES.fileNotSupported();
        }
      }
      return undefined;
    }, [fileRejections, dropzoneOptions]);

    return (
      <div>
        <div className="grid grid-cols-[repeat(1,1fr)] gap-2 sm:grid-cols-[repeat(2,1fr)] lg:grid-cols-[repeat(3,1fr)] xl:grid-cols-[repeat(4,1fr)]">
          {/* Images */}
          {value?.map(({ file, progress }, index) => (
            <div key={index} className={variants.image + ' aspect-square'}>
              <img
                className="h-full w-full rounded-md object-cover"
                src={imageUrls[index]}
                alt={typeof file === 'string' ? file : file.name}
              />
              {/* Progress Bar */}
              {typeof progress === 'number' && (
                <div className="absolute top-0 left-0 flex h-full w-full items-center justify-center rounded-md bg-black bg-opacity-70">
                  <CircleProgress progress={progress} />
                </div>
              )}
              {/* Remove Image Icon */}
              {imageUrls[index] && !disabled && progress === 'PENDING' && (
                <div
                  className="group absolute right-0 top-0 -translate-y-1/4 translate-x-1/4 transform"
                  onClick={(e) => {
                    e.stopPropagation();
                    void onChange?.(value.filter((_, i) => i !== index) ?? []);
                  }}
                >
                  <div className="flex h-5 w-5 cursor-pointer items-center justify-center rounded-md border border-solid border-gray-500 bg-white transition-all duration-300 hover:h-6 hover:w-6 dark:border-gray-400 dark:bg-black">
                    <X
                      className="text-gray-500 dark:text-gray-400"
                      width={16}
                      height={16}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Dropzone */}
          {(!value || value.length < (dropzoneOptions?.maxFiles ?? 0)) && (
            <div
              {...getRootProps({
                className: dropZoneClassName,
              })}
            >
              {/* Main File Input */}
              <input ref={ref} {...getInputProps()} />
              <div className="flex flex-col items-center justify-center text-xs text-gray-400">
                <UploadCloudIcon className="mb-2 h-7 w-7" />
                <div className="text-gray-400">drag & drop to upload</div>
                <div className="mt-3">
                  <Button type="button" disabled={disabled}>
                    select
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
        {/* Error Text */}
        <div className="mt-1 text-xs text-red-500">
          {customError ?? errorMessage}
        </div>
      </div>
    );
  },
);
MultiImageDropzone.displayName = 'MultiImageDropzone';

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => {
  return (
    <button
      className={twMerge(
        // base
        'focus-visible:ring-ring inline-flex cursor-pointer items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50',
        // color
        'border border-gray-400 text-gray-400 shadow hover:bg-gray-100 hover:text-gray-500 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700',
        // size
        'h-6 rounded-md px-2 text-xs',
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Button.displayName = 'Button';

export { MultiImageDropzone };

function CircleProgress({ progress }: { progress: number }) {
  const strokeWidth = 10;
  const radius = 50;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="relative h-16 w-16">
      <svg
        className="absolute top-0 left-0 -rotate-90 transform"
        width="100%"
        height="100%"
        viewBox={`0 0 ${(radius + strokeWidth) * 2} ${
          (radius + strokeWidth) * 2
        }`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          className="text-gray-400"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          cx={radius + strokeWidth}
          cy={radius + strokeWidth}
          r={radius}
        />
        <circle
          className="text-white transition-all duration-300 ease-in-out"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={((100 - progress) / 100) * circumference}
          strokeLinecap="round"
          fill="none"
          cx={radius + strokeWidth}
          cy={radius + strokeWidth}
          r={radius}
        />
      </svg>
      <div className="absolute top-0 left-0 flex h-full w-full items-center justify-center text-xs text-white">
        {Math.round(progress)}%
      </div>
    </div>
  );
}
```

## Usage

```tsx
'use client';

import {
  MultiImageDropzone,
  type FileState,
} from '@/components/MultiImageDropzone';
import { useEdgeStore } from '@/lib/edgestore';
import { useState } from 'react';

export function MultiImageDropzoneUsage() {
  const [fileStates, setFileStates] = useState<FileState[]>([]);
  const { edgestore } = useEdgeStore();

  function updateFileProgress(key: string, progress: FileState['progress']) {
    setFileStates((fileStates) => {
      const newFileStates = structuredClone(fileStates);
      const fileState = newFileStates.find(
        (fileState) => fileState.key === key,
      );
      if (fileState) {
        fileState.progress = progress;
      }
      return newFileStates;
    });
  }

  return (
    <div>
      <MultiImageDropzone
        value={fileStates}
        dropzoneOptions={{
          maxFiles: 6,
        }}
        onChange={(files) => {
          setFileStates(files);
        }}
        onFilesAdded={async (addedFiles) => {
          setFileStates([...fileStates, ...addedFiles]);
          await Promise.all(
            addedFiles.map(async (addedFileState) => {
              try {
                const res = await edgestore.publicFiles.upload({
                  file: addedFileState.file,
                  onProgressChange: async (progress) => {
                    updateFileProgress(addedFileState.key, progress);
                    if (progress === 100) {
                      // wait 1 second to set it to complete
                      // so that the user can see the progress bar at 100%
                      await new Promise((resolve) => setTimeout(resolve, 1000));
                      updateFileProgress(addedFileState.key, 'COMPLETE');
                    }
                  },
                });
                console.log(res);
              } catch (err) {
                updateFileProgress(addedFileState.key, 'ERROR');
              }
            }),
          );
        }}
      />
    </div>
  );
}
```

# Multi-file Dropzone

## Component

```tsx
'use client';

import { formatFileSize } from '@edgestore/react/utils';
import {
  CheckCircleIcon,
  FileIcon,
  LucideFileWarning,
  Trash2Icon,
  UploadCloudIcon,
  XIcon,
} from 'lucide-react';
import * as React from 'react';
import { useDropzone, type DropzoneOptions } from 'react-dropzone';
import { twMerge } from 'tailwind-merge';

const variants = {
  base: 'relative rounded-md p-4 w-full flex justify-center items-center flex-col cursor-pointer border border-dashed border-gray-400 dark:border-gray-300 transition-colors duration-200 ease-in-out',
  active: 'border-2',
  disabled:
    'bg-gray-200 border-gray-300 cursor-default pointer-events-none bg-opacity-30 dark:bg-gray-700 dark:border-gray-600',
  accept: 'border border-blue-500 bg-blue-500 bg-opacity-10',
  reject: 'border border-red-700 bg-red-700 bg-opacity-10',
};

export type FileState = {
  file: File;
  key: string; // used to identify the file in the progress callback
  progress: 'PENDING' | 'COMPLETE' | 'ERROR' | number;
  abortController?: AbortController;
};

type InputProps = {
  className?: string;
  value?: FileState[];
  onChange?: (files: FileState[]) => void | Promise<void>;
  onFilesAdded?: (addedFiles: FileState[]) => void | Promise<void>;
  disabled?: boolean;
  dropzoneOptions?: Omit<DropzoneOptions, 'disabled'>;
};

const ERROR_MESSAGES = {
  fileTooLarge(maxSize: number) {
    return `The file is too large. Max size is ${formatFileSize(maxSize)}.`;
  },
  fileInvalidType() {
    return 'Invalid file type.';
  },
  tooManyFiles(maxFiles: number) {
    return `You can only add ${maxFiles} file(s).`;
  },
  fileNotSupported() {
    return 'The file is not supported.';
  },
};

const MultiFileDropzone = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { dropzoneOptions, value, className, disabled, onFilesAdded, onChange },
    ref,
  ) => {
    const [customError, setCustomError] = React.useState<string>();
    if (dropzoneOptions?.maxFiles && value?.length) {
      disabled = disabled ?? value.length >= dropzoneOptions.maxFiles;
    }
    // dropzone configuration
    const {
      getRootProps,
      getInputProps,
      fileRejections,
      isFocused,
      isDragAccept,
      isDragReject,
    } = useDropzone({
      disabled,
      onDrop: (acceptedFiles) => {
        const files = acceptedFiles;
        setCustomError(undefined);
        if (
          dropzoneOptions?.maxFiles &&
          (value?.length ?? 0) + files.length > dropzoneOptions.maxFiles
        ) {
          setCustomError(ERROR_MESSAGES.tooManyFiles(dropzoneOptions.maxFiles));
          return;
        }
        if (files) {
          const addedFiles = files.map<FileState>((file) => ({
            file,
            key: Math.random().toString(36).slice(2),
            progress: 'PENDING',
          }));
          void onFilesAdded?.(addedFiles);
          void onChange?.([...(value ?? []), ...addedFiles]);
        }
      },
      ...dropzoneOptions,
    });

    // styling
    const dropZoneClassName = React.useMemo(
      () =>
        twMerge(
          variants.base,
          isFocused && variants.active,
          disabled && variants.disabled,
          (isDragReject ?? fileRejections[0]) && variants.reject,
          isDragAccept && variants.accept,
          className,
        ).trim(),
      [\
        isFocused,\
        fileRejections,\
        isDragAccept,\
        isDragReject,\
        disabled,\
        className,\
      ],
    );

    // error validation messages
    const errorMessage = React.useMemo(() => {
      if (fileRejections[0]) {
        const { errors } = fileRejections[0];
        if (errors[0]?.code === 'file-too-large') {
          return ERROR_MESSAGES.fileTooLarge(dropzoneOptions?.maxSize ?? 0);
        } else if (errors[0]?.code === 'file-invalid-type') {
          return ERROR_MESSAGES.fileInvalidType();
        } else if (errors[0]?.code === 'too-many-files') {
          return ERROR_MESSAGES.tooManyFiles(dropzoneOptions?.maxFiles ?? 0);
        } else {
          return ERROR_MESSAGES.fileNotSupported();
        }
      }
      return undefined;
    }, [fileRejections, dropzoneOptions]);

    return (
      <div className="w-full">
        <div className="flex w-full flex-col gap-2">
          <div className="w-full">
            {/* Main File Input */}
            <div
              {...getRootProps({
                className: dropZoneClassName,
              })}
            >
              <input ref={ref} {...getInputProps()} />
              <div className="flex flex-col items-center justify-center text-xs text-gray-400">
                <UploadCloudIcon className="mb-1 h-7 w-7" />
                <div className="text-gray-400">
                  drag & drop or click to upload
                </div>
              </div>
            </div>

            {/* Error Text */}
            <div className="mt-1 text-xs text-red-500">
              {customError ?? errorMessage}
            </div>
          </div>

          {/* Selected Files */}
          {value?.map(({ file, abortController, progress }, i) => (
            <div
              key={i}
              className="flex h-16 w-full flex-col justify-center rounded border border-gray-300 px-4 py-2"
            >
              <div className="flex items-center gap-2 text-gray-500 dark:text-white">
                <FileIcon size="30" className="shrink-0" />
                <div className="min-w-0 text-sm">
                  <div className="overflow-hidden overflow-ellipsis whitespace-nowrap">
                    {file.name}
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-400">
                    {formatFileSize(file.size)}
                  </div>
                </div>
                <div className="grow" />
                <div className="flex w-12 justify-end text-xs">
                  {progress === 'PENDING' ? (
                    <button
                      type="button"
                      className="rounded-md p-1 transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                      onClick={() => {
                        void onChange?.(
                          value.filter((_, index) => index !== i),
                        );
                      }}
                    >
                      <Trash2Icon className="shrink-0" />
                    </button>
                  ) : progress === 'ERROR' ? (
                    <LucideFileWarning className="shrink-0 text-red-600 dark:text-red-400" />
                  ) : progress !== 'COMPLETE' ? (
                    <div className="flex flex-col items-end gap-0.5">
                      {abortController && (
                        <button
                          type="button"
                          className="rounded-md p-0.5 transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                          disabled={progress === 100}
                          onClick={() => {
                            abortController.abort();
                          }}
                        >
                          <XIcon className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-400" />
                        </button>
                      )}
                      <div>{Math.round(progress)}%</div>
                    </div>
                  ) : (
                    <CheckCircleIcon className="shrink-0 text-green-600 dark:text-gray-400" />
                  )}
                </div>
              </div>
              {/* Progress Bar */}
              {typeof progress === 'number' && (
                <div className="relative h-0">
                  <div className="absolute top-1 h-1 w-full overflow-clip rounded-full bg-gray-200 dark:bg-gray-700">
                    <div
                      className="h-full bg-gray-400 transition-all duration-300 ease-in-out dark:bg-white"
                      style={{
                        width: progress ? `${progress}%` : '0%',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  },
);
MultiFileDropzone.displayName = 'MultiFileDropzone';

export { MultiFileDropzone };
```

## Usage

```tsx
'use client';

import {
  MultiFileDropzone,
  type FileState,
} from '@/components/MultiFileDropzone';
import { useEdgeStore } from '@/lib/edgestore';
import { useState } from 'react';

export function MultiFileDropzoneUsage() {
  const [fileStates, setFileStates] = useState<FileState[]>([]);
  const { edgestore } = useEdgeStore();

  function updateFileProgress(key: string, progress: FileState['progress']) {
    setFileStates((fileStates) => {
      const newFileStates = structuredClone(fileStates);
      const fileState = newFileStates.find(
        (fileState) => fileState.key === key,
      );
      if (fileState) {
        fileState.progress = progress;
      }
      return newFileStates;
    });
  }

  return (
    <div>
      <MultiFileDropzone
        value={fileStates}
        onChange={(files) => {
          setFileStates(files);
        }}
        onFilesAdded={async (addedFiles) => {
          setFileStates([...fileStates, ...addedFiles]);
          await Promise.all(
            addedFiles.map(async (addedFileState) => {
              try {
                const res = await edgestore.publicFiles.upload({
                  file: addedFileState.file,
                  onProgressChange: async (progress) => {
                    updateFileProgress(addedFileState.key, progress);
                    if (progress === 100) {
                      // wait 1 second to set it to complete
                      // so that the user can see the progress bar at 100%
                      await new Promise((resolve) => setTimeout(resolve, 1000));
                      updateFileProgress(addedFileState.key, 'COMPLETE');
                    }
                  },
                });
                console.log(res);
              } catch (err) {
                updateFileProgress(addedFileState.key, 'ERROR');
              }
            }),
          );
        }}
      />
    </div>
  );
}
```
