import { CodeExample } from './code-example';
import { FilePreview } from './file-preview';
import {
  Closing,
  FeatureRows,
  Footer,
  Frameworks,
  HeroLinks,
  Navigation,
  StartWithAgent,
  StorageChoices,
} from './shared';

export function Studio() {
  return (
    <>
      <div className="ll-studio-opening">
        <Navigation />
      </div>
      <main id="landing-content">
        <div className="ll-studio-opening">
          <section className="ll-studio-hero ll-width">
            <div>
              <h1>
                Big ideas.
                <br />
                Small upload API.
              </h1>
              <p className="ll-lead">
                Type-safe file uploads for TypeScript and React. From the first
                dropzone to the storage behind it.
              </p>
            </div>
            <HeroLinks />
          </section>
          <div className="ll-width ll-studio-gallery">
            <FilePreview gallery />
          </div>
        </div>
        <StartWithAgent />
        <Frameworks />
        <section className="ll-studio-details ll-width">
          <div className="ll-section-intro">
            <h2>
              The details,
              <br />
              already considered.
            </h2>
            <p>
              Your interface, your upload rules. EdgeStore connects them with an
              API that knows your types.
            </p>
          </div>
          <FeatureRows />
          <CodeExample />
        </section>
        <StorageChoices />
        <Closing title="Make room for your next idea." />
      </main>
      <Footer />
    </>
  );
}
