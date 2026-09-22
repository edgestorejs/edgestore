import { Braces, Check, FolderOpen, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
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

function PageFrame({ children }: { children: ReactNode }) {
  return (
    <>
      <Navigation />
      <main id="landing-content">{children}</main>
      <Footer />
    </>
  );
}

function Details({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="ll-new-details ll-width">
      <div className="ll-section-intro">
        <h2>{title}</h2>
        <p>{children}</p>
      </div>
      <FeatureRows />
      <CodeExample />
    </section>
  );
}

export function Canvas() {
  return (
    <PageFrame>
      <section className="ll-canvas-hero ll-width">
        <div className="ll-canvas-title">
          <h1>
            A place for files.
            <br />
            <span>Room for your ideas.</span>
          </h1>
          <p className="ll-lead">
            File uploads for TypeScript and React. Build your interface, set
            your rules, and choose where your files live.
          </p>
          <HeroLinks />
        </div>
        <div className="ll-canvas-demo">
          <FilePreview gallery />
        </div>
      </section>
      <StartWithAgent />
      <Frameworks />
      <Details title="Make it yours, all the way through.">
        From the dropzone to the storage provider, keep control of the parts
        that make your app yours.
      </Details>
      <StorageChoices />
      <Closing title="What will you build around it?" />
    </PageFrame>
  );
}

export function Relay() {
  return (
    <PageFrame>
      <section className="ll-relay-hero">
        <div className="ll-relay-copy">
          <h1>
            From your UI.
            <br />
            To your storage.
            <br />
            <span>All typed.</span>
          </h1>
          <p className="ll-lead">
            One upload API connects the pieces. React components, server-side
            rules, and the storage provider you choose.
          </p>
          <HeroLinks />
        </div>
        <div className="ll-relay-demo">
          <div className="ll-relay-caption">
            <FolderOpen size={24} />
            <span>Your next application / files</span>
          </div>
          <FilePreview />
          <p className="ll-relay-foot">Select. Upload. Keep building.</p>
        </div>
      </section>
      <StartWithAgent />
      <section
        className="ll-relay-flow ll-width"
        aria-label="Upload architecture"
      >
        <span>
          <Braces size={22} /> React client
        </span>
        <span>
          <ShieldCheck size={22} /> Server rules
        </span>
        <span>
          <FolderOpen size={22} /> Your storage
        </span>
      </section>
      <Details title="Less glue. More application.">
        Define your buckets once. Let your client infer the names and inputs
        from your server.
      </Details>
      <Frameworks />
      <StorageChoices />
      <Closing title="Connect your next upload." />
    </PageFrame>
  );
}

export function Index() {
  return (
    <PageFrame>
      <section className="ll-index-hero ll-width">
        <div className="ll-index-heading">
          <h1>
            Every file.
            <br />
            <span>Your rules.</span>
          </h1>
          <p className="ll-lead">
            Typed file uploads for the apps you are building. Validation,
            authorization, and storage in one clear API.
          </p>
          <HeroLinks />
        </div>
        <div className="ll-index-demo">
          <div className="ll-index-path">
            <FolderOpen size={20} />
            <span>application / project-files</span>
            <span>Sample workspace</span>
          </div>
          <FilePreview />
        </div>
      </section>
      <StartWithAgent />
      <section className="ll-index-features ll-width">
        <h2>The upload is just the start.</h2>
        <FeatureRows />
      </section>
      <Frameworks />
      <StorageChoices />
      <section className="ll-index-api ll-width">
        <h2>Small API. Clear contract.</h2>
        <CodeExample />
      </section>
      <Closing title="Add files to the plan." />
    </PageFrame>
  );
}

export function Orbit() {
  return (
    <PageFrame>
      <section className="ll-orbit-hero ll-width">
        <div className="ll-orbit-title">
          <h1>
            Your app has a new
            <br />
            <span>place for uploads.</span>
          </h1>
          <p className="ll-lead">
            Type-safe uploads. Customizable components.
            <br />
            Storage that fits your application.
          </p>
          <HeroLinks />
        </div>
        <div className="ll-orbit-stage">
          <div className="ll-orbit-side">
            <h3>Made to fit.</h3>
            <p>Start with a React component. Make it feel like your app.</p>
          </div>
          <FilePreview />
          <div className="ll-orbit-side">
            <h3>Built for control.</h3>
            <p>Keep validation and authorization on your server.</p>
          </div>
        </div>
      </section>
      <StartWithAgent />
      <Frameworks />
      <Details title="The front and back, on the same page.">
        Your UI handles progress and cancellation. Your server defines the
        rules. Their types stay connected.
      </Details>
      <StorageChoices />
      <Closing title="Give your ideas somewhere to land." />
    </PageFrame>
  );
}

export function Mono() {
  return (
    <PageFrame>
      <section className="ll-mono-hero ll-width">
        <h1>
          File uploads.
          <br />
          <span>Nothing in your way.</span>
        </h1>
        <div className="ll-mono-body">
          <div>
            <p className="ll-lead">
              A typed upload API for TypeScript and React. Your components, your
              authentication, your storage.
            </p>
            <HeroLinks />
            <div className="ll-mono-capabilities">
              <span>
                <Check size={16} /> Server-side validation
              </span>
              <span>
                <Check size={16} /> Inferred client types
              </span>
              <span>
                <Check size={16} /> Progress and cancellation
              </span>
            </div>
          </div>
          <FilePreview />
        </div>
      </section>
      <StartWithAgent />
      <Frameworks />
      <Details title="A small surface. A lot of control.">
        Use what you need, from an upload call in your existing UI to ready-made
        React components.
      </Details>
      <StorageChoices />
      <Closing title="Put it to work." />
    </PageFrame>
  );
}

export function Signal() {
  return (
    <PageFrame>
      <section className="ll-signal-hero ll-width">
        <div className="ll-signal-heading">
          <h1>
            Know your files.
            <br />
            <span>Control the flow.</span>
          </h1>
          <div>
            <p className="ll-lead">
              Uploads for TypeScript and React, with server-side rules and
              client-side types that agree.
            </p>
            <HeroLinks />
          </div>
        </div>
        <div className="ll-signal-console">
          <FilePreview />
          <aside className="ll-signal-inspector">
            <h3>Inside this preview</h3>
            <dl>
              <div>
                <dt>Files</dt>
                <dd>3 sample assets</dd>
              </div>
              <div>
                <dt>Total size</dt>
                <dd>154 KB</dd>
              </div>
              <div>
                <dt>Storage</dt>
                <dd>Local simulation</dd>
              </div>
              <div>
                <dt>Network requests</dt>
                <dd>None</dd>
              </div>
            </dl>
            <p>
              Try selection, progress and cancellation. The same controls are
              available to your upload UI.
            </p>
          </aside>
        </div>
      </section>
      <StartWithAgent />
      <section className="ll-signal-contract ll-width">
        <div>
          <h2>
            The rules live
            <br />
            on your server.
          </h2>
          <p>
            Define buckets, size limits, and accepted file types. Use your
            existing authentication to authorize uploads.
          </p>
        </div>
        <CodeExample />
      </section>
      <Frameworks />
      <StorageChoices />
      <Closing title="Your files. Your next feature." />
    </PageFrame>
  );
}
