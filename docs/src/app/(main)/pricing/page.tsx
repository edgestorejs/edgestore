import { type Metadata } from 'next';
import { Pricing } from './_components/pricing';

export const metadata: Metadata = {
  title: 'Pricing',
};

export const dynamic = 'force-static';
// Pick up scheduled price changes without a redeploy.
export const revalidate = 3600;

export default function Page() {
  return <Pricing />;
}
