import { randomUUID } from 'node:crypto';

export const SMOKE_CONTENT = 'edgestore smoke test';

export function getSmokeApiEndpoint() {
  return process.env.EDGE_STORE_API_ENDPOINT ?? 'https://api.edgestore.dev';
}

export function getSmokeBucketName() {
  return process.env.EDGESTORE_SMOKE_BUCKET_NAME ?? 'publicFiles';
}

export function getSmokeBasicAuthHeader() {
  requireSmokeCredentials();
  return `Basic ${Buffer.from(
    `${process.env.EDGE_STORE_ACCESS_KEY}:${process.env.EDGE_STORE_SECRET_KEY}`,
  ).toString('base64')}`;
}

export function createSmokeFileName(prefix: string) {
  return `${prefix}-smoke-${randomUUID()}.txt`;
}

export function requireSmokeCredentials() {
  if (
    !process.env.EDGE_STORE_ACCESS_KEY ||
    !process.env.EDGE_STORE_SECRET_KEY
  ) {
    throw new Error(
      'EDGE_STORE_ACCESS_KEY and EDGE_STORE_SECRET_KEY are required',
    );
  }
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retryUntilSuccess(params: {
  action: () => Promise<{ success: boolean }>;
  description: string;
}) {
  const delays = [250, 500, 1000, 2000, 4000];
  let lastResult: { success: boolean } | undefined;
  let lastError: unknown;

  for (const delay of delays) {
    try {
      lastResult = await params.action();
      lastError = undefined;
      if (lastResult.success) {
        return lastResult;
      }
    } catch (err) {
      lastResult = undefined;
      lastError = err;
    }
    await wait(delay);
  }

  try {
    lastResult = await params.action();
    lastError = undefined;
    if (lastResult.success) {
      return lastResult;
    }
  } catch (err) {
    lastResult = undefined;
    lastError = err;
  }

  const lastFailure =
    lastError instanceof Error
      ? `${lastError.name}: ${lastError.message}`
      : JSON.stringify(lastError ?? lastResult);

  throw new Error(`${params.description} did not succeed: ${lastFailure}`);
}

type SmokeFileResult = {
  size: number;
  url: string;
};

function assertSmokeFileResult(
  description: string,
  result: SmokeFileResult,
  expectedSize: number,
) {
  if (!result.url) {
    throw new Error(`${description} did not return a file URL`);
  }
  if (result.size !== expectedSize) {
    throw new Error(
      `${description} returned size ${result.size}, expected ${expectedSize}`,
    );
  }
}

function assertSuccess(description: string, result: { success: boolean }) {
  if (!result.success) {
    throw new Error(`${description} did not succeed`);
  }
}

export async function runSmokeUploadLifecycle(params: {
  confirmUpload: (url: string) => Promise<{ success: boolean }>;
  deleteFile: (url: string) => Promise<{ success: boolean }>;
  deleteDescription: string;
  expectedSize: number;
  getFile?: (url: string) => Promise<SmokeFileResult>;
  upload: () => Promise<SmokeFileResult>;
}) {
  let accessUrl: string | undefined;

  try {
    const uploadRes = await params.upload();
    assertSmokeFileResult('upload', uploadRes, params.expectedSize);
    accessUrl = uploadRes.url;

    assertSuccess('confirmUpload', await params.confirmUpload(uploadRes.url));

    if (params.getFile) {
      assertSmokeFileResult(
        'getFile',
        await params.getFile(uploadRes.url),
        params.expectedSize,
      );
    }

    return uploadRes;
  } finally {
    if (accessUrl) {
      const url = accessUrl;
      await retryUntilSuccess({
        description: params.deleteDescription,
        action: () => params.deleteFile(url),
      });
    }
  }
}
