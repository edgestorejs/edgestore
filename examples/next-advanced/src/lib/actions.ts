'use server';

import { backendClient } from '@/app/api/edgestore/[...edgestore]/route';
import { unstable_noStore } from 'next/cache';

export async function serverSideUpload(text: string) {
  unstable_noStore(); // to make sure the upload request is sent every time
  const res = await backendClient.publicFiles.upload({
    content: {
      blob: new Blob([text], { type: 'text/csv' }),
      extension: 'csv',
    },
    options: {
      temporary: true,
    },
    ctx: {
      userId: '123',
      userRole: 'admin',
    },
    input: {
      type: 'post',
    },
  });
  console.log(res);
}
