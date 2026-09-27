'use client';

import { useEdgeStore } from '@/lib/edgestore';
import {
  EdgeStoreApiClientError,
  UploadAbortedError,
} from '@edgestore/react/errors';
import { formatFileSize } from '@edgestore/react/utils';
import { useRef, useState } from 'react';
import { Button, OutcomeLine, Row, Step, textFile, useScenario } from './ui';

const MiB = 1024 * 1024;

export function UploadFileStep({ onUploaded }: { onUploaded: () => void }) {
  const { edgestore } = useEdgeStore();
  const { running, outcome, run } = useScenario();
  const [file, setFile] = useState<File>();
  const [progress, setProgress] = useState(0);
  const controller = useRef<AbortController>(undefined);

  function upload(file: File) {
    return run(async () => {
      controller.current = new AbortController();
      setProgress(0);
      try {
        const res = await edgestore.publicFiles.upload({
          file,
          input: { label: 'browser upload' },
          signal: controller.current.signal,
          onProgressChange: setProgress,
        });
        onUploaded();
        return { ok: true, text: `Uploaded ${res.size} bytes.`, url: res.url };
      } catch (error) {
        if (error instanceof UploadAbortedError) {
          return { ok: true, text: 'Upload cancelled.' };
        }
        throw error;
      }
    });
  }

  return (
    <Step
      number={1}
      title="Upload a file"
      description={
        <>
          Uploads to <code>publicFiles</code> with progress and cancellation.
          Files over 100 MiB switch to multipart uploads automatically. Try it
          while signed out to see <code>beforeUpload</code> reject the request.
        </>
      }
    >
      <input
        type="file"
        className="block text-sm"
        onChange={(event) => setFile(event.target.files?.[0])}
      />
      <Row>
        <Button
          disabled={!file || running}
          onClick={() => file && void upload(file)}
        >
          Upload
        </Button>
        <Button
          variant="secondary"
          disabled={running}
          onClick={() => {
            const big = new File([new Uint8Array(120 * MiB)], 'large.bin');
            setFile(big);
            void upload(big);
          }}
        >
          Upload a generated 120 MiB file
        </Button>
        <Button
          variant="secondary"
          disabled={!running}
          onClick={() => controller.current?.abort()}
        >
          Cancel
        </Button>
      </Row>
      {file ? (
        <div className="flex items-center gap-3 text-sm">
          <progress className="w-full" value={progress} max={100} />
          <span className="shrink-0 tabular-nums">
            {progress}% of {formatFileSize(file.size)}
          </span>
        </div>
      ) : null}
      <OutcomeLine outcome={outcome} />
    </Step>
  );
}

export function ValidationStep() {
  const { edgestore } = useEdgeStore();
  const { running, outcome, run } = useScenario();

  function expectRejected(
    file: File,
    code: 'FILE_TOO_LARGE' | 'MIME_TYPE_NOT_ALLOWED',
  ) {
    return run(async () => {
      try {
        await edgestore.publicImages.upload({ file });
      } catch (error) {
        // Any other error, such as a network failure, fails the scenario.
        if (
          !(error instanceof EdgeStoreApiClientError) ||
          error.data.code !== code
        ) {
          throw error;
        }
        return { ok: true, text: `Rejected with ${code}: ${error.message}` };
      }
      return { ok: false, text: 'The upload should have been rejected.' };
    });
  }

  return (
    <Step
      number={2}
      title="Validation"
      description={
        <>
          <code>publicImages</code> only accepts images up to 2 MiB. Both
          uploads below should fail.
        </>
      }
    >
      <Row>
        <Button
          disabled={running}
          onClick={() =>
            void expectRejected(
              new File([new Uint8Array(3 * MiB)], 'too-large.png', {
                type: 'image/png',
              }),
              'FILE_TOO_LARGE',
            )
          }
        >
          Upload a 3 MiB image
        </Button>
        <Button
          disabled={running}
          onClick={() =>
            void expectRejected(
              textFile('not-an-image.txt', 'hello'),
              'MIME_TYPE_NOT_ALLOWED',
            )
          }
        >
          Upload a text file
        </Button>
      </Row>
      <OutcomeLine outcome={outcome} />
    </Step>
  );
}

