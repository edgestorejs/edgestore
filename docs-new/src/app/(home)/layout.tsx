import { baseOptions } from '@/app/layout.config';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import type { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <HomeLayout
      {...baseOptions}
      className="bg-gradient-to-b from-background via-background to-primary/10"
    >
      {children}
    </HomeLayout>
  );
}
