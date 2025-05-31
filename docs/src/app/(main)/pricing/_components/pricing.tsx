import { ActionButton } from '@/components/action-button';
import { env } from '@/env';
import { formatFileSize, formatNumber } from '@/lib/formatter';
import { cn } from '@/lib/utils';
import { CheckCircleIcon, HeartIcon } from 'lucide-react';
import { CampaignCountdown } from './campaign-countdown';

export async function Pricing() {
  const pricingInfo = await fetchPricingInfo();
  const { defaultPricing, campaignPricing, campaign } = pricingInfo;

  const pricingBlocks = buildPricingBlocks(defaultPricing, campaignPricing);

  return (
    <div className="px-4">
      <div className="mt-10 text-center">
        <div className="mb-4 text-5xl font-medium text-foreground">Pricing</div>
        <div className="mb-6 text-muted-foreground">
          {"Choose the plan that's right for you."}
        </div>
      </div>
      {campaign && (
        <div className="mb-10">
          <CampaignCountdown campaign={campaign} />
        </div>
      )}
      <div className="mb-14" />
      <div className="mb-6 flex justify-center">
        <div className="grid max-w-[90rem] gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <PricingBlock item={pricingBlocks[0]} />
          <PricingBlock item={pricingBlocks[1]} isMain />
          <PricingBlock item={pricingBlocks[2]} />
          <PricingBlock item={pricingBlocks[3]} className="lg:col-span-3" />
        </div>
      </div>
    </div>
  );
}

