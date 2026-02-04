import type { NextFunction, Request, Response } from 'express';

import { capture } from '../utils/posthog';

function getPathWithoutQuery(req: Request): string {
  const url = String(req.originalUrl ?? req.url ?? '');
  const queryIndex = url.indexOf('?');
  return queryIndex === -1 ? url : url.slice(0, queryIndex);
}

export function posthogApiMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = process.hrtime.bigint();

  res.on('finish', () => {
    // Start with authenticated-only capture.
    const agentId = req.agent?.id;
    if (!agentId) return;

    const durationMs = Number(process.hrtime.bigint() - startTime) / 1_000_000;

    capture('api_request', agentId, {
      method: req.method,
      path: getPathWithoutQuery(req),
      status_code: res.statusCode,
      duration_ms: Math.round(durationMs),
      is_authenticated: true
    });
  });

  next();
}
