'use client';

import { Button } from '@/components/ui/button';
import { PlayIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';

interface YouTubeVideoProps {
  videoId: string;
  title?: string;
  overlayContent?: ReactNode;
  badgeContent?: ReactNode;
  buttonSize?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function YouTubeVideo({
  videoId,
  title = 'YouTube Video',
  overlayContent,
  badgeContent,
  buttonSize = 'lg',
  className = '',
}: YouTubeVideoProps) {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  const handlePlayVideo = () => {
    setIsVideoPlaying(true);
  };

  const buttonSizes = {
    sm: 'h-12 w-12',
    md: 'h-16 w-16',
    lg: 'h-20 w-20 sm:h-24 sm:w-24',
  };

  const iconSizes = {
    sm: 'h-5 w-5',
    md: 'h-6 w-6',
    lg: 'h-8 w-8 sm:h-10 sm:w-10',
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
              className={`group/btn relative rounded-full bg-white/10 p-0 backdrop-blur-md transition-all duration-300 hover:scale-110 hover:bg-white/20 hover:shadow-[0_0_40px_rgba(255,255,255,0.3)] ${buttonSizes[buttonSize]}`}
            >
              {/* Animated ring */}
              <div className="absolute inset-0 animate-ping rounded-full border-2 border-white/30" />
              <div className="absolute inset-2 rounded-full border border-white/20" />

              {/* Play icon */}
              <PlayIcon
                className={`relative ml-1 fill-white text-white transition-transform duration-300 group-hover/btn:scale-110 ${iconSizes[buttonSize]}`}
              />
            </Button>
          </div>

          {/* Badge content */}
          {badgeContent && (
            <div className="absolute bottom-6 left-6">{badgeContent}</div>
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
