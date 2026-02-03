/**
 * Vitest setup for API tests
 *
 * Runs before any tests and handles:
 * - Environment configuration
 * - Global test utilities
 * - Database setup/teardown hooks
 */

// Load environment variables
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });
dotenv.config(); // Fallback to .env

// Set test environment flag
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

// x402 test environment - REQUIRE explicit configuration, no hardcoded fallbacks
// Tests should fail loudly if wallet config is missing, not silently use fake values
if (!process.env.PLATFORM_WALLET_ADDRESS) {
  // Use environment variable or skip x402 tests
  console.warn('[TEST SETUP] PLATFORM_WALLET_ADDRESS not set - x402 payment tests will use mock mode');
  process.env.X402_MOCK_MODE = 'true';
}
