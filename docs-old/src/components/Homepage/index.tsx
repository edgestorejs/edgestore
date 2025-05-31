import BrowserOnly from '@docusaurus/BrowserOnly';
import React from 'react';
import CodeBlock1 from '../../../docs/landing-code/CodeBlock1.md';
import CodeBlock2 from '../../../docs/landing-code/CodeBlock2.md';
import CodeBlock3 from '../../../docs/landing-code/CodeBlock3.md';
import { BlurryBlob } from '../BlurryBlob';
import { Dialog, DialogContent, DialogTrigger } from '../ui/Dialog';

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
          Wrap your app with the EdgeStore provider component. This will enable
          you to access EdgeStore methods anywhere in your app.
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
          Use the useEdgeStore hook to upload files to EdgeStore. You can also
          use the onProgressChange callback to easily show a progress bar for
          your uploads.
        </p>
        <p>
          If it is a storage for images and the image is large, EdgeStore will
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
                left="50%"
                top="50px"
              />
            ) : (
              <></>
            );
          }}
        </BrowserOnly>
      </div>
      <div className="flex w-full flex-col items-center justify-center bg-[radial-gradient(theme(colors.primary.999),#000000_85%)] px-3 pb-10 pt-40 md:bg-none">
        <h1 className="z-0 text-center text-2xl font-bold sm:text-5xl md:text-6xl">
          Implementing file uploads
          <br /> should be easy.
        </h1>
        <h2 className="z-0 mb-10 bg-gradient-to-b from-primary-100 to-primary-200 bg-clip-text text-center text-xs font-medium text-transparent sm:text-sm md:text-lg">
          Storage, CDN and a super easy to use type-safe library. <br />
          Created by a developer, for developers.
        </h2>
        <div className="z-0 flex gap-3 ">
          <JoinButton />
          <LearnMoreButton />
        </div>
      </div>
      <VideoSection />
      <div className="mx-auto mb-20 grid w-full max-w-4xl auto-rows-fr grid-cols-1 gap-10 px-6 md:grid-cols-3 md:justify-between">
        <TechCard
          title="Start for free"
          description="Get your free storage and start building. No credit card required."
        />
        <TechCard
          title="Effortless Integration"
          description="Use our type-safe npm package to seamlessly integrate EdgeStore into your app."
        />
        <TechCard
          title="Easy-to-Use Dashboard"
          description="Monitor, manage, and delete files with ease."
        />
        <TechCard
          title="Fast CDN"
          description="All your files are served from the edge for a great performance anywhere in the world."
        />
        <TechCard
          title="Large file support"
          description="Automatically uses multipart uploads for bigger files."
        />
        <TechCard
          title="Protected Files"
          description="Ensure your files are safe with custom edge validations."
        />
        <TechCard
          title="Automatic Thumbnail Generation"
          description="Images ready to use, without the extra effort."
        />
        <TechCard
          title="Customizable Components"
          description="Just copy one of our sample components and customize it to your needs."
        />
        <TechCard
          title="And More..."
          description="Temporary files, parallel uploads, and much more. Handle all scenarios with finesse."
        />
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

const VideoSection: React.FC = () => {
  return (
    <div className="mb-10 flex justify-center">
      <Dialog>
        <DialogTrigger asChild>
          <div className="group relative">
            <img className="w-full max-w-2xl" src="/img/video-thumb.png" />
            <div className="absolute inset-0 flex cursor-pointer items-center justify-center">
              <div className="flex h-32 w-32 items-center justify-center rounded-full bg-white/10 p-3 transition-all duration-200 group-hover:scale-110">
                <div className="flex h-full w-full items-center justify-center rounded-full bg-primary-500/80 transition-all duration-200 group-hover:bg-primary-500">
                  <img
                    className="h-10 translate-x-1"
                    src="/img/icons/play-icon.svg"
                  />
                </div>
              </div>
            </div>
          </div>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <div className="flex aspect-video w-full justify-center">
            <iframe
              width="100%"
              height="100%"
              src="https://www.youtube.com/embed/Acq9UEA2akU?si=7UjGbV6kaVPx1OxN&autoplay=1"
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            ></iframe>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const TechCard: React.FC<{ title: string; description: string }> = ({
  title,
  description,
}) => {
  return (
    <div className="min-h-[170px] w-full rounded-lg p-6 shadow-[0px_0px_5px_0px_theme(colors.primary.500),0px_0px_20px_0px_theme(colors.primary.700)]">
      <p className="mb-2 text-lg font-bold">{title}</p>
      <p className="text-gray-400">{description}</p>
    </div>
  );
};

const JoinButton: React.FC = () => {
  return (
    <a
      target="_blank"
      rel="noreferrer"
      className="rounded-lg bg-primary px-4 py-2 font-semibold text-gray-100 transition-colors duration-200 hover:bg-primary-800 hover:text-gray-100 hover:no-underline focus:border-transparent focus:bg-primary-800 focus:outline-none focus:ring-2 focus:ring-gray-600 active:bg-primary-800"
      href="https://dashboard.edgestore.dev/sign-up"
    >
      Start for free
    </a>
  );
};

const LearnMoreButton: React.FC = () => {
  return (
    <a
      className="rounded-lg bg-white/5 px-4 py-2 font-semibold text-gray-100 transition-colors duration-200 hover:bg-white/10 hover:text-gray-100 hover:no-underline focus:border-transparent focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-gray-600 active:bg-white/10"
      href="/docs/quick-start"
    >
      Learn more
    </a>
  );
};

const CodeBlockItem: React.FC<{ block: CodeBlockItem }> = ({ block }) => {
  return (
    <div className="flex max-w-full flex-col justify-between lg:max-w-6xl lg:flex-row lg:gap-12">
      <div className="order-1 min-w-0 flex-[3] lg:order-none">{block.code}</div>
      <div className="flex-[2]">
        <h2>{block.title}</h2>
        <div>{block.description}</div>
      </div>
    </div>
  );
};
