'use client';

import { Button } from '@/components/ui/button';
import { GITHUB_URL } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { StarIcon } from 'lucide-react';
import Link from 'next/link';
import { useAppContext } from './app-context-provider';
import { GithubIcon } from './icons/platforms/github';

interface GitHubStarButtonProps {
  className?: string;
}

export default function GitHubStarButton({ className }: GitHubStarButtonProps) {
  const { githubStars } = useAppContext();

  return (
    <Button
      variant="outline"
      size="sm"
      asChild
      className={cn(
        'border-border/40 bg-background/60 hover:border-border hover:bg-accent/80 dark:hover:shadow-primary/5 group relative overflow-hidden backdrop-blur-sm transition-all duration-200 hover:shadow-md dark:hover:shadow-lg',
        className,
      )}
    >
      <Link href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
        <div className="flex items-center gap-2">
          <StarIcon className="text-muted-foreground h-4 w-4 transition-all duration-200 group-hover:fill-yellow-500 group-hover:text-yellow-500" />
          <span className="text-muted-foreground text-sm font-medium">
            Star
          </span>
          <span
            className={cn(
              'text-muted-foreground font-mono text-sm font-medium tabular-nums',
              githubStars === undefined &&
                'bg-muted animate-pulse select-none rounded text-transparent',
            )}
          >
            {githubStars === undefined ? '...' : formatStars(githubStars)}
          </span>
          <GithubIcon className="text-muted-foreground group-hover:text-foreground ml-1 h-4 w-4 transition-colors duration-200" />
        </div>

        {/* Hover effect overlay */}
        <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full" />
      </Link>
    </Button>
  );
}

// Format number with k/m suffix
const formatStars = (count: number) => {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}m`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return count.toString();
};
