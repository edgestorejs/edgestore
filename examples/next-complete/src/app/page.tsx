import { Playground } from '@/components/playground';
import { getUser, USER_COOKIE } from '@/lib/users';
import { cookies } from 'next/headers';

export default async function Home() {
  const { userId } = getUser((await cookies()).get(USER_COOKIE)?.value);
  const hasKeys = Boolean(
    (process.env.EDGESTORE_ACCESS_KEY ?? process.env.EDGE_STORE_ACCESS_KEY) &&
    (process.env.EDGESTORE_SECRET_KEY ?? process.env.EDGE_STORE_SECRET_KEY),
  );

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16">
      <header className="py-10">
        <h1 className="text-3xl font-bold tracking-tight">
          EdgeStore complete example
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Work through the steps from top to bottom. Each one runs a single
          EdgeStore feature and tells you whether it behaved as expected. The
          buckets are defined in <code>src/lib/edgestore-server.ts</code>, and
          each step&apos;s code is in <code>src/components</code>.
        </p>
      </header>
      {hasKeys ? <Playground initialUser={userId} /> : <SetupNotice />}
    </main>
  );
}

function SetupNotice() {
  return (
    <section className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm dark:border-amber-800 dark:bg-amber-950">
      <h2 className="text-lg font-semibold">Add your EdgeStore keys</h2>
      <p className="mt-2">
        Copy <code>.env.example</code> to <code>.env.local</code>, paste the
        access key and secret key from the{' '}
        <a className="underline" href="https://dashboard.edgestore.dev">
          EdgeStore dashboard
        </a>
        , and restart the dev server.
      </p>
    </section>
  );
}
