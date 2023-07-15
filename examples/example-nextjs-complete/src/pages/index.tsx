import { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import { useState } from 'react';
import { twMerge } from 'tailwind-merge';
import ImageInput from '../components/ImageInput';
import { useEdgeStore } from '../utils/edgestore';

const MAX_SIZE = 1024 * 1024 * 5; // 5MB

export default function Home({
  numbers,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const [file, setFile] = useState<File>();
  const [progress, setProgress] = useState<number | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const { edgestore, getSrc } = useEdgeStore();

  const handleUpload = async () => {
    if (!file) {
      return;
    }
    try {
      const { url } = await edgestore.images.upload({
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
      });
      // wait 2 seconds to make sure the image is available
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setUrl(getSrc(url));
    } catch (e) {
      console.error(e);
      return;
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
        <Button onClick={handleUpload} disabled={!file || progress !== null}>
          Upload
        </Button>
      </div>
      <ProgressBar progress={progress} />
      {url && (
        <div className="mt-5">
          <img src={url} alt="Example" />
        </div>
      )}
      {numbers.map((number) => (
        <div key={number}>{number}</div>
      ))}
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
}> = ({ children, onClick, disabled }) => {
  return (
    <button
      className={twMerge(
        'rounded bg-violet-600 px-2 py-1 font-bold uppercase text-white transition-colors duration-300 hover:bg-violet-500',
        disabled &&
          'pointer-events-none cursor-default bg-gray-800 text-opacity-50',
      )}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

export const getServerSideProps: GetServerSideProps<{
  numbers: number[];
}> = async () => {
  // wait 1 second
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return { props: { numbers: [1, 2, 3, 4] } };
};
