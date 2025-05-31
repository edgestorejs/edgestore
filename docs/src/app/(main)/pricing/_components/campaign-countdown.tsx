'use client';

import { useEffect, useState } from 'react';
import { type PricingInfo } from './pricing';

export function CampaignCountdown(props: {
  campaign: NonNullable<PricingInfo['campaign']>;
}) {
  const { campaign } = props;
  const [timeLeft, setTimeLeft] = useState(() =>
    getTimeDifference(new Date(), campaign.endDate),
  );

  useEffect(() => {
    const intervalId = setInterval(() => {
      setTimeLeft(getTimeDifference(new Date(), campaign.endDate));
    }, 1000);

    return () => { clearInterval(intervalId); };
  }, [campaign.endDate]);

  if (timeLeft.diff < 0) {
    return null;
  }

  return (
    <div className="mx-auto w-full rounded-lg border bg-background p-8 sm:w-min sm:min-w-96">
      <div className="space-y-4">
        <div className="text-center">
          <h2 className="text-xl font-bold sm:text-nowrap sm:text-3xl">
            {campaign.name} Ends Soon
          </h2>
          <p className="text-sm text-muted-foreground sm:text-base">
            {campaign.description}
          </p>
        </div>
        <div className="mx-auto grid max-w-md grid-cols-4 gap-2 text-center sm:gap-4">
          <div className="space-y-1">
            <div
              className="text-4xl font-bold text-primary sm:text-5xl"
              suppressHydrationWarning
            >
              {timeLeft.days}
            </div>
            <div className="text-sm text-muted-foreground sm:text-base">
              Days
            </div>
          </div>
          <div className="space-y-1">
            <div
              className="text-4xl font-bold text-primary sm:text-5xl"
              suppressHydrationWarning
            >
              {timeLeft.hours}
            </div>
            <div
              className="text-sm text-muted-foreground sm:text-base"
              suppressHydrationWarning
            >
              Hours
            </div>
          </div>
          <div className="space-y-1">
            <div
              className="text-4xl font-bold text-primary sm:text-5xl"
              suppressHydrationWarning
            >
              {timeLeft.minutes}
            </div>
            <div className="text-sm text-muted-foreground sm:text-base">
              Minutes
            </div>
          </div>
          <div className="space-y-1">
            <div
              className="text-4xl font-bold text-primary sm:text-5xl"
              suppressHydrationWarning
            >
              {timeLeft.seconds}
            </div>
            <div className="text-sm text-muted-foreground sm:text-base">
              Seconds
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getTimeDifference(date1: Date, date2: Date) {
  const diff = (date2.getTime() - date1.getTime()) / 1000;
  let delta = Math.abs(diff);

  const days = Math.floor(delta / 86400);
  delta -= days * 86400;

  const hours = Math.floor(delta / 3600) % 24;
  delta -= hours * 3600;

  const minutes = Math.floor(delta / 60) % 60;
  delta -= minutes * 60;

  const seconds = Math.floor(delta % 60);

  return {
    diff,
    days,
    hours,
    minutes,
    seconds,
  };
}
