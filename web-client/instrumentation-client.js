import posthog from 'posthog-js';

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

if (typeof window !== 'undefined' && posthogKey && posthogHost) {
  posthog.init(posthogKey, {
    defaults: '2025-11-30',
    api_host: posthogHost,
  });
}
