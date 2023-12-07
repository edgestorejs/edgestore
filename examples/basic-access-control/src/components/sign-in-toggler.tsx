'use client';

import { fakeSignIn, fakeSignOut } from '@/lib/actions';
import { useEdgeStore } from '@/lib/edgestore';

export function SignInToggler({ isSignedIn }: { isSignedIn: boolean }) {
  const { reset } = useEdgeStore();

  return (
    <>
      {!isSignedIn ? (
        <button
          onClick={async () => {
            await fakeSignIn();
            await reset(); // re-run the createContext function from edgestore
            window.location.reload(); // hard reload
          }}
        >
          Sign In
        </button>
      ) : (
        <button
          onClick={async () => {
            await fakeSignOut();
            await reset(); // re-run the createContext function from edgestore
            window.location.reload(); // hard reload
          }}
        >
          Sign Out
        </button>
      )}
    </>
  );
}
