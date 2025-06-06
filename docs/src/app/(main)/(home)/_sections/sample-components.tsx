'use client';

import { Button } from '@/components/ui/button';
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import {
  BotIcon,
  Palette,
  PlugIcon,
  Settings,
  Terminal,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { YouTubeVideo } from '../_components/youtube-video';

export function SampleComponents() {
  // You'll need to replace this with your actual YouTube video ID
  const videoId = 'YOUR_COMPONENTS_VIDEO_ID';

  const features = [
    {
      icon: <Palette className="h-5 w-5" />,
      title: 'Beautiful',
      description: 'Stunning UI components out of the box',
    },
    {
      icon: <Zap className="h-5 w-5" />,
      title: 'Feature Rich',
      description: 'Everything you need for file uploads',
    },
    {
      icon: <Settings className="h-5 w-5" />,
      title: 'Completely Customizable',
      description: 'Tailor every aspect to your needs',
    },
    {
      icon: <Terminal className="h-5 w-5" />,
      title: 'Install with the shadcn cli',
      description: 'One command setup and configuration',
    },
    {
      icon: <BotIcon className="h-5 w-5" />,
      title: 'Open in v0 Integration',
      description: 'Design and customize with AI assistance',
    },
    {
      icon: <PlugIcon className="h-5 w-5" />,
      title: 'Provider Agnostic',
      description: 'Works with any storage provider',
    },
  ];

  return (
    <div className="container py-10 md:py-20">
      <div className="mx-auto max-w-4xl xl:max-w-6xl">
        {/* Section header */}
        <div className="mb-12 space-y-4 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl md:text-4xl">
            Ready-to-Use{' '}
            <span className="from-primary to-primary/60 bg-gradient-to-b bg-clip-text text-transparent">
              Components
            </span>
          </h2>
          <p className="text-muted-foreground mx-auto max-w-2xl text-base sm:text-lg">
            Beautiful, feature-rich file upload components that you can drop
            into your application. No need to build from scratch — just install
            and customize.
          </p>
        </div>

        <div className="mx-auto grid gap-8 xl:grid-cols-2 xl:gap-12">
          {/* Video Section */}
          <div className="order-2 min-w-0 content-center xl:order-1">
            <YouTubeVideo
              videoId={videoId}
              title="EdgeStore Components Showcase"
              badgeContent="Component Showcase"
            />
            {/* Call to action */}
            <div className="mt-12 text-center">
              <div className="flex flex-col justify-center gap-4 sm:flex-row">
                <Button variant="outline" asChild size="lg">
                  <Link
                    href="/docs/components/image"
                    aria-label="Browse components"
                  >
                    Browse Components
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          {/* Features Grid */}
          <div className="order-1 min-w-0 xl:order-2">
            <div className="grid grid-cols-2 gap-4">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="border-border bg-card rounded-lg border p-4 transition-all duration-200 hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <div className="text-primary mt-1 flex-shrink-0">
                      {feature.icon}
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold sm:text-base">
                        {feature.title}
                      </h3>
                      <p className="text-muted-foreground text-xs sm:text-sm">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick install example */}
            <div className="border-border bg-muted/50 mt-6 flex flex-col gap-2 rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <Terminal className="text-muted-foreground h-4 w-4" />
                <span className="text-sm font-medium">Quick Install</span>
              </div>
              <div className="min-w-0">
                <DynamicCodeBlock
                  code="npx shadcn@latest add https://edgestore.dev/r/single-image-dropzone.json"
                  lang="bash"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
