import assert from 'node:assert/strict';
import test from 'node:test';
import { getBlogSocialImage } from '../src/app/_social-card/blog-images.ts';
import { getBlogDeployment } from '../src/lib/blogDeployment.ts';

await test('release social image is a compact JPEG with matching metadata dimensions', async () => {
  const image = getBlogSocialImage(['v1-release']);
  assert.ok(image);
  const data = await image.read();
  assert.equal(image.contentType, 'image/jpeg');
  assert.deepEqual([...data.subarray(0, 2)], [0xff, 0xd8]);
  assert.ok(data.length < 100_000, 'Keep the release OG image under 100 KB');

  // Read the JPEG frame header without adding an image-processing dependency.
  for (let offset = 2; offset + 8 < data.length;) {
    assert.equal(data[offset], 0xff);
    const marker = data[offset + 1];
    if (marker === 0xc0 || marker === 0xc2) {
      assert.equal(data.readUInt16BE(offset + 5), image.height);
      assert.equal(data.readUInt16BE(offset + 7), image.width);
      return;
    }
    if (marker === 0xda || marker === 0xd9) break;
    const length = data.readUInt16BE(offset + 2);
    assert.ok(length >= 2);
    offset += 2 + length;
  }
  assert.fail('Missing JPEG frame header');
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
