import { randomUUID } from 'node:crypto';

export const SMOKE_CONTENT = 'edgestore smoke test';

export function getSmokeBucketName() {
  return process.env.EDGESTORE_SMOKE_BUCKET_NAME ?? 'publicFiles';
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

  for (const delay of delays) {
    lastResult = await params.action();
    if (lastResult.success) {
      return lastResult;
    }
    await wait(delay);
  }

  lastResult = await params.action();
  if (lastResult.success) {
    return lastResult;
  }

  throw new Error(
    `${params.description} did not succeed: ${JSON.stringify(lastResult)}`,
  );
}
