'use client';

import { YouTubeVideo } from '../_components/youtube-video';

export function DemoVideo() {
  const videoId = 'Acq9UEA2akU';

  return (
    <div className="container py-10 md:py-20">
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
        <div className="mx-auto w-full">
          <YouTubeVideo
            videoId={videoId}
            title="EdgeStore Demo Video"
            overlayContent={<FeatureHighlights />}
            badgeContent="10min demo"
          />
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
