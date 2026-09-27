'use client';

import { switchUser } from '@/lib/actions';
import { useEdgeStore } from '@/lib/edgestore';
import { users, type UserId } from '@/lib/users';
import { useState, useTransition } from 'react';
import {
  ImageStep,
  ReplaceStep,
  TemporaryStep,
  TransformStep,
  UploadFileStep,
  ValidationStep,
} from './client-uploads';
import { FileListStep } from './file-list';
import { ServerUploadStep } from './server-uploads';
import { Button, Row } from './ui';

export function Playground({ initialUser }: { initialUser: UserId }) {
  const { reset, state } = useEdgeStore();
  const [user, setUser] = useState(initialUser);
  const [switching, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  // Bumped after every upload so the file list in step 7 reloads.
  const [version, setVersion] = useState(0);
  const onUploaded = () => setVersion((v) => v + 1);

  function changeUser(next: UserId) {
    startTransition(async () => {
      try {
        await switchUser(next);
        setUser(next);
        // Re-runs createContext so uploads and protected files use the new user.
        await reset();
        setError(undefined);
      } catch (error) {
        setError(error instanceof Error ? error.message : String(error));
      }
      onUploaded();
    });
  }

  return (
    <>
      <div className="sticky top-0 z-10 -mx-4 border-b border-zinc-200 bg-zinc-50/90 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <Row>
          <span className="text-sm font-medium">Acting as</span>
          {(Object.keys(users) as UserId[]).map((id) => (
            <Button
              key={id}
              variant={id === user ? 'primary' : 'secondary'}
              disabled={switching}
              onClick={() => changeUser(id)}
            >
              {users[id].name}
            </Button>
          ))}
          {error || state.error ? (
            <span className="text-sm text-red-700 dark:text-red-400">
              EdgeStore failed to initialize{error ? `: ${error}` : ''}. Check
              your keys and the server logs.
            </span>
          ) : null}
        </Row>
      </div>

      <div className="mt-6 space-y-4">
        <UploadFileStep onUploaded={onUploaded} />
        <ValidationStep />
        <TemporaryStep onUploaded={onUploaded} />
        <ReplaceStep onUploaded={onUploaded} />
        <TransformStep onUploaded={onUploaded} />
        <ImageStep onUploaded={onUploaded} />
        <FileListStep version={version} />
        <ServerUploadStep onUploaded={onUploaded} />
      </div>
    </>
  );
}
