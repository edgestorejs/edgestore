import { PassThrough, Readable } from 'node:stream';
import type { ManagementEdgeStoreSdk } from '@edgestore/sdk';
import { vi, type Mock } from 'vitest';
import type {
  GlobalConfig,
  LocatedRepoConfig,
  RepoConfig,
} from './core/config';
import type { CredentialStore } from './core/credentials';
import type { CliRuntime, CliSdk } from './core/runtime';

type ManagementClient = ManagementEdgeStoreSdk['management'];
type TestCliSdk = Pick<CliSdk, 'system' | 'management'>;

export const account = {
  id: 'acc_123',
  type: 'PERSONAL',
  displayName: 'ravi@example.com',
  role: 'OWNER',
  planType: 'free',
  projectCount: 1,
  usageBytes: 0,
  storageLimitBytes: 1_000,
  projectLimit: 3,
  memberLimit: 1,
  isPaused: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
} as const;

export const teamAccount = {
  ...account,
  id: 'acc_team',
  type: 'TEAM',
  displayName: 'EdgeStore',
  memberLimit: 5,
} as const;

export const project = {
  id: 'proj_123',
  basePath: 'x36t1ejdlz',
  name: 'Marketing Site',
  accountId: account.id,
  usageBytes: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

export const projectKey = {
  id: 'key_123',
  name: 'production',
  accessKey: 'access_test',
  projectId: project.id,
  accountId: account.id,
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
  revokedAt: null as string | null,
};

type ManagementToken = Awaited<
  ReturnType<ManagementClient['tokens']['listAccount']>
>['tokens'][number];

export const accountToken = {
  id: 'tok_created',
  name: 'deploy',
  kind: 'ACCOUNT' as const,
  tokenPrefix: 'edge_',
  scopes: ['project:read'],
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
  lastUsedAt: null,
  revokedAt: null as string | null,
  expiresAt: null as string | null,
  accountId: account.id,
  userId: null,
} satisfies ManagementToken;

type ManagementFile = Awaited<
  ReturnType<ManagementClient['files']['list']>
>['files'][number];

export const uploadedFile = {
  id: 'file_123',
  url: 'https://files.example/logo.png',
  key: 'publicFiles/_public/logo.png',
  thumbnailUrl: null,
  thumbnailKey: null,
  bucketId: 'bucket_123',
  bucketName: 'publicFiles',
  projectId: project.id,
  accountId: account.id,
  name: 'logo.png',
  path: {},
  metadata: {},
  sizeBytes: 10,
  mimeType: 'image/png',
  state: 'uploaded',
  temporary: false,
  uploadedAt: project.createdAt,
  updatedAt: project.updatedAt,
} satisfies ManagementFile;

export const failedEmptyJob = {
  id: 'job_123',
  bucketId: 'bucket_123',
  projectId: project.id,
  accountId: account.id,
  status: 'FAILED' as const,
  phase: 'DELETING_FILES' as const,
  totalCount: 5,
  totalBytes: 500,
  processedCount: 2,
  freedBytes: 200,
  pendingS3CleanupCount: 1,
  canceledUploadCount: 0,
  orphanObjectCount: 1,
  orphanBytes: 20,
  cloudFrontInvalidationId: null,
  error: 'storage unavailable',
  heartbeatAt: project.updatedAt,
  startedAt: project.createdAt,
  completedAt: project.updatedAt,
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
};

export const singleUploadRequest = {
  file: {
    id: 'upload_123',
    url: 'https://files.example/upload.txt',
    key: 'publicFiles/_public/upload.txt',
    thumbnailUrl: null,
    thumbnailKey: null,
    bucketId: 'bucket_123',
    bucketName: 'publicFiles',
    projectId: project.id,
    accountId: account.id,
    name: 'upload.txt',
    sizeBytes: 7,
    mimeType: 'text/plain',
    temporary: false,
    state: 'requested' as const,
  },
  upload: {
    kind: 'single' as const,
    id: 'upload_123',
    signedUrl: 'https://storage.example/upload',
  },
};

export const projectCreateResult = {
  project,
  projectKey: {
    key: {
      id: 'key_123',
      name: 'default',
      accessKey: 'access_test',
      projectId: project.id,
      accountId: account.id,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      revokedAt: null,
    },
    secretKey: 'secret_test',
  },
};

type CliTestFixture = {
  runtime: CliRuntime;
  abortController: AbortController;
  globalConfig: GlobalConfig;
  repoConfig: { config?: RepoConfig };
  readRepoConfig: Mock;
  credentials: CredentialStore;
  setCredential: Mock;
  readToken: Mock;
  confirmTyped: Mock;
  createAccountToken: Mock;
  createUserToken: Mock;
  availableAccounts: (typeof account | typeof teamAccount)[];
  listAccounts: Mock;
  accountLeave: Mock;
  memberList: Mock;
  memberUpdate: Mock;
  memberRemove: Mock;
  invitationList: Mock;
  invitationCreate: Mock;
  openUrl: Mock;
  runCommand: Mock<CliRuntime['runCommand']>;
  invitationRevoke: Mock;
  invitationResend: Mock;
  listAccountTokens: Mock;
  revokeToken: Mock;
  createBucket: Mock;
  getBucket: Mock;
  deleteBucket: Mock;
  emptyBucket: Mock;
  latestEmptyJob: Mock;
  getEmptyJob: Mock;
  retryEmptyJob: Mock;
  generateAccessUrls: Mock;
  lookupFile: Mock;
  deleteFiles: Mock<ManagementClient['files']['delete']>;
  uploadFile: Mock<ManagementClient['uploads']['upload']>;
  uploadRequest: Mock<ManagementClient['uploads']['request']>;
  uploadCancel: Mock;
  uploadGet: Mock<ManagementClient['uploads']['get']>;
  completeMultipart: Mock;
  projectCreate: Mock;
  createProject: Mock;
  listProjectKeys: Mock;
  createProjectKey: Mock;
  revokeProjectKey: Mock;
  deleteProject: Mock;
  stdout(): string;
  stderr(): string;
};

export function createFixture(): CliTestFixture {
  const stdoutStream = new PassThrough();
  const stderrStream = new PassThrough();
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  stdoutStream.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
  stderrStream.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

  const globalConfig: GlobalConfig = {
    version: 1,
    activeAccount: account.id,
  };
  const repoConfig: { config?: RepoConfig } = {};
  const readRepoConfig = vi.fn(
    async (): Promise<LocatedRepoConfig | undefined> =>
      repoConfig.config
        ? {
            config: { ...repoConfig.config },
            path: '/repo/.edgestore/config.json',
          }
        : undefined,
  );
  const credentialValues = new Map([
    ['https://api.edgestore.dev', 'stored_token'],
    ['https://api-dev.edgestore.dev', 'stored_dev_token'],
  ]);
  const readToken = vi.fn(async () => 'mgmt_test');
  const setCredential = vi.fn(async (apiOrigin: string, token: string) => {
    credentialValues.set(apiOrigin, token);
  });
  const confirmTyped = vi.fn(async () => undefined);
  const availableAccounts: (typeof account | typeof teamAccount)[] = [account];
  const listAccounts = vi.fn(async () => ({
    accounts: [...availableAccounts],
  }));
  const accountLeave = vi.fn(async () => ({}));
  const memberList = vi.fn(async () => ({ members: [] }));
  const memberUpdate = vi.fn<ManagementClient['members']['update']>(
    async (input) => ({
      member: {
        id: 'member_123',
        userId: input.userId,
        accountId: input.account,
        email: 'member@example.com',
        role: input.role,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
    }),
  );
  const memberRemove = vi.fn(async () => ({}));
  const invitationList = vi.fn(async () => ({ invitations: [] }));
  const invitationCreate = vi.fn(async (input: { email: string }) => ({
    invitation: {
      id: 'inv_123',
      accountId: teamAccount.id,
      email: input.email,
      role: 'VIEWER' as const,
      status: 'INITIAL' as const,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    },
  }));
  const openUrl = vi.fn(async () => undefined);
  const runCommand = vi.fn<CliRuntime['runCommand']>(async () => undefined);
  const invitationRevoke = vi.fn<ManagementClient['invitations']['revoke']>(
    async () => ({}),
  );
  const invitationResend = vi.fn<ManagementClient['invitations']['resend']>(
    async () => ({
      invitation: {
        id: 'inv_123',
        accountId: teamAccount.id,
        email: 'member@example.com',
        role: 'VIEWER',
        status: 'PENDING',
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
    }),
  );
  const credentials: CredentialStore = {
    get: vi.fn(async (apiOrigin) => credentialValues.get(apiOrigin)),
    set: setCredential,
    delete: vi.fn(async (apiOrigin) => {
      return credentialValues.delete(apiOrigin);
    }),
    available: vi.fn(async () => true),
  };

  const createAccountToken = vi.fn<ManagementClient['tokens']['createAccount']>(
    async () => ({
      token: accountToken,
      secret: 'mgmt_created',
    }),
  );
  const createUserToken = vi.fn<ManagementClient['tokens']['createUser']>(
    async () => ({
      token: {
        id: 'tok_user_created',
        name: 'read access',
        kind: 'USER' as const,
        tokenPrefix: 'edge_',
        scopes: ['account:read'],
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        lastUsedAt: null,
        revokedAt: null,
        expiresAt: null,
        accountId: null,
        userId: 'user_123',
      },
      secret: 'mgmt_user_created',
    }),
  );
  const createProject = vi.fn(async () => projectCreateResult);
  const listProjectKeys = vi.fn(async () => ({ keys: [projectKey] }));
  const createProjectKey = vi.fn(async () => ({
    key: projectKey,
    secretKey: 'secret_test',
  }));
  type ProjectKeyRevokeInput = Parameters<
    ManagementEdgeStoreSdk['management']['projectKeys']['revoke']
  >[0];
  const revokeProjectKey = vi.fn(async (_input: ProjectKeyRevokeInput) => ({}));
  const listAccountTokens = vi.fn<ManagementClient['tokens']['listAccount']>(
    async () => ({ tokens: [] }),
  );
  const revokeToken = vi.fn(async () => ({}));
  const createBucket = vi.fn(async () => ({
    bucket: {
      id: 'bucket_123',
      name: 'publicFiles',
      projectId: project.id,
      accountId: account.id,
      type: 'file' as const,
      visibility: 'public' as const,
      usageBytes: 0,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    },
  }));
  const getBucket = vi.fn(async () => ({
    bucket: {
      id: 'bucket_123',
      name: 'publicFiles',
      projectId: project.id,
      accountId: account.id,
      type: 'file' as const,
      visibility: 'public' as const,
      usageBytes: 0,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    },
  }));
  const deleteBucket = vi.fn(async () => ({}));
  const emptyBucket = vi.fn(async () => ({
    jobId: 'job_123',
    bucketId: 'bucket_123',
    status: 'QUEUED' as const,
  }));
  const latestEmptyJob = vi.fn(async () => ({ job: null }));
  const getEmptyJob = vi.fn();
  const retryEmptyJob = vi.fn();
  const generateAccessUrls = vi.fn(async () => ({
    accessUrls: [
      {
        fileRef: { id: 'file_123' },
        url: 'https://files.example/download',
        expiresAt: null,
        expiresIn: null,
      },
    ],
  }));
  const lookupFile = vi.fn();
  type DeleteFilesInput = Parameters<
    ManagementEdgeStoreSdk['management']['files']['delete']
  >[0];
  type DeleteFilesResult = Awaited<
    ReturnType<ManagementEdgeStoreSdk['management']['files']['delete']>
  >;
  type UploadInput = Parameters<
    ManagementEdgeStoreSdk['management']['uploads']['get']
  >[0];
  const deleteFiles = vi.fn(
    async (_input: DeleteFilesInput): Promise<DeleteFilesResult> => ({
      results: [],
      successCount: 0,
      failureCount: 0,
    }),
  );
  const uploadRequest = vi.fn<ManagementClient['uploads']['request']>(
    async () => singleUploadRequest,
  );
  const uploadFile = vi.fn<ManagementClient['uploads']['upload']>(async () => ({
    upload: { id: 'upload_123', status: 'completed' as const },
    file: {
      ...uploadedFile,
      id: 'upload_123',
      url: 'https://files.example/upload.txt',
    },
  }));
  const uploadCancel = vi.fn(async (_input: UploadInput) => ({
    upload: { id: 'upload_123', status: 'canceled' as const },
  }));
  const uploadGet = vi.fn<ManagementClient['uploads']['get']>(
    async (input) => ({
      upload: { id: input.uploadId, status: 'completed' as const },
      file: {
        ...uploadedFile,
        id: input.uploadId,
        url:
          input.uploadId === 'file_123'
            ? 'https://files.example/logo.png'
            : 'https://files.example/upload.txt',
      },
    }),
  );
  const completeMultipart = vi.fn<
    ManagementClient['uploads']['completeMultipart']
  >(async (input) => ({
    upload: { id: input.uploadId, status: 'processing' },
  }));
  const deleteProject = vi.fn(async () => ({}));
  const sdk = {
    system: {
      health: vi.fn<ManagementEdgeStoreSdk['system']['health']>(async () => ({
        ok: true,
        version: 'v2',
      })),
    },
    management: {
      whoami: vi.fn<ManagementClient['whoami']>(async () => ({
        actor: {
          kind: 'user_token',
          tokenId: 'tok_123',
          scopes: ['account:read', 'project:read'],
          user: {
            id: 'user_123',
            clerkUserId: 'clerk_123',
            accountId: account.id,
            email: 'ravi@example.com',
            username: 'ravi',
            firstName: 'Ravi',
            lastName: null,
            picture: 'https://example.com/ravi.png',
          },
        },
      })),
      accounts: {
        list: listAccounts,
        get: vi.fn(async ({ account: accountId }: { account: string }) => ({
          account:
            availableAccounts.find((candidate) => candidate.id === accountId) ??
            account,
        })),
        leave: accountLeave,
      },
      members: {
        list: memberList,
        update: memberUpdate,
        remove: memberRemove,
      },
      invitations: {
        list: invitationList,
        create: invitationCreate,
        revoke: invitationRevoke,
        resend: invitationResend,
      },
      projects: {
        list: vi.fn(async () => ({ projects: [project] })),
        get: vi.fn(async () => ({ project })),
        create: createProject,
        delete: deleteProject,
      },
      projectKeys: {
        list: listProjectKeys,
        create: createProjectKey,
        revoke: revokeProjectKey,
      },
      tokens: {
        listAccount: listAccountTokens,
        listUser: vi.fn(async () => ({ tokens: [] })),
        createAccount: createAccountToken,
        createUser: createUserToken,
        revoke: revokeToken,
      },
      buckets: {
        list: vi.fn(async () => ({ buckets: [] })),
        get: getBucket,
        create: createBucket,
        delete: deleteBucket,
        empty: emptyBucket,
        emptyJobs: {
          latest: latestEmptyJob,
          get: getEmptyJob,
          retry: retryEmptyJob,
        },
      },
      files: {
        list: vi.fn<ManagementClient['files']['list']>(async () => ({
          files: [uploadedFile],
          pagination: { limit: 50, nextCursor: null, hasMore: false },
        })),
        lookup: lookupFile,
        generateAccessUrls,
        delete: deleteFiles,
      },
      uploads: {
        upload: uploadFile,
        request: uploadRequest,
        get: uploadGet,
        cancel: uploadCancel,
        completeMultipart,
      },
    },
  } satisfies TestCliSdk;

  const abortController = new AbortController();
  const runtime: CliRuntime = {
    exitCode: 0,
    cwd: '/repo',
    env: {},
    io: {
      stdin: Readable.from([]),
      stdout: stdoutStream,
      stderr: stderrStream,
      inputIsTty: true,
      outputIsTty: false,
    },
    signal: abortController.signal,
    setCwd(cwd) {
      runtime.cwd = cwd;
    },
    globalConfig: {
      path: '/config/edgestore/config.json',
      read: vi.fn(async () => ({ ...globalConfig })),
      write: vi.fn(async (config: GlobalConfig) => {
        Object.assign(globalConfig, config);
      }),
    },
    repoConfig: {
      read: readRepoConfig,
      write: vi.fn(async (config: RepoConfig) => {
        repoConfig.config = config;
        return '/repo/.edgestore/config.json';
      }),
      remove: vi.fn(async () => {
        if (!repoConfig.config) {
          return undefined;
        }
        repoConfig.config = undefined;
        return '/repo/.edgestore/config.json';
      }),
    },
    credentials,
    prompts: {
      readToken,
      confirmTyped,
      confirm: vi.fn(async () => false),
      select: vi.fn(async () => {
        throw new Error('Unexpected select prompt');
      }),
      text: vi.fn(async () => {
        throw new Error('Unexpected text prompt');
      }),
    },
    sdkFactory: vi.fn(() => sdk),
    openUrl,
    runCommand,
  };

  return {
    runtime,
    abortController,
    globalConfig,
    repoConfig,
    readRepoConfig,
    credentials,
    setCredential,
    readToken,
    confirmTyped,
    createAccountToken,
    createUserToken,
    availableAccounts,
    listAccounts,
    accountLeave,
    memberList,
    memberUpdate,
    memberRemove,
    invitationList,
    invitationCreate,
    openUrl,
    runCommand,
    invitationRevoke,
    invitationResend,
    listAccountTokens,
    revokeToken,
    createBucket,
    getBucket,
    deleteBucket,
    emptyBucket,
    latestEmptyJob,
    getEmptyJob,
    retryEmptyJob,
    generateAccessUrls,
    lookupFile,
    deleteFiles,
    uploadFile,
    uploadRequest,
    uploadCancel,
    uploadGet,
    completeMultipart,
    projectCreate: createProject,
    createProject,
    listProjectKeys,
    createProjectKey,
    revokeProjectKey,
    deleteProject,
    stdout: () => Buffer.concat(stdoutChunks).toString('utf8'),
    stderr: () => Buffer.concat(stderrChunks).toString('utf8'),
  };
}
