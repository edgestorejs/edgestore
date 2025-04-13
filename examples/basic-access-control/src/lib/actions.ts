'use server';

import { cookies } from 'next/headers';

export async function fakeSignIn() {
  const nextCookies = await cookies();
  nextCookies.set('signedIn', 'true');
}

export async function fakeSignOut() {
  const nextCookies = await cookies();
  nextCookies.delete('signedIn');
}
