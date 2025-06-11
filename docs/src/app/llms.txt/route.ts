import { source } from '@/lib/source';

export const revalidate = false;

export function GET() {
  const scanned: string[] = [];
  scanned.push('# Docs');
  const map = new Map<string, string[]>();

  for (const page of source.getPages()) {
    const dir = page.slugs.length <= 1 ? 'getting-started' : page.slugs[0]!;
    const list = map.get(dir) ?? [];
    list.push(
      `- [${page.data.title}](https://edgestore.dev${page.url}.md): ${page.data.description}`,
    );
    map.set(dir, list);
  }

  // Ensure getting-started is first
  if (map.has('getting-started')) {
    scanned.push(`## getting-started`);
    scanned.push(map.get('getting-started')!.join('\n'));
  }

  // Add all other sections
  for (const [key, value] of map) {
    if (key !== 'getting-started') {
      scanned.push(`## ${key}`);
      scanned.push(value.join('\n'));
    }
  }

  return new Response(scanned.join('\n\n'));
}
