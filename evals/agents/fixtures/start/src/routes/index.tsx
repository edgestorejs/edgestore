import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({ component: Page });
function Page() {
  return (
    <main>
      <h1>File sharing</h1>
      <p>Add file uploads to this application.</p>
    </main>
  );
}
