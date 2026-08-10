'use client';

import { setDemoUserAction } from '@/lib/actions';
import {
  demoUsers,
  type ActionResult,
  type DemoUser,
  type FilePage,
} from '@/lib/demo';
import { useEdgeStore } from '@/lib/edgestore';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { BackendPlayground } from './backend-playground';
import { FileBrowser } from './file-browser';
import { UploadPlayground } from './upload-playground';

export function DemoApp({
  initialUser,
  initialPage,
}: {
  initialUser: DemoUser;
  initialPage: ActionResult<FilePage>;
}) {
  const router = useRouter();
  const { reset, state } = useEdgeStore();
  const [user, setUser] = useState(initialUser);
  const [refreshToken, setRefreshToken] = useState(0);
  const [identityError, setIdentityError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function changeUser(nextUser: DemoUser) {
    setUser(nextUser);
    startTransition(async () => {
      try {
        setIdentityError(undefined);
        await setDemoUserAction(nextUser);
        await reset();
        router.refresh();
        setRefreshToken((current) => current + 1);
      } catch (error) {
        setIdentityError(
          error instanceof Error ? error.message : 'Could not refresh context.',
        );
      }
    });
  }

  return (
    <main>
      <header className="hero">
        <div>
          <p className="eyebrow">Next.js App Router · EdgeStore testbed</p>
          <h1>One example, the complete file lifecycle.</h1>
          <p className="lede">
            Upload, transform, cancel, confirm, replace, protect, search,
            delete, restore, and inspect without unrelated application code.
          </p>
        </div>
        <div className="identity-card">
          <label>
            Request identity
            <select
              value={user}
              disabled={pending}
              onChange={(event) => changeUser(event.target.value as DemoUser)}
            >
              {Object.entries(demoUsers).map(([id, profile]) => (
                <option value={id} key={id}>
                  {profile.label} · {profile.role}
                </option>
              ))}
            </select>
          </label>
          <div className="provider-state">
            <span
              className={`signal ${state.initialized ? 'ready' : state.error ? 'error' : ''}`}
            />
            {state.loading
              ? 'Initializing provider'
              : state.error
                ? 'Provider error'
                : 'Provider ready'}
          </div>
          <small>
            Changing identity refreshes the EdgeStore context and protected-file
            access token.
          </small>
          {identityError ? (
            <small className="inline-error">{identityError}</small>
          ) : null}
        </div>
      </header>

      <nav className="jump-links" aria-label="Example sections">
        <a href="#uploads">Uploads</a>
        <a href="#files">Files</a>
        <a href="#backend">Backend + SDK</a>
      </nav>

      <div className="content">
        <UploadPlayground
          onChange={() => setRefreshToken((current) => current + 1)}
        />
        <FileBrowser initialPage={initialPage} refreshToken={refreshToken} />
        <BackendPlayground
          onChange={() => setRefreshToken((current) => current + 1)}
        />
      </div>
    </main>
  );
}
