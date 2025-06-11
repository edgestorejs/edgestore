'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PlayIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';

interface YouTubeVideoProps {
  videoId: string;
  title?: string;
  overlayContent?: ReactNode;
  badgeContent?: string;
  className?: string;
  thumbnailSrc?: string;
}

export function YouTubeVideo({
  videoId,
  title = 'YouTube Video',
  overlayContent,
  badgeContent,
  className = '',
  thumbnailSrc,
}: YouTubeVideoProps) {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  const handlePlayVideo = () => {
    setIsVideoPlaying(true);
  };

  return (
    <div
      className={`border-muted group relative aspect-video w-full overflow-hidden rounded-2xl border bg-gradient-to-br from-slate-900 to-slate-800 shadow-2xl ${className}`}
    >
      {!isVideoPlaying ? (
        <>
          {/* Thumbnail image or background pattern */}
          {thumbnailSrc ? (
            <div
              className="absolute inset-0 h-full w-full bg-cover bg-center bg-no-repeat transition-all duration-500 before:absolute before:inset-0 before:bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.6)_100%)] before:content-[''] after:absolute after:inset-0 after:bg-[radial-gradient(ellipse_at_center,transparent_20%,rgba(0,0,0,0.2)_100%)] after:opacity-100 after:transition-opacity after:duration-500 after:content-[''] group-hover:after:opacity-0"
              style={{ backgroundImage: `url(${thumbnailSrc})` }}
            />
          ) : (
            <div className="absolute inset-0 opacity-30">
              <div className="h-full w-full bg-[radial-gradient(circle_at_25%_25%,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[length:20px_20px]" />
            </div>
          )}

          {/* Additional overlay for better contrast */}
          <div className="absolute inset-0 bg-black/20 transition-all duration-300 group-hover:bg-black/10" />

          {/* Play button */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Button
              onClick={handlePlayVideo}
              size="lg"
              aria-label="Play video"
              className={cn(
                'group/btn relative rounded-full bg-black/40 backdrop-blur-md transition-all duration-300 hover:scale-110 hover:bg-black/60 hover:shadow-[0_0_40px_rgba(0,0,0,0.6)]',
                'h-20 w-20 sm:h-24 sm:w-24',
                'border border-white/50 shadow-2xl',
              )}
            >
              {/* Animated ring */}
              <div className="absolute inset-0 animate-ping rounded-full border-2 border-white/40 opacity-75" />
              <div className="absolute inset-2 rounded-full border border-white/30" />

              {/* Play icon with drop shadow for better visibility */}
              <PlayIcon
                className={cn(
                  'relative ml-1 fill-white text-white drop-shadow-lg transition-transform duration-300 group-hover/btn:scale-110',
                  'h-8 w-8 sm:h-10 sm:w-10',
                )}
              />
            </Button>
          </div>

          {/* Badge content */}
          {badgeContent && (
            <div className="absolute bottom-2 left-2">
              <div className="flex items-center gap-2 rounded-full bg-black/50 px-4 py-2 backdrop-blur-md">
                <div className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                <span className="text-sm font-medium text-white">
                  {badgeContent}
                </span>
              </div>
            </div>
          )}

          {/* Overlay content (e.g., feature highlights) */}
          {overlayContent && overlayContent}
        </>
      ) : (
        /* YouTube video iframe */
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="h-full w-full"
        />
      )}
    </div>
  );
}
