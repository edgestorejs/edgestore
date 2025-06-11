import { DocsBody } from 'fumadocs-ui/page';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <DocsBody className="mx-auto max-w-2xl p-4">{children}</DocsBody>;
}
