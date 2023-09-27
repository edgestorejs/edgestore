import { EdgeStoreProvider } from '@/lib/edgestore';
import '@/styles/globals.css';
import type { AppProps } from 'next/app';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <EdgeStoreProvider>
      <Component {...pageProps} />
    </EdgeStoreProvider>
  );
}
