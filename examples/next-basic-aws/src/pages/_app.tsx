import '../styles/globals.css';
import { EdgeStoreProvider } from '@edgestore/react';
import type { AppProps } from 'next/app';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <EdgeStoreProvider>
      <Component {...pageProps} />
    </EdgeStoreProvider>
  );
}
