'use client';

import AvatarBlock from '@/components/upload/blocks/avatar-block';
import FileFieldBlock from '@/components/upload/blocks/file-field-block';
import UploadButtonBlock from '@/components/upload/blocks/upload-button-block';

export function UploadComponentsDemo() {
  return (
    <figure className="not-prose my-9">
      <div className="grid grid-cols-1 gap-8 rounded-xl border bg-muted/30 p-4 sm:p-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-6 lg:p-10">
        <div className="flex min-w-0 flex-col justify-center gap-7 lg:border-r lg:pr-6">
          <div>
            <div className="mb-3 text-sm font-medium">Avatar uploader</div>
            <AvatarBlock />
          </div>
          <div>
            <div className="mb-3 text-sm font-medium">Upload button</div>
            <UploadButtonBlock />
          </div>
        </div>
        <div className="flex min-w-0 flex-col justify-center">
          <div className="mb-5 text-sm font-medium">File field</div>
          <div className="rounded-xl border bg-background p-3 shadow-sm sm:p-5">
            <div className="mb-1 text-base font-semibold">Join the team</div>
            <div className="mb-6 text-sm text-muted-foreground">
              Send us a little about yourself.
            </div>
            <div className="mb-2 text-sm font-medium">Name</div>
            <div className="mb-4 rounded-md border px-3 py-2 text-sm text-muted-foreground">
              Alex Morgan
            </div>
            <div className="[&>div]:p-0">
              <FileFieldBlock />
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-sm leading-6 text-muted-foreground">
        Try the components. Uploads are simulated; your files stay in your
        browser.
      </figcaption>
    </figure>
  );
}
