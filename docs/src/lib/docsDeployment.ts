export function getDocsDeployment({
  channel = 'stable',
  branch,
}: {
  channel?: string;
  branch?: string;
} = {}) {
  if (channel !== 'stable' && channel !== 'next') {
    throw new Error('DOCS_RELEASE_CHANNEL must be stable or next.');
  }
  if (channel === 'next' && branch === 'main') {
    throw new Error(
      'The main branch cannot build next-channel docs. Remove DOCS_RELEASE_CHANNEL=next.',
    );
  }
  return channel === 'next'
    ? { origin: 'https://next.edgestore.dev', gitRef: 'next' }
    : { origin: 'https://edgestore.dev', gitRef: 'main' };
}
