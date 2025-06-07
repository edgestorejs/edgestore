'use client';

import { ActionButton } from '@/components/action-button';
import { Button } from '@/components/ui/button';
import {
  UploaderProvider,
  type UploadFn,
} from '@/components/upload/uploader-provider';
import { useEdgeStore } from '@/lib/edgestore';
import Link from 'next/link';
import { useCallback } from 'react';
import { NeonDropzone } from '../_components/neon-dropzone';

export function Hero() {
  const { edgestore } = useEdgeStore();
  // Define the upload function
  const uploadFn: UploadFn = useCallback(
    async ({ file, onProgressChange, signal }) => {
      // Example using Edge Store client
      const { url } = await edgestore.publicFiles.upload({
        file,
        signal,
        onProgressChange: (progress) => {
          void onProgressChange(progress);
        },
        options: {
          temporary: true,
        },
      });
      return { url };
    },
    [edgestore],
  );

  return (
    <UploaderProvider uploadFn={uploadFn} autoUpload>
      <div className="container flex flex-col items-center gap-8 py-20 lg:flex-row lg:py-40">
        <div className="flex-2 flex w-full min-w-0 flex-col items-center gap-6 lg:items-start">
          <h1 className="text-foreground text-center text-3xl font-bold min-[380px]:text-4xl min-[420px]:text-5xl md:text-6xl lg:text-left lg:text-5xl">
            The best way to
            <br /> add <span className="text-primary">file uploads</span>
            <br /> to your apps
          </h1>
          <div className="block w-full lg:hidden">
            <NeonDropzone />
          </div>
          <p className="text-md text-muted-foreground max-w-[600px] text-balance text-center lg:text-left lg:text-lg">
            EdgeStore provides type-safe, fast, scalable storage solutions
            tailored for modern web development. It eliminates the complexities
            of traditional services like S3.
          </p>
          <div className="flex w-full flex-col justify-center gap-4 sm:flex-row lg:justify-start">
            <ActionButton
              href="/docs/getting-started"
              size="lg"
              aria-label="Sign up for free"
            >
              Start for Free
            </ActionButton>
            <Button asChild variant="outline" size="lg">
              <Link href="/docs/quick-start" aria-label="Go to documentation">
                Learn More
                <span className="sr-only">about EdgeStore</span>
              </Link>
            </Button>
          </div>
        </div>
        <div className="flex-2 hidden min-w-0 lg:block">
          <NeonDropzone />
        </div>
      </div>
    </UploaderProvider>
  );
}
