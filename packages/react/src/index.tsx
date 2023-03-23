import * as React from "react";
import EdgeStoreError from "./libs/errors/EdgeStoreError";

type UploadImageHandler = (
  file: File,
  options?: {
    /**
     * The path to upload the image to.
     * @default - "/"
     */
    path?: string;
    /**
     * The name of the image.
     * @default - auto-generated
     */
    name?: string;
    /**
     * Whether to overwrite the image if it already exists.
     * @default - false
     */
    overwrite?: boolean;
    /**
     * The progress callback.
     * You can use this to get the progress of the upload.
     */
    onProgressChange?: (progress: number) => void;
  }
) => Promise<{
  url: string;
}>;

type GetImgSrcHandler = (
  /**
   * The url of the image.
   * @example - "https://my-domain.com/images/example.png"
   */
  url: string
) => string;

type EdgeStoreContextValue = {
  uploadImage: UploadImageHandler;
  uploadProtectedImage: UploadImageHandler;
  getImgSrc: GetImgSrcHandler;
};

const EdgeStoreContext = React.createContext<EdgeStoreContextValue | undefined>(
  undefined
);

export const EdgeStoreProvider: React.FC<{
  children: React.ReactNode;
  /**
   * In case your app is not hosted at the root of your domain, you can specify the base path here.
   * If you set this, make sure to set the full path to the EdgeStore API.
   * e.g. `/my-app/api/edgestore` or `https://example.com/my-app/api/edgestore`
   *
   * @example - If your app is hosted at `https://example.com/my-app`, you can set the `basePath` to `/my-app/api/edgestore`.
   */
  basePath?: string;
}> = ({ children, basePath }) => {
  const apiPath = basePath ? `${basePath}` : "/api/edgestore";
  const [token, setToken] = React.useState<string | null>(null);
  const [baseUrl, setBaseUrl] = React.useState<string | null>(null);
  React.useEffect(() => {
    fetch(`${apiPath}/init`, {
      method: "POST",
    }).then((res) => {
      if (res.ok) {
        res.json().then((json) => {
          setToken(json.token);
          setBaseUrl(json.baseUrl);
        });
      }
    });
  }, []);

  const baseUploadImage = async (
    file: File,
    {
      path,
      name,
      overwrite,
      isPublic,
      onProgressChange,
    }: {
      path?: string;
      name?: string;
      overwrite?: boolean;
      isPublic?: boolean;
      onProgressChange?: (progress: number) => void;
    }
  ) => {
    try {
      const res = await fetch(`${apiPath}/request-upload`, {
        method: "POST",
        body: JSON.stringify({
          path,
          name,
          extension: file.name.split(".").pop(),
          size: file.size,
          overwrite,
          public: isPublic,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });
      const json = await res.json();
      if (!json.signedUrl) {
        throw new EdgeStoreError("An error occurred");
      }
      // Upload the file to the signed URL and get the progress
      await uploadFile(file, json.signedUrl, onProgressChange);
      return { url: `${baseUrl}${json.path}` };
    } catch (e) {
      onProgressChange?.(0);
      throw e;
    } finally {
      onProgressChange?.(100);
    }
  };

  const uploadImage: UploadImageHandler = async (
    file,
    { path, name, overwrite, onProgressChange } = {}
  ) => {
    return await baseUploadImage(file, {
      path,
      name,
      overwrite,
      isPublic: true,
      onProgressChange,
    });
  };

  const uploadProtectedImage: UploadImageHandler = async (
    file,
    { path, name, overwrite, onProgressChange } = {}
  ) => {
    return await baseUploadImage(file, {
      path,
      name,
      overwrite,
      isPublic: false,
      onProgressChange,
    });
  };

  const getImgSrc: GetImgSrcHandler = (url) => {
    if (url.match(/^https?:\/\/[^\/]+\/[^\/]+\/_public\/.+/)) {
      return `${url}`;
    } else {
      return `${url}?token=${token}`;
    }
  };

  return (
    <>
      <EdgeStoreContext.Provider
        value={{
          uploadImage,
          uploadProtectedImage,
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
  const promise = new Promise<void>((resolve, reject) => {
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
      reject(new Error("Error uploading file"));
    });
    request.addEventListener("abort", () => {
      reject(new Error("File upload aborted"));
    });
    request.addEventListener("loadend", () => {
      resolve();
    });

    request.send(file);
  });
  return promise;
};
