'use client';

import { ArrowLeft, ArrowRight, Moon, Sun } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function ReviewControls({
  designs,
  selected,
  theme,
}: {
  designs: { id: string; name: string }[];
  selected: string;
  theme: 'light' | 'dark';
}) {
  const router = useRouter();
  const index = designs.findIndex(({ id }) => id === selected);
  const href = (id: string, mode = theme) =>
    `/landing-lab?design=${id}&theme=${mode}`;
  return (
    <div className="ll-review-bar">
      <span>Landing exploration</span>
      <nav aria-label="Design options">
        <Link
          href={href(
            designs[(index + designs.length - 1) % designs.length]!.id,
          )}
          aria-label="Previous design"
        >
          <ArrowLeft size={16} />
        </Link>
        <label className="ll-sr-only" htmlFor="landing-design">
          Design
        </label>
        <select
          id="landing-design"
          value={selected}
          onChange={(event) => router.push(href(event.target.value))}
        >
          {designs.map(({ id, name }, i) => (
            <option key={id} value={id}>
              {i + 1} / {designs.length} · {name}
            </option>
          ))}
        </select>
        <Link
          href={href(designs[(index + 1) % designs.length]!.id)}
          aria-label="Next design"
        >
          <ArrowRight size={16} />
        </Link>
      </nav>
      <div className="ll-review-actions">
        <Link
          href={href(selected, theme === 'light' ? 'dark' : 'light')}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          scroll={false}
        >
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          <span>{theme === 'light' ? 'Dark' : 'Light'}</span>
        </Link>
        <Link href="/" className="ll-current-site">
          Current site
        </Link>
      </div>
    </div>
  );
}
