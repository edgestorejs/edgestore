import Layout from '@theme/Layout';
import React from 'react';
import Homepage from '../components/Homepage';
import { PageFrame } from '../components/PageFrame';

export default function Home(): React.ReactNode {
  return (
    <div className="homepage">
      <Layout
        title={`Easily handle file uploads in React`}
        description="The best developer experience for uploading files from your React app."
      >
        <PageFrame>
          <Homepage />
        </PageFrame>
      </Layout>
    </div>
  );
}