function PricingBlock(props: {
  item: PricingBlockItem;
  isMain?: boolean;
  className?: string;
}) {
  const {
    item: { id, title, description, price, features, action },
    isMain,
    className,
  } = props;

  return (
    <div
      className={cn(
        'flex flex-col rounded-md p-5',
        isMain
          ? 'shadow-[0px_0px_5px_0px_theme(colors.violet.500),0px_0px_20px_0px_var(--primary)] lg:-translate-y-4 lg:scale-105'
          : 'border',
        className,
      )}
    >
      <div className="text-xl font-bold text-primary">{title}</div>
      <div>{description}</div>
      <div className="mb-4 mt-4 flex items-baseline gap-1">
        {price === undefined ? (
          <>
            <div>
              contact:{' '}
              <a
                href="mailto:support@edgestore.dev"
                className="text-primary hover:text-primary"
              >
                support@edgestore.dev
              </a>
            </div>
          </>
        ) : price > 0 ? (
          <>
            <div className="text-3xl font-bold text-primary">${price}</div>
            <div className="text-muted-foreground">/month</div>
          </>
        ) : (
          <div>
            <SponsorButton />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {features.map((feature, i) => (
          <div key={i} className="flex items-center gap-2">
            <CheckCircleIcon size={22} className="shrink-0 text-primary" />
            <div>{feature}</div>
          </div>
        ))}
      </div>
      <div className="mt-auto pt-6">
        {action ??
          (id ? (
            <ActionButton
              href={`${env.NEXT_PUBLIC_DASHBOARD_URL}/subscription/new?plan=${id}`}
              className="w-full"
            >
              Sign Up
            </ActionButton>
          ) : (
            <ActionButton
              href={env.NEXT_PUBLIC_DASHBOARD_URL}
              className="w-full"
            >
              Sign Up
            </ActionButton>
          ))}
      </div>
    </div>
  );
}

function SponsorButton() {
  return (
    <ActionButton href="https://github.com/sponsors/perfectbase">
      <HeartIcon /> Sponsor
    </ActionButton>
  );
}

function Strikethrough(props: {
  children: React.ReactNode;
  size?: 'sm' | 'lg';
}) {
  const { children, size = 'sm' } = props;
  return (
    <div className="relative inline-block text-nowrap text-muted-foreground">
      <div className="h-full w-full">
        <div
          className={cn(
            'absolute bottom-[40%] left-0 right-0 -rotate-[10deg] border-primary/80',
            size === 'sm' && 'border-t-2',
            size === 'lg' && 'border-t-4',
          )}
        />
      </div>
      {children}
    </div>
  );
}

type PricingBlockItem = {
  id?: string;
  title: string;
  description: string | React.ReactNode;
  price?: number;
  features: (string | React.ReactNode)[];
  action?: React.ReactNode;
};

function buildPricingBlocks(
  defaultPricing: PricingInfo['defaultPricing'],
  campaignPricing: PricingInfo['campaignPricing'],
) {
  return [
    {
      title: 'Free',
      description: 'Best for individuals and non-commercial projects.',
      price: 0,
      features: [
        <>
          <PlanLimitItem
            defaultValue={defaultPricing.FREE.storageLimit}
            campaignValue={campaignPricing?.FREE.storageLimit}
            formatter={formatFileSize}
          />{' '}
          storage
        </>,
        <>
          <PlanLimitItem
            defaultValue={defaultPricing.FREE.projectLimit}
            campaignValue={campaignPricing?.FREE.projectLimit}
          />{' '}
          projects
        </>,
        <>
          Up to{' '}
          <PlanLimitItem
            defaultValue={defaultPricing.FREE.monthlyBandwidthLimit}
            campaignValue={campaignPricing?.FREE.monthlyBandwidthLimit}
            formatter={formatFileSize}
          />{' '}
          of bandwidth per month
        </>,
        <>
          Up to{' '}
          <PlanLimitItem
            defaultValue={defaultPricing.FREE.monthlyUploadSizeLimit}
            campaignValue={campaignPricing?.FREE.monthlyUploadSizeLimit}
            formatter={formatFileSize}
          />{' '}
          of uploads per month
        </>,
        <>
          <PlanLimitItem
            defaultValue={defaultPricing.FREE.aggRangeLimit}
            campaignValue={campaignPricing?.FREE.aggRangeLimit}
            formatter={formatNumber}
          />{' '}
          day of usage metrics
        </>,
        'Discord/Github standard support',
        'Personal use',
      ],
    },
    {
      id: 'STARTER',
      title: 'Starter',
      description:
        'Best for start-ups and businesses who build commercial products with Edge Store.',
      price: 5,
      features: [
        'Everything in Free',
        <>
          <PlanLimitItem
            defaultValue={defaultPricing.STARTER.storageLimit}
            campaignValue={campaignPricing?.STARTER.storageLimit}
            formatter={formatFileSize}
          />{' '}
          storage
        </>,
        <>
          <PlanLimitItem
            defaultValue={defaultPricing.STARTER.memberLimit}
            campaignValue={campaignPricing?.STARTER.memberLimit}
          />{' '}
          team members
        </>,
        <>
          <PlanLimitItem
            defaultValue={defaultPricing.STARTER.projectLimit}
            campaignValue={campaignPricing?.STARTER.projectLimit}
          />{' '}
          projects
        </>,
        <>
          Up to{' '}
          <PlanLimitItem
            defaultValue={defaultPricing.STARTER.monthlyBandwidthLimit}
            campaignValue={campaignPricing?.STARTER.monthlyBandwidthLimit}
            formatter={formatFileSize}
          />{' '}
          of bandwidth per month
        </>,
        <>
          Up to{' '}
          <PlanLimitItem
            defaultValue={defaultPricing.STARTER.monthlyUploadSizeLimit}
            campaignValue={campaignPricing?.STARTER.monthlyUploadSizeLimit}
            formatter={formatFileSize}
          />{' '}
          of uploads per month
        </>,
        <>
          <PlanLimitItem
            defaultValue={defaultPricing.STARTER.aggRangeLimit}
            campaignValue={campaignPricing?.STARTER.aggRangeLimit}
            formatter={formatNumber}
          />{' '}
          day of usage metrics
        </>,
        'Discord/Github priority support',
        'Email support',
        'Commercial use',
      ],
    },
    {
      id: 'PRO',
      title: 'Pro',
      description:
        'Best for businesses who build larger commercial products with Edge Store.',
      price: 35,
      features: [
        'Everything in Starter',
        <>
          <PlanLimitItem
            defaultValue={defaultPricing.PRO.storageLimit}
            campaignValue={campaignPricing?.PRO.storageLimit}
            formatter={formatFileSize}
          />{' '}
          storage
        </>,
        <>
          <PlanLimitItem
            defaultValue={defaultPricing.PRO.memberLimit}
            campaignValue={campaignPricing?.PRO.memberLimit}
          />{' '}
          team members
        </>,
        'more members for $5/month each',
        <>
          <PlanLimitItem
            defaultValue={defaultPricing.PRO.projectLimit}
            campaignValue={campaignPricing?.PRO.projectLimit}
          />{' '}
          projects
        </>,
        'more projects for $5/month each',
        <>
          Up to{' '}
          <PlanLimitItem
            defaultValue={defaultPricing.PRO.monthlyBandwidthLimit}
            campaignValue={campaignPricing?.PRO.monthlyBandwidthLimit}
            formatter={formatFileSize}
          />{' '}
          of bandwidth per month
        </>,
        <>
          Up to{' '}
          <PlanLimitItem
            defaultValue={defaultPricing.PRO.monthlyUploadSizeLimit}
            campaignValue={campaignPricing?.PRO.monthlyUploadSizeLimit}
            formatter={formatFileSize}
          />{' '}
          of uploads per month
        </>,
        <>
          <PlanLimitItem
            defaultValue={defaultPricing.PRO.aggRangeLimit}
            campaignValue={campaignPricing?.PRO.aggRangeLimit}
            formatter={formatNumber}
          />{' '}
          day of usage metrics
        </>,
        'one-time 30min optional project consultation',
      ],
    },
    {
      title: 'Custom',
      description:
        "If the other plans don't fit your needs, we can create a custom plan for you.",
      features: [
        'Everything in Pro',
        'More storage',
        'More team members',
        'More projects',
        'Bigger limits',
        '1 hour of individual support via voice, video or email per month',
      ],
      action: (
        <ActionButton href="mailto:support@edgestore.dev">
          Contact us
        </ActionButton>
      ),
    },
  ] as const satisfies PricingBlockItem[];
}

function PlanLimitItem(props: {
  defaultValue: string | number;
  campaignValue?: string | number;
  formatter?: (value: string | number) => string;
}) {
  const { defaultValue, campaignValue, formatter } = props;

  if (campaignValue === undefined || campaignValue === defaultValue) {
    return (
      <span className="text-nowrap">
        {formatter?.(defaultValue) ?? defaultValue}
      </span>
    );
  } else {
    return (
      <>
        <Strikethrough size="sm">
          <>{formatter?.(defaultValue) ?? defaultValue}</>
        </Strikethrough>{' '}
        <span className="text-nowrap font-bold text-primary">
          {formatter?.(campaignValue) ?? campaignValue}
        </span>
      </>
    );
  }
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
};

export type PricingInfo = {
  defaultPricing: Record<PlanType, PlanPricing>;
  campaignPricing?: Record<PlanType, PlanPricing>;
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
