'use client';

import * as React from 'react';

export function useMockProgress() {
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    if (progress >= 100) {
      // When progress hits 100, set a timeout to reset it.
      const timerId = setTimeout(() => {
        setProgress(0); // This will trigger the useEffect again, entering the 'else' block.
      }, 1000);
      // Cleanup function for this effect run: clear the timeout if the component
      // unmounts or if 'progress' changes before the timeout fires.
      return () => { clearTimeout(timerId); };
    } else {
      // If progress is less than 100, set an interval to increment it.
      const intervalId = setInterval(() => {
        setProgress((prevProgress) => {
          // Add a random value between 10-20 percent
          return Math.min(
            100,
            prevProgress + Math.floor(Math.random() * 11) + 10,
          );
        });
      }, 300);
      // Cleanup function for this effect run: clear the interval if the component
      // unmounts or if 'progress' changes (e.g., hits 100).
      return () => { clearInterval(intervalId); };
    }
  }, [progress]); // Re-run this effect whenever 'progress' changes.

  return progress;
}
