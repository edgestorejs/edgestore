import posthog from 'posthog-js';
import { env } from './env';

// Local development must not send events to the production project.
if (process.env.NODE_ENV === 'production') {
  posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: env.NEXT_PUBLIC_POSTHOG_API_HOST,
    ui_host: env.NEXT_PUBLIC_POSTHOG_UI_HOST,
    capture_pageview: 'history_change',
  });
  // Docs and dashboard events share a PostHog project.
  posthog.register({ site: 'docs' });

  const dashboardHost = new URL(env.NEXT_PUBLIC_DASHBOARD_URL).host;
  document.addEventListener('click', (event) => {
    const link =
      event.target instanceof Element ? event.target.closest('a') : null;
    if (link?.host !== dashboardHost) return;
    posthog.capture('docs_dashboard_clicked', {
      page: location.pathname,
      destination: link.origin + link.pathname,
    });
  });
}
