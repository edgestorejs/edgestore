import type { StandardSchemaV1 } from '@standard-schema/spec';
import type {
  AnyEdgeStoreProvider,
  BackendFile,
  BackendFileMutationOperation,
  BackendGetFileOperation,
  BackendGetSignedUrlsOperation,
  BackendListFilesOperation,
  BackendUploadOperation,
  GetSignedUrlRes,
  ProviderFileMutationResult,
} from './providerTypes';

export type ProviderCapabilityName =
  | 'upload'
  | 'get'
  | 'list'
  | 'confirm'
  | 'delete'
  | 'restore'
  | 'getSignedUrls';

export type ProviderCapability<
  TProvider,
  TName extends ProviderCapabilityName,
> = TName extends 'upload'
  ? TProvider extends { uploads: { upload: infer TOperation } }
    ? Extract<TOperation, (...args: never[]) => unknown>
    : never
  : TProvider extends {
        files: infer TFiles;
      }
    ? TName extends keyof TFiles
      ? Extract<TFiles[TName], (...args: never[]) => unknown>
      : never
    : never;

export type ProviderCapabilityInput<
  TProvider,
  TName extends ProviderCapabilityName,
> = Parameters<ProviderCapability<TProvider, TName>>[0];

export type ProviderCapabilityResult<
  TProvider,
  TName extends ProviderCapabilityName,
> = Awaited<ReturnType<ProviderCapability<TProvider, TName>>>;

type ProviderReferenceSchema<TProvider> = TProvider extends {
  reference: {
    schema: infer TSchema extends StandardSchemaV1;
  };
}
  ? TSchema
  : never;

export type ProviderReferenceInput<TProvider> = StandardSchemaV1.InferInput<
  ProviderReferenceSchema<TProvider>
>;

export type ProviderReference<TProvider> = StandardSchemaV1.InferOutput<
  ProviderReferenceSchema<TProvider>
>;

export type ProviderCursor<TProvider> = TProvider extends {
  files: {
    cursorSchema: infer TSchema extends StandardSchemaV1;
  };
}
  ? StandardSchemaV1.InferOutput<TSchema>
  : string;

export type ProviderCapabilityFile<
  TProvider,
  TName extends 'upload' | 'get' | 'list',
> = TName extends 'upload'
  ? ProviderCapabilityResult<TProvider, TName> extends {
      file: infer TFile extends BackendFile;
    }
    ? TFile
    : never
  : TName extends 'list'
    ? ProviderCapabilityResult<TProvider, TName> extends {
        items: (infer TFile extends BackendFile)[];
      }
      ? TFile
      : never
    : ProviderCapabilityResult<TProvider, TName> extends BackendFile
      ? ProviderCapabilityResult<TProvider, TName>
      : never;

export type ProviderMutationItem<
  TProvider,
  TName extends 'confirm' | 'delete' | 'restore',
> =
  ProviderCapabilityResult<TProvider, TName> extends {
    results: (infer TItem)[];
  }
    ? TItem
    : never;

export type ProviderMutationError<
  TProvider,
  TName extends 'confirm' | 'delete' | 'restore',
> =
  Extract<ProviderMutationItem<TProvider, TName>, { success: false }> extends {
    error: infer TError;
  }
    ? TError
    : never;

export type ProviderMutationReference<
  TProvider,
  TName extends 'confirm' | 'delete' | 'restore',
> =
  ProviderMutationItem<TProvider, TName> extends {
    fileRef: infer TReference;
  }
    ? TReference
    : never;

type ProviderMutationErrorCode<
  TProvider,
  TName extends 'confirm' | 'delete' | 'restore',
> =
  ProviderMutationError<TProvider, TName> extends {
    code: infer TErrorCode extends string;
  }
    ? TErrorCode
    : never;

type ProviderSignedUrlResult<TProvider> =
  ProviderCapabilityResult<
    TProvider,
    'getSignedUrls'
  > extends (infer TResult extends GetSignedUrlRes)[]
    ? TResult
    : never;

export type ResolvedProviderCapabilities<TProvider> = {
  upload?: BackendUploadOperation<ProviderCapabilityFile<TProvider, 'upload'>>;
  get?: BackendGetFileOperation<
    ProviderCapabilityFile<TProvider, 'get'>,
    ProviderReference<TProvider>
  >;
  list?: BackendListFilesOperation<
    ProviderCapabilityFile<TProvider, 'list'>,
    ProviderCursor<TProvider>
  >;
  confirm?: BackendFileMutationOperation<
    ProviderReference<TProvider>,
    ProviderMutationErrorCode<TProvider, 'confirm'>
  >;
  delete?: BackendFileMutationOperation<
    ProviderReference<TProvider>,
    ProviderMutationErrorCode<TProvider, 'delete'>
  >;
  restore?: BackendFileMutationOperation<
    ProviderReference<TProvider>,
    ProviderMutationErrorCode<TProvider, 'restore'>
  >;
  getSignedUrls?: BackendGetSignedUrlsOperation<
    ProviderReference<TProvider>,
    ProviderSignedUrlResult<TProvider>
  >;
};

export function resolveProviderCapabilities<
  TProvider extends AnyEdgeStoreProvider,
>(provider: TProvider): ResolvedProviderCapabilities<TProvider> {
  return {
    upload: provider.uploads.upload,
    get: provider.files.get,
    list: provider.files.list,
    confirm: provider.files.confirm,
    delete: provider.files.delete,
    restore: provider.files.restore,
    getSignedUrls: provider.files.getSignedUrls,
  } as ResolvedProviderCapabilities<TProvider>;
}

export type ProviderMutationResult<
  TProvider,
  TName extends 'confirm' | 'delete' | 'restore',
> = ProviderFileMutationResult<
  ProviderReference<TProvider>,
  ProviderMutationErrorCode<TProvider, TName>
>;
