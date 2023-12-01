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
  return (
    <div
      style={{
        padding: '1rem',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '1rem',
      }}
    >
      {files.data.map((file) => (
        <div key={file.url}>
          <img
            src={file.url}
            alt="Image"
            style={{
              width: '100%',
              height: 'auto',
              objectFit: 'cover',
              borderRadius: '0.5rem',
            }}
          />
        </div>
      ))}
    </div>
  );
}
