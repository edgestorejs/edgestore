import { initEdgeStore } from '@edgestore/server';
import {
  initEdgeStoreClient,
  type InferClientResponse,
} from '@edgestore/server/core';
import {
  expectAssignable,
  expectError,
  expectNotAssignable,
  expectType,
} from 'tsd';
import { z } from 'zod';

type Context = {
  userId: string;
  role: 'admin' | 'visitor';
};

const es = initEdgeStore.context<Context>().create();

const router = es.router({
  avatars: es
    .imageBucket()
    .input(
      z.object({
        type: z.enum(['profile', 'post']),
      }),
    )
    .path(({ ctx, input }) => [{ author: ctx.userId }, { type: input.type }])
    .metadata(({ ctx, input }) => ({
      role: ctx.role,
      type: input.type,
    })),
  documents: es.fileBucket().path(({ ctx }) => [{ author: ctx.userId }]),
});

const client = initEdgeStoreClient({
  router,
});

const publicEs = initEdgeStore.create();
const publicRouter = publicEs.router({
  files: publicEs.fileBucket(),
});
const publicClient = initEdgeStoreClient({
  router: publicRouter,
});
const privateRouter = publicEs.router({
  privateFiles: publicEs.fileBucket().accessControl('private'),
  privateImages: publicEs
    .imageBucket()
    .accessControl('private')
    .autoSignedUrls({ expiresIn: 300 }),
});
const privateClient = initEdgeStoreClient({
  router: privateRouter,
});

void client.avatars.upload({
  content: 'hello',
  ctx: {
    userId: 'user-1',
    role: 'admin',
  },
  input: {
    type: 'profile',
  },
});

expectNotAssignable<Parameters<typeof client.avatars.upload>[0]>({
  content: 'hello',
  ctx: {
    userId: 'user-1',
    role: 'admin',
  },
});

expectNotAssignable<Parameters<typeof client.avatars.upload>[0]>({
  content: 'hello',
  input: {
    type: 'profile',
  },
});

void client.documents.upload({
  content: 'hello',
  ctx: {
    userId: 'user-1',
    role: 'visitor',
  },
});

expectNotAssignable<Parameters<typeof client.documents.upload>[0]>({
  content: 'hello',
});

void publicClient.files.upload({
  content: 'hello',
});
expectError(publicClient.files.getSignedUrl({ url: 'https://example.com/a' }));

expectType<
  Promise<{
    url: string;
    signedUrl: string;
    expiresAt: Date;
    expiresIn: number;
  }>
>(
  privateClient.privateFiles.getSignedUrl({
    url: 'https://files.edgestore.dev/project/privateFiles/file.txt',
  }),
);

expectAssignable<
  Promise<
    {
      url: string;
      signedUrl: string;
      expiresAt: Date;
      expiresIn: number;
      thumbnailUrl?: string | null;
      signedThumbnailUrl?: string | null;
    }[]
  >
>(
  privateClient.privateImages.getSignedUrls({
    urls: ['https://files.edgestore.dev/project/privateImages/image.png'],
    includeThumbnails: true,
  }),
);

expectType<
  Promise<{
    url: string;
    thumbnailUrl: string | null;
    size: number;
    metadata: Record<string, never>;
    path: Record<string, never>;
    pathOrder: [];
    signedUrl: string;
    expiresAt: Date;
    expiresIn: number;
    signedThumbnailUrl?: string | null;
  }>
>(
  privateClient.privateImages.upload({
    content: 'hello',
  }),
);

expectType<
  Promise<{
    url: string;
    thumbnailUrl: string | null;
    size: number;
    metadata: {
      role: 'admin' | 'visitor';
      type: 'profile' | 'post';
    };
    path: {
      author: string;
      type: string;
    };
    pathOrder: ('author' | 'type')[];
  }>
>(
  client.avatars.upload({
    content: 'hello',
    ctx: {
      userId: 'user-1',
      role: 'admin',
    },
    input: {
      type: 'post',
    },
  }),
);

