import { baseOptions } from '@/app/layout.config';
import { GithubIcon } from '@/components/icons/platforms/github';
import { GITHUB_URL } from '@/lib/constants';
import { v0Source as source } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import type { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.pageTree}
      searchToggle={{ enabled: false }}
      {...baseOptions}
      links={[
        {
          type: 'icon',
          text: 'GitHub',
          url: GITHUB_URL,
          icon: <GithubIcon />,
        },
      ]}
    >
      {children}
    </DocsLayout>
  );
}
