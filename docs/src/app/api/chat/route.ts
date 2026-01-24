import { getLLMText } from '@/lib/get-llm-text';
import { source } from '@/lib/source';
import { convertToModelMessages, streamText, type UIMessage } from 'ai';
import { ProvideLinksToolSchema } from '../../../lib/qa-schema';

async function getDocsContext() {
  const pages = source.getPages();
  const texts = await Promise.all(pages.map(getLLMText));
  return texts.join('\n\n');
}

export async function POST(req: Request) {
  const reqJson = (await req.json()) as { messages: UIMessage[] };
  const docsContext = await getDocsContext();

  const result = streamText({
    model: 'google/gemini-3-flash',
    system: `You are a helpful assistant for EdgeStore documentation. Use the following documentation to answer questions accurately.\n\n${docsContext}`,
    tools: {
      provideLinks: {
        inputSchema: ProvideLinksToolSchema,
      },
    },
    messages: await convertToModelMessages(reqJson.messages, {
      ignoreIncompleteToolCalls: true,
    }),
    toolChoice: 'auto',
    onError: (error) => {
      console.error('Error in chat API:', JSON.stringify(error, null, 2));
    },
  });

  return result.toUIMessageStreamResponse();
}
