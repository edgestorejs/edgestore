---
sidebar_position: 1
---

# Getting Started

### Next.js Setup

#### Install

```shell
npm install @edge-store/react
```

#### Environment Variables

```shell
EDGE_STORE_ACCESS_KEY=your-access-key
EDGE_STORE_SECRET_KEY=your-secret-key
```

#### API Route

```jsx
import EdgeStore from "@edge-store/react/next";

export default EdgeStore();
```

#### Provider

```jsx
import { EdgeStoreProvider } from "@edge-store/react";

export default function App({ Component, pageProps }) {
  return (
    <EdgeStoreProvider>
      <Component {...pageProps} />
    </EdgeStoreProvider>
  );
}
```

### Upload image

```jsx
import { useEdgeStore } from "@edge-store/react";

const Page = () => {
  const [file, setFile] = useState(null);
  const { upload } = useEdgeStore();

  return (
    <div>
      <input type="file" onChange={(e) => setFile(e.target.files[0])} />
      <button
        onClick={async () => {
          await upload({
            file,
            key: "path/to/image.jpg",
          });
        }}
      >
        Upload
      </button>
    </div>
  );
};

export default Page;
```

### Show image

```jsx
import { useEdgeStore } from "@edge-store/react";

const Page = () => {
  const { getImgSrc } = useEdgeStore();

  return (
    <div>
      <img src={getImgSrc("path/to/image.jpg")} />
    </div>
  );
};
```