expectType<
  Promise<{
    url: string;
    size: number;
    metadata: Record<string, never>;
    path: {
      author: string;
    };
    pathOrder: 'author'[];
  }>
>(
  client.documents.upload({
    content: 'hello',
    ctx: {
      userId: 'user-1',
      role: 'visitor',
    },
  }),
);

expectType<
  Promise<{
    url: string;
    size: number;
    uploadedAt: Date;
    metadata: {
      role: 'admin' | 'visitor';
      type: 'profile' | 'post';
    };
    path: {
      author: string;
      type: string;
    };
  }>
>(
  client.avatars.getFile({
    url: 'https://files.example.com/file.png',
  }),
);

expectType<
  Promise<{
    data: {
      url: string;
      thumbnailUrl: string | null;
      size: number;
      uploadedAt: Date;
      metadata: {
        role: 'admin' | 'visitor';
        type: 'profile' | 'post';
      };
      path: {
        author: string;
        type: string;
      };
    }[];
    pagination: {
      limit: number;
      nextCursor: string | null;
      hasMore: boolean;
    };
  }>
>(client.avatars.listFiles());

expectNotAssignable<
  NonNullable<Parameters<typeof client.documents.listFiles>[0]>
>({
  filter: {
    path: {
      unknown: {
        eq: 'value',
      },
    },
  },
});

expectType<{
  avatars: {
    upload: {
      url: string;
      thumbnailUrl: string | null;
      size: number;
      metadata: {
        role: 'admin' | 'visitor';
        type: 'profile' | 'post';
      };
      path: {
        author: string;
        type: string;
      };
      pathOrder: ('author' | 'type')[];
    };
    getFile: {
      url: string;
      size: number;
      uploadedAt: Date;
      metadata: {
        role: 'admin' | 'visitor';
        type: 'profile' | 'post';
      };
      path: {
        author: string;
        type: string;
      };
    };
    confirmUpload: {
      success: boolean;
    };
    deleteFile: {
      success: boolean;
    };
    listFiles: {
      data: {
        url: string;
        thumbnailUrl: string | null;
        size: number;
        uploadedAt: Date;
        metadata: {
          role: 'admin' | 'visitor';
          type: 'profile' | 'post';
        };
        path: {
          author: string;
          type: string;
        };
      }[];
      pagination: {
        limit: number;
        nextCursor: string | null;
        hasMore: boolean;
      };
    };
  };
  documents: {
    upload: {
      url: string;
      size: number;
      metadata: Record<string, never>;
      path: {
        author: string;
      };
      pathOrder: 'author'[];
    };
    getFile: {
      url: string;
      size: number;
      uploadedAt: Date;
      metadata: Record<string, never>;
      path: {
        author: string;
      };
    };
    confirmUpload: {
      success: boolean;
    };
    deleteFile: {
      success: boolean;
    };
    listFiles: {
      data: {
        url: string;
        size: number;
        uploadedAt: Date;
        metadata: Record<string, never>;
        path: {
          author: string;
        };
      }[];
      pagination: {
        limit: number;
        nextCursor: string | null;
        hasMore: boolean;
      };
    };
  };
}>({} as InferClientResponse<typeof router>);

expectType<{
  files: {
    upload: {
      url: string;
      size: number;
      metadata: Record<string, never>;
      path: Record<string, never>;
      pathOrder: [];
    };
    getFile: {
      url: string;
      size: number;
      uploadedAt: Date;
      metadata: Record<string, never>;
      path: Record<string, never>;
    };
    confirmUpload: {
      success: boolean;
    };
    deleteFile: {
      success: boolean;
    };
    listFiles: {
      data: {
        url: string;
        size: number;
        uploadedAt: Date;
        metadata: Record<string, never>;
        path: Record<string, never>;
      }[];
      pagination: {
        limit: number;
        nextCursor: string | null;
        hasMore: boolean;
      };
    };
  };
}>({} as InferClientResponse<typeof publicRouter>);
