import Image from 'next/image';
import { useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { IoCloseSharp, IoCloudUploadOutline } from 'react-icons/io5';
import { twMerge } from 'tailwind-merge';

const className = {
  base: 'relative flex justify-center items-center flex-col cursor-pointer min-h-[150px] min-w-[200px] border border-dashed border-[#C6CAD8] transition-colors duration-200 ease-in-out',
  image:
    'border-0 p-0 min-h-0 min-w-0 relative shadow-md bg-slate-900 rounded-md',
  active: 'border-2',
  disabled: 'bg-gray-700 cursor-default pointer-events-none bg-opacity-30',
  accept: 'border border-blue-500 bg-blue-500 bg-opacity-10',
  reject: 'border border-red-700 bg-red-700 bg-opacity-10',
};

const ImageInput: React.FC<{
  value?: File | string;
  error?: string;
  width: number;
  height: number;
  maxSize: number;
  disabled?: boolean;
  onChange?: (file?: File) => void | Promise<void>;
}> = ({ value, error, width, height, maxSize, disabled, onChange }) => {
  const imageUrl = useMemo(() => {
    if (typeof value === 'string') {
      return value;
    } else if (value) {
      return URL.createObjectURL(value);
    }
    return null;
  }, [value]);

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
    maxSize,
    disabled,
    onDrop: async (acceptedFiles) => {
      const file = acceptedFiles[0];
      if (file) {
        await onChange?.(file);
      }
    },
  });

  const dropZoneClassName = useMemo(
    () =>
      twMerge(
        className.base,
        isFocused && className.active,
        disabled && className.disabled,
        imageUrl && className.image,
        (isDragReject ?? fileRejections[0] ?? error) && className.reject,
        isDragAccept && className.accept,
      ).trim(),
    [
      isFocused,
      imageUrl,
      fileRejections,
      isDragAccept,
      isDragReject,
      error,
      disabled,
    ],
  );

  const errorMessage = useMemo(() => {
    if (fileRejections[0]) {
      const { errors } = fileRejections[0];
      if (errors[0]?.code === 'file-too-large') {
        return `The file is too large. Max size is ${getMaxSizeText(maxSize)}.`;
      } else if (errors[0]?.code === 'file-invalid-type') {
        return 'Invalid file type.';
      } else if (errors[0]?.code === 'too-many-files') {
        return 'You can only upload one file.';
      } else {
        return 'The file is not supported.';
      }
    }
    return undefined;
  }, [fileRejections, maxSize]);

  return (
    <div>
      <div
        {...getRootProps({
          className: dropZoneClassName,
          style: {
            width: imageUrl ? '200px' : width,
            height: imageUrl ? undefined : height,
          },
        })}
      >
        <input {...getInputProps()} />
        {imageUrl ? (
          <div>
            <Image
              width={width}
              height={height}
              className="rounded-md object-cover"
              src={imageUrl}
              alt={acceptedFiles[0]?.name}
            />
          </div>
        ) : (
          <div className="text-blue-gray-500 flex flex-col items-center justify-center text-xs">
            <IoCloudUploadOutline className="mb-2 h-7 w-7" />
            <div>Drag & drop to upload</div>
            <div className="mt-3">
              <Button disabled={disabled}>select</Button>
            </div>
          </div>
        )}
        {imageUrl && !disabled && (
          <div
            className="group absolute right-0 top-0 -translate-y-1/4 translate-x-1/4 transform"
            onClick={async (e) => {
              e.stopPropagation();
              await onChange?.(undefined);
            }}
          >
            <div className="bg-blue-gray-600 flex h-5 w-5 items-center justify-center rounded-md bg-gray-500 transition-all duration-300 hover:h-6 hover:w-6 hover:bg-gray-700">
              <IoCloseSharp color="white" width={16} height={16} />
            </div>
          </div>
        )}
      </div>
      <ErrorText>{errorMessage ?? error}</ErrorText>
    </div>
  );
};

export default ImageInput;

const Button: React.FC<{ children?: string; disabled?: boolean }> = ({
  children,
  disabled,
}) => {
  return (
    <button
      className={twMerge(
        'rounded bg-violet-600 px-2 py-1 font-bold uppercase text-white transition-colors duration-300 hover:bg-violet-500',
        disabled &&
          'pointer-events-none cursor-default bg-gray-800 text-opacity-50',
      )}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

const ErrorText: React.FC<{ children?: string }> = ({ children }) => {
  if (!children) return null;
  return (
    <div className="mt-1 text-xs text-red-500" role="alert">
      {children}
    </div>
  );
};

function getMaxSizeText(maxSize: number) {
  return maxSize >= 1024 * 1024
    ? formatNumber(maxSize / (1024 * 1024)) + 'MB'
    : maxSize >= 1024
    ? formatNumber(maxSize / 1024) + 'KB'
    : formatNumber(maxSize) + 'B';
}

function formatNumber(num: number) {
  return num.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}
