import { highlight } from 'fumadocs-core/highlight';
import { rehypeCodeDefaultOptions } from 'fumadocs-core/mdx-plugins';
import { transformerTwoslash } from 'fumadocs-twoslash';
import * as Base from 'fumadocs-ui/components/codeblock';
import { type HTMLAttributes } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../_components/tabs';

const SERVER_BASIC_CODE = `
const es = initEdgeStore.create();

const edgeStoreRouter = es.router({
  myFiles: es.fileBucket(),
});
`.trim();

const SERVER_CONFIG_CODE = `
const es = initEdgeStore.create();

const edgeStoreRouter = es.router({
  myFiles: es.fileBucket(),
});
`.trim();

const SERVER_AUTH_CODE = `
const es = initEdgeStore.create();

const edgeStoreRouter = es.router({
  myFiles: es.fileBucket(),
});
`.trim();

const CLIENT_BASIC_CODE = `
export function FileUpload() {
  const { edgestore } = useEdgeStore();

  async function handleUpload(file: File) {
    const res = await edgestore.myFiles.upload({
      file,
    });
    
    console.log(res.url);
  }

  return (
    // your component here
  );
}
`.trim();

const CLIENT_PROGRESS_CODE = `
import { useEdgeStore } from '@/lib/edgestore';
import { useState } from 'react';

export function FileUpload() {
  const { edgestore } = useEdgeStore();
  const [progress, setProgress] = useState(0);
  
  const uploadFile = async (file: File) => {
    const res = await edgestore.myFiles.upload({
      file,
      onProgressChange: (progress) => {
        setProgress(progress);
      },
    });
    
    return res.url;
  };
  
  return (
    <div>
      <input type="file" onChange={(e) => uploadFile(e.target.files?.[0])} />
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div 
          className="bg-purple-600 h-2.5 rounded-full transition-all" 
          style={{ width: \`\${progress}%\` }}
        />
      </div>
    </div>
  );
}
`.trim();

export function CodeExamples() {
  return (
    <>
      <div className="container mt-32 space-y-10">
        <div className="space-y-2">
          <h2 className="text-center text-4xl font-bold">
            As simple as it gets
          </h2>
          <p className="text-center text-muted-foreground">
            Just define your storage structure and start uploading.
          </p>
        </div>
        <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
          <div className="grid gap-4 lg:grid-cols-2 [&>figure]:m-0">
            <div>
              <h3 className="mb-2 text-lg font-semibold">Server</h3>
              <Tabs defaultValue="basic">
                <TabsList className="flex w-full">
                  <TabsTrigger className="flex-1" value="basic">
                    Basic
                  </TabsTrigger>
                  <TabsTrigger className="flex-1" value="validation">
                    Validation & Metadata
                  </TabsTrigger>
                  <TabsTrigger className="flex-1" value="auth">
                    With Auth
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="basic">
                  <CodeBlock code={SERVER_BASIC_CODE} lang="ts" />
                </TabsContent>
                <TabsContent value="validation">
                  <CodeBlock code={SERVER_CONFIG_CODE} lang="ts" />
                </TabsContent>
                <TabsContent value="auth">
                  <CodeBlock code={SERVER_AUTH_CODE} lang="ts" />
                </TabsContent>
              </Tabs>
            </div>
            <div>
              <h3 className="mb-2 text-lg font-semibold">Client</h3>
              <Tabs defaultValue="basic">
                <TabsList className="flex w-full">
                  <TabsTrigger className="flex-1" value="basic">
                    Basic
                  </TabsTrigger>
                  <TabsTrigger className="flex-1" value="progress">
                    Progress
                  </TabsTrigger>
                  <TabsTrigger className="flex-1" value="cancelation">
                    Cancelation
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="basic">
                  <CodeBlock code={CLIENT_BASIC_CODE} lang="ts" />
                </TabsContent>
                <TabsContent value="progress">
                  <CodeBlock code={CLIENT_PROGRESS_CODE} lang="ts" />
                </TabsContent>
                <TabsContent value="cancelation">
                  <CodeBlock code={CLIENT_PROGRESS_CODE} lang="ts" />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

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
