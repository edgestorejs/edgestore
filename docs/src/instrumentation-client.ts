import posthog from 'posthog-js';
import { env } from './env';

posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY, {
  api_host: env.NEXT_PUBLIC_POSTHOG_API_HOST,
  ui_host: env.NEXT_PUBLIC_POSTHOG_UI_HOST,
  capture_pageview: 'history_change',
});
