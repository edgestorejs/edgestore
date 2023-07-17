import '../styles/globals.css';
import type { AppProps } from 'next/app';
import { EdgeStoreProvider } from '../utils/edgestore';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <EdgeStoreProvider>
      <Component {...pageProps} />
    </EdgeStoreProvider>
  );
}
