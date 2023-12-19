/* eslint-disable @typescript-eslint/no-non-null-assertion */
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { EdgeStoreProvider } from './lib/edgestore.ts';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <EdgeStoreProvider>
      <App />
    </EdgeStoreProvider>
  </React.StrictMode>,
);
