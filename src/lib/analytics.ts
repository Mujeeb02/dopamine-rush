// One entry point for product analytics and error reporting.
// PostHog loads lazily and only when VITE_POSTHOG_KEY is set, so local
// development and forks send nothing.
type Props = Record<string, string | number | boolean | null | undefined>;
type Client = {
  capture: (event: string, props?: Props) => void;
  captureException: (error: unknown, props?: Props) => void;
  identify: (id: string, props?: Props) => void;
  reset: () => void;
  register: (props: Props) => void;
};

export type EventName =
  | 'landing_viewed' | 'game_started' | 'round_completed' | 'game_completed' | 'play_again_clicked'
  | 'share_clicked' | 'share_completed' | 'challenge_created' | 'challenge_opened' | 'challenge_started'
  | 'challenge_completed' | 'challenge_reshared' | 'signup_prompt_shown' | 'signup_completed'
  | 'daily_challenge_completed' | 'guest_session_started' | 'error';

const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const host = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://us.i.posthog.com';
const ATTRIBUTION_KEY = 'dopamine-attribution';
const queue: Array<(c: Client) => void> = [];
let client: Client | null = null;
let loading = false;

export function attribution(): Props {
  try { return JSON.parse(localStorage.getItem(ATTRIBUTION_KEY) || '{}'); } catch { return {}; }
}

/** First-touch attribution: kept from the very first visit that carried campaign data. */
function captureAttribution() {
  try {
    if (localStorage.getItem(ATTRIBUTION_KEY)) return;
    const url = new URL(window.location.href);
    const props: Props = { landing_path: url.pathname, referrer: document.referrer || null };
    for (const name of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'ref']) {
      const value = url.searchParams.get(name);
      if (value) props[name] = value.slice(0, 100);
    }
    localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(props));
  } catch { /* Storage can be unavailable in private browsing. */ }
}

function run(fn: (c: Client) => void) {
  if (!key) return;
  if (client) { try { fn(client); } catch { /* Analytics must never break play. */ } return; }
  queue.push(fn);
  if (loading) return;
  loading = true;
  void import('posthog-js').then(({ default: posthog }) => {
    posthog.init(key, { api_host: host, capture_pageview: false, persistence: 'localStorage+cookie', autocapture: false });
    posthog.register({ ...attribution(), app: 'web' });
    client = posthog as unknown as Client;
    queue.splice(0).forEach(run);
  }).catch(() => { loading = false; });
}

export function track(event: EventName, props: Props = {}) {
  run(c => c.capture(event, props));
  if (import.meta.env.DEV) console.debug('[analytics]', event, props);
}
export function pageview(path: string) { run(c => c.capture('$pageview', { path })); }
export function identify(userId: string | null, props: Props = {}) {
  run(c => (userId ? c.identify(userId, props) : c.reset()));
  withSentry(s => s.setUser(userId ? { id: userId } : null));
}
export function reportError(error: unknown, context: Props = {}) {
  run(c => c.captureException(error, context));
  withSentry(s => s.captureException(error, { tags: { source: String(context.source ?? 'app') }, extra: context }));
  if (import.meta.env.DEV) console.error('[error]', error, context);
}

// ── Error tracking ──
// Sentry also loads lazily, and only when VITE_SENTRY_DSN is set. Its own global
// handlers are off: every error reaches it through reportError, so nothing is sent twice.
type SentryClient = typeof import('@sentry/react');
const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const sentryQueue: Array<(s: SentryClient) => void> = [];
let sentry: SentryClient | null = null;
let sentryLoading = false;
function withSentry(fn: (s: SentryClient) => void) {
  if (!dsn) return;
  if (sentry) { try { fn(sentry); } catch { /* Reporting must never break play. */ } return; }
  sentryQueue.push(fn);
  if (sentryLoading) return;
  sentryLoading = true;
  void import('@sentry/react').then(mod => {
    mod.init({
      dsn, environment: import.meta.env.MODE, tracesSampleRate: 0,
      integrations: defaults => defaults.filter(i => i.name !== 'GlobalHandlers'),
    });
    sentry = mod;
    sentryQueue.splice(0).forEach(withSentry);
  }).catch(() => { sentryLoading = false; });
}

let started = false;
/** Call once at startup: captures attribution and wires global error handlers. */
export function startAnalytics() {
  if (started || typeof window === 'undefined') return;
  started = true;
  captureAttribution();
  window.addEventListener('error', e => reportError(e.error ?? e.message, { source: 'window' }));
  window.addEventListener('unhandledrejection', e => reportError(e.reason, { source: 'promise' }));
  window.addEventListener('dopamine:error', e => reportError(new Error('Render error'), { source: String((e as CustomEvent).detail?.source ?? 'render') }));
}
