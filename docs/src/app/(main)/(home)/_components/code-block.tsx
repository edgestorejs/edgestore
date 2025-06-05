import { highlight } from 'fumadocs-core/highlight';
import { rehypeCodeDefaultOptions } from 'fumadocs-core/mdx-plugins';
import { transformerTwoslash } from 'fumadocs-twoslash';
import * as Base from 'fumadocs-ui/components/codeblock';
import { type HTMLAttributes } from 'react';

export async function CodeBlock({
  code,
  lang,
  ...rest
}: HTMLAttributes<HTMLElement> & {
  code: string;
  lang: string;
}) {
  const rendered = await highlight(code, {
    lang,
    components: {
      pre: (props) => <Base.Pre {...props} />,
    },

    transformers: [
      ...(rehypeCodeDefaultOptions.transformers ?? []),
      transformerTwoslash(),
    ],
  });
  return <Base.CodeBlock {...rest}>{rendered}</Base.CodeBlock>;
}
