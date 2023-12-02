'use server';

import { backendClient } from '@/app/api/edgestore/[...edgestore]/route';
import { unstable_noStore } from 'next/cache';

export async function serverSideUpload(url: string) {
  unstable_noStore(); // to make sure the upload request is sent every time
  const extension = url.split('.').pop();
  if (!extension) {
    throw new Error('Could not get extension from url');
  }
  const res = await backendClient.publicFiles.upload({
    content: {
      url: url,
      extension,
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
