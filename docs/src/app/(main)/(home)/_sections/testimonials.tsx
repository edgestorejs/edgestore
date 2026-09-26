'use client';

import { AnimatedGrid, AnimatedGridItem } from '@/components/animated-grid';
import { DevtoIcon } from '@/components/icons/platforms/devto';
import { TwitterIcon } from '@/components/icons/platforms/twitter';
import { YoutubeIcon } from '@/components/icons/platforms/youtube';
import { testimonials } from '@/lib/testimonials';
import Link from 'next/link';

const platformIcons = {
  youtube: (
    <YoutubeIcon className="h-5 w-5 text-muted-foreground sm:h-6 sm:w-6" />
  ),
  twitter: (
    <TwitterIcon className="h-5 w-5 text-muted-foreground sm:h-6 sm:w-6" />
  ),
  devto: <DevtoIcon className="h-5 w-5 text-muted-foreground sm:h-6 sm:w-6" />,
};

export function Testimonials() {
  return (
    <div className="relative container flex flex-col items-center justify-center gap-6 overflow-hidden px-4 py-10 md:gap-10 md:px-8 md:py-20">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-bold sm:text-3xl md:text-4xl">
          Loved by{' '}
          <span className="bg-gradient-to-b from-primary to-primary/60 bg-clip-text text-transparent">
            Developers
          </span>
        </h2>
        <p className="text-base text-muted-foreground sm:text-lg">
          Here is what our users are saying about Edge Store.
        </p>
      </div>
      <AnimatedGrid>
        {testimonials.map((testimonial) => (
          <AnimatedGridItem key={testimonial.user}>
            <Link
              href={testimonial.url}
              target="_blank"
              className="flex flex-col gap-3 transition-transform duration-200 ease-in-out md:gap-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 md:gap-3">
                  <img
                    src={testimonial.image}
                    alt={testimonial.user}
                    width={40}
                    height={40}
                    className="rounded-full"
                  />
                  <span className="text-sm font-semibold sm:text-base">
                    {testimonial.user}
                  </span>
                </div>
                {
                  platformIcons[
                    testimonial.platform as keyof typeof platformIcons
                  ]
                }
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground sm:text-sm md:text-sm">
                {testimonial.comment}
              </p>
            </Link>
          </AnimatedGridItem>
        ))}
      </AnimatedGrid>
    </div>
  );
}
