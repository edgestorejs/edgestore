import { AppContextProvider } from '@/components/app-context-provider';
import { GITHUB_OWNER, GITHUB_REPO } from '@/lib/constants';
import { EdgeStoreProvider } from '@/lib/edgestore';
import './global.css';
import { env } from '@/env';
import { RootProvider } from 'fumadocs-ui/provider';
import { type Metadata } from 'next';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: {
    template: '%s | EdgeStore',
    default: 'EdgeStore',
  },
  description: 'The best way to add file uploads to React apps.',
};

export const revalidate = 86400; // 24 hours in seconds

const inter = Inter({
  subsets: ['latin'],
});

export default async function Layout({ children }: { children: ReactNode }) {
  const githubStars = await fetchGithubStars();

  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <EdgeStoreProvider>
          <AppContextProvider githubStars={githubStars}>
            <RootProvider>{children}</RootProvider>
          </AppContextProvider>
        </EdgeStoreProvider>
      </body>
    </html>
  );
}

async function fetchGithubStars() {
  try {
    console.log('Fetching github stars');
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`,
      {
        next: { revalidate: 86400 },
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        },
      },
    );

    if (!response.ok) {
      throw await response.json();
    }

    console.log(
      'Rate limit remaining:',
      response.headers.get('x-ratelimit-remaining') || 'unknown',
    );

    const data = (await response.json()) as { stargazers_count: number };
    if (data.stargazers_count !== undefined) {
      return data.stargazers_count;
    }
  } catch (error) {
    console.error('Failed to fetch star count:', error);
  }
}
