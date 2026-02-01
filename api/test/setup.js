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
