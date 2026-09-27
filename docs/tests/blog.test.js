import assert from 'node:assert/strict';
import test from 'node:test';
import { getBlogDeployment } from '../src/lib/blogDeployment.ts';

await test('drafts are visible in local development', () => {
  assert.equal(getBlogDeployment({ nodeEnv: 'development' }).showDrafts, true);
});

await test('preview builds expose drafts without requiring a branch name', () => {
  const deployment = getBlogDeployment({
    nodeEnv: 'production',
    vercelEnv: 'preview',
    previewUrl: 'edgestore-docs-pr.vercel.app',
  });
  assert.equal(deployment.showDrafts, true);
  assert.equal(
    deployment.metadataBase?.origin,
    'https://edgestore-docs-pr.vercel.app',
  );
});

await test('previews can show drafts without a deployment URL', () => {
  assert.deepEqual(
    getBlogDeployment({ nodeEnv: 'production', vercelEnv: 'preview' }),
    { showDrafts: true, metadataBase: undefined },
  );
});

await test('production and unknown environments hide drafts', () => {
  for (const environment of [
    {},
    { nodeEnv: 'production' },
    { nodeEnv: 'production', vercelEnv: 'production' },
    { nodeEnv: 'production', vercelEnv: 'development' },
  ]) {
    assert.deepEqual(getBlogDeployment(environment), {
      showDrafts: false,
      metadataBase: undefined,
    });
  }
});
