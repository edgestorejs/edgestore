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
}

export function YouTubeVideo({
  videoId,
  title = 'YouTube Video',
  overlayContent,
  badgeContent,
  className = '',
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
              aria-label="Play video"
              className={cn(
                'group/btn relative rounded-full bg-white/10 p-0 backdrop-blur-md transition-all duration-300 hover:scale-110 hover:bg-white/20 hover:shadow-[0_0_40px_rgba(255,255,255,0.3)]',
                'h-20 w-20 sm:h-24 sm:w-24',
              )}
            >
              {/* Animated ring */}
              <div className="absolute inset-0 animate-ping rounded-full border-2 border-white/30" />
              <div className="absolute inset-2 rounded-full border border-white/20" />

              {/* Play icon */}
              <PlayIcon
                className={cn(
                  'relative ml-1 fill-white text-white transition-transform duration-300 group-hover/btn:scale-110',
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
