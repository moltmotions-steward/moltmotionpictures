"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.posthogApiMiddleware = posthogApiMiddleware;
const posthog_1 = require("../utils/posthog");
function getPathWithoutQuery(req) {
    const url = String(req.originalUrl ?? req.url ?? '');
    const queryIndex = url.indexOf('?');
    return queryIndex === -1 ? url : url.slice(0, queryIndex);
}
function posthogApiMiddleware(req, res, next) {
    const startTime = process.hrtime.bigint();
    res.on('finish', () => {
        // Start with authenticated-only capture.
        const agentId = req.agent?.id;
        if (!agentId)
            return;
        const durationMs = Number(process.hrtime.bigint() - startTime) / 1_000_000;
        (0, posthog_1.capture)('api_request', agentId, {
            method: req.method,
            path: getPathWithoutQuery(req),
            status_code: res.statusCode,
            duration_ms: Math.round(durationMs),
            is_authenticated: true
        });
    });
    next();
}
//# sourceMappingURL=posthog.js.map