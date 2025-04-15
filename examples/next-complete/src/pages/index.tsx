import { Button } from '@/components/ui/button';
import { SingleImageDropzone } from '@/components/upload/single-image';
import {
  UploaderProvider,
  UploadFn,
  useUploader,
} from '@/components/upload/uploader-provider';
import { useEdgeStore } from '@/lib/edgestore';
import { cn } from '@/lib/utils';
import { UploadCloudIcon } from 'lucide-react';
import { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { edgeStoreClient } from './api/edgestore/[...edgestore]';

const MAX_SIZE = 1024 * 1024 * 5; // 5MB

type UploadOptions = {
  replaceTargetUrl?: string;
};

export default function Home({
  files: initFiles,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const [files, setFiles] = useState(initFiles);
  const { edgestore } = useEdgeStore();

  const uploadFn: UploadFn<UploadOptions> = useCallback(
    async ({ file, signal, onProgressChange, options }) => {
      const newFileData = await edgestore.myPublicImages.upload({
        file,
        signal,
        onProgressChange,
        input: {
          type: 'post',
          extension: 'jpg',
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

      return newFileData;
    },
    [edgestore],
  );

  return (
    <UploaderProvider uploadFn={uploadFn}>
      <div className="flex flex-col items-center">
        <div className="mb-3 text-lg font-bold">NextJS example</div>
        <ImageInput />
        <div className="mt-5 grid w-full grid-cols-2 gap-3 px-10 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          {files.map((fileData) => (
            <div className="mt-5 aspect-square" key={fileData.url}>
              <ImageFileBlock
                fileData={fileData}
                onDelete={async (fileData) => {
                  await edgestore.myPublicImages.delete({ url: fileData.url });
                  setFiles((files) =>
                    files.filter((f) => f.url !== fileData.url),
                  );
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </UploaderProvider>
  );
}

function ImageInput() {
  const { fileStates, uploadFiles, resetFiles, isUploading } =
    useUploader<UploadOptions>();

  useEffect(() => {
    // Once the upload is complete, clear the input
    if (fileStates[0]?.status === 'COMPLETE') {
      resetFiles();
    }
  }, [fileStates, resetFiles]);

  return (
    <div className="flex flex-col items-center gap-2">
      <SingleImageDropzone
        width={200}
        height={200}
        dropzoneOptions={{ maxSize: MAX_SIZE }}
      />
      <Button
        onClick={() => uploadFiles()}
        className="flex items-center gap-2 pl-3"
        disabled={
          isUploading || !fileStates.some((file) => file.status === 'PENDING')
        }
      >
        <UploadCloudIcon className="h-4 w-4" />
        <span>{isUploading ? 'Uploading...' : 'Upload Files'}</span>
      </Button>
    </div>
  );
}

function ImageFileBlock(params: {
  fileData: FileRes;
  onDelete?: (fileData: FileRes) => void | Promise<void>;
}) {
  const { fileStates, uploadFiles } = useUploader<UploadOptions>();
  const { fileData, onDelete } = params;
  const [loading, setLoading] = useState(false);
  const newFileState = fileStates.find((file) => file.status === 'PENDING');

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
            {newFileState && (
              <Button
                onClick={async () => {
                  try {
                    setLoading(true);
                    await uploadFiles([newFileState.key], {
                      replaceTargetUrl: fileData.url,
                    });
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
