import { env } from '@/env';
import { getMDXComponents } from '@/mdx-components';
import { compileMDX } from '@fumadocs/mdx-remote';

export default async function Page() {
  const response = await fetch(
    `${env.NEXT_PUBLIC_DASHBOARD_URL}/legal/privacy-policy.md`,
  );
  const data = await response.text();

  const compiled = await compileMDX({
    source: data,
  });
  const MdxContent = compiled.body;

  return <MdxContent components={getMDXComponents()} />;
}
