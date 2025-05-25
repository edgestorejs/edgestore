import { CodeExamples } from './_sections/code-examples';
import { Footer } from './_sections/footer';
import { Frameworks } from './_sections/frameworks';
import { Hero } from './_sections/hero';

export default function HomePage() {
  return (
    <main className="landing-page">
      <Hero />
      <Frameworks />
      <CodeExamples />
      <Footer />
    </main>
  );
}
