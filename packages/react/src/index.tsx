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
      // TODO: implement
      console.log("uploadImage");
      onProgressChange?.(0);
      for (let i = 0; i < 20; i++) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        onProgressChange?.((100 / 20) * i);
      }
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
