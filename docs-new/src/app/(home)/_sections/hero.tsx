import { Button } from '@/components/ui/button';
import { ChevronDownIcon } from 'lucide-react';
import Link from 'next/link';

export function Hero() {
  return (
    <div className="container flex flex-col items-center gap-8 py-20 md:flex-row lg:py-40">
      <div className="lg:flex-3 flex-2 xl:flex-2 space-y-6">
        <h1 className="text-center text-3xl font-bold text-foreground sm:text-4xl md:text-left md:text-5xl">
          The best way to
          <br /> add <span className="text-primary">file uploads</span>
          <br /> to your apps
        </h1>
        <p className="max-w-[600px] text-balance text-center text-lg text-muted-foreground md:text-left">
          EdgeStore provides type-safe, fast, scalable storage solutions
          tailored for modern web development. It eliminates the complexities of
          traditional services like S3.
        </p>
        <div className="flex flex-col justify-center gap-4 sm:flex-row md:justify-start">
          <Button
            asChild
            size="lg"
            className="group relative inline-flex items-center justify-center overflow-hidden bg-gradient-to-r from-[#AA99FF] to-[#8B7FE8] text-white shadow-lg transition-all duration-300 hover:shadow-[0_0_30px_rgba(170,153,255,0.4)]"
            style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
          >
            <Link href="/docs/getting-started">
              {/* Animated background gradient */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#8B7FE8] to-[#AA99FF] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

              {/* Shimmer effect */}
              <div className="absolute inset-0 -translate-x-full skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />

              <span
                className="relative flex items-center gap-2"
                style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}
              >
                Start for Free
              </span>
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/docs/quick-start">Learn More</Link>
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
