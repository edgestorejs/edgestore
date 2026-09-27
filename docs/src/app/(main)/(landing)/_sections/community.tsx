import { testimonials } from '@/lib/testimonials';
import { cn } from '@/lib/utils';
import { Play } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { CodeBlock } from '../_components/code-block';
import {
  siteButton,
  siteContainer,
  siteSecondaryButton,
} from '../../_components/styles';

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
      className={cn(
        siteContainer,
        'border-b border-site-line py-[100px] max-[981px]:py-[72px] max-[601px]:py-14',
      )}
      aria-labelledby="components-title"
    >
      <div className="mb-[38px] grid max-w-[720px] gap-[18px] max-[601px]:mb-[26px]">
        <h2
          className="text-[clamp(28px,3.3vw,44px)] leading-[1.16] font-[650] tracking-[-0.045em] text-balance"
          id="components-title"
        >
          React upload components
        </h2>
        <p className="max-w-[660px] text-[17px]/7 text-site-muted max-[601px]:text-[15px]">
          Add a dropzone with shadcn, then customize the code in your app.
        </p>
      </div>
      <div className="max-w-[800px] min-w-0 [&_figure]:m-0 [&_figure]:border-site-line [&_figure]:bg-site-panel [&_figure]:shadow-none [&_pre]:w-full [&_pre]:py-6 [&_pre]:pr-12 [&_pre]:pl-6 [&_pre]:text-[13px] [&_pre]:wrap-anywhere [&_pre]:whitespace-pre-wrap">
        <CodeBlock
          code="npx shadcn@latest add https://edgestore.dev/r/single-image-dropzone.json"
          lang="bash"
        />
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Link
          className={cn(siteButton, siteSecondaryButton)}
          href="/docs/components/image"
        >
          Browse components
        </Link>
        <a
          className={cn(siteButton, siteSecondaryButton)}
          href={v0Url}
          target="_blank"
          rel="noreferrer"
        >
          Open in v0
        </a>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-x-[30px] gap-y-[18px]">
        <a
          className="inline-flex items-center gap-2 text-sm text-site-accent hover:underline hover:underline-offset-4"
          href="https://www.youtube.com/watch?v=Acq9UEA2akU"
          target="_blank"
          rel="noreferrer"
        >
          <Play size={16} aria-hidden="true" /> Watch the overview
        </a>
        <a
          className="inline-flex items-center gap-2 text-sm text-site-accent hover:underline hover:underline-offset-4"
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
      className={cn(
        siteContainer,
        'border-t border-site-line py-[100px] max-[981px]:py-[72px] max-[601px]:py-14',
      )}
      aria-labelledby="testimonials-title"
    >
      <div className="mb-[38px] grid max-w-[720px] gap-[18px] max-[601px]:mb-[26px] [&_p]:max-w-[660px] [&_p]:text-[17px]/7 [&_p]:text-site-muted max-[601px]:[&_p]:text-[15px]">
        <h2
          className="text-[clamp(28px,3.3vw,44px)] leading-[1.16] font-[650] tracking-[-0.045em] text-balance"
          id="testimonials-title"
        >
          From developers using EdgeStore
        </h2>
      </div>
      <div className="grid grid-cols-3 gap-8 max-[761px]:grid-cols-1 [&_img]:rounded-full">
        {testimonials
          .filter(({ user }) => featuredUsers.has(user))
          .map(({ user, comment, url, image }) => (
            <figure
              className="flex flex-col gap-6 border-t-2 border-site-accent pt-6 max-[761px]:gap-[18px]"
              key={user}
            >
              <blockquote className="text-base leading-[1.8]">
                <p>“{comment}”</p>
              </blockquote>
              <figcaption className="mt-auto">
                <a
                  className="inline-flex items-center gap-2.5 text-[13px] text-site-muted hover:underline hover:underline-offset-4"
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                >
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
