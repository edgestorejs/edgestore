export const bucketNames = [
  'publicFiles',
  'publicImages',
  'privateImages',
] as const;

export type BucketName = (typeof bucketNames)[number];

export const categories = ['avatars', 'posts', 'tests'] as const;

export type Category = (typeof categories)[number];

export const demoUsers = {
  guest: { userId: 'guest', role: 'guest', label: 'Guest' },
  alice: { userId: 'alice', role: 'user', label: 'Alice' },
  bob: { userId: 'bob', role: 'user', label: 'Bob' },
  admin: { userId: 'admin', role: 'admin', label: 'Admin' },
} as const;

export type DemoUser = keyof typeof demoUsers;
export type DemoContext = Pick<(typeof demoUsers)[DemoUser], 'userId' | 'role'>;

export function resolveDemoUser(value?: string): DemoUser {
  return value && value in demoUsers ? (value as DemoUser) : 'guest';
}

export type SerializableError = {
  name: string;
  message: string;
  details?: unknown;
};

export type FileItem = {
  id: string;
  key: string;
  url: string;
  thumbnailUrl: string | null;
  name: string;
  sizeBytes: number;
  mimeType: string | null;
  state: string;
  temporary: boolean;
  uploadedAt: Date;
  updatedAt: Date;
  path: Record<string, string>;
  metadata: Record<string, string>;
};

export type FilePage = {
  items: FileItem[];
  limit: number;
  nextCursor: string | null;
  hasMore: boolean;
};

export type ActionResult<T> =
  { ok: true; data: T } | { ok: false; error: SerializableError };
