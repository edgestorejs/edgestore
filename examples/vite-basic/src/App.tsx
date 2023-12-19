import { useState } from 'react';
import { EdgeStoreProvider, useEdgeStore } from './lib/edgestore';

function App() {
  return (
    <EdgeStoreProvider basePath="http://localhost:3001/edgestore">
      <div>
        AAAAAA
        <UploadInput />
      </div>
    </EdgeStoreProvider>
  );
}

export default App;

function UploadInput() {
  const [file, setFile] = useState<File | null>(null);
  const { edgestore } = useEdgeStore();

  return <div>UPLOAD</div>;
}
