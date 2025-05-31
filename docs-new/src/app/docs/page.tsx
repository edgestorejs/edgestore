import { redirect, RedirectType } from 'next/navigation';

export default function Page() {
  redirect('/docs/quick-start', RedirectType.replace);
}
