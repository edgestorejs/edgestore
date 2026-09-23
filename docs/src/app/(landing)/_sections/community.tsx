import { CodeBlock } from '@/app/(main)/(home)/_components/code-block';
import { testimonials } from '@/lib/testimonials';
import { Play } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

const featuredUsers = new Set([
  '@whiterabbit6768',
  '@harshalranjhani',
  '@MarcelGatete',
]);
const v0Url = `https://v0.dev/chat/api/open?${new URLSearchParams({
  title: 'Single Image Dropzone',
  prompt: 'A single image upload component with preview and upload status.',
  url: 'https://edgestore.dev/r/single-image-dropzone-block.json',
})}`;

export function UploadComponents() {
  return (
    <section
      className="ya-section ya-container ya-components"
      aria-labelledby="components-title"
    >
      <div className="ya-section-heading">
        <h2 id="components-title">React upload components</h2>
        <p>Add a dropzone with shadcn, then customize the code in your app.</p>
      </div>
      <div className="ya-install-command">
        <CodeBlock
          code="npx shadcn@latest add https://edgestore.dev/r/single-image-dropzone.json"
          lang="bash"
        />
      </div>
      <div className="ya-component-links">
        <Link className="ya-button ya-secondary" href="/docs/components/image">
          Browse components
        </Link>
        <a
          className="ya-button ya-secondary"
          href={v0Url}
          target="_blank"
          rel="noreferrer"
        >
          Open in v0
        </a>
      </div>
      <div className="ya-video-links">
        <a
          href="https://www.youtube.com/watch?v=Acq9UEA2akU"
          target="_blank"
          rel="noreferrer"
        >
          <Play size={16} aria-hidden="true" /> Watch the overview
        </a>
        <a
          href="https://www.youtube.com/watch?v=0gZrDWzlkn0"
          target="_blank"
          rel="noreferrer"
        >
          <Play size={16} aria-hidden="true" /> Watch the component demo
        </a>
      </div>
    </section>
  );
}

export function DeveloperQuotes() {
  return (
    <section
      className="ya-section ya-container ya-testimonials"
      aria-labelledby="testimonials-title"
    >
      <div className="ya-section-heading">
        <h2 id="testimonials-title">From developers using EdgeStore</h2>
      </div>
      <div className="ya-quote-grid">
        {testimonials
          .filter(({ user }) => featuredUsers.has(user))
          .map(({ user, comment, url, image }) => (
            <figure key={user}>
              <blockquote>
                <p>“{comment}”</p>
              </blockquote>
              <figcaption>
                <a href={url} target="_blank" rel="noreferrer">
                  <Image src={image} alt="" width={32} height={32} />
                  {user}
                </a>
              </figcaption>
            </figure>
          ))}
      </div>
    </section>
  );
}
