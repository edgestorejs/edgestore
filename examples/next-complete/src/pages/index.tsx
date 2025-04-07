import ImageInput from '@/components/ImageInput';
import { useEdgeStore } from '@/lib/edgestore';
import { cn } from '@/lib/utils';
import { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import Image from 'next/image';
import { useState } from 'react';
import { edgeStoreClient } from './api/edgestore/[...edgestore]';

const MAX_SIZE = 1024 * 1024 * 5; // 5MB

export default function Home({
  files: initFiles,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const [file, setFile] = useState<File>();
  const [files, setFiles] = useState(initFiles);
  const [progress, setProgress] = useState<number | null>(null);
  const { edgestore } = useEdgeStore();

  const uploadFile = async (options?: { replaceTargetUrl?: string }) => {
    try {
      if (!file) {
        return;
      }
      const newFileData = await edgestore.myPublicImages.upload({
        file,
        input: {
          type: 'post',
          extension: 'jpg',
        },
        onProgressChange: (progress) => {
          setProgress(progress);
          if (progress === 100) {
            setTimeout(() => {
              setProgress(null);
            }, 1000);
          }
        },
        options: {
          replaceTargetUrl: options?.replaceTargetUrl,
        },
      });

      const parsedNewFile: FileRes = {
        ...newFileData,
        base64Url: URL.createObjectURL(file),
      };

      if (options?.replaceTargetUrl) {
        setFiles((files) => [
          parsedNewFile,
          ...files.filter((f) => f.url !== options.replaceTargetUrl),
        ]);
      } else {
        setFiles((files) => [parsedNewFile, ...files]);
      }
      setFile(undefined);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className="mb-3 text-lg font-bold">NextJS example</div>
      <div>
        <ImageInput
          height={200}
          width={200}
          value={file}
          maxSize={MAX_SIZE}
          onChange={(file) => {
            setFile(file);
          }}
        />
      </div>
      <div className="mt-3" />
      <div>
        <Button
          onClick={() => uploadFile()}
          disabled={!file || progress !== null}
        >
          Upload
        </Button>
      </div>
      <ProgressBar progress={progress} />
      <div className="mt-5 grid w-full grid-cols-2 gap-3 px-10 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
        {files.map((fileData) => (
          <div className="mt-5 aspect-square" key={fileData.url}>
            <ImageFileBlock
              fileData={fileData}
              // when the newFile is set, the replace button will be shown
              newFile={progress !== null ? undefined : file}
              onDelete={async (fileData) => {
                await edgestore.myPublicImages.delete({ url: fileData.url });
                setFiles((files) =>
                  files.filter((f) => f.url !== fileData.url),
                );
              }}
              onReplace={async (originalFile) => {
                await uploadFile({
                  replaceTargetUrl: originalFile.url,
                });
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function ImageFileBlock(params: {
  fileData: FileRes;
  newFile?: File;
  onDelete?: (fileData: FileRes) => void | Promise<void>;
  onReplace?: (originalFile: FileRes, newFile: File) => void | Promise<void>;
}) {
  const { fileData, newFile, onDelete, onReplace } = params;
  const [loading, setLoading] = useState(false);
  return (
    <div className="group relative h-full w-full">
      <Image
        fill
        sizes="200px"
        className="object-cover"
        src={fileData.base64Url ?? fileData.thumbnailUrl ?? fileData.url}
        alt="Example"
      />
      <div
        className={cn(
          'absolute left-0 top-0 flex h-full w-full flex-col items-center justify-center gap-2 bg-black bg-opacity-50 opacity-0 transition-all duration-300 group-hover:opacity-100',
          loading && 'opacity-100',
        )}
      >
        {loading ? (
          <div className="text-white">Loading...</div>
        ) : (
          <>
            <Button
              onClick={async () => {
                try {
                  setLoading(true);
                  await onDelete?.(fileData);
                } finally {
                  setLoading(false);
                }
              }}
            >
              Delete
            </Button>
            {newFile && (
              <Button
                onClick={async () => {
                  try {
                    setLoading(true);
                    await onReplace?.(fileData, newFile);
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                Replace
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ProgressBar({ progress }: { progress: number | null }) {
  return (
    <>
      {progress !== null && (
        <>
          <div className="my-2 h-2 w-[200px] border border-violet-300">
            <div
              className="h-full bg-violet-500 transition-all duration-300"
              style={{
                width: `${progress ?? 0}%`,
              }}
            />
          </div>
        </>
      )}
    </>
  );
}

const Button: React.FC<{
  children?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}> = ({ children, onClick, disabled, className }) => {
  return (
    <button
      className={cn(
        'rounded bg-violet-600 px-2 py-1 font-bold uppercase text-white transition-colors duration-300 hover:bg-violet-500',
        disabled &&
          'pointer-events-none cursor-default bg-gray-800 text-opacity-50',
        className,
      )}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

type FileRes = {
  url: string;
  thumbnailUrl?: string | null;
  base64Url?: string;
};

export const getServerSideProps: GetServerSideProps<{
  files: FileRes[];
}> = async () => {
  const res = await edgeStoreClient.myPublicImages.listFiles({
    filter: {
      uploadedAt: {
        gt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7), // 7 days
      },
    },
  });
  return {
    props: {
      files: res.data.map((file) => ({
        url: file.url,
        thumbnailUrl: file.thumbnailUrl,
      })),
    },
  };
};
