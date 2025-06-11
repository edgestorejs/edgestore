'use client';

import { cn } from '@/lib/utils';
import { CheckCircle2 } from 'lucide-react';
import { motion, useAnimation } from 'motion/react';
import { useEffect, useId, useRef } from 'react';

interface UploadIconProps {
  className?: string;
  size?: number;
  animate?: boolean;
  complete?: boolean;
}

export default function UploadIcon({
  className,
  animate = false,
  complete = false,
}: UploadIconProps) {
  const maskId = useId();
  const cloudControls = useAnimation();
  const arrow1Controls = useAnimation();
  const arrow2Controls = useAnimation();
  const checkIconControls = useAnimation();
  const isAnimatingRef = useRef(false);

  const cloudPathInitial =
    'M3.99762 14.8969C3.25458 14.1378 2.69405 13.2196 2.35848 12.2117C2.02291 11.2039 1.92111 10.1329 2.06078 9.07994C2.20045 8.02694 2.57793 7.01954 3.16462 6.13403C3.75132 5.24852 4.53186 4.50813 5.4471 3.96893C6.36234 3.42974 7.3883 3.10589 8.44725 3.02191C9.5062 2.93793 10.5704 3.09603 11.5592 3.48422C12.548 3.87241 13.4355 4.48052 14.1544 5.26249C14.8734 6.04445 15.4049 6.97977 15.7088 7.99759H17.499C18.4646 7.99748 19.4047 8.30792 20.1803 8.88307C20.9559 9.45822 21.526 10.2676 21.8062 11.1916C22.0865 12.1155 22.0622 13.1052 21.7368 14.0143C21.4114 14.9234 20.8022 15.7037 19.9993 16.24';
  const cloudPathState2 =
    'M4.79785 14.5798C4.12912 13.7771 3.62464 12.8062 3.32263 11.7405C3.02062 10.6748 2.929 9.54238 3.0547 8.42894C3.1804 7.3155 3.52013 6.25027 4.04816 5.31393C4.57619 4.37759 5.27867 3.59469 6.10239 3.02455C6.92611 2.45441 7.84947 2.11197 8.80252 2.02317C9.75558 1.93437 10.7133 2.10154 11.6033 2.51201C12.4932 2.92249 13.2919 3.5655 13.939 4.39236C14.586 5.21921 15.0644 6.20821 15.338 7.28446H16.9491C17.8182 7.28434 18.6642 7.61261 19.3623 8.22077C20.0603 8.82893 20.5734 9.68473 20.8256 10.6618C21.0779 11.6388 21.056 12.6852 20.7631 13.6465C20.4703 14.6078 19.922 15.4329 19.1994 16';

  const animateElements = async () => {
    // Set the animation state
    isAnimatingRef.current = true;

    // Loop the animation
    while (isAnimatingRef.current) {
      // Reset positions
      arrow1Controls.set({ y: 0 });
      arrow2Controls.set({ y: 20, opacity: 0 });

      // Create a timeline of animations
      const animationSequence = async () => {
        // Skip if animation has been disabled
        if (!isAnimatingRef.current) return;

        // 0ms: Start animations
        const cloudAnimation1 = cloudControls.start({
          d: cloudPathInitial,
          transition: { duration: 0.12, ease: 'linear' },
        });

        // 0ms to 400ms: Arrow1 animation
        const arrow1Animation = arrow1Controls.start({
          y: [0, -20],
          transition: { duration: 0.4, ease: 'easeInOut' },
        });

        // Wait for the initial 120ms
        await new Promise((resolve) => setTimeout(resolve, 120));
        if (!isAnimatingRef.current) return;

        // 120ms to 260ms: animate cloud to second state
        const cloudAnimation2 = cloudControls.start({
          d: cloudPathState2,
          transition: { duration: 0.14, ease: 'easeInOut' },
        });

        // Wait until 260ms from start
        await new Promise((resolve) => setTimeout(resolve, 140));
        if (!isAnimatingRef.current) return;

        // 260ms to 400ms: cloud back to initial state
        const cloudAnimation3 = cloudControls.start({
          d: cloudPathInitial,
          transition: { duration: 0.14, ease: 'easeInOut' },
        });

        // Wait until 400ms from start
        await new Promise((resolve) => setTimeout(resolve, 140));
        if (!isAnimatingRef.current) return;

        // At 400ms, start arrow2 animation
        const arrow2Animation = arrow2Controls.start({
          y: 0,
          opacity: 1,
          transition: {
            y: { type: 'spring', stiffness: 300, damping: 24 },
            opacity: { duration: 0.2 },
          },
        });

        // Wait for all animations to complete
        await Promise.all([
          cloudAnimation1,
          arrow1Animation,
          cloudAnimation2,
          cloudAnimation3,
          arrow2Animation,
        ]);
      };

      if (isAnimatingRef.current) {
        await animationSequence();
      } else {
        break;
      }

      // Wait for the full cycle to complete
      if (isAnimatingRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 600));
      } else {
        break;
      }
    }
  };

  // Reset animation to initial state
  const resetAnimation = () => {
    cloudControls.stop();
    arrow1Controls.stop();
    arrow2Controls.stop();

    cloudControls.set({ d: cloudPathInitial });
    arrow1Controls.set({ y: 0 });
    arrow2Controls.set({ y: 20, opacity: 0 });
  };

  useEffect(() => {
    if (complete) {
      // Stop any running animation
      isAnimatingRef.current = false;
      cloudControls.stop();
      arrow1Controls.stop();
      arrow2Controls.stop();

      // Fade out and shrink cloud and arrows
      void cloudControls.start({
        opacity: 0,
        scale: 0.5,
        transition: { duration: 0.3, ease: 'easeInOut' },
      });

      void arrow1Controls.start({
        opacity: 0,
        scale: 0.5,
        transition: { duration: 0.3, ease: 'easeInOut' },
      });

      void arrow2Controls.start({
        opacity: 0,
        scale: 0.5,
        transition: { duration: 0.3, ease: 'easeInOut' },
      });

      // Animate in the CheckCircle2Icon with bounce
      void checkIconControls.start({
        opacity: 1,
        scale: 1,
        transition: {
          opacity: { duration: 0.2, delay: 0.2 },
          scale: {
            type: 'spring',
            stiffness: 700,
            damping: 25,
            delay: 0.2,
          },
        },
      });
    } else {
      // Reset cloud and arrows
      void cloudControls.start({
        opacity: 1,
        scale: 1,
        transition: { duration: 0.3 },
      });

      // Reset check icon
      void checkIconControls.start({
        opacity: 0,
        scale: 0.5,
        transition: { duration: 0.2 },
      });

      if (animate) {
        // Start the animation loop only if animate is true
        void animateElements();
      } else {
        // Stop any running animation
        isAnimatingRef.current = false;
        resetAnimation();
      }
    }

    return () => {
      // Clean up animations on unmount
      isAnimatingRef.current = false;
      cloudControls.stop();
      arrow1Controls.stop();
      arrow2Controls.stop();
      checkIconControls.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate, complete]);

  return (
    <div className={cn('relative inline-block h-20 w-20', className)}>
      {/* Original SVG with cloud and arrows */}
      <motion.svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="absolute inset-0 h-full w-full"
      >
        {/* Cloud Path */}
        <motion.path d={cloudPathInitial} animate={cloudControls} />

        {/* Only show arrows when not complete */}
        {!complete && (
          <>
            {/* Mask for Arrow */}
            <mask
              id={maskId}
              style={{ maskType: 'alpha' }}
              maskUnits="userSpaceOnUse"
              x="1"
              y="2"
              width="22"
              height="21"
            >
              <path
                d="M8.36963 2.02832C9.57967 1.93235 10.7964 2.11307 11.9263 2.55664C13.0561 3.00027 14.0706 3.69533 14.8921 4.58887C15.542 5.29592 16.0555 6.11367 16.4146 7H17.4995L17.7202 7.00488C18.8223 7.04896 19.8881 7.42301 20.7769 8.08203C21.7246 8.78484 22.4206 9.77429 22.7632 10.9033C23.1057 12.0326 23.0759 13.2425 22.6782 14.3535C22.6776 14.3561 22.6754 14.3643 22.6714 14.3789C22.6658 14.3993 22.659 14.4277 22.6509 14.4639C22.6344 14.5372 22.6158 14.6326 22.5952 14.75C22.5539 14.9855 22.5093 15.2844 22.4604 15.6328C22.3652 16.3127 22.2513 17.1988 22.1274 18.043C22.0027 18.8928 21.8583 19.7644 21.689 20.4668C21.6048 20.8156 21.5068 21.1549 21.3901 21.4404C21.3317 21.5834 21.26 21.7355 21.1694 21.877C21.0842 22.0101 20.9459 22.1917 20.7358 22.332C20.5717 22.4415 20.3785 22.4999 20.1812 22.5H4.49951C4.26433 22.4999 4.03781 22.417 3.85889 22.2676L3.78467 22.2002C3.63153 22.0437 3.52854 21.8623 3.4624 21.7305C3.3897 21.5855 3.32534 21.4247 3.26709 21.2627C3.15052 20.9384 3.03712 20.5432 2.9292 20.1162C2.71248 19.2587 2.496 18.1915 2.29541 17.1377C2.09499 16.0848 1.90473 15.0128 1.74854 14.165C1.58295 13.2663 1.4675 12.6982 1.41162 12.5303C1.02819 11.3786 0.912241 10.1544 1.07178 8.95117C1.23136 7.74801 1.66325 6.5968 2.3335 5.58496C3.00387 4.5731 3.89614 3.72652 4.94189 3.11035C5.98754 2.49434 7.15983 2.12437 8.36963 2.02832Z"
                fill="black"
                transform="translate(1, 2)"
              />
            </mask>

            {/* Arrow Path with Mask */}
            <g mask={`url(#${maskId})`}>
              {/* Arrow 1 (animates upward) */}
              <motion.path
                d="M8 17L12 13M12 13V21M12 13L16 17"
                animate={arrow1Controls}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Arrow 2 (appears from the bottom) */}
              <motion.path
                d="M8 17L12 13M12 13V21M12 13L16 17"
                animate={arrow2Controls}
                initial={{ opacity: 0, y: 20 }}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          </>
        )}
      </motion.svg>

      {/* CheckCircle2Icon for complete state */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={checkIconControls}
      >
        <CheckCircle2 className="h-4/5 w-4/5" />
      </motion.div>
    </div>
  );
}