export function TemporaryStep({ onUploaded }: { onUploaded: () => void }) {
  const { edgestore } = useEdgeStore();
  const { running, outcome, run } = useScenario();
  const [url, setUrl] = useState<string>();

  return (
    <Step
      number={3}
      title="Temporary files"
      description="Temporary files are deleted after 24 hours unless you confirm them, for example when a form is submitted."
    >
      <Row>
        <Button
          disabled={running}
          onClick={() =>
            void run(async () => {
              const res = await edgestore.publicFiles.upload({
                file: textFile('draft.txt', 'A draft attachment'),
                input: { label: 'temporary' },
                options: { temporary: true },
              });
              setUrl(res.url);
              onUploaded();
              return { ok: true, text: 'Uploaded as temporary.', url: res.url };
            })
          }
        >
          Upload temporary file
        </Button>
        <Button
          variant="secondary"
          disabled={!url || running}
          onClick={() =>
            void run(async () => {
              await edgestore.publicFiles.confirm({ url: url! });
              setUrl(undefined);
              onUploaded();
              return { ok: true, text: 'Confirmed. It will not expire.' };
            })
          }
        >
          Confirm it
        </Button>
      </Row>
      <OutcomeLine outcome={outcome} />
    </Step>
  );
}

export function ReplaceStep({ onUploaded }: { onUploaded: () => void }) {
  const { edgestore } = useEdgeStore();
  const { running, outcome, run } = useScenario();
  const [url, setUrl] = useState<string>();

  function uploadVersion(version: number) {
    return run(async () => {
      const res = await edgestore.publicFiles.upload({
        file: textFile('notes.txt', `Version ${version}`),
        input: { label: 'replace' },
        options: { replaceTargetUrl: version > 1 ? url : undefined },
      });
      setUrl(res.url);
      onUploaded();
      return { ok: true, text: `Uploaded version ${version}.`, url: res.url };
    });
  }

  return (
    <Step
      number={4}
      title="Replace a file"
      description={
        <>
          <code>replaceTargetUrl</code> uploads a new version and deletes the
          old file once the upload finishes.
        </>
      }
    >
      <Row>
        <Button disabled={running} onClick={() => void uploadVersion(1)}>
          Upload version 1
        </Button>
        <Button
          variant="secondary"
          disabled={!url || running}
          onClick={() => void uploadVersion(2)}
        >
          Replace with version 2
        </Button>
      </Row>
      <OutcomeLine outcome={outcome} />
    </Step>
  );
}

export function TransformStep({ onUploaded }: { onUploaded: () => void }) {
  const { edgestore } = useEdgeStore();
  const { running, outcome, run } = useScenario();

  return (
    <Step
      number={5}
      title="Transform and rename"
      description={
        <>
          <code>transform</code> changes the file in the browser before it is
          validated and uploaded. <code>manualFileName</code> sets its name.
        </>
      }
    >
      <Row>
        <Button
          disabled={running}
          onClick={() =>
            void run(async () => {
              const res = await edgestore.publicFiles.upload({
                file: textFile('quiet.txt', 'this text was lowercase'),
                input: { label: 'transform' },
                options: {
                  manualFileName: 'loud.txt',
                  transform: async ({ file }) =>
                    new Blob([(await file.text()).toUpperCase()], {
                      type: file.type,
                    }),
                },
              });
              onUploaded();
              return {
                ok: true,
                text: 'Uploaded uppercase text as loud.txt.',
                url: res.url,
              };
            })
          }
        >
          Upload quiet.txt as loud.txt
        </Button>
      </Row>
      <OutcomeLine outcome={outcome} />
    </Step>
  );
}

export function ImageStep({ onUploaded }: { onUploaded: () => void }) {
  const { edgestore } = useEdgeStore();
  const { running, outcome, run } = useScenario();
  const [file, setFile] = useState<File>();

  function upload(bucket: 'publicImages' | 'privateImages') {
    return run(async () => {
      const res = await edgestore[bucket].upload({ file: file! });
      onUploaded();
      return {
        ok: true,
        text: res.thumbnailUrl
          ? `Uploaded to ${bucket} with a thumbnail.`
          : `Uploaded to ${bucket}. Images under 200px get no thumbnail.`,
        url: res.url,
      };
    });
  }

  return (
    <Step
      number={6}
      title="Images and access control"
      description={
        <>
          Image buckets create thumbnails. <code>privateImages</code> uses{' '}
          <code>accessControl</code>, so only the owner can load its files.
          Upload a private image as Alice, then switch to Bob and look at it in
          step 7.
        </>
      }
    >
      <input
        type="file"
        accept="image/*"
        className="block text-sm"
        onChange={(event) => setFile(event.target.files?.[0])}
      />
      <Row>
        <Button
          disabled={!file || running}
          onClick={() => void upload('publicImages')}
        >
          Upload public image
        </Button>
        <Button
          disabled={!file || running}
          onClick={() => void upload('privateImages')}
        >
          Upload private image
        </Button>
      </Row>
      <OutcomeLine outcome={outcome} />
    </Step>
  );
}
