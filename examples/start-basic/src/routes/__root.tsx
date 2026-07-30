import { createRootRoute, HeadContent, Scripts } from '@tanstack/react-router';
import { type ReactNode } from 'react';
import appCss from '../styles.css?url';
import { EdgeStoreProvider } from '../utils/edgestore';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      { title: 'EdgeStore TanStack Start Example' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <EdgeStoreProvider>{children}</EdgeStoreProvider>
        <Scripts />
      </body>
    </html>
  );
}
