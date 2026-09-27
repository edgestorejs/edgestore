import Link from 'next/link';

export function DocsVersionNotice({ legacy = false }: { legacy?: boolean }) {
  return (
    <aside className="mb-6 rounded-lg border border-fd-border bg-fd-muted p-4 text-sm">
      {legacy ? (
        <>
          <strong>v0 documentation (0.8.0).</strong>{' '}
          <Link className="underline" href="/docs/quick-start">
            Try the v1 prerelease
          </Link>
          .
        </>
      ) : (
        <>
          <strong>v1 prerelease.</strong> Install with <code>@next</code>.{' '}
          <Link className="underline" href="/v0/docs/quick-start">
            Using v0?
          </Link>{' '}
          <Link className="underline" href="/docs/migrate-to-v1">
            Migration guide
          </Link>
        </>
      )}
    </aside>
  );
}
