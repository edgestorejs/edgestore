'use client';

import { uploadFromServer, uploadWithSdk } from '@/lib/actions';
import { Button, OutcomeLine, Row, Step, unwrap, useScenario } from './ui';

export function ServerUploadStep({ onUploaded }: { onUploaded: () => void }) {
  const { running, outcome, run } = useScenario();

  function upload(label: string, action: () => Promise<{ url: string }>) {
    return run(async () => {
      const { url } = await action();
      onUploaded();
      return { ok: true, text: `Uploaded ${label}.`, url };
    });
  }

  return (
    <Step
      number={8}
      title="Upload from the server"
      description={
        <>
          Server actions can upload with the router&apos;s backend client, which
          applies the bucket&apos;s input, path, and metadata, or with the
          low-level <code>@edgestore/sdk</code>.
        </>
      }
    >
      <Row>
        <Button
          disabled={running}
          onClick={() =>
            void upload('text with the backend client', async () =>
              unwrap(await uploadFromServer('text')),
            )
          }
        >
          Upload text
        </Button>
        <Button
          disabled={running}
          onClick={() =>
            void upload('a copy of a remote URL', async () =>
              unwrap(await uploadFromServer('url')),
            )
          }
        >
          Copy a remote URL
        </Button>
        <Button
          disabled={running}
          onClick={() =>
            void upload('text with the SDK', async () =>
              unwrap(await uploadWithSdk()),
            )
          }
        >
          Upload with the SDK
        </Button>
      </Row>
      <OutcomeLine outcome={outcome} />
    </Step>
  );
}
