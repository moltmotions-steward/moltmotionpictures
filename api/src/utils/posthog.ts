import { PostHog } from 'posthog-node';

import config from '../config';

type CaptureProperties = Record<string, string | number | boolean | null>;

let client: PostHog | null = null;

function getClient(): PostHog | null {
  if (config.posthog.disabled) return null;

  const apiKey = config.posthog.apiKey;
  if (!apiKey) return null;

  if (!client) {
    client = new PostHog(apiKey, {
      host: config.posthog.host,
      flushAt: config.posthog.flushAt,
      flushInterval: config.posthog.flushIntervalMs
    });
  }

  return client;
}

function sanitizeProperties(properties: Record<string, unknown>): CaptureProperties {
  const sanitized: CaptureProperties = {};

  for (const [key, value] of Object.entries(properties)) {
    if (value === undefined) continue;

    if (value === null) {
      sanitized[key] = null;
      continue;
    }

    if (typeof value === 'string') {
      sanitized[key] = value.length > 300 ? value.slice(0, 300) : value;
      continue;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = value;
      continue;
    }

    // Drop non-primitive values to avoid accidental PII/secrets.
  }

  return sanitized;
}

export function capture(event: string, distinctId: string, properties: Record<string, unknown> = {}): void {
  const posthog = getClient();
  if (!posthog) return;

  try {
    posthog.capture({
      event,
      distinctId,
      properties: sanitizeProperties(properties)
    });
  } catch {
    // Never block or fail API requests due to analytics.
  }
}

export async function shutdownPosthog(): Promise<void> {
  if (!client) return;

  const posthog = client;
  client = null;

  try {
    const shutdownAsync = (posthog as unknown as { shutdownAsync?: () => Promise<void> }).shutdownAsync;
    if (typeof shutdownAsync === 'function') {
      await shutdownAsync.call(posthog);
      return;
    }

    const shutdown = (posthog as unknown as { shutdown?: () => void | Promise<void> }).shutdown;
    if (typeof shutdown === 'function') {
      await shutdown.call(posthog);
    }
  } catch {
    // Best-effort flush on shutdown.
  }
}
