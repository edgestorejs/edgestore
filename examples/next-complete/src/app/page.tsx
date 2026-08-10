import { DemoApp } from '@/components/demo-app';
import { listFilesAction } from '@/lib/actions';
import { resolveDemoUser } from '@/lib/demo';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = resolveDemoUser(
    (await cookies()).get('edgestore-demo-user')?.value,
  );
  const initialPage = await listFilesAction({
    bucket: 'publicFiles',
    limit: 12,
  });

  return <DemoApp initialUser={user} initialPage={initialPage} />;
}
