import { AstroIcon } from '@/components/icons/frameworks/astro-icon';
import { ExpressIcon } from '@/components/icons/frameworks/express-icon';
import { FastifyIcon } from '@/components/icons/frameworks/fastify-icon';
import { HonoIcon } from '@/components/icons/frameworks/hono-icon';
import { NextIcon } from '@/components/icons/frameworks/next-icon';
import { ReactIcon } from '@/components/icons/frameworks/react-icon';
import { ReactRouterIcon } from '@/components/icons/frameworks/react-router-icon';
import { TanStackIcon } from '@/components/icons/frameworks/tanstack-icon';
import { cn } from '@/lib/utils';

const iconClassName = cn('size-10 sm:size-12');

export function Frameworks() {
  return (
    <div className="container space-y-8">
      <h2 className="text-center text-xl font-bold">
        Ready for your framework
      </h2>
      <div className="grid grid-cols-4 items-center justify-items-center gap-8 md:grid-cols-8">
        <NextIcon className={iconClassName} />
        <AstroIcon className={iconClassName} />
        <TanStackIcon className={iconClassName} />
        <ReactRouterIcon className={iconClassName} />
        <ReactIcon className={iconClassName} />
        <ExpressIcon className={iconClassName} />
        <HonoIcon className={iconClassName} />
        <FastifyIcon className={iconClassName} />
      </div>
    </div>
  );
}
