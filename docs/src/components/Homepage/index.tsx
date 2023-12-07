import BrowserOnly from '@docusaurus/BrowserOnly';
import React from 'react';
import CodeBlock1 from '../../../docs/landing-code/CodeBlock1.md';
import CodeBlock2 from '../../../docs/landing-code/CodeBlock2.md';
import CodeBlock3 from '../../../docs/landing-code/CodeBlock3.md';
import { BlurryBlob } from '../BlurryBlob';
import Hero from './Hero';
import HomepageFeatures from '../HomepageFeatures';

type CodeBlockItem = {
  title: string;
  description: string | React.ReactNode;
  code: React.ReactNode;
};

const codeBlocks: CodeBlockItem[] = [
  {
    title: 'Step 1 - Server',
    description: (
      <>
        <p>
          Use our completely type-safe package to configure your storage. You
          can configure who can upload and access files and even add metadata
          that can be used for access control or search filtering.
        </p>
        <p>
          You can also leverage the lifecycle hooks to run custom code when a
          file is uploaded or deleted. Which can be used to sync data with your
          database if needed.
        </p>
      </>
    ),
    code: <CodeBlock1 />,
  },
  {
    title: 'Step 2 - Client',
    description: (
      <>
        <p>
          Wrap your app with the Edge Store provider component. This will enable
          you to access Edge Store methods anywhere in your app.
        </p>
      </>
    ),
    code: <CodeBlock2 />,
  },
  {
    title: 'Step 3 - Start uploading',
    description: (
      <>
        <p>
          Use the useEdgeStore hook to upload files to Edge Store. You can also
          use the onProgressChange callback to easily show a progress bar for
          your uploads.
        </p>
        <p>
          If it is a storage for images and the image is large, Edge Store will
          automatically create a thumbnail for you. And return the url for the
          thumbnail in the response. (Thumbnail images are not counted towards
          your storage quota.)
        </p>
      </>
    ),
    code: <CodeBlock3 />,
  },
];

const Homepage = () => {
  return (
    <main className="mt-[calc(var(--ifm-navbar-height)*-1)] min-h-screen text-white">
      <div className="pointer-events-none -z-10 opacity-50">
        <BrowserOnly>
          {() => {
            // get window width
            const windowWidth = window.innerWidth;
            // only desktop
            return windowWidth > 768 ? (
              <BlurryBlob
                width="min(56rem, 100vw)"
                height="400px"
                left="45%"
                top="50px"
              />
            ) : (
              <></>
            );
          }}
        </BrowserOnly>
      </div>
      <div className="flex w-full flex-col items-center justify-center bg-[radial-gradient(theme(colors.primary.999),#000000_85%)] px-3 pb-20 pt-40 md:bg-none">
        <Hero />
      </div>
      
      <div className="mb-20">
        <HomepageFeatures />
      </div>

      <div className="mx-6 flex flex-col items-center gap-12">
        {codeBlocks.map((block) => (
          <CodeBlockItem key={block.title} block={block} />
        ))}
      </div>
      <div className="my-16 text-center">
        <JoinButton />
      </div>
    </main>
  );
};

export default Homepage;

const TechCard: React.FC<{ title: string; description: string }> = ({
  title,
  description,
}) => {
  return (
     <div className="min-h-[170px] w-full rounded-xl p-5"
     style={{
      border: "1px solid #222"
     }}
    >
      <p className="mb-2 text-lg font-bold">{title}</p>
      <p className="text-gray-400">{description}</p>
    </div>
  );
};

export const JoinButton: React.FC = () => {
  return (
    <a 
      target="_blank"
      rel="noreferrer"
      href="https://dashboard.edgestore.dev/sign-up"
      className="max-w-[250px] hover:no-underline focus:border-transparent focus:outline-none no-underline flex items-center justify-center gap-x-2 py-2 px-4 text-white hover:text-white font-medium bg-primary duration-150 hover:bg-primary-800 active:bg-primary-800 rounded-md md:inline-flex"
    >
        Get started for free
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M2 10a.75.75 0 01.75-.75h12.59l-2.1-1.95a.75.75 0 111.02-1.1l3.5 3.25a.75.75 0 010 1.1l-3.5 3.25a.75.75 0 11-1.02-1.1l2.1-1.95H2.75A.75.75 0 012 10z" clipRule="evenodd" />
        </svg>
    </a>
  );
};

export const LearnMoreButton: React.FC = () => {
  return (
    <a  href="/docs/quick-start"  className="max-w-[250px] hover:no-underline focus:border-transparent focus:outline-none no-underline flex items-center justify-center gap-x-2 py-2 px-4 text-gray-300 hover:text-white hover:bg-[#3334] font-medium duration-150 active:bg-gray-100 border rounded-md md:inline-flex">
      Learn more
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
          <path fillRule="evenodd" d="M2 10a.75.75 0 01.75-.75h12.59l-2.1-1.95a.75.75 0 111.02-1.1l3.5 3.25a.75.75 0 010 1.1l-3.5 3.25a.75.75 0 11-1.02-1.1l2.1-1.95H2.75A.75.75 0 012 10z" clipRule="evenodd" />
      </svg>
    </a>
  );
};

const CodeBlockItem: React.FC<{ block: CodeBlockItem }> = ({ block }) => {
  return (
    <div className="flex max-w-full flex-col justify-between lg:max-w-6xl lg:flex-row lg:gap-12">
      <code className="order-1 min-w-0 flex-[3] lg:order-none">{block.code}</code>
      <div className="flex-[2]">
        <h2>{block.title}</h2>
        <div>{block.description}</div>
      </div>
    </div>
  );
};
