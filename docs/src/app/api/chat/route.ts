import { env } from '@/env';
import { langfuseSpanProcessor } from '@/instrumentation';
import { getLLMText } from '@/lib/get-llm-text';
import { source } from '@/lib/source';
import { propagateAttributes } from '@langfuse/tracing';
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from 'ai';
import { after } from 'next/server';
import type { z } from 'zod';
import {
  GetDocsToolSchema,
  ProvideLinksToolSchema,
} from '../../../lib/qa-schema';

function getAvailablePages() {
  const pages = source.getPages();
  return pages.map((page) => ({
    slug: page.slugs.join('/'),
    title: page.data.title,
    description: page.data.description,
  }));
}

async function getDocsForSlugs(slugs: string[]) {
  const pages = source.getPages();
  const matchedPages = pages.filter((page) =>
    slugs.includes(page.slugs.join('/')),
  );
  const texts = await Promise.all(matchedPages.map(getLLMText));
  return texts.join('\n\n');
}

export const POST = async (req: Request) => {
  const reqJson = (await req.json()) as { messages: UIMessage[]; id?: string };
  const availablePages = getAvailablePages();

  // Pre-fetch quick-start docs to include in system prompt by default
  const quickStartDocs = await getDocsForSlugs(['quick-start']);

  const envName = env.VERCEL_ENV ?? 'local';
  const envTag = `env:${envName}`;

  const systemPrompt = `You are a helpful assistant for EdgeStore documentation.

IMPORTANT: Only answer based on the documentation provided. Do not make up information, code examples, APIs, or features that are not explicitly documented. If the answer is not in the documentation, say "I don't have information about that in the documentation" and suggest checking the official docs or asking on the EdgeStore Discord/GitHub.

You have access to a tool called "getDocs" that retrieves documentation pages. Use it to fetch relevant documentation before answering questions.

Available documentation pages:
${availablePages.map((p) => `- "${p.slug}": ${p.title}${p.description ? ` - ${p.description}` : ''}`).join('\n')}

Here is the Quick Start guide with FAQ that you can reference for common questions:

<quick-start-docs>
${quickStartDocs}
</quick-start-docs>

For questions covered in the quick-start guide or FAQ above, you can answer directly. For other topics, use the getDocs tool to retrieve relevant documentation before answering. You can request multiple pages at once if needed.

Guidelines:
- Only provide code examples that are directly from the documentation or trivially derived from documented patterns.
- If you're unsure about something, fetch the relevant docs first rather than guessing.
- Never invent API methods, configuration options, or features that aren't documented.
- If a feature doesn't exist in EdgeStore, say so clearly.

Before writing your final answer, call the "provideLinks" tool exactly once with the documentation pages you referenced. After the tool returns, write a complete, non-empty answer to the user. Do not call "provideLinks" again, and do not treat the tool call as the answer.`;

  return propagateAttributes(
    {
      traceName: 'docs-chat',
      sessionId: reqJson.id,
      tags: [envTag, 'app:docs'],
      metadata: {
        env: envName,
      },
    },
    async () => {
      const result = streamText({
        model: 'openai/gpt-5.6-luna',
        providerOptions: {
          openai: {
            reasoningEffort: 'none',
          },
        },
        instructions: systemPrompt,
        tools: {
          getDocs: {
            inputSchema: GetDocsToolSchema,
            execute: async ({ slugs }: { slugs: string[] }) => {
              const docs = await getDocsForSlugs(slugs);
              return docs || 'No documentation found for the requested slugs.';
            },
          },
          provideLinks: {
            inputSchema: ProvideLinksToolSchema,
            execute: ({ links }: z.infer<typeof ProvideLinksToolSchema>) => ({
              links,
            }),
          },
        },
        messages: await convertToModelMessages(reqJson.messages, {
          ignoreIncompleteToolCalls: true,
        }),
        toolChoice: 'auto',
        stopWhen: isStepCount(5),
        telemetry: {
          functionId: 'docs-chat',
        },
        onError: ({ error }) => {
          console.error('Error in chat API:', JSON.stringify(error, null, 2));
        },
      });

      // Critical for serverless/edge runtimes: flush traces before the function exits.
      after(() => langfuseSpanProcessor.forceFlush());

      return createUIMessageStreamResponse({
        stream: toUIMessageStream({ stream: result.stream }),
      });
    },
  );
};
