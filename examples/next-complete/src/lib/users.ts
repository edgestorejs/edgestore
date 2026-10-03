/**
 * Fake sign-in for the example. The selected user is stored in a cookie and
 * turned into the EdgeStore context, so you can test access rules without
 * setting up an auth provider.
 */
export const USER_COOKIE = 'demo-user';

export const users = {
  guest: { userId: 'guest', role: 'guest', name: 'Signed out' },
  alice: { userId: 'alice', role: 'user', name: 'Alice' },
  bob: { userId: 'bob', role: 'user', name: 'Bob' },
} as const;

export type UserId = keyof typeof users;

export type Context = {
  userId: string;
  role: 'guest' | 'user';
};

export function getUser(cookieValue: string | undefined) {
  const id: UserId =
    cookieValue && cookieValue in users ? (cookieValue as UserId) : 'guest';
  return users[id];
}
