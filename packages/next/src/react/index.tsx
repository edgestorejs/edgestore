import * as React from "react";

type UploadImageHandler = (
  file: File,
  options?: {
    onProgressChange?: (progress: number) => void;
  }
) => Promise<void>;

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
  const uploadImage: UploadImageHandler = async (
    file,
    { onProgressChange } = {}
  ) => {
    // TODO: implement
    console.log("uploadImage");
    for (let i = 0; i < 20; i++) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      onProgressChange?.((100 / 20) * i);
    }
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
      "[next-auth]: `useSession` must be wrapped in a <SessionProvider />"
    );
  }

  return value;
};
