import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { CodeExample } from './code-example';
import { FilePreview } from './file-preview';
import {
  Closing,
  FeatureRows,
  Footer,
  Frameworks,
  Navigation,
  Prompt,
  StorageChoices,
} from './shared';

export function Workbench() {
  return (
    <>
      <Navigation />
      <main id="landing-content">
        <section className="ll-workbench-hero ll-width">
          <div>
            <h1>
              File uploads.
              <br />
              <span>Part of your app.</span>
            </h1>
            <p className="ll-lead">
              Add uploads that look and work the way you want. Type-safe APIs,
              customizable React components, and your choice of storage.
            </p>
            <Prompt />
          </div>
          <div className="ll-workbench-demo">
            <div className="ll-demo-title">
              <span>your-app / files</span>
              <span>React component preview</span>
            </div>
            <FilePreview />
            <div className="ll-demo-bottom">
              <span>Progress. Cancellation. Your UI.</span>
              <Link href="/docs/components/multi-file">
                Explore components <ArrowUpRight size={15} />
              </Link>
            </div>
          </div>
        </section>
        <Frameworks />
        <section className="ll-workbench-code">
          <div className="ll-width">
            <div className="ll-section-intro">
              <h2>
                One definition.
                <br />
                Types all the way through.
              </h2>
              <p>
                Define your buckets on the server. Your React client knows their
                names and inputs, without a second schema to maintain.
              </p>
            </div>
            <CodeExample />
            <FeatureRows />
          </div>
        </section>
        <StorageChoices />
        <Closing title="Add uploads. Keep building." />
      </main>
      <Footer />
    </>
  );
}
