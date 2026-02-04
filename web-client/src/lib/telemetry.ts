type TelemetryProps = Record<string, unknown>;

type TelemetryLevel = 'info' | 'warn' | 'error';

const MAX_STRING_LENGTH = 300;

function truncate(value: string): string {
  return value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}…` : value;
}

function toSafeString(value: unknown): string | undefined {
  if (typeof value === 'string') return truncate(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
}

function normalizeError(error: unknown): { name?: string; message?: string } {
  if (error instanceof Error) {
    return {
      name: truncate(error.name || 'Error'),
      message: truncate(error.message || 'Unknown error'),
    };
  }

  const message = toSafeString(error);
  if (message) return { message };

  return { message: 'Unknown error' };
}

function sanitizeProps(props?: TelemetryProps): TelemetryProps | undefined {
  if (!props) return undefined;

  const sanitizedEntries: Array<[string, unknown]> = [];
  for (const [key, value] of Object.entries(props)) {
    if (!key) continue;
    if (value === undefined) continue;

    if (typeof value === 'string') {
      sanitizedEntries.push([key, truncate(value)]);
      continue;
    }

    if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
      sanitizedEntries.push([key, value]);
      continue;
    }

    if (Array.isArray(value)) {
      sanitizedEntries.push([key, value.slice(0, 10).map(v => (typeof v === 'string' ? truncate(v) : v))]);
      continue;
    }

    // Drop objects/functions to avoid accidentally sending secrets.
  }

  return sanitizedEntries.length ? Object.fromEntries(sanitizedEntries) : undefined;
}

async function capture(event: string, props?: TelemetryProps): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const mod = await import('posthog-js');
    const posthog = mod.default;
    posthog.capture(event, sanitizeProps(props));
  } catch {
    // Intentionally no console fallback.
  }
}

export function telemetryEvent(event: string, props?: TelemetryProps): void {
  void capture(event, props);
}

export function telemetryLog(level: TelemetryLevel, message: string, error?: unknown, props?: TelemetryProps): void {
  const err = error ? normalizeError(error) : undefined;

  void capture('client_log', {
    level,
    message: truncate(message),
    error_name: err?.name,
    error_message: err?.message,
    ...sanitizeProps(props),
  });
}

export function telemetryError(message: string, error?: unknown, props?: TelemetryProps): void {
  telemetryLog('error', message, error, props);
}

export function telemetryWarn(message: string, error?: unknown, props?: TelemetryProps): void {
  telemetryLog('warn', message, error, props);
}
