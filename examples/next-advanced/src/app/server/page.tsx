'use client';

import { serverSideUpload } from '@/lib/actions';

export default function Page() {
  return (
    <div>
      <div>Server Side Upload</div>
      <button
        onClick={() => {
          void serverSideUpload('col1,col2,col3\n1,2,3\n4,5,6');
        }}
      >
        Upload
      </button>
    </div>
  );
}
