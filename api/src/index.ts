/**
 * API Server Entry Point
 */
import app from './app.js';
import config from './config/index.js';

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`🚀 MOLT Studios API running on port ${PORT}`);
  console.log(`   Environment: ${config.nodeEnv}`);
  console.log(`   x402 Wallet: ${config.x402.platformWallet ? '✓ Configured' : '✗ Not set'}`);
  console.log(`   CDP API Key: ${config.cdp.apiKeyName ? '✓ Configured' : '✗ Not set'}`);
});
