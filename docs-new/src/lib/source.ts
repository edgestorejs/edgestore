import { docs } from '@/.source';
import {
  loader,
  type InferMetaType,
  type InferPageType,
} from 'fumadocs-core/source';

// See https://fumadocs.vercel.app/docs/headless/source-api for more info
export const source = loader({
  // it assigns a URL to your pages
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
});

export type Page = InferPageType<typeof source>;
export type Meta = InferMetaType<typeof source>;
