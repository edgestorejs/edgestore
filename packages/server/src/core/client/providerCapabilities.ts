import {
  type AnyEdgeStoreProvider,
  type ProviderCapability,
  type ProviderCapabilityFile,
  type ProviderCapabilityName,
  type ProviderCapabilityResult,
  type ProviderCursor,
  type ProviderMutationError,
  type ProviderMutationReference,
  type ProviderReferenceInput,
  type ResolvedProviderCapabilities,
} from '@edgestore/shared';

export type AnyBackendProvider = AnyEdgeStoreProvider;

type LegacyCapabilityName =
  | 'upload'
  | 'getFile'
  | 'listFiles'
  | 'confirmFiles'
  | 'deleteFiles'
  | 'restoreFiles'
  | 'getSignedUrls';

type CanonicalCapabilityName<TName extends LegacyCapabilityName> =
  TName extends 'getFile'
    ? 'get'
    : TName extends 'listFiles'
      ? 'list'
      : TName extends 'confirmFiles'
        ? 'confirm'
        : TName extends 'deleteFiles'
          ? 'delete'
          : TName extends 'restoreFiles'
            ? 'restore'
            : Extract<TName, ProviderCapabilityName>;

export type BackendCapability<
  TProvider,
  TName extends LegacyCapabilityName,
> = ProviderCapability<TProvider, CanonicalCapabilityName<TName>>;

export type CapabilityResult<
  TProvider,
  TName extends LegacyCapabilityName,
> = ProviderCapabilityResult<TProvider, CanonicalCapabilityName<TName>>;

export type CapabilityFile<
  TProvider,
  TName extends 'upload' | 'getFile' | 'listFiles',
> = ProviderCapabilityFile<
  TProvider,
  TName extends 'getFile'
    ? 'get'
    : TName extends 'listFiles'
      ? 'list'
      : 'upload'
>;

export type GetFileReference<TProvider> = ProviderReferenceInput<TProvider>;

export type MutationReference<
  TProvider,
  _TName extends 'confirmFiles' | 'deleteFiles' | 'restoreFiles',
> = ProviderReferenceInput<TProvider>;

export type MutationResultReference<
  TProvider,
  TName extends 'confirmFiles' | 'deleteFiles' | 'restoreFiles',
> = ProviderMutationReference<
  TProvider,
  TName extends 'confirmFiles'
    ? 'confirm'
    : TName extends 'deleteFiles'
      ? 'delete'
      : 'restore'
>;

export type MutationError<
  TProvider,
  TName extends 'confirmFiles' | 'deleteFiles' | 'restoreFiles',
> = ProviderMutationError<
  TProvider,
  TName extends 'confirmFiles'
    ? 'confirm'
    : TName extends 'deleteFiles'
      ? 'delete'
      : 'restore'
>;

export type ListCursor<TProvider> = ProviderCursor<TProvider>;

export type SignedUrlReference<TProvider> = ProviderReferenceInput<TProvider>;

export function resolveBackendCapabilities<
  TProvider extends AnyBackendProvider,
>(
  provider: TProvider,
): {
  upload?: ResolvedProviderCapabilities<TProvider>['upload'];
  getFile?: ResolvedProviderCapabilities<TProvider>['get'];
  listFiles?: ResolvedProviderCapabilities<TProvider>['list'];
  confirmFiles?: ResolvedProviderCapabilities<TProvider>['confirm'];
  deleteFiles?: ResolvedProviderCapabilities<TProvider>['delete'];
  restoreFiles?: ResolvedProviderCapabilities<TProvider>['restore'];
  getSignedUrls?: ResolvedProviderCapabilities<TProvider>['getSignedUrls'];
} {
  return {
    upload: provider.uploads.upload,
    getFile: provider.files.get,
    listFiles: provider.files.list,
    confirmFiles: provider.files.confirm,
    deleteFiles: provider.files.delete,
    restoreFiles: provider.files.restore,
    getSignedUrls: provider.files.getSignedUrls,
  } as {
    upload?: ResolvedProviderCapabilities<TProvider>['upload'];
    getFile?: ResolvedProviderCapabilities<TProvider>['get'];
    listFiles?: ResolvedProviderCapabilities<TProvider>['list'];
    confirmFiles?: ResolvedProviderCapabilities<TProvider>['confirm'];
    deleteFiles?: ResolvedProviderCapabilities<TProvider>['delete'];
    restoreFiles?: ResolvedProviderCapabilities<TProvider>['restore'];
    getSignedUrls?: ResolvedProviderCapabilities<TProvider>['getSignedUrls'];
  };
}
