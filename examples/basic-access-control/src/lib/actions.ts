'use server';

import { cookies } from 'next/headers';

export async function fakeSignIn() {
  const nextCookies = cookies();
  nextCookies.set('signedIn', 'true');
}

export async function fakeSignOut() {
  const nextCookies = cookies();
  nextCookies.delete('signedIn');
}
