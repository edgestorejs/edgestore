import { LangfuseSpanProcessor } from '@langfuse/otel';
import { LangfuseVercelAiSdkIntegration } from '@langfuse/vercel-ai-sdk';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { registerTelemetry } from 'ai';
import { env } from './env';

export const langfuseSpanProcessor = new LangfuseSpanProcessor({
  environment: env.VERCEL_ENV ?? 'local',
});

const sdk = new NodeSDK({
  spanProcessors: [langfuseSpanProcessor],
});

export function register() {
  sdk.start();
  registerTelemetry(new LangfuseVercelAiSdkIntegration());
}
