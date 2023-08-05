import React from 'react';
import CodeBlock1 from '../../../docs/landing-code/CodeBlock1.md';

export const useScrollPosition = () => {
  const [scrollPosition, setScrollPosition] = React.useState(0);

  React.useEffect(() => {
    const updatePosition = () => {
      setScrollPosition(window.pageYOffset);
    };

    window.addEventListener('scroll', updatePosition);

    updatePosition();

    // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
    return () => window.removeEventListener('scroll', updatePosition);
  }, []);

  return scrollPosition;
};

type CodeBlockItem = {
  title: string;
  description: string;
  code: React.ReactNode;
};

const codeBlocks: CodeBlockItem[] = [
  {
    title: 'Step 1 - Server',
    description:
      'Add the service environment variables to your Next.js app. Then export the Edge Store API from the Next.js API routes.',
    code: <CodeBlock1 />,
  },
  {
    title: 'Step 2 - Client',
    description:
      'Wrap your app with the Edge Store provider component. This will enable you to access Edge Store methods anywhere in your app.',
    code: <CodeBlock1 />,
  },
  {
    title: 'Step 3 - Start using',
    description:
      'Use the useEdgeStore hook to upload and fetch images from Edge Store. You can also use Edge Store features like:',
    code: <CodeBlock1 />,
  },
];

const Homepage = () => {
  const scrollPosition = useScrollPosition();

  return (
    <>
      <div
        style={{
          boxShadow: 'inset 0px -6px 2px -5px #ffffff10',
        }}
        className={`sticky top-0 z-10 mt-[calc(var(--ifm-navbar-height)*-1)] h-[var(--ifm-navbar-height)] w-full bg-[#00000040] backdrop-blur-sm transition-opacity duration-700 ${
          scrollPosition > 0 ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <main className="mt-[calc(var(--ifm-navbar-height)*-1)] min-h-screen text-white">
        <div className="flex w-full flex-col items-center justify-center bg-[radial-gradient(theme(colors.primary.999),#000000)] py-28 px-3">
          <h1 className="bg-gradient-to-b from-primary-100 to-primary-400 bg-clip-text text-center font-[Futura] text-5xl text-transparent md:text-6xl">
            EDGE STORE
          </h1>
          <h2 className="pt-3 text-center text-lg text-gray-300 md:text-xl">
            The image storage all developers dream of.
          </h2>
          <h3 className="pb-6 text-center text-sm text-gray-300">
            Working with images should be easy.
          </h3>
          <JoinButton />
        </div>
        <div className="flex w-full justify-center bg-primary-999 py-10 px-3 text-center">
          <div className="max-w-4xl">
            <p className="pb-4 text-xl font-bold">Why Edge Store?</p>
            <p>
              Edge Store is a simple image storage for all project sizes. It is
              designed to be easy to use and easy to integrate into your
              project. It is built leveraging s3, cloudfront and lambda@edge to
              give you a fast, reliable and secure image storage.
            </p>
          </div>
        </div>
        <div className="my-20 mx-auto grid w-full max-w-4xl auto-rows-fr grid-cols-1 gap-10 px-6 md:grid-cols-3 md:justify-between">
          <TechCard
            title="Easy to use"
            description="Use our server side and client side libraries to easily integrate Edge Store into your project."
          />
          <TechCard
            title="Fast"
            description="All your images are served from the edge, so they are fast to load."
          />
          <TechCard
            title="Secure"
            description="Have full control over who can access your images with a JWT based access control system that works on the Edge."
          />
          <TechCard
            title="Reliable"
            description="It leverages AWS serverless technologies that are known and trusted by millions of developers."
          />
          <TechCard
            title="Free for small projects"
            description="Just create an account and start using Edge Store for free."
          />
          <TechCard
            title="Pay as you grow"
            description="As your project grows, you can upgrade your plan to get more storage and more bandwidth."
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
    </>
  );
};

export default Homepage;

const TechCard: React.FC<{ title: string; description: string }> = ({
  title,
  description,
}) => {
  return (
    <div className="min-h-[170px] w-full rounded-lg p-6 shadow-[0px_0px_19px_0px_theme(colors.primary.900)]">
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
      className="rounded-lg bg-primary px-4 py-2 font-[futura] font-semibold text-gray-100 transition-colors duration-200 hover:bg-primary-800 hover:text-gray-100 hover:no-underline focus:border-transparent focus:bg-primary-800 focus:outline-none focus:ring-2 focus:ring-gray-600 active:bg-primary-800"
      href="https://app.edgestore.dev/subscribe"
    >
      APPLY FOR EARLY ACCESS
    </a>
  );
};

const CodeBlockItem: React.FC<{ block: CodeBlockItem }> = ({ block }) => {
  return (
    <div className="flex max-w-full flex-col justify-between gap-12 md:max-w-6xl md:flex-row">
      <div className="flex-[3]">{block.code}</div>
      <div className="flex-[2]">
        <h2>{block.title}</h2>
        <div>{block.description}</div>
      </div>
    </div>
  );
};
