import { GalleryClient } from '@/components/gallery-client';
import { SignInToggler } from '@/components/sign-in-toggler';
import { UploadInput } from '@/components/upload-input';
import { unstable_noStore } from 'next/cache';
import { cookies } from 'next/headers';
import { backendClient } from './api/edgestore/[...edgestore]/route';

export default function Home() {
  const isSignedIn = cookies().get('signedIn')?.value === 'true';

  return (
    <div>
      <SignInToggler isSignedIn={isSignedIn} />
      <UploadInput />
      <Gallery />
    </div>
  );
}

async function Gallery() {
  unstable_noStore();
  const files = await backendClient.privateFiles.listFiles();
  return <GalleryClient files={files.data} />;
}
