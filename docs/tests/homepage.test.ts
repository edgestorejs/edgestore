import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  formatFileSize,
  selectPreviewImages,
} from '../src/app/(main)/(landing)/_components/preview-files';

function file(name: string, type = 'image/png', size = 16) {
  return new File([new Uint8Array(size)], name, { type });
}

test('upload demo accepts only supported image types', () => {
  const files = [
    file('photo.jpg', 'image/jpeg'),
    file('image.png'),
    file('image.webp', 'image/webp'),
    file('document.pdf', 'application/pdf'),
    file('script.svg', 'image/svg+xml'),
  ];
  assert.deepEqual(
    selectPreviewImages(files, 4).map((f) => f.name),
    ['photo.jpg', 'image.png', 'image.webp'],
  );
});

test('upload demo accepts the size limit and rejects larger files', () => {
  const files = [
    file('limit.png', 'image/png', 5 * 1024 * 1024),
    file('large.png', 'image/png', 5 * 1024 * 1024 + 1),
  ];
  assert.deepEqual(
    selectPreviewImages(files, 4).map((f) => f.name),
    ['limit.png'],
  );
});

test('gallery caps selection at four and profile at one', () => {
  const files = Array.from({ length: 6 }, (_, i) => file(`${i}.png`));
  assert.equal(selectPreviewImages(files, 4).length, 4);
  assert.deepEqual(selectPreviewImages(files, 1), [files[0]]);
  assert.equal(files.length, 6);
});

test('empty and invalid selections leave no previews', () => {
  assert.deepEqual(selectPreviewImages([], 4), []);
  assert.deepEqual(selectPreviewImages([file('unknown', '')], 4), []);
});

test('file sizes are readable at the KB and MB boundary', () => {
  assert.equal(formatFileSize(0), '1 KB');
  assert.equal(formatFileSize(12 * 1024), '12 KB');
  assert.equal(formatFileSize(1024 * 1024), '1.0 MB');
});
