import { readFile } from 'node:fs/promises';

type BlogSocialImage = {
  width: number;
  height: number;
  contentType: 'image/jpeg' | 'image/png';
  read: () => Promise<Buffer>;
};

// Bespoke images are kept outside public/ so the OG route can enforce draft visibility.
const images = new Map<string, BlogSocialImage>([
  [
    'v1-release',
    {
      width: 1200,
      height: 628,
      contentType: 'image/jpeg',
      read: () => readFile(new URL('./assets/v1-release.jpg', import.meta.url)),
    },
  ],
]);

export function getBlogSocialImage(slugs: string[]) {
  return images.get(slugs.join('/'));
}
