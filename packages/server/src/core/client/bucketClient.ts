import { EdgeStoreFileMutationError } from '@edgestore/sdk';
import {
  type AnyBuilder,
  type AnyEdgeStoreProvider,
  type AnyRouter,
  type BackendFile,
  type BackendFileMutationOperation,
  type BackendUploadResult,
  type Prettify,
  type ProviderCursor,
  type ProviderFileMutationResult,
  type ProviderFilterValue,
  type ListFilesFilter as ProviderListFilesFilter,
  type ProviderReference,
  type ProviderReferenceInput,
} from '@edgestore/shared';
import type {
  BucketClient,
  Comparison,
  FileMutationFailure,
  FileMutationResult,
  FileMutationSuccess,
  ListFilesRequest,
  UploadContent,
  UploadFileRequest,
} from '.';
import { isDev } from '../../libs/env';
import { validateProviderCursor, validateProviderReference } from '../provider';
import { buildPath, parseBucketInput, parsePath } from '../routerRules';
import { validateFileForBucket } from '../validateFile';

type BucketContext<
  TBucket extends AnyBuilder,
  TProvider extends AnyEdgeStoreProvider,
> = {
  bucket: TBucket;
  bucketName: string;
  provider: TProvider;
  baseUrl?: string;
};

type UploadImplementationParams = {
  content: UploadContent;
  ctx?: Record<string, unknown>;
  input?: Record<string, unknown>;
};

export function createBucketClient<
  TRouter extends AnyRouter,
  TName extends keyof TRouter['buckets'] & string,
  TProvider extends AnyEdgeStoreProvider,
>(
  router: TRouter,
  bucketName: TName,
  options: {
    provider: TProvider;
    baseUrl?: string;
  },
): BucketClient<TRouter['buckets'][TName], TProvider> {
  type TBucket = TRouter['buckets'][TName];
  const context: BucketContext<TBucket, TProvider> = {
    bucket: router.buckets[bucketName] as TBucket,
    bucketName,
    ...options,
  };

  return {
    ...createUploadMethods(context),
    ...createGetMethods(context),
    ...createMutationMethods(context, context.provider.files.confirm, {
      single: 'confirm',
      many: 'confirmMany',
    }),
    ...createMutationMethods(context, context.provider.files.delete, {
      single: 'delete',
      many: 'deleteMany',
    }),
    ...createMutationMethods(context, context.provider.files.restore, {
      single: 'restore',
      many: 'restoreMany',
    }),
    ...createListMethods(context),
    ...createSignedUrlMethods(context),
  } as BucketClient<TBucket, TProvider>;
}

function createUploadMethods<
  TBucket extends AnyBuilder,
  TProvider extends AnyEdgeStoreProvider,
>(context: BucketContext<TBucket, TProvider>) {
  const upload = context.provider.uploads.upload;
  if (!upload) return {};

  return {
    upload: async (params: Prettify<UploadFileRequest<TBucket>>) => {
      const {
        content,
        ctx = {},
        input = {},
      }: UploadImplementationParams = params;
      let { blob, extension } = await resolveUploadContent(
        content,
        params.signal,
      );

      if (params.options?.transform) {
        const transformed = await params.options.transform({
          blob,
          extension,
          type: blob.type,
        });
        blob = transformed.blob;
        extension = transformed.extension;
      }

      const parsedInput = await parseBucketInput(context.bucket, input);
      validateFileForBucket({
        bucket: context.bucket,
        fileInfo: { size: blob.size, type: blob.type },
      });

      const path = buildPath({
        bucket: context.bucket,
        pathAttrs: { ctx, input: parsedInput },
      });
      const metadata =
        (await context.bucket._def.metadata?.({
          ctx,
          input: parsedInput,
        })) ?? {};
      const uploadResult = await upload({
        bucketName: context.bucketName,
        bucketType: context.bucket._def.type,
        autoSignedUrls: context.bucket._def.autoSignedUrls,
        source: blob,
        signal: params.signal,
        onProgress: params.onProgress,
        fileInfo: {
          fileName: params.options?.manualFileName,
          replaceTargetUrl: params.options?.replaceTargetUrl,
          type: blob.type,
          size: blob.size,
          extension,
          isPublic: context.bucket._def.accessControl === undefined,
          temporary: params.options?.temporary ?? false,
          path,
          metadata: normalizeMetadata(metadata),
        },
      });

      const { parsedPath, pathOrder } = parsePath<TBucket>(path);
      return {
        ...mapFileRecord(uploadResult.file, context.baseUrl),
        ...mapSignedReadAccess(uploadResult.signedReadUrl),
        metadata,
        path: parsedPath,
        pathOrder,
      };
    },
  };
}

