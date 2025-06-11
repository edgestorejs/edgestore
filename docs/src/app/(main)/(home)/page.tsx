import { CodeExamples } from './_sections/code-examples';
import { DemoVideo } from './_sections/demo-video';
import { Frameworks } from './_sections/frameworks';
import { Hero } from './_sections/hero';
import { SampleComponents } from './_sections/sample-components';
import { Testimonials } from './_sections/testimonials';

export default function HomePage() {
  return (
    <main className="landing-page">
      <Hero />
      <Frameworks />
      <CodeExamples />
      <DemoVideo />
      <SampleComponents />
      <Testimonials />
    </main>
  );
}
