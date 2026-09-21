import { ArrowUpRight } from 'lucide-react';
import { type Metadata } from 'next';
import { Bricolage_Grotesque, Manrope } from 'next/font/google';
import Link from 'next/link';
import { Reference } from './reference';
import { Studio } from './studio';
import { Workbench } from './workbench';
import './landing-lab.css';

const manrope = Manrope({ subsets: ['latin'], variable: '--lab-sans' });
const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--lab-display',
});

export const metadata: Metadata = {
  title: 'Landing page exploration',
  robots: { index: false, follow: false },
};

const designs = [
  { id: 'studio', name: 'Studio', component: Studio },
  { id: 'workbench', name: 'Workbench', component: Workbench },
  { id: 'reference', name: 'Reference', component: Reference },
];

export default async function LandingLab({
  searchParams,
}: {
  searchParams: Promise<{ design?: string | string[] }>;
}) {
  const { design } = await searchParams;
  const selected = designs.find(({ id }) => id === design) ?? designs[0]!;
  const Page = selected.component;

  return (
    <div
      className={`landing-lab ${manrope.variable} ${bricolage.variable}`}
      data-design={selected.id}
    >
      <div className="ll-review-bar">
        <span>Landing exploration</span>
        <nav aria-label="Design options">
          {designs.map(({ id, name }) => (
            <Link
              key={id}
              href={`/landing-lab?design=${id}`}
              aria-current={selected.id === id ? 'page' : undefined}
            >
              {name}
            </Link>
          ))}
        </nav>
        <Link href="/" className="ll-current-site">
          Current site <ArrowUpRight size={13} aria-hidden="true" />
        </Link>
      </div>
      <a href="#landing-content" className="ll-skip">
        Skip to content
      </a>
      <Page />
    </div>
  );
}
