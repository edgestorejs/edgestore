import { Button } from '@/components/ui/button';
import { ChevronDownIcon } from 'lucide-react';
import Link from 'next/link';

export default function Hero() {
  return (
    <div className="container flex flex-col items-center gap-8 py-20 md:flex-row">
      <div className="lg:flex-3 flex-2 xl:flex-2 space-y-6">
        <h1 className="text-center text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-left md:text-5xl">
          Effortless File Uploads
          <br /> for Your Apps
        </h1>
        <p className="max-w-[600px] text-balance text-center text-lg text-muted-foreground md:text-left">
          EdgeStore provides type-safe, fast, scalable storage solutions
          tailored for modern web development. It eliminates the complexities of
          traditional services like S3.
        </p>
        <div className="flex flex-col justify-center gap-4 sm:flex-row md:justify-start">
          <Button asChild size="lg" className="font-medium">
            <Link href="/docs/getting-started">Start for Free</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="font-medium">
            <Link href="/docs">Learn More</Link>
          </Button>
        </div>
      </div>

      <div className="flex-2 hidden justify-center md:flex">
        <div className="w-full max-w-md overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="border-b border-border bg-muted/50 p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">File Upload</h3>
              <div className="h-4 w-4 rounded-full bg-primary"></div>
            </div>
          </div>
          <div className="space-y-3 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Select file type:</span>
              <div className="flex items-center gap-2 font-medium text-foreground">
                <span>Image</span>
                <ChevronDownIcon className="h-4 w-4 text-primary" />
              </div>
            </div>
            <div className="flex h-20 items-center justify-center rounded-md border-2 border-dashed border-border">
              <p className="text-sm text-muted-foreground">
                Drag and drop files here
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
