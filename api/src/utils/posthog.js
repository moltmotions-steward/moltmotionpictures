"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.capture = capture;
exports.shutdownPosthog = shutdownPosthog;
const posthog_node_1 = require("posthog-node");
const config_1 = __importDefault(require("../config"));
let client = null;
function getClient() {
    if (config_1.default.posthog.disabled)
        return null;
    const apiKey = config_1.default.posthog.apiKey;
    if (!apiKey)
        return null;
    if (!client) {
        client = new posthog_node_1.PostHog(apiKey, {
            host: config_1.default.posthog.host,
            flushAt: config_1.default.posthog.flushAt,
            flushInterval: config_1.default.posthog.flushIntervalMs
        });
    }
    return client;
}
function sanitizeProperties(properties) {
    const sanitized = {};
    for (const [key, value] of Object.entries(properties)) {
        if (value === undefined)
            continue;
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
function capture(event, distinctId, properties = {}) {
    const posthog = getClient();
    if (!posthog)
        return;
    try {
        posthog.capture({
            event,
            distinctId,
            properties: sanitizeProperties(properties)
        });
    }
    catch {
        // Never block or fail API requests due to analytics.
    }
}
async function shutdownPosthog() {
    if (!client)
        return;
    const posthog = client;
    client = null;
    try {
        const shutdownAsync = posthog.shutdownAsync;
        if (typeof shutdownAsync === 'function') {
            await shutdownAsync.call(posthog);
            return;
        }
        const shutdown = posthog.shutdown;
        if (typeof shutdown === 'function') {
            await shutdown.call(posthog);
        }
    }
    catch {
        // Best-effort flush on shutdown.
    }
}
//# sourceMappingURL=posthog.js.map