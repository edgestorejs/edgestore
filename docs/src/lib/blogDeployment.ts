export function getBlogDeployment({
  nodeEnv,
  vercelEnv,
  previewUrl,
}: {
  nodeEnv?: string;
  vercelEnv?: string;
  previewUrl?: string;
}) {
  const isPreview = vercelEnv === 'preview';

  return {
    showDrafts: nodeEnv === 'development' || isPreview,
    metadataBase:
      isPreview && previewUrl ? new URL(`https://${previewUrl}`) : undefined,
  };
}
