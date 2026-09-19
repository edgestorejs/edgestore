import type { Nodes, Root } from 'mdast';
import { remark } from 'remark';
import frontmatter from 'remark-frontmatter';
import gfm from 'remark-gfm';
import mdx from 'remark-mdx';
import { parse as parseYaml } from 'yaml';

const parser = remark().use(frontmatter).use(gfm).use(mdx);
const writer = remark().use(gfm);

type RenderOptions = {
  sourceUrl: string;
  sections?: string[];
};

export function renderReference(
  source: string,
  options: RenderOptions,
): string {
  const tree = parser.parse(source);
  const metadata = tree.children.find((node) => node.type === 'yaml');
  const data: unknown = metadata ? parseYaml(metadata.value) : undefined;
  if (
    !data ||
    typeof data !== 'object' ||
    !('title' in data) ||
    typeof data.title !== 'string'
  ) {
    throw new Error(`Missing documentation title: ${options.sourceUrl}`);
  }
  if (options.sections) tree.children = selectSections(tree, options.sections);
  const transformed = rewrite(tree, options)[0] as Root;
  return `# ${data.title}\n\nSource: ${options.sourceUrl}\n\n${writer.stringify(transformed)}`;
}

function selectSections(tree: Root, names: string[]): Root['children'] {
  const selected = new Set<number>();
  for (const name of names) {
    const matches = tree.children.flatMap((node, index) =>
      node.type === 'heading' && plainText(node) === name ? [index] : [],
    );
    if (matches.length !== 1)
      throw new Error(
        `Expected one section named "${name}", found ${matches.length}`,
      );
    const start = matches[0]!;
    const heading = tree.children[start]!;
    if (heading.type !== 'heading') throw new Error('Expected a heading');
    selected.add(start);
    for (let i = start + 1; i < tree.children.length; i++) {
      const node = tree.children[i]!;
      if (node.type === 'heading' && node.depth <= heading.depth) break;
      selected.add(i);
    }
  }
  return tree.children.filter((_, index) => selected.has(index));
}

function plainText(node: Nodes): string {
  if ('value' in node) return node.value;
  return 'children' in node ? node.children.map(plainText).join('') : '';
}

function rewrite(node: Nodes, options: RenderOptions): Nodes[] {
  if (node.type === 'yaml') return [];
  if (
    node.type === 'mdxjsEsm' ||
    node.type === 'mdxFlowExpression' ||
    node.type === 'mdxTextExpression'
  ) {
    throw new Error(
      `Executable MDX is not supported in package references: ${node.type}`,
    );
  }

  if ('children' in node) {
    // Replacements preserve the block/phrasing category of their original node.
    node.children = node.children.flatMap((child) =>
      rewrite(child, options),
    ) as typeof node.children;
  }

  if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') {
    validateAttributes(node);
    if (node.name === 'br') return [{ type: 'text', value: '\n' }];
    if (node.name === 'Tabs') return node.children;
    if (node.name === 'Callout' && node.type === 'mdxJsxFlowElement') {
      const type = node.attributes.find(
        (attribute) =>
          attribute.type === 'mdxJsxAttribute' && attribute.name === 'type',
      );
      if (
        type &&
        (type.type !== 'mdxJsxAttribute' || typeof type.value !== 'string')
      ) {
        throw new Error('Callout type must be static text');
      }
      return [
        {
          type: 'blockquote',
          children: [
            {
              type: 'paragraph',
              children: [
                {
                  type: 'text',
                  value: type ? String(type.value).toUpperCase() : 'NOTE',
                },
              ],
            },
            ...(node.children as Extract<
              Nodes,
              { type: 'blockquote' }
            >['children']),
          ],
        },
      ];
    }
    throw new Error(`Unsupported documentation component: ${node.name}`);
  }

  if (node.type === 'code') {
    const labels = node.meta;
    node.meta = undefined;
    if (node.lang === 'package-install') {
      // Do not guess the user's package manager or turn arbitrary text into shell commands.
      node.lang = 'text';
      return [
        {
          type: 'paragraph',
          children: [
            {
              type: 'text',
              value:
                'Packages to install (use the application’s package manager):',
            },
          ],
        },
        node,
      ];
    }
    if (labels)
      return [
        {
          type: 'paragraph',
          children: [{ type: 'text', value: `Example: ${labels}` }],
        },
        node,
      ];
  }
  if ('url' in node) node.url = new URL(node.url, options.sourceUrl).href;
  return [node];
}

function validateAttributes(
  node: Extract<Nodes, { type: 'mdxJsxFlowElement' | 'mdxJsxTextElement' }>,
): void {
  for (const attribute of node.attributes) {
    if (attribute.type !== 'mdxJsxAttribute')
      throw new Error('Executable MDX attribute spread is unsupported');
    if (node.name === 'Tabs' && attribute.name === 'items') {
      const value = attribute.value;
      const body =
        typeof value === 'object' && value
          ? value.data?.estree?.body
          : undefined;
      const statement = body?.length === 1 ? body[0] : undefined;
      const expression =
        statement?.type === 'ExpressionStatement'
          ? statement.expression
          : undefined;
      if (
        expression?.type === 'ArrayExpression' &&
        expression.elements.every(
          (element) =>
            element?.type === 'Literal' && typeof element.value === 'string',
        )
      )
        continue;
      throw new Error('Tabs items must be static string labels');
    }
    if (
      ((node.name === 'Callout' && attribute.name === 'type') ||
        (node.name === 'Tabs' && attribute.name === 'groupId')) &&
      typeof attribute.value === 'string'
    )
      continue;
    throw new Error(
      `Unsupported or non-static ${node.name} attribute: ${attribute.name}`,
    );
  }
}
