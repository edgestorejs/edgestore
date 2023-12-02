'use client';

import { serverSideUpload } from '@/lib/actions';

export default function Page() {
  return (
    <div>
      <div>Server Side Upload</div>
      <button
        onClick={() => {
          void serverSideUpload(
            'https://files.edgestore.dev/j26azsoyqh7n72m2/myPublicImages/_public/5db1c66f-0244-4f9f-9f69-11df82ff1b21.png',
          );
        }}
      >
        Upload
      </button>
    </div>
  );
}
