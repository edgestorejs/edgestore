'use client';

import { serverSideUpload } from '@/lib/actions';

export default function Page() {
  return (
    <div>
      <div>Server Side Upload</div>
      <button
        onClick={() => {
          void serverSideUpload(
            'https://files.edgestore.dev/x36t1ejdlzdao58t/myPublicFiles/_public/2023-11-release-pro-plan.jpg',
          );
        }}
      >
        Upload
      </button>
    </div>
  );
}
