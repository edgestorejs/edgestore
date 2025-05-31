'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ExternalLink } from 'lucide-react';
import React from 'react';

type DemoBlockProps = {
  children: React.ReactNode;
  externalLink?: string;
  v0Config?: {
    title: string;
    description: string;
    registryUrl: string;
  };
};

export function DemoBlock({
  children,
  externalLink,
  v0Config,
}: DemoBlockProps) {
  return (
    <div className="not-prose flex items-center justify-center pb-4">
      <div className="flex w-full max-w-lg flex-col items-center rounded-lg border border-solid border-border bg-background px-4 pb-8 pt-2">
        <div className="flex w-full items-center gap-2">
          {externalLink && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="flex items-center gap-2 text-foreground"
            >
              <a href={externalLink} target="_blank" rel="noreferrer">
                <span>See it in action</span>
                <ExternalLink size={16} />
              </a>
            </Button>
          )}
          <div className="grow" />
          {v0Config && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="flex items-center gap-1 text-foreground no-underline"
            >
              <a
                href={`https://v0.dev/chat/api/open?title=${v0Config.title}&prompt=${v0Config.description}&url=${v0Config.registryUrl}`}
                target="_blank"
                rel="noreferrer"
              >
                <span>Open in</span>
                <V0Logo className="inline-block" />
              </a>
            </Button>
          )}
        </div>
        <div className="reset-docusaurus w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}

export function V0Logo({ className, ...props }: React.ComponentProps<'svg'>) {
  return (
    <svg
      viewBox="0 0 40 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-5 w-5 text-current', className)}
      {...props}
    >
      <path
        d="M23.3919 0H32.9188C36.7819 0 39.9136 3.13165 39.9136 6.99475V16.0805H36.0006V6.99475C36.0006 6.90167 35.9969 6.80925 35.9898 6.71766L26.4628 16.079C26.4949 16.08 26.5272 16.0805 26.5595 16.0805H36.0006V19.7762H26.5595C22.6964 19.7762 19.4788 16.6139 19.4788 12.7508V3.68923H23.3919V12.7508C23.3919 12.9253 23.4054 13.0977 23.4316 13.2668L33.1682 3.6995C33.0861 3.6927 33.003 3.68923 32.9188 3.68923H23.3919V0Z"
        fill="currentColor"
      ></path>
      <path
        d="M13.7688 19.0956L0 3.68759H5.53933L13.6231 12.7337V3.68759H17.7535V17.5746C17.7535 19.6705 15.1654 20.6584 13.7688 19.0956Z"
        fill="currentColor"
      ></path>
    </svg>
  );
}
