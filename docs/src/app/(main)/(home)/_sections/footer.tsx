import { DiscordIcon } from '@/components/icons/platforms/discord';
import { GithubIcon } from '@/components/icons/platforms/github';
import { TwitterIcon } from '@/components/icons/platforms/twitter';
import { YoutubeIcon } from '@/components/icons/platforms/youtube';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  DISCORD_INVITE_URL,
  GITHUB_URL,
  SPONSOR_URL,
  X_URL,
  YOUTUBE_URL,
} from '@/lib/constants';
import { ChevronDownIcon, HeartIcon } from 'lucide-react';
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-32 space-y-4 border-t">
      <div className="container flex flex-col items-center justify-between gap-4 py-4 sm:flex-row">
        {/* Social Media Icons */}
        <div className="flex items-center gap-4">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <GithubIcon size="sm" />
            <span className="sr-only">GitHub</span>
          </a>
          <a
            href={DISCORD_INVITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <DiscordIcon size="sm" />
            <span className="sr-only">Discord</span>
          </a>
          <a
            href={YOUTUBE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <YoutubeIcon size="sm" />
            <span className="sr-only">YouTube</span>
          </a>
          <a
            href={X_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <TwitterIcon size="sm" />
            <span className="sr-only">X</span>
          </a>
        </div>

        <div className="flex items-center gap-4">
          {/* Sponsor Button */}
          <Button
            asChild
            variant="outline"
            size="sm"
            className="border-primary text-primary hover:bg-primary/10 hover:text-primary"
          >
            <a
              href={SPONSOR_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2"
            >
              <HeartIcon className="h-4 w-4 fill-current" />
              Sponsor
            </a>
          </Button>
          {/* Legal Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
              >
                Legal
                <ChevronDownIcon className="ml-1 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top">
              <DropdownMenuItem asChild>
                <Link href="/legal/terms" className="w-full cursor-pointer">
                  Terms of Service
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href="/legal/privacy-policy"
                  className="w-full cursor-pointer"
                >
                  Privacy Policy
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href="/legal/disclosure"
                  className="w-full cursor-pointer"
                >
                  Disclosure
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </footer>
  );
}
