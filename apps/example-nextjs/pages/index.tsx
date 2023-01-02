import { useEdgeStore } from "@edge-store/react";
import { useState } from "react";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const { uploadImage } = useEdgeStore();

  const handleUpload = async () => {
    if (!file) {
      return;
    }
    const url = await uploadImage(file, {
      onProgressChange: (progress) => {
        setProgress(progress);
      },
    });
  };
  return (
    <div>
      <div>NextJS example</div>
      <div>
        <input
          type="file"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
          }}
        />
      </div>
      <div>
        <input
          type="button"
          value="Upload"
          onClick={handleUpload}
          disabled={!file || progress !== null}
        />
      </div>
      <ProgressBar progress={progress} />
    </div>
  );
}

function ProgressBar({ progress }: { progress: number | null }) {
  return (
    <>
      {progress !== null && (
        <>
          {progress !== 100 ? (
            <div
              style={{
                border: "1px solid white",
                width: "300px",
                height: "10px",
                margin: "4px 0",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${progress ?? 0}%`,
                  backgroundColor: "blue",
                }}
              />
            </div>
          ) : (
            <div>Done</div>
          )}
        </>
      )}
    </>
  );
}
