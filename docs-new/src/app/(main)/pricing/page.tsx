import { Metadata } from 'next';
import { Pricing } from './_components/pricing';

export const metadata: Metadata = {
  title: 'Pricing',
};

export const dynamic = 'force-static';

export default function Page() {
  return <Pricing />;
}
