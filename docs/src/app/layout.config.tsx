import GitHubStarButton from '@/components/github-star';
import { DiscordIcon } from '@/components/icons/platforms/discord';
import type { BaseLayoutProps, LinkItemType } from 'fumadocs-ui/layouts/shared';
import Image from 'next/image';
import Link from 'next/link';

export const linkItems: LinkItemType[] = [
  {
    type: 'custom',
    children: (
      <div className="flex w-full flex-col items-end sm:flex-row sm:items-center sm:gap-2">
        <Link
          className="text-fd-muted-foreground hover:text-fd-accent-foreground data-[active=true]:text-fd-primary inline-flex items-center gap-1 p-2 text-sm transition-colors [&_svg]:size-4"
          href="/docs/quick-start"
          aria-label="Go to documentation"
        >
          Docs
        </Link>
        <div className="grow max-sm:hidden" />
        <Link
          className="text-fd-muted-foreground hover:text-fd-accent-foreground data-[active=true]:text-fd-primary inline-flex items-center gap-1 p-2 text-sm transition-colors [&_svg]:size-4"
          href="/pricing"
          aria-label="Go to pricing"
        >
          Pricing
        </Link>
        <Link
          className="text-fd-muted-foreground hover:text-fd-accent-foreground data-[active=true]:text-fd-primary inline-flex items-center gap-1 p-2 text-sm transition-colors [&_svg]:size-4"
          href="https://dashboard.edgestore.dev"
          target="_blank"
          aria-label="Go to dashboard"
        >
          Dashboard
        </Link>
        <Link
          className="text-fd-muted-foreground hover:text-fd-accent-foreground data-[active=true]:text-fd-primary inline-flex items-center gap-1 p-2 text-sm transition-colors duration-200 [&_svg]:size-4"
          href="https://discord.gg/HvrnhRTfgQ"
          target="_blank"
          aria-label="Go to Discord"
        >
          <DiscordIcon />
        </Link>
        <GitHubStarButton />
      </div>
    ),
  },
];

export const logo = (
  <Image
    src="/img/logo-sm.png"
    alt="EdgeStore"
    aria-label="EdgeStore"
    width={28}
    height={28}
  />
);

/**
 * Shared layout configurations
 *
 * you can customise layouts individually from:
 * Home Layout: app/(home)/layout.tsx
 * Docs Layout: app/docs/layout.tsx
 */
export const baseOptions: BaseLayoutProps = {
  nav: {
    title: (
      <>
        {logo}
        <div className="h-7 w-[120px] shrink-0 bg-[url('/img/edgestore-light.svg')] bg-contain bg-center bg-no-repeat dark:bg-[url('/img/edgestore.svg')]" />
      </>
    ),
  },
};
