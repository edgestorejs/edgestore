/* eslint-disable @next/next/no-img-element */
import React from "react";
import Responsive from "../Responsive";

export const useScrollPosition = () => {
  const [scrollPosition, setScrollPosition] = React.useState(0);

  React.useEffect(() => {
    const updatePosition = () => {
      setScrollPosition(window.pageYOffset);
    };

    window.addEventListener("scroll", updatePosition);

    updatePosition();

    return () => window.removeEventListener("scroll", updatePosition);
  }, []);

  return scrollPosition;
};

const Homepage = () => {
  const scrollPosition = useScrollPosition();

  return (
    <>
      <div
        style={{
          boxShadow: "inset 0px -6px 2px -5px #ffffff10",
        }}
        className={`sticky top-0 mt-[calc(var(--ifm-navbar-height)*-1)] w-full h-[var(--ifm-navbar-height)] backdrop-blur-sm bg-[#00000040] transition-opacity duration-700 ${
          scrollPosition > 0 ? "opacity-100" : "opacity-0"
        }`}
      />

      <main className="flex min-h-screen flex-col items-center text-white mt-[calc(var(--ifm-navbar-height)*-1)]">
        <div className="flex w-full flex-col items-center justify-center bg-[radial-gradient(#1F0B3E,#000000)] py-28 px-3">
          <h1 className="text-center text-5xl md:text-6xl font-[Futura]  bg-gradient-to-b from-primary-100 to-primary-400 bg-clip-text text-transparent">
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
        <div className="flex w-full justify-center bg-[#1F0B3E] py-10 px-3 text-center">
          <div className="max-w-4xl">
            <p className="pb-4 text-xl font-bold">Why Edge Store?</p>
            <p>
              Edge Store is a simple image store for all project sizes. It is
              designed to be easy to use and easy to integrate into your
              project. It is built leveraging s3, cloudfront and lambda@edge to
              give you a fast, reliable and secure image store.
            </p>
          </div>
        </div>
        <div className="my-20 flex w-full max-w-4xl flex-wrap justify-center px-6 md:justify-between">
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
        <div className="flex flex-col items-center justify-center -z-10">
          <p className="mb-6 text-3xl font-bold">Examples</p>
          <div className="relative">
            <div className="absolute top-6 left-16">Client</div>
            <Responsive
              desktop={
                <img
                  className="w-[800px]"
                  src="/img/lp-code/edge-store_client.png"
                  alt="Edge Store Client"
                />
              }
              mobile={
                <img
                  className="w-[800px]"
                  src="/img/lp-code/edge-store_client_mobile.png"
                  alt="Edge Store Client"
                />
              }
            />
          </div>
          <div className="relative">
            <div className="absolute top-6 left-16">Server</div>
            <Responsive
              desktop={
                <img
                  className="w-[800px]"
                  src="/img/lp-code/edge-store_server.png"
                  alt="Edge Store Server"
                />
              }
              mobile={
                <img
                  className="w-[800px]"
                  src="/img/lp-code/edge-store_server_mobile.png"
                  alt="Edge Store Server"
                />
              }
            />
          </div>
          <div className="relative">
            <div className="absolute top-6 left-16">React</div>
            <Responsive
              desktop={
                <img
                  className="w-[800px]"
                  src="/img/lp-code/edge-store_react.png"
                  alt="Edge Store React"
                />
              }
              mobile={
                <img
                  className="w-[800px]"
                  src="/img/lp-code/edge-store_react_mobile.png"
                  alt="Edge Store React"
                />
              }
            />
          </div>
        </div>
        <div className="mb-16">
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
    <div className="my-4 min-h-[170px] w-[90%] rounded-lg p-6 shadow-[0px_0px_19px_3px_#7C3AED60] md:w-[30%]">
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
      className="rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-gray-600 focus:border-transparent font-[futura] font-semibold transition-colors duration-200 text-gray-100 hover:text-gray-100 hover:no-underline bg-primary hover:bg-primary-800 focus:bg-primary-800 active:bg-primary-800"
      href="https://app.edge-store.com/subscribe"
    >
      APPLY FOR EARLY ACCESS
    </a>
  );
};
