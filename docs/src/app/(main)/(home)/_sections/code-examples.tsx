import { CodeBlock } from '../_components/code-block';
import {
  ResponsiveTabs,
  ResponsiveTabsContent,
  ResponsiveTabsList,
  ResponsiveTabsTrigger,
} from '../_components/responsive-tabs';

const SERVER_BASIC_CODE = `
const es = initEdgeStore.create();

const edgeStoreRouter = es.router({
  myFiles: es.fileBucket(),
});
`.trim();

const SERVER_CONFIG_CODE = `
const es = initEdgeStore.create();

const edgeStoreRouter = es.router({
  myFiles: es
    .fileBucket({
      accept: ['application/pdf'],
      maxSize: 1024 * 1024 * 10, // 10MB
    })
    .input(z.object({ type: z.enum(['post', 'article']) }))
    .path(({ input }) => [{ type: input.type }])
    .metadata(({ input }) => ({
      custom: 'some-custom-metadata',
    })),
});
`.trim();

const SERVER_AUTH_CODE = `
type Context = {
  personalFolder: string;
};

async function createContext({ req }: CreateContextOptions): Promise<Context> {
  const session = await auth();
  return {
    personalFolder: session?.user?.id ?? '_shared',
  };
}

const es = initEdgeStore.context<Context>().create();

const edgeStoreRouter = es.router({
  myFiles: es
    .fileBucket()
    .path(({ ctx }) => [{ author: ctx.personalFolder }])
    .accessControl({
      OR: [
        // ctx.personalFolder is the same as the author in the path
        { personalFolder: { path: 'author' } },
        // if the personal folder is _shared, it's accessible to everyone
        { personalFolder: '_shared' },
      ],
    }),
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
export function FileUpload() {
  const { edgestore } = useEdgeStore();
  const [progress, setProgress] = useState(0);
  
  async function handleUpload(file: File) {
    const res = await edgestore.myFiles.upload({
      file,
      onProgressChange: (progress) => {
        setProgress(progress);
      },
    });
    
    return res.url;
  };
  
  return (
    // your component here
  );
}
`.trim();

const CLIENT_CANCELATION_CODE = `
export function FileUpload() {
  const { edgestore } = useEdgeStore();
  const [progress, setProgress] = useState(0);
  const [abortController, setAbortController] = useState<AbortController>();
  
  async function handleUpload(file: File) {
    const abortController = new AbortController();
    setAbortController(abortController);

    const res = await edgestore.myFiles.upload({
      file,
      signal: abortController.signal,
      onProgressChange: (progress) => {
        setProgress(progress);
      },
    });
    
    return res.url;
  };

  // You can call this function to cancel the upload
  function handleCancel() {
    abortController?.abort();
  }
  
  return (
    // your component here
  );
}
`.trim();

export function CodeExamples() {
  return (
    <>
      <div className="container space-y-10 py-20">
        <div className="space-y-2 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl md:text-4xl">
            As{' '}
            <span className="from-primary to-primary/60 bg-gradient-to-b bg-clip-text text-transparent">
              Simple
            </span>{' '}
            as it Gets
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg">
            Just define your storage structure and start uploading.
          </p>
        </div>
        <div className="border-border/50 bg-muted/20 rounded-lg border p-4">
          <div className="flex flex-col gap-4 overflow-hidden lg:grid lg:grid-cols-2 [&>figure]:m-0">
            <div>
              <h3 className="mb-2 text-lg font-semibold">Server</h3>
              <ResponsiveTabs defaultValue="basic">
                <ResponsiveTabsList className="flex w-full">
                  <ResponsiveTabsTrigger className="flex-1" value="basic">
                    Basic
                  </ResponsiveTabsTrigger>
                  <ResponsiveTabsTrigger className="flex-1" value="validation">
                    Validation & Metadata
                  </ResponsiveTabsTrigger>
                  <ResponsiveTabsTrigger className="flex-1" value="auth">
                    With Auth
                  </ResponsiveTabsTrigger>
                </ResponsiveTabsList>
                <ResponsiveTabsContent value="basic">
                  <CodeBlock code={SERVER_BASIC_CODE} lang="ts" />
                </ResponsiveTabsContent>
                <ResponsiveTabsContent value="validation">
                  <CodeBlock code={SERVER_CONFIG_CODE} lang="ts" />
                </ResponsiveTabsContent>
                <ResponsiveTabsContent value="auth">
                  <CodeBlock code={SERVER_AUTH_CODE} lang="ts" />
                </ResponsiveTabsContent>
              </ResponsiveTabs>
            </div>
            <div>
              <h3 className="mb-2 text-lg font-semibold">Client</h3>
              <ResponsiveTabs defaultValue="basic">
                <ResponsiveTabsList className="flex w-full">
                  <ResponsiveTabsTrigger className="flex-1" value="basic">
                    Basic
                  </ResponsiveTabsTrigger>
                  <ResponsiveTabsTrigger className="flex-1" value="progress">
                    Progress
                  </ResponsiveTabsTrigger>
                  <ResponsiveTabsTrigger className="flex-1" value="cancelation">
                    Cancelation
                  </ResponsiveTabsTrigger>
                </ResponsiveTabsList>
                <ResponsiveTabsContent value="basic">
                  <CodeBlock code={CLIENT_BASIC_CODE} lang="ts" />
                </ResponsiveTabsContent>
                <ResponsiveTabsContent value="progress">
                  <CodeBlock code={CLIENT_PROGRESS_CODE} lang="ts" />
                </ResponsiveTabsContent>
                <ResponsiveTabsContent value="cancelation">
                  <CodeBlock code={CLIENT_CANCELATION_CODE} lang="ts" />
                </ResponsiveTabsContent>
              </ResponsiveTabs>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
