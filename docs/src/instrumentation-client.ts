import posthog from 'posthog-js';
import { env } from './env';

/**
 * First-touch acquisition cookie shared with dashboard.edgestore.dev, which
 * writes the same format and copies it onto the signup event. Only campaign
 * tags and domains are kept: no full URLs, paths, or query strings.
 */
const ATTRIBUTION_COOKIE = 'edgestore_attribution';
const UTM_FIELDS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
] as const;
const MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

function isEdgeStoreHost(hostname: string) {
  return hostname === 'edgestore.dev' || hostname.endsWith('.edgestore.dev');
}

function trackingAllowed() {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.doNotTrack !== '1' && !nav.globalPrivacyControl;
}

function readVisitorId() {
  const raw = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ATTRIBUTION_COOKIE}=`))
    ?.slice(ATTRIBUTION_COOKIE.length + 1);
  try {
    const id = raw
      ? (JSON.parse(decodeURIComponent(raw)) as { id?: unknown }).id
      : undefined;
    return typeof id === 'string' && /^[\w-]{8,64}$/.test(id) ? id : undefined;
  } catch {
    return undefined;
  }
}

function referringDomain() {
  try {
    const { hostname } = new URL(document.referrer);
    return isEdgeStoreHost(hostname) ? undefined : hostname;
  } catch {
    return undefined;
  }
}

/** Returns the shared visitor ID, creating the cookie on a visitor's first page load. */
function visitorId() {
  if (!trackingAllowed()) return undefined;
  const existing = readVisitorId();
  if (existing) return existing;
  const params = new URLSearchParams(location.search);
  const attribution: Record<string, string> = {
    id: crypto.randomUUID(),
    landing_host: location.hostname,
    first_seen_at: new Date().toISOString(),
  };
  for (const field of UTM_FIELDS) {
    const value = params.get(field)?.trim().slice(0, 100);
    if (value) attribution[field] = value;
  }
  const referrer = referringDomain();
  if (referrer) attribution.referring_domain = referrer;
  document.cookie = [
    `${ATTRIBUTION_COOKIE}=${encodeURIComponent(JSON.stringify(attribution))}`,
    isEdgeStoreHost(location.hostname) && 'domain=edgestore.dev',
    'path=/',
    `max-age=${MAX_AGE_SECONDS}`,
    'samesite=lax',
    location.protocol === 'https:' && 'secure',
  ]
    .filter(Boolean)
    .join('; ');
  // Browsers can refuse the cookie; only share an ID the dashboard can read.
  return readVisitorId();
}

const distinctID = visitorId();
// Local development must not send events to the production project.
const analyticsEnabled = process.env.NODE_ENV === 'production';

if (analyticsEnabled) {
  posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: env.NEXT_PUBLIC_POSTHOG_API_HOST,
    ui_host: env.NEXT_PUBLIC_POSTHOG_UI_HOST,
    capture_pageview: 'history_change',
    // The dashboard links this visitor to the account at signup.
    person_profiles: 'identified_only',
    ...(distinctID && { bootstrap: { distinctID } }),
  });
  // Docs and dashboard events share a PostHog project.
  posthog.register({ site: 'docs' });
}

const dashboardHost = new URL(env.NEXT_PUBLIC_DASHBOARD_URL).host;

function trackDashboardClick(event: MouseEvent) {
  // `auxclick` also fires for right clicks; only count middle-click opens.
  if (event.type === 'auxclick' && event.button !== 1) return;
  if (!(event.target instanceof Element)) return;
  const link = event.target.closest('a');
  if (!link?.href) return;
  const url = new URL(link.href);
  if (url.host !== dashboardHost) return;
  posthog.capture(
    'docs_dashboard_clicked',
    { page: location.pathname, destination: url.origin + url.pathname },
    // The page is about to unload.
    { transport: 'sendBeacon', send_instantly: true },
  );
}

// Like the dashboard's own browser events, honor DNT and Global Privacy Control.
if (analyticsEnabled && trackingAllowed()) {
  document.addEventListener('click', trackDashboardClick, { capture: true });
  document.addEventListener('auxclick', trackDashboardClick, { capture: true });
}
