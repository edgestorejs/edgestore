import { GalleryClient } from '@/components/gallery-client';
import { SignInToggler } from '@/components/sign-in-toggler';
import { UploadInput } from '@/components/upload-input';
import { unstable_noStore } from 'next/cache';
import { cookies } from 'next/headers';
import { backendClient } from './api/edgestore/[...edgestore]/route';

export default async function Home() {
  const isSignedIn = (await cookies()).get('signedIn')?.value === 'true';

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
  const files = await backendClient.privateImages.listFiles();
  return <GalleryClient files={files.data} />;
}
