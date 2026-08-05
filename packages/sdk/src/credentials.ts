/** Project-scoped credentials used by runtime API clients. */
export type ProjectCredentials = {
  /** Project access key. */
  accessKey: string;
  /** Project secret key. */
  secretKey: string;
  token?: never;
};

/** Bearer token used by management API clients. */
export type BearerCredentials = {
  /** Account- or user-owned EdgeStore management token. */
  token: string;
  accessKey?: never;
  secretKey?: never;
};

/** Credentials accepted by {@link createEdgeStoreSdk}. */
export type EdgeStoreCredentials = ProjectCredentials | BearerCredentials;

export type ClassifiedCredentials =
  | ({ kind: 'project' } & ProjectCredentials)
  | ({ kind: 'bearer' } & BearerCredentials);

export function classifyCredentials(
  credentials: EdgeStoreCredentials,
): ClassifiedCredentials {
  const values = credentials as Record<string, unknown>;
  const token = values.token;
  const accessKey = values.accessKey;
  const secretKey = values.secretKey;

  if (token !== undefined) {
    if (accessKey !== undefined || secretKey !== undefined) {
      throw new TypeError(
        'EdgeStore credentials cannot contain both a Bearer token and project keys.',
      );
    }
    assertCredential(token, 'token');
    return { kind: 'bearer', token };
  }

  assertCredential(accessKey, 'accessKey');
  assertCredential(secretKey, 'secretKey');
  return { kind: 'project', accessKey, secretKey };
}

export function getAuthorizationHeader(
  credentials: ClassifiedCredentials,
): string {
  if (credentials.kind === 'bearer') {
    return `Bearer ${credentials.token}`;
  }

  const encodedCredentials = Buffer.from(
    `${credentials.accessKey}:${credentials.secretKey}`,
    'utf8',
  ).toString('base64');

  return `Basic ${encodedCredentials}`;
}

function assertCredential(
  value: unknown,
  name: string,
): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`EdgeStore credential \`${name}\` must not be empty.`);
  }
}
