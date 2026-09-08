// Authored docs remain the source of truth. Section names must match exactly;
// a removed/renamed section fails the build rather than silently dropping advice.
export type Reference = {
  file: string;
  source: string;
  sections?: string[];
};

export const references: Record<string, Reference[]> = {
  server: [
    {
      file: 'next.md',
      source: '(getting-started)/quick-start.mdx',
      sections: ['Install', 'Environment Variables', 'Backend'],
    },
    { file: 'configuration.md', source: '(getting-started)/configuration.mdx' },
    {
      file: 'backend-client.md',
      source: '(getting-started)/backend-client.mdx',
    },
    { file: 'hono.md', source: 'adapters/hono.mdx' },
    { file: 'tanstack-start.md', source: 'adapters/tanstack-start.mdx' },
    ...['edgestore', 's3', 'azure-blob', 'custom'].map((provider) => ({
      file: `provider-${provider}.md`,
      source: `providers/${provider}.mdx`,
    })),
  ],
  react: [
    {
      file: 'client.md',
      source: '(getting-started)/quick-start.mdx',
      sections: [
        'Frontend',
        'Upload file',
        'Replace file',
        'Delete file',
        'Cancel upload',
        'Transform files before upload',
        'Temporary files',
      ],
    },
    {
      file: 'configuration.md',
      source: '(getting-started)/configuration.mdx',
      sections: ['Limit parallel uploads', 'Base Path'],
    },
    { file: 'errors.md', source: '(getting-started)/error-handling.mdx' },
  ],
  sdk: [{ file: 'sdk.md', source: '(getting-started)/sdk.mdx' }],
};

export function docsOrigin(version: string): string {
  return version.includes('-')
    ? 'https://next.edgestore.dev'
    : 'https://edgestore.dev';
}

export function pageUrl(source: string, origin: string): string {
  const slug = source.replace('(getting-started)/', '').replace(/\.mdx$/, '');
  return `${origin}/docs/${slug}`;
}
