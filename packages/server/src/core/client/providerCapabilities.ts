import type {
  BackendCapabilityName,
  BackendCapableEdgeStoreProvider,
  BackendFile,
  BackendFileMutationOperation,
  BackendGetFileOperation,
  BackendGetSignedUrlsOperation,
  BackendListFilesOperation,
  BackendProviderOperations,
  BackendUploadOperation,
  GetSignedUrlRes,
} from '@edgestore/shared';

export type AnyBackendProvider =
  BackendCapableEdgeStoreProvider<BackendProviderOperations>;

export type BackendCapability<
  TProvider,
  TName extends BackendCapabilityName,
> = TName extends keyof TProvider
  ? Extract<TProvider[TName], (...args: never[]) => unknown>
  : never;

export type CapabilityInput<
  TProvider,
  TName extends BackendCapabilityName,
> = Parameters<BackendCapability<TProvider, TName>>[0];

export type CapabilityResult<
  TProvider,
  TName extends BackendCapabilityName,
> = Awaited<ReturnType<BackendCapability<TProvider, TName>>>;

export type CapabilityFile<
  TProvider,
  TName extends 'upload' | 'getFile' | 'listFiles',
> = TName extends 'upload'
  ? CapabilityResult<TProvider, TName> extends {
      file: infer TFile extends BackendFile;
    }
    ? TFile
    : never
  : TName extends 'listFiles'
    ? CapabilityResult<TProvider, TName> extends {
        items: (infer TFile extends BackendFile)[];
      }
      ? TFile
      : never
    : CapabilityResult<TProvider, TName> extends BackendFile
      ? CapabilityResult<TProvider, TName>
      : never;

export type GetFileReference<TProvider> =
  CapabilityInput<TProvider, 'getFile'> extends { file: infer TReference }
    ? TReference
    : never;

type MutationItem<
  TProvider,
  TName extends 'confirmFiles' | 'deleteFiles' | 'restoreFiles',
> =
  CapabilityResult<TProvider, TName> extends {
    results: (infer TItem)[];
  }
    ? TItem
    : never;

export type MutationReference<
  TProvider,
  TName extends 'confirmFiles' | 'deleteFiles' | 'restoreFiles',
> =
  MutationItem<TProvider, TName> extends { fileRef: infer TReference }
    ? TReference
    : never;

export type MutationError<
  TProvider,
  TName extends 'confirmFiles' | 'deleteFiles' | 'restoreFiles',
> =
  Extract<MutationItem<TProvider, TName>, { success: false }> extends {
    error: infer TError;
  }
    ? TError
    : never;

export type ListCursor<TProvider> =
  CapabilityInput<TProvider, 'listFiles'> extends { cursor?: infer TCursor }
    ? Exclude<TCursor, undefined>
    : never;

export type SignedUrlReference<TProvider> =
  CapabilityInput<TProvider, 'getSignedUrls'> extends {
    urls: (infer TReference)[];
  }
    ? TReference
    : never;

type MutationErrorCode<
  TProvider,
  TName extends 'confirmFiles' | 'deleteFiles' | 'restoreFiles',
> =
  MutationError<TProvider, TName> extends {
    code: infer TErrorCode extends string;
  }
    ? TErrorCode
    : never;

type ProviderSignedUrlResult<TProvider> =
  CapabilityResult<TProvider, 'getSignedUrls'> extends (infer TResult extends
    GetSignedUrlRes)[]
    ? TResult
    : never;

type ResolvedBackendCapabilities<TProvider> = {
  upload?: BackendUploadOperation<CapabilityFile<TProvider, 'upload'>>;
  getFile?: BackendGetFileOperation<
    CapabilityFile<TProvider, 'getFile'>,
    GetFileReference<TProvider>
  >;
  listFiles?: BackendListFilesOperation<
    CapabilityFile<TProvider, 'listFiles'>,
    ListCursor<TProvider>
  >;
  confirmFiles?: BackendFileMutationOperation<
    MutationReference<TProvider, 'confirmFiles'>,
    MutationErrorCode<TProvider, 'confirmFiles'>
  >;
  deleteFiles?: BackendFileMutationOperation<
    MutationReference<TProvider, 'deleteFiles'>,
    MutationErrorCode<TProvider, 'deleteFiles'>
  >;
  restoreFiles?: BackendFileMutationOperation<
    MutationReference<TProvider, 'restoreFiles'>,
    MutationErrorCode<TProvider, 'restoreFiles'>
  >;
  getSignedUrls?: BackendGetSignedUrlsOperation<
    SignedUrlReference<TProvider>,
    ProviderSignedUrlResult<TProvider>
  >;
};

export function resolveBackendCapabilities<
  TProvider extends AnyBackendProvider,
>(provider: TProvider): ResolvedBackendCapabilities<TProvider> {
  return provider as unknown as ResolvedBackendCapabilities<TProvider>;
}
