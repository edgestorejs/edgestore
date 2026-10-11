'use client';

import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { type PricingInfo } from './pricing';

export function CampaignCountdown(props: {
  campaign: NonNullable<PricingInfo['campaign']>;
  className?: string;
}) {
  const { campaign, className } = props;
  const endTime = new Date(campaign.endDate).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(intervalId);
  }, []);

  const secondsLeft = Math.floor((endTime - now) / 1000);
  if (secondsLeft < 0) {
    return null;
  }

  const timeLeft = [
    [Math.floor(secondsLeft / 86400), 'd'],
    [Math.floor(secondsLeft / 3600) % 24, 'h'],
    [Math.floor(secondsLeft / 60) % 60, 'm'],
    [secondsLeft % 60, 's'],
  ] as const;

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-6 rounded-xl border border-site-accent/35 bg-[color-mix(in_srgb,var(--site-accent)_8%,var(--site-bg))] px-6 py-4 max-[601px]:flex-col max-[601px]:items-start max-[601px]:gap-2 max-[601px]:px-5',
        className,
      )}
    >
      <p className="text-[15px] leading-[1.6]">
        <span className="font-semibold">{campaign.name}.</span>{' '}
        <span className="text-site-muted">{campaign.description}</span>
      </p>
      <p
        className="shrink-0 text-[15px] font-[550] text-site-accent tabular-nums"
        suppressHydrationWarning
      >
        Ends in{' '}
        {timeLeft.map(([value, unit]) => (
          <span key={unit} className="ml-1.5">
            {value}
            {unit}
          </span>
        ))}
      </p>
    </div>
  );
}
