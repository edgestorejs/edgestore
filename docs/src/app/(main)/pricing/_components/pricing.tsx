import { env } from '@/env';
import { formatFileSize } from '@/lib/formatter';
import { cn } from '@/lib/utils';
import { Check, Minus } from 'lucide-react';
import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import {
  siteButton,
  siteContainer,
  sitePrimaryButton,
  siteSecondaryButton,
} from '../../_components/styles';
import { CampaignCountdown } from './campaign-countdown';
import { PlanTabs } from './plan-tabs';

export async function Pricing() {
  const pricingInfo = await fetchPricingInfo();
  const plans = buildPlans(pricingInfo);
  const features = buildFeatures(pricingInfo);

  return (
    <div className={cn(siteContainer, 'pt-[72px] pb-24 max-[601px]:py-11')}>
      <h1 className="text-[clamp(44px,4.8vw,64px)] leading-[1.08] font-[720] tracking-[-0.055em]">
        Pricing
      </h1>
      <p className="mt-5 max-w-[620px] text-[17px] leading-[1.65] text-site-muted max-[601px]:text-[15px]">
        Plans for EdgeStore hosted storage. The library is open source and free
        with{' '}
        <Link
          className="text-site-accent underline underline-offset-4"
          href="/docs/providers/s3"
        >
          your own storage provider
        </Link>
        .
      </p>
      {pricingInfo.campaign && (
        <CampaignCountdown campaign={pricingInfo.campaign} className="mt-9" />
      )}

      <div className="mt-11 max-[601px]:mt-8">
        <div className="min-[982px]:hidden">
          <PlanTabs
            tabs={plans.map((plan) => ({
              name: plan.name,
              price: `$${plan.price}`,
            }))}
            defaultIndex={1}
          >
            {plans.map((plan) => (
              <div key={plan.id} className="rounded-xl border border-site-line">
                <PlanSummary plan={plan} className="p-5" />
                {features.map((group) => (
                  <section
                    key={group.title}
                    className="border-t border-site-line px-5 pt-4 pb-1.5"
                  >
                    <h3 className="text-[13px] font-semibold">{group.title}</h3>
                    <dl className="mt-1.5">
                      {group.rows.map((row) => (
                        <div
                          key={row.label}
                          className="flex items-baseline justify-between gap-4 border-t border-site-line/60 py-3 text-sm first:border-t-0"
                        >
                          <dt className="text-site-muted">{row.label}</dt>
                          <dd className="text-right font-[550]">
                            {row.values[plan.id]}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                ))}
              </div>
            ))}
          </PlanTabs>
        </div>

        <div
          role="table"
          aria-label="Plan comparison"
          className="overflow-hidden rounded-xl border border-site-line max-[981px]:hidden"
        >
          <div role="row" className={cn(tableRow, 'border-b border-site-line')}>
            <div role="columnheader">
              <span className="sr-only">Feature</span>
            </div>
            {plans.map((plan) => (
              <PlanSummary
                key={plan.id}
                role="columnheader"
                plan={plan}
                className={cn(
                  'border-l border-site-line p-7 max-[1191px]:p-5',
                  plan.id === 'STARTER' && featuredColumn,
                )}
              />
            ))}
          </div>
          {features.map((group) => (
            <Fragment key={group.title}>
              <div role="row" className={tableRow}>
                <div
                  role="rowheader"
                  className="px-7 pt-7 pb-2.5 text-[13px] font-semibold max-[1191px]:px-5"
                >
                  {group.title}
                </div>
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    role="cell"
                    className={cn(
                      'border-l border-site-line',
                      plan.id === 'STARTER' && featuredColumn,
                    )}
                  />
                ))}
              </div>
              {group.rows.map((row) => (
                <div
                  key={row.label}
                  role="row"
                  className={cn(tableRow, 'border-t border-site-line/70')}
                >
                  <div
                    role="rowheader"
                    className="px-7 py-3.5 text-sm text-site-muted max-[1191px]:px-5"
                  >
                    {row.label}
                  </div>
                  {plans.map((plan) => (
                    <div
                      key={plan.id}
                      role="cell"
                      className={cn(
                        'border-l border-site-line px-7 py-3.5 text-[15px] font-[550] max-[1191px]:px-5',
                        plan.id === 'STARTER' && featuredColumn,
                      )}
                    >
                      {row.values[plan.id]}
                    </div>
                  ))}
                </div>
              ))}
            </Fragment>
          ))}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-8 rounded-xl border border-site-line px-7 py-6 max-[1191px]:px-5 max-[601px]:flex-col max-[601px]:items-start max-[601px]:gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.02em]">Custom</h2>
          <p className="mt-1 text-sm leading-[1.65] text-site-muted">
            Higher limits, more projects and team members, and an hour of
            one-on-one support each month.
          </p>
        </div>
        <a
          href="mailto:support@edgestore.dev"
          className={cn(siteButton, siteSecondaryButton, 'shrink-0')}
        >
          Contact us
        </a>
      </div>

      <p className="mt-7 text-[13px] leading-[1.7] text-site-muted">
        Using EdgeStore with your own storage?{' '}
        <a
          className="text-site-accent underline underline-offset-4"
          href="https://github.com/sponsors/perfectbase"
        >
          Sponsor the project on GitHub
        </a>
        .
      </p>
    </div>
  );
}

