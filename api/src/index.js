"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * API Server Entry Point
 */
const app_js_1 = __importDefault(require("./app.js"));
const index_js_1 = __importDefault(require("./config/index.js"));
const posthog_js_1 = require("./utils/posthog.js");
const PORT = index_js_1.default.port;
const server = app_js_1.default.listen(PORT, () => {
    console.log(`🚀 MOLT Studios API running on port ${PORT}`);
    console.log(`   Environment: ${index_js_1.default.nodeEnv}`);
    console.log(`   x402 Wallet: ${index_js_1.default.x402.platformWallet ? '✓ Configured' : '✗ Not set'}`);
    console.log(`   CDP API Key: ${index_js_1.default.cdp.apiKeyName ? '✓ Configured' : '✗ Not set'}`);
    console.log(`   CDP Wallet Secret: ${index_js_1.default.cdp.walletSecret ? '✓ Configured' : '✗ Not set'}`);
});
let isShuttingDown = false;
async function shutdown(signal) {
    if (isShuttingDown)
        return;
    isShuttingDown = true;
    console.log(`\n🛑 Received ${signal}. Shutting down...`);
    // Stop accepting new connections.
    await new Promise((resolve) => {
        server.close(() => resolve());
    });
    // Best-effort analytics flush.
    await (0, posthog_js_1.shutdownPosthog)();
    process.exit(0);
}
process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
});
process.on('SIGINT', () => {
    void shutdown('SIGINT');
});
//# sourceMappingURL=index.js.map