import React, { useEffect, useState } from 'react';
import { ProgressCircle } from '../progress-circle';

export function ProgressCircleUsage() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const startAnimation = () => {
      const interval = setInterval(() => {
        setProgress((prevProgress) => {
          if (prevProgress >= 100) {
            clearInterval(interval);
            // Reset after 1 second when reaching 100%
            setTimeout(() => {
              setProgress(0);
              startAnimation(); // Restart the animation cycle
            }, 1000);
            return 100;
          }
          // Add a random value between 10-20 percent
          return Math.min(
            100,
            prevProgress + Math.floor(Math.random() * 11) + 10,
          );
        });
      }, 300);

      return interval;
    };

    const interval = startAnimation();

    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex w-full items-center justify-center">
      <div className="flex h-20 w-20 items-center justify-center rounded bg-black/80">
        <ProgressCircle progress={progress} />
      </div>
    </div>
  );
}