const tableRow = 'grid grid-cols-4';
const featuredColumn =
  'bg-[color-mix(in_srgb,var(--site-accent)_6%,var(--site-bg))]';

function PlanSummary(props: { plan: Plan; role?: string; className?: string }) {
  const { plan, role, className } = props;

  return (
    <div role={role} className={cn('flex flex-col', className)}>
      <h2 className="text-lg font-semibold tracking-[-0.02em]">{plan.name}</h2>
      <p className="mt-1 text-[13px] leading-[1.5] text-site-muted min-[982px]:min-h-[3em]">
        {plan.description}
      </p>
      <p className="mt-5 flex items-baseline gap-1">
        <span className="text-[44px] leading-none font-[720] tracking-[-0.05em]">
          ${plan.price}
        </span>
        <span className="text-sm text-site-muted">/month</span>
      </p>
      {plan.upcoming && (
        <p className="mt-3 text-xs leading-[1.55] text-site-muted">
          {`$${plan.upcoming.price}/month for new subscribers from ${formatDate(plan.upcoming.activeFrom)}. Subscribe before then to keep $${plan.price}.`}
        </p>
      )}
      <div className="mt-auto pt-6">
        <a
          href={plan.href}
          className={cn(
            siteButton,
            plan.id === 'STARTER' ? sitePrimaryButton : siteSecondaryButton,
            'w-full',
          )}
        >
          {plan.cta}
        </a>
      </div>
    </div>
  );
}

function PlanLimit(props: {
  value: number;
  campaignValue?: number;
  format?: (value: number) => string;
}) {
  const { value, campaignValue, format = String } = props;

  if (campaignValue === undefined || campaignValue === value) {
    return <span className="whitespace-nowrap">{format(value)}</span>;
  }
  return (
    <span className="whitespace-nowrap">
      <s className="mr-1.5 font-normal text-site-muted">{format(value)}</s>
      <span className="text-site-accent">{format(campaignValue)}</span>
    </span>
  );
}

function Included({ value }: { value: boolean }) {
  return value ? (
    <>
      <Check size={18} className="inline text-site-accent" aria-hidden />
      <span className="sr-only">Included</span>
    </>
  ) : (
    <>
      <Minus size={18} className="inline text-site-muted/50" aria-hidden />
      <span className="sr-only">Not included</span>
    </>
  );
}

type Plan = {
  id: PlanType;
  name: string;
  description: string;
  price: number;
  upcoming?: { price: number; activeFrom: string };
  href: string;
  cta: string;
};

function buildPlans(info: PricingInfo): Plan[] {
  const { defaultPricing, upcomingPricing } = info;
  const dashboardUrl = env.NEXT_PUBLIC_DASHBOARD_URL;

  return [
    {
      id: 'FREE',
      name: 'Free',
      description: 'For personal and non-commercial projects.',
      price: 0,
      href: new URL('/sign-up', dashboardUrl).toString(),
      cta: 'Start for free',
    },
    {
      id: 'STARTER',
      name: 'Starter',
      description: 'For commercial apps and small teams.',
      price: toDollars(defaultPricing.STARTER.basePrice, 5),
      upcoming: toUpcoming(upcomingPricing?.STARTER),
      href: `${dashboardUrl}/subscription/new?plan=STARTER`,
      cta: 'Choose Starter',
    },
    {
      id: 'PRO',
      name: 'Pro',
      description: 'For apps with more files and traffic.',
      price: toDollars(defaultPricing.PRO.basePrice, 35),
      upcoming: toUpcoming(upcomingPricing?.PRO),
      href: `${dashboardUrl}/subscription/new?plan=PRO`,
      cta: 'Choose Pro',
    },
  ];
}

