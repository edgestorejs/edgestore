import { type Metadata } from 'next';
import { Bricolage_Grotesque, Manrope } from 'next/font/google';
import { Canvas, Index, Mono, Orbit, Relay, Signal } from './new-designs';
import { Reference } from './reference';
import { ReviewControls } from './review-controls';
import { Studio } from './studio';
import { Workbench } from './workbench';
import './landing-lab.css';
import './themes.css';
import './new-designs.css';

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
  { id: 'canvas', name: 'Canvas', component: Canvas },
  { id: 'relay', name: 'Relay', component: Relay },
  { id: 'index', name: 'Index', component: Index },
  { id: 'orbit', name: 'Orbit', component: Orbit },
  { id: 'mono', name: 'Mono', component: Mono },
  { id: 'signal', name: 'Signal', component: Signal },
  { id: 'studio', name: 'Studio', component: Studio },
  { id: 'workbench', name: 'Workbench', component: Workbench },
  { id: 'reference', name: 'Reference', component: Reference },
];

export default async function LandingLab({
  searchParams,
}: {
  searchParams: Promise<{
    design?: string | string[];
    theme?: string | string[];
  }>;
}) {
  const { design, theme: themeParam } = await searchParams;
  const theme = themeParam === 'dark' ? 'dark' : 'light';
  const selected = designs.find(({ id }) => id === design) ?? designs[0]!;
  const Page = selected.component;

  return (
    <div
      className={`landing-lab ${manrope.variable} ${bricolage.variable}`}
      data-design={selected.id}
      data-theme={theme}
    >
      <ReviewControls
        designs={designs.map(({ id, name }) => ({ id, name }))}
        selected={selected.id}
        theme={theme}
      />
      <a href="#landing-content" className="ll-skip">
        Skip to content
      </a>
      <Page />
    </div>
  );
}
