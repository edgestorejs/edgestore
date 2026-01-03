import { defineConfig } from 'tsdown';

export const input = [
  'src/index.ts',
  'src/core/index.ts',
  'src/adapters/astro/index.ts',
  'src/adapters/express/index.ts',
  'src/adapters/fastify/index.ts',
  'src/adapters/hono/index.ts',
  'src/adapters/next/pages/index.ts',
  'src/adapters/next/app/index.ts',
  'src/adapters/remix/index.ts',
  'src/adapters/start/index.ts',
  'src/providers/aws/index.ts',
  'src/providers/azure/index.ts',
  'src/providers/edgestore/index.ts',
];

export default defineConfig({
  target: ['node18', 'es2017'],
  entry: input,
  dts: {
    sourcemap: true,
    tsconfig: './tsconfig.build.json',
  },
  format: ['cjs', 'esm'],
  outExtensions: (ctx) => ({
    dts: ctx.format === 'cjs' ? '.d.cts' : '.d.mts',
    js: ctx.format === 'cjs' ? '.cjs' : '.mjs',
  }),
  onSuccess: async () => {
    const start = Date.now();
    const { generateEntrypoints } = await import(
      '../../scripts/entrypoints.mjs'
    );
    await generateEntrypoints(input);
    console.log(`Generated entrypoints in ${Date.now() - start}ms`);
  },
});