function createGetMethods<
  TBucket extends AnyBuilder,
  TProvider extends AnyEdgeStoreProvider,
>(context: BucketContext<TBucket, TProvider>) {
  const getFile = context.provider.files.get;
  if (!getFile) return {};

  return {
    get: async (ref: ProviderReferenceInput<TProvider>) => {
      const file = await getFile({
        bucketName: context.bucketName,
        file: await validateProviderReference(context.provider, ref),
      });
      return mapBucketFileRecord(file, context.baseUrl);
    },
  };
}

function createMutationMethods<
  TBucket extends AnyBuilder,
  TProvider extends AnyEdgeStoreProvider,
  TSingleName extends string,
  TManyName extends string,
>(
  context: BucketContext<TBucket, TProvider>,
  operation:
    | BackendFileMutationOperation<ProviderReference<TProvider>, string>
    | undefined,
  names: {
    single: TSingleName;
    many: TManyName;
  },
) {
  if (!operation) return {};

  return {
    [names.single]: async (ref: ProviderReferenceInput<TProvider>) => {
      const file = await validateProviderReference(context.provider, ref);
      return requireMutationSuccess(
        file,
        await operation({ bucketName: context.bucketName, files: [file] }),
      );
    },
    [names.many]: async ({
      refs,
    }: {
      refs: ProviderReferenceInput<TProvider>[];
    }) => {
      const files = await Promise.all(
        refs.map((ref) => validateProviderReference(context.provider, ref)),
      );
      return mapMutationResult(
        files,
        await operation({ bucketName: context.bucketName, files }),
      );
    },
  };
}

function createListMethods<
  TBucket extends AnyBuilder,
  TProvider extends AnyEdgeStoreProvider,
>(context: BucketContext<TBucket, TProvider>) {
  const listFiles = context.provider.files.list;
  if (!listFiles) return {};

  const listBucketFiles = async (
    params?: ListFilesRequest<TBucket, ProviderCursor<TProvider>>,
  ) => {
    const result = await listFiles({
      bucketName: context.bucketName,
      filter: serializeFilter(params?.filter),
      cursor:
        params?.cursor === undefined
          ? undefined
          : await validateProviderCursor(context.provider, params.cursor),
      limit: params?.limit,
    });
    return {
      ...result,
      items: result.items.map((file) =>
        mapBucketFileRecord(file, context.baseUrl),
      ),
    };
  };

  return {
    list: listBucketFiles,
  };
}

function createSignedUrlMethods<
  TBucket extends AnyBuilder,
  TProvider extends AnyEdgeStoreProvider,
>(context: BucketContext<TBucket, TProvider>) {
  const getSignedUrls = context.provider.files.getSignedUrls;
  if (!getSignedUrls || context.bucket._def.accessControl === undefined) {
    return {};
  }

  return {
    createSignedUrl: async (params: {
      url: ProviderReferenceInput<TProvider>;
      expiresIn?: number;
    }) => {
      const file = await validateProviderReference(
        context.provider,
        params.url,
      );
      const [signedUrl] = await getSignedUrls({
        bucketName: context.bucketName,
        files: [file],
        expiresIn: params.expiresIn,
      });
      if (!signedUrl) {
        throw new Error('Missing signed URL response');
      }
      return mapSignedUrl(signedUrl);
    },
    createSignedUrls: async (params: {
      urls: ProviderReferenceInput<TProvider>[];
      expiresIn?: number;
      includeThumbnails?: boolean;
    }) => {
      const files = await Promise.all(
        params.urls.map((url) =>
          validateProviderReference(context.provider, url),
        ),
      );
      const signedUrls = await getSignedUrls({
        bucketName: context.bucketName,
        files,
        expiresIn: params.expiresIn,
        includeThumbnails: params.includeThumbnails,
      });
      return signedUrls.map(mapSignedUrl);
    },
  };
}

async function resolveUploadContent(
  content: UploadContent,
  signal?: AbortSignal,
) {
  if (typeof content === 'string') {
    return {
      blob: new Blob([content], { type: 'text/plain' }),
      extension: 'txt',
    };
  }
  if ('blob' in content) {
    return {
      blob: content.blob,
      extension: content.extension,
    };
  }
  return {
    blob: await getBlobFromUrl(content.url, signal),
    extension: content.extension,
  };
}

