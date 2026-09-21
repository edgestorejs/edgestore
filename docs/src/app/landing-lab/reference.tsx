import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { CodeExample } from './code-example';
import {
  Closing,
  FeatureRows,
  Footer,
  Frameworks,
  Navigation,
  Prompt,
  StorageChoices,
} from './shared';

export function Reference() {
  return (
    <>
      <Navigation light />
      <main id="landing-content">
        <section className="ll-reference-hero ll-width">
          <div>
            <h1>
              Your upload stack.
              <br />
              <span>Fully typed.</span>
            </h1>
            <p className="ll-lead">
              File uploads for TypeScript and React, with validation,
              authorization and storage under your control.
            </p>
          </div>
          <Prompt />
        </section>
        <section
          className="ll-reference-code ll-width"
          aria-label="Typed upload API example"
        >
          <CodeExample />
          <div className="ll-reference-proof">
            <span>
              <strong>Server rules.</strong> Inferred client types.
            </span>
            <Link href="/docs/quick-start">
              Read the quick start <ArrowUpRight size={16} />
            </Link>
          </div>
        </section>
        <Frameworks />
        <section className="ll-reference-features ll-width">
          <h2>
            Less to wire up.
            <br />
            More you can control.
          </h2>
          <FeatureRows />
        </section>
        <StorageChoices />
        <section className="ll-agent-section ll-width">
          <h2>
            Your agent gets
            <br />
            the right context.
          </h2>
          <div>
            <p>
              The setup skill guides your agent through the integration. Package
              references match the APIs you have installed. MCP and CLI tools
              connect the workflow to EdgeStore.
            </p>
            <Link href="/docs/agents" className="ll-text-link">
              See agent setup <ArrowUpRight size={16} />
            </Link>
          </div>
        </section>
        <Closing title="Start with a prompt. Keep the control." />
      </main>
      <Footer />
    </>
  );
}
