import assert from 'node:assert/strict';
import test from 'node:test';
import { getBlogSocialImage } from '../src/app/_social-card/blog-images.ts';
import { getBlogDeployment } from '../src/lib/blogDeployment.ts';

await test('release social image is a PNG with matching metadata dimensions', async () => {
  const image = getBlogSocialImage(['v1-release']);
  assert.ok(image);
  const data = await image.read();
  assert.deepEqual([...data.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(data.readUInt32BE(16), image.width);
  assert.equal(data.readUInt32BE(20), image.height);
});

await test('other posts use generated social cards, including nested slugs', () => {
  assert.equal(getBlogSocialImage(['another-post']), undefined);
  assert.equal(getBlogSocialImage(['announcements', 'v1-release']), undefined);
});

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
