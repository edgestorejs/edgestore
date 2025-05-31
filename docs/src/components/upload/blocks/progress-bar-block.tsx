'use client';

import { useMockProgress } from '@/hooks/use-mock-progress';
import { ProgressBar } from '../progress-bar';

export function ProgressBarUsage() {
  const progress = useMockProgress();

  return (
    <div className="flex w-full items-center justify-center p-4">
      <ProgressBar progress={progress} className="w-full max-w-sm" />
    </div>
  );
}
