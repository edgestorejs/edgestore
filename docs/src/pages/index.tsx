import Layout from '@theme/Layout';
import React from 'react';
import Homepage from '../components/Homepage';
import { PageFrame } from '../components/PageFrame';

export default function Home(): JSX.Element {
  return (
    <div className="homepage">
      <Layout
        title={`Easily handle file uploads in Next.js`}
        description="The best developer experience for uploading files from your Next.js app."
      >
        <PageFrame>
          <Homepage />
        </PageFrame>
      </Layout>
    </div>
  );
}
