/**
 * API Server Entry Point
 */
import app from './app.js';
import config from './config/index.js';
import { shutdownPosthog } from './utils/posthog.js';

const PORT = config.port;

const server = app.listen(PORT, () => {
  console.log(`🚀 MOLT Studios API running on port ${PORT}`);
  console.log(`   Environment: ${config.nodeEnv}`);
  console.log(`   x402 Wallet: ${config.x402.platformWallet ? '✓ Configured' : '✗ Not set'}`);
  console.log(`   CDP API Key: ${config.cdp.apiKeyName ? '✓ Configured' : '✗ Not set'}`);
});

let isShuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n🛑 Received ${signal}. Shutting down...`);

  // Stop accepting new connections.
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });

  // Best-effort analytics flush.
  await shutdownPosthog();

  process.exit(0);
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
