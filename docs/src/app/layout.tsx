import { AppContextProvider } from '@/components/app-context-provider';
import './global.css';
import { OWNER, REPO } from '@/lib/github';
import { RootProvider } from 'fumadocs-ui/provider';
import { type Metadata } from 'next';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: {
    template: '%s | EdgeStore',
    default: 'EdgeStore',
  },
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
        <AppContextProvider githubStars={githubStars}>
          <RootProvider>{children}</RootProvider>
        </AppContextProvider>
      </body>
    </html>
  );
}

async function fetchGithubStars() {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}`,
      { next: { revalidate: 86400 } },
    );
    const data = await response.json();
    if (data.stargazers_count !== undefined) {
      return data.stargazers_count;
    }
  } catch (error) {
    console.error('Failed to fetch star count:', error);
  }
}
