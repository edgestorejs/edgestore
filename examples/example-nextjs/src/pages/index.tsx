import { useState } from "react";
import { useEdgeStore } from "../utils/edgestore";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
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
          type: "post",
          extension: "jpg",
        },
        onProgressChange: (progress) => {
          setProgress(progress);
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
          // disabled={!file || progress !== null}
        />
      </div>
      <ProgressBar progress={progress} />
      {url && (
        <div style={{ marginTop: "20px" }}>
          <img src={url} alt="Example" />
        </div>
      )}
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
