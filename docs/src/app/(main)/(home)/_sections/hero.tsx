import { ActionButton } from '@/components/action-button';
import { Button } from '@/components/ui/button';
import { ChevronDownIcon } from 'lucide-react';
import Link from 'next/link';

export function Hero() {
  return (
    <div className="container flex flex-col items-center gap-8 py-20 md:flex-row lg:py-40">
      <div className="lg:flex-3 flex-2 xl:flex-2 space-y-6">
        <h1 className="text-foreground text-center text-3xl font-bold min-[380px]:text-4xl md:text-left lg:text-5xl">
          The best way to
          <br /> add <span className="text-primary">file uploads</span>
          <br /> to your apps
        </h1>
        <div className="block md:hidden">
          <HeroDropzone />
        </div>
        <p className="text-md text-muted-foreground max-w-[600px] text-balance text-center md:text-left lg:text-lg">
          EdgeStore provides type-safe, fast, scalable storage solutions
          tailored for modern web development. It eliminates the complexities of
          traditional services like S3.
        </p>
        <div className="flex flex-col justify-center gap-4 sm:flex-row md:justify-start">
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
      <div className="flex-2 hidden md:block">
        <HeroDropzone />
      </div>
    </div>
  );
}

function HeroDropzone() {
  return (
    <div className="flex justify-center">
      <div className="border-border bg-card w-full max-w-md overflow-hidden rounded-lg border shadow-sm">
        <div className="border-border bg-muted/50 border-b p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">File Upload</h3>
            <div className="bg-primary h-4 w-4 rounded-full"></div>
          </div>
        </div>
        <div className="space-y-3 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Select file type:</span>
            <div className="text-foreground flex items-center gap-2 font-medium">
              <span>Image</span>
              <ChevronDownIcon className="text-primary h-4 w-4" />
            </div>
          </div>
          <div className="border-border flex h-20 items-center justify-center rounded-md border-2 border-dashed">
            <p className="text-muted-foreground text-sm">
              Drag and drop files here
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
