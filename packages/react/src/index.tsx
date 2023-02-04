import * as React from "react";

type UploadImageHandler = (
  file: File,
  options?: {
    onProgressChange?: (progress: number) => void;
  }
) => Promise<string>;

type GetImgSrcHandler = (id: string) => string;

type EdgeStoreContextValue = {
  uploadImage: UploadImageHandler;
  getImgSrc: GetImgSrcHandler;
};

const EdgeStoreContext = React.createContext<EdgeStoreContextValue | undefined>(
  undefined
);

export const EdgeStoreProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  React.useEffect(() => {
    fetch("/api/edgestore/init", {
      method: "POST",
    });
  }, []);

  const uploadImage: UploadImageHandler = async (
    file,
    { onProgressChange } = {}
  ) => {
    try {
      const res = await fetch(
        "https://qdnxe91xjc.execute-api.us-east-1.amazonaws.com/dev/request-upload",
        {
          method: "POST",
          body: JSON.stringify({
            fileName: file.name,
          }),
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      const { signedUrl } = await res.json();
      // Upload the file to the signed URL and get the progress
      await uploadFile(file, signedUrl, onProgressChange);
    } finally {
      onProgressChange?.(100);
    }
    return "";
  };
  const getImgSrc: GetImgSrcHandler = (id) => {
    // TODO: implement
    return "";
  };

  return (
    <>
      <EdgeStoreContext.Provider
        value={{
          uploadImage,
          getImgSrc,
        }}
      >
        {children}
      </EdgeStoreContext.Provider>
    </>
  );
};

export const useEdgeStore = () => {
  if (!EdgeStoreContext) {
    throw new Error("React Context is unavailable in Server Components");
  }

  // @ts-expect-error - We know that the context value should not be undefined
  const value: EdgeStoreContextValue = React.useContext(EdgeStoreContext);
  if (!value && process.env.NODE_ENV !== "production") {
    throw new Error(
      "[edge-store]: `useEdgeStore` must be wrapped in a <EdgeStoreProvider />"
    );
  }

  return value;
};

const uploadFile = async (
  file: File,
  signedUrl: string,
  onProgressChange?: (progress: number) => void
) => {
  const request = new XMLHttpRequest();
  request.open("PUT", signedUrl);
  request.upload.addEventListener("progress", (e) => {
    if (e.lengthComputable) {
      onProgressChange?.((e.loaded / e.total) * 100);
    }
  });
  request.addEventListener("load", () => {
    onProgressChange?.(100);
  });
  request.addEventListener("error", () => {
    throw new Error("Error uploading file");
  });
  request.send(file);
};