async function getBlobFromUrl(url: string, signal?: AbortSignal) {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Could not fetch upload source: HTTP ${response.status}`);
  }
  return await response.blob();
}

function normalizeMetadata(
  metadata: Record<string, string | null | undefined>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(metadata).filter(
      (entry): entry is [string, string] => entry[1] != null,
    ),
  );
}

function serializeFilter<TBucket extends AnyBuilder>(
  filter: ListFilesRequest<TBucket>['filter'],
): ProviderListFilesFilter | undefined {
  if (!filter) return undefined;
  return {
    uploadedAt: serializeComparison(filter.uploadedAt),
    path: serializeStringComparisons(filter.path),
    metadata: serializeStringComparisons(filter.metadata),
    AND: filter.AND?.map((item) => serializeFilter(item)!),
    OR: filter.OR?.map((item) => serializeFilter(item)!),
  };
}

function serializeComparison(
  value: Comparison<Date> | undefined,
): ProviderFilterValue | undefined {
  if (value instanceof Date) return value.toISOString();
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      Array.isArray(item)
        ? item.map((date) => date.toISOString())
        : item?.toISOString(),
    ]),
  ) as ProviderFilterValue;
}

function serializeStringComparisons(
  value: Record<string, Comparison | undefined> | undefined,
): Record<string, ProviderFilterValue> | undefined {
  if (!value) return undefined;
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, ProviderFilterValue] => entry[1] !== undefined,
    ),
  );
}

function mapSignedReadAccess(
  signedReadUrl: BackendUploadResult<BackendFile>['signedReadUrl'] | undefined,
) {
  if (!signedReadUrl) return {};
  return mapSignedUrl(signedReadUrl);
}

function mapSignedUrl<TSignedUrl extends { expiresAt: Date | string }>(
  signedUrl: TSignedUrl,
) {
  return {
    ...signedUrl,
    expiresAt: new Date(signedUrl.expiresAt),
  };
}

function mapFileRecord<TFile extends BackendFile>(
  file: TFile,
  baseUrl?: string,
) {
  return {
    ...file,
    url: getUrl(file.url, baseUrl),
    uploadedAt: new Date(file.uploadedAt),
    updatedAt: new Date(file.updatedAt),
  };
}

function mapBucketFileRecord<TFile extends BackendFile>(
  file: TFile,
  baseUrl?: string,
) {
  return mapFileRecord(file, baseUrl);
}

/**
 * Protected files need third-party cookies to work.
 * Since third party cookies don't work on localhost,
 * we need to proxy the file through the server.
 */
function getUrl(url: string, baseUrl?: string) {
  if (isDev() && !url.includes('/_public/')) {
    if (!baseUrl) {
      throw new Error(
        'Missing baseUrl. Pass the baseUrl to `createEdgeStore` to get protected files in development.',
      );
    }
    const proxyUrl = new URL(baseUrl);
    proxyUrl.pathname = `${proxyUrl.pathname}/proxy-file`;
    proxyUrl.search = new URLSearchParams({ url }).toString();
    return proxyUrl.toString();
  }
  return url;
}

function mapMutationResult<TFileReference, TErrorCode extends string>(
  files: TFileReference[],
  result: ProviderFileMutationResult<TErrorCode>,
): FileMutationResult<TFileReference, { code: TErrorCode; message: string }> {
  assertMutationResultCount(files, result);
  const succeeded: TFileReference[] = [];
  const failed: FileMutationFailure<
    TFileReference,
    { code: TErrorCode; message: string }
  >[] = [];
  result.results.forEach((item, index) => {
    const file = files[index]!;
    if (item.success) succeeded.push(file);
    else failed.push({ ref: file, error: item.error });
  });
  return { succeeded, failed };
}

function requireMutationSuccess<TFileReference, TErrorCode extends string>(
  file: TFileReference,
  result: ProviderFileMutationResult<TErrorCode>,
): FileMutationSuccess<TFileReference> {
  assertMutationResultCount([file], result);
  const item = result.results[0]!;
  if (!item.success) {
    throw new EdgeStoreFileMutationError(
      item.error.code,
      item.error.message,
      file,
    );
  }
  return { ref: file };
}

function assertMutationResultCount<TErrorCode extends string>(
  files: unknown[],
  result: ProviderFileMutationResult<TErrorCode>,
) {
  if (result.results.length !== files.length) {
    throw new Error(
      `The provider returned ${result.results.length} mutation results for ${files.length} files.`,
    );
  }
}
