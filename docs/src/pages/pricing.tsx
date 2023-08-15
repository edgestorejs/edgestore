import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import { CheckCircleIcon } from 'lucide-react';
import React from 'react';
import { PageFrame } from '../components/PageFrame';
import { Button } from '../components/ui/Button';

type PricingBlockItem = {
  title: string;
  description: string | React.ReactNode;
  monthlyPrice: string | React.ReactNode;
  yearlyPrice: string | React.ReactNode;
  features: (string | React.ReactNode)[];
  action?: React.ReactNode;
};

const pricingBlocks: PricingBlockItem[] = [
  {
    title: 'Free',
    description: 'Best for individuals and non-commercial projects.',
    monthlyPrice: '$0', // <SponsorButton />,
    yearlyPrice: '$0', // <SponsorButton />,
    features: ['1GB storage', 'Discord/Github standard support'],
  },
  {
    title: 'Starter',
    description:
      'Best for start-ups and businesses who build commercial products with Edge Store.',
    monthlyPrice: '$5',
    yearlyPrice: '$50',
    features: [
      'Everything in Free',
      '50GB storage',
      'Discord/Github priority support',
      'Email support',
    ],
    action: <Button className="w-full">Coming Soon</Button>,
  },
];

export default function Home(): JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  return (
    <div className="homepage">
      <Layout
        title={`Pricing - ${siteConfig.title}`}
        description="Choose the plan that's right for you."
      >
        <PageFrame>
          <Pricing />
        </PageFrame>
      </Layout>
    </div>
  );
}

function Pricing(): JSX.Element {
  return (
    <div className="mt-[calc(var(--ifm-navbar-height)*-1)] min-h-screen px-4 pt-[var(--ifm-navbar-height)]">
      <div className="mt-10 text-center">
        <div className="mb-4 text-5xl font-medium text-white">Pricing</div>
        <div className="mb-12">{"Choose the plan that's right for you."}</div>
      </div>
      <div className="mb-6 flex justify-center">
        <div className="grid max-w-4xl gap-8 sm:grid-cols-2">
          {pricingBlocks.map((pricingBlock, i) => (
            <PricingBlock key={i} item={pricingBlock} type="monthly" />
          ))}
        </div>
      </div>
    </div>
  );
}

function PricingBlock(props: {
  item: PricingBlockItem;
  type: 'monthly' | 'yearly';
}): JSX.Element {
  const {
    type,
    item: { title, description, monthlyPrice, yearlyPrice, features, action },
  } = props;

  const price = type === 'monthly' ? monthlyPrice : yearlyPrice;

  return (
    <div className="flex flex-col rounded-md bg-primary-900/20 p-5 shadow-[0px_0px_5px_0px_theme(colors.primary.500),0px_0px_20px_0px_theme(colors.primary.700)]">
      <div className="text-xl font-bold text-white">{title}</div>
      <div className="min-h-[4rem]">{description}</div>
      <div className="mt-4 mb-4 flex items-baseline gap-1">
        {typeof price === 'string' ? (
          <>
            <div className="text-3xl font-bold">{price}</div>
            <div className="text-gray-400">
              {type === 'monthly' ? '/month' : '/year'}
            </div>
          </>
        ) : (
          price
        )}
      </div>
      <div className="flex flex-col gap-2">
        {features.map((feature, i) => (
          <div key={i} className="flex items-center gap-2">
            <CheckCircleIcon size={22} className="text-primary-300" />
            {feature}
          </div>
        ))}
      </div>
      <div className="mt-auto pt-6">
        {action ?? (
          <Button asChild className="w-full">
            <a
              href="https://dashboard.edgestore.dev"
              target="_blank"
              rel="noreferrer"
            >
              Sign Up
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}

// function SponsorButton(): JSX.Element {
//   return (
//     <Button variant="outline" asChild>
//       <a
//         href="https://github.com/sponsors/edgestorejs"
//         target="_blank"
//         rel="noreferrer"
//         className="flex items-center gap-2"
//       >
//         <HeartIcon size={22} />
//         Sponsor Us
//       </a>
//     </Button>
//   );
// }
