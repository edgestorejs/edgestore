import { useState } from 'react';
import { EdgeStoreProvider, useEdgeStore } from './lib/edgestore';

function App() {
  return (
    <EdgeStoreProvider basePath="http://localhost:3001/edgestore">
      <div>
        <UploadInput />
      </div>
    </EdgeStoreProvider>
  );
}

export default App;

function UploadInput() {
  const [file, setFile] = useState<File | null>(null);
  const { edgestore } = useEdgeStore();

  return (
    <div>
      <input
        type="file"
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
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
