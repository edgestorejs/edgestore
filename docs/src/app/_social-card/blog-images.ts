import { readFile } from 'node:fs/promises';

type BlogSocialImage = {
  width: number;
  height: number;
  read: () => Promise<Buffer>;
};

// Bespoke images are kept outside public/ so the OG route can enforce draft visibility.
const images = new Map<string, BlogSocialImage>([
  [
    'v1-release',
    {
      width: 1734,
      height: 907,
      read: () => readFile(new URL('./assets/v1-release.png', import.meta.url)),
    },
  ],
]);

export function getBlogSocialImage(slugs: string[]) {
  return images.get(slugs.join('/'));
}
