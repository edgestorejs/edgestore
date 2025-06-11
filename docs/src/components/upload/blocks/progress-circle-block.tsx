'use client';

import { useMockProgress } from '@/hooks/use-mock-progress';
import { ProgressCircle } from '../progress-circle';

export function ProgressCircleUsage() {
  const progress = useMockProgress();

  return (
    <div className="flex w-full items-center justify-center p-4">
      <div className="flex h-20 w-20 items-center justify-center rounded-md bg-black/80">
        <ProgressCircle progress={progress} />
      </div>
    </div>
  );
}
