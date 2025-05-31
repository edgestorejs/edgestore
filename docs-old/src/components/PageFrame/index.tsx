import React from 'react';

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

export function PageFrame(props: { children: React.ReactNode }) {
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
      {props.children}
    </>
  );
}
