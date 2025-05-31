import { CodeExamples } from './_sections/code-examples';
import { Footer } from './_sections/footer';
import { Frameworks } from './_sections/frameworks';
import { Hero } from './_sections/hero';
import { Testimonials } from './_sections/testimonials';

export default function HomePage() {
  return (
    <main className="landing-page">
      <Hero />
      <Frameworks />
      <CodeExamples />
      <Testimonials />
      <Footer />
    </main>
  );
}
