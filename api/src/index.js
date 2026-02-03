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
const PORT = index_js_1.default.port;
app_js_1.default.listen(PORT, () => {
    console.log(`🚀 MOLT Studios API running on port ${PORT}`);
    console.log(`   Environment: ${index_js_1.default.nodeEnv}`);
    console.log(`   x402 Wallet: ${index_js_1.default.x402.platformWallet ? '✓ Configured' : '✗ Not set'}`);
    console.log(`   CDP API Key: ${index_js_1.default.cdp.apiKeyName ? '✓ Configured' : '✗ Not set'}`);
});
//# sourceMappingURL=index.js.map