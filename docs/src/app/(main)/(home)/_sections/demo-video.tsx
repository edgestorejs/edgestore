'use client';

import { Button } from '@/components/ui/button';
import { PlayIcon } from 'lucide-react';
import { useState } from 'react';

export function DemoVideo() {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  const videoId = 'Acq9UEA2akU';

  const handlePlayVideo = () => {
    setIsVideoPlaying(true);
  };

  return (
    <div className="container py-20">
      <div className="mx-auto max-w-4xl">
        {/* Section header */}
        <div className="mb-12 space-y-4 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl md:text-4xl">
            See EdgeStore in{' '}
            <span className="from-primary to-primary/60 bg-gradient-to-b bg-clip-text text-transparent">
              Action
            </span>
          </h2>
          <p className="text-muted-foreground mx-auto max-w-2xl text-base sm:text-lg">
            Watch how easy it is to integrate file uploads into your application
            with EdgeStore&apos;s powerful features and intuitive API.
          </p>
        </div>

        {/* Video container */}
        <div className="border-muted group relative mx-auto aspect-video w-full overflow-hidden rounded-2xl border bg-gradient-to-br from-slate-900 to-slate-800 shadow-2xl">
          {!isVideoPlaying ? (
            <>
              {/* Background pattern/placeholder */}
              <div className="absolute inset-0 opacity-30">
                <div className="h-full w-full bg-[radial-gradient(circle_at_25%_25%,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[length:20px_20px]" />
              </div>

              {/* Video overlay */}
              <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] transition-all duration-300 group-hover:bg-black/20" />

              {/* Gradient overlay for better text visibility */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

              {/* Play button */}
              <div className="absolute inset-0 flex items-center justify-center">
                <Button
                  onClick={handlePlayVideo}
                  size="lg"
                  className="group/btn relative h-20 w-20 rounded-full bg-white/10 p-0 backdrop-blur-md transition-all duration-300 hover:scale-110 hover:bg-white/20 hover:shadow-[0_0_40px_rgba(255,255,255,0.3)] sm:h-24 sm:w-24"
                >
                  {/* Animated ring */}
                  <div className="absolute inset-0 animate-ping rounded-full border-2 border-white/30" />
                  <div className="absolute inset-2 rounded-full border border-white/20" />

                  {/* Play icon */}
                  <PlayIcon className="relative ml-1 h-8 w-8 fill-white text-white transition-transform duration-300 group-hover/btn:scale-110 sm:h-10 sm:w-10" />
                </Button>
              </div>

              {/* Demo duration badge */}
              <div className="absolute bottom-6 left-6">
                <div className="flex items-center gap-2 rounded-full bg-black/50 px-4 py-2 backdrop-blur-md">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                  <span className="text-sm font-medium text-white">
                    10min demo
                  </span>
                </div>
              </div>

              <FeatureHighlights />
            </>
          ) : (
            /* YouTube video iframe */
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
              title="EdgeStore Demo Video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="h-full w-full"
            />
          )}
        </div>

        {/* Additional CTA below video */}
        <div className="mt-8 text-center">
          <p className="text-muted-foreground text-sm">
            Ready to get started? It takes less than 5 minutes to set up.
          </p>
        </div>
      </div>
    </div>
  );
}

function FeatureHighlights() {
  const features = [
    'Type-safe uploads',
    'Real-time progress',
    'Custom components',
    'Protected files',
    'Parallel uploads',
    'Temporary files',
  ];

  return (
    <div className="pointer-events-none absolute right-6 top-6 hidden space-y-2 sm:block">
      {features.map((feature) => (
        <div
          key={feature}
          className="rounded-lg bg-white/10 px-3 py-2 backdrop-blur-md"
        >
          <span className="block text-xs leading-none text-white/90">
            {feature}
          </span>
        </div>
      ))}
    </div>
  );
}