type PlanValues = Record<PlanType, ReactNode>;

type FeatureGroup = {
  title: string;
  rows: { label: string; values: PlanValues }[];
};

function buildFeatures(info: PricingInfo): FeatureGroup[] {
  const byPlan = (render: (plan: PlanType) => ReactNode): PlanValues => ({
    FREE: render('FREE'),
    STARTER: render('STARTER'),
    PRO: render('PRO'),
  });
  const limit = (key: LimitKey, format?: (value: number) => string) =>
    byPlan((plan) => (
      <PlanLimit
        value={info.defaultPricing[plan][key]}
        campaignValue={info.campaignPricing?.[plan][key]}
        format={format}
      />
    ));
  const paidOnly = byPlan((plan) => <Included value={plan !== 'FREE'} />);
  const withAddOn = (values: PlanValues): PlanValues => ({
    ...values,
    PRO: (
      <>
        {values.PRO}
        <span className="ml-2 text-[13px] font-normal text-site-muted">
          +$5/month each
        </span>
      </>
    ),
  });

  return [
    {
      title: 'Usage',
      rows: [
        { label: 'Storage', values: limit('storageLimit', formatFileSize) },
        {
          label: 'Bandwidth per month',
          values: limit('monthlyBandwidthLimit', formatFileSize),
        },
        {
          label: 'Uploads per month',
          values: limit('monthlyUploadSizeLimit', formatFileSize),
        },
      ],
    },
    {
      title: 'Workspace',
      rows: [
        { label: 'Projects', values: withAddOn(limit('projectLimit')) },
        { label: 'Team members', values: withAddOn(limit('memberLimit')) },
        {
          label: 'Usage metrics history',
          values: limit('aggRangeLimit', (days) => `${days} days`),
        },
        {
          label: 'Restore deleted files',
          values: byPlan((plan) => (
            <Included value={info.defaultPricing[plan].canRestore === 1} />
          )),
        },
        { label: 'Commercial use', values: paidOnly },
      ],
    },
    {
      title: 'Support',
      rows: [
        {
          label: 'Discord and GitHub',
          values: byPlan((plan) =>
            plan === 'FREE' ? 'Community' : 'Priority',
          ),
        },
        { label: 'Email', values: paidOnly },
        {
          label: 'Project consultation',
          values: byPlan((plan) =>
            plan === 'PRO' ? (
              '30 minutes, one-time'
            ) : (
              <Included value={false} />
            ),
          ),
        },
      ],
    },
  ];
}

// `fallback` covers dashboards that don't return prices yet.
function toDollars(cents: number | undefined, fallback: number) {
  return cents === undefined ? fallback : cents / 100;
}

function toUpcoming(plan: UpcomingPlanPricing | undefined) {
  return plan?.basePrice === undefined
    ? undefined
    : { price: plan.basePrice / 100, activeFrom: plan.activeFrom };
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

async function fetchPricingInfo() {
  const response = await fetch(`${env.NEXT_PUBLIC_DASHBOARD_URL}/api/pricing`, {
    headers: {
      Authorization: `${env.DASHBOARD_API_KEY}`,
    },
  });
  const data = (await response.json()) as PricingInfo;
  return data;
}

export type PlanType = 'FREE' | 'STARTER' | 'PRO';

type LimitKey =
  | 'storageLimit'
  | 'projectLimit'
  | 'memberLimit'
  | 'monthlyBandwidthLimit'
  | 'monthlyUploadSizeLimit'
  | 'aggRangeLimit';

export type PlanPricing = {
  id: string;
  isDefault: number;
  planType: PlanType;
  basePriceId: string | null;
  storagePriceId: string | null;
  projectPriceId: string | null;
  memberPriceId: string | null;
  storageLimit: number;
  projectLimit: number;
  memberLimit: number;
  monthlyAccessLimit: number;
  monthlyBandwidthLimit: number;
  monthlyUploadSizeLimit: number;
  aggRangeLimit: number;
  canRestore: number;
  campaignId: string | null;
  /** Monthly base price in cents. */
  basePrice?: number;
};

type UpcomingPlanPricing = PlanPricing & { activeFrom: string };

export type PricingInfo = {
  defaultPricing: Record<PlanType, PlanPricing>;
  campaignPricing?: Record<PlanType, PlanPricing>;
  /** Price changes scheduled for new subscribers. */
  upcomingPricing?: Partial<Record<PlanType, UpcomingPlanPricing>>;
  campaign?: {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    description: string | null;
    startDate: Date;
    endDate: Date;
  };
};
