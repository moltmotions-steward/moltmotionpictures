/**
 * Database connection and query helpers
 */
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import config from './index';

let pool: Pool | null = null;

/**
 * Initialize database connection pool
 */
export function initializePool(): Pool | null {
  if (pool) return pool;
  
  if (!config.database.url) {
    console.warn('DATABASE_URL not set, using mock database');
    return null;
  }
  
  pool = new Pool({
    connectionString: config.database.url,
    ssl: config.database.ssl,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000
  });
  
  pool.on('error', (err: Error) => {
    console.error('Unexpected database error:', err);
  });
  
  return pool;
}

/**
 * Execute a query
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const db = initializePool();
  
  if (!db) {
    throw new Error('Database not configured');
  }
  
  const start = Date.now();
  const result = await db.query<T>(text, params);
  const duration = Date.now() - start;
  
  if (config.nodeEnv === 'development') {
    console.log('Query executed', { 
      text: text.substring(0, 50), 
      duration, 
      rows: result.rowCount 
    });
  }
  
  return result;
}

/**
 * Execute a query and return first row
 */
export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const result = await query<T>(text, params);
  return result.rows[0] || null;
}

/**
 * Execute a query and return all rows
 */
export async function queryAll<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await query<T>(text, params);
  return result.rows;
}

/**
 * Execute multiple queries in a transaction
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const db = initializePool();
  
  if (!db) {
    throw new Error('Database not configured');
  }
  
  const client = await db.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if error is retryable
 */
interface DatabaseError extends Error {
  code?: string;
}

function isRetryable(error: unknown): boolean {
  if (!error) return false;
  
  const dbError = error as DatabaseError;
  if (typeof dbError.code === 'string') {
    return ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED'].includes(dbError.code);
  }

  const message = String(dbError.message || '');
  return (
    message.includes('Connection terminated unexpectedly') ||
    message.includes('terminating connection')
  );
}

/**
 * Check database connection
 */
export async function healthCheck(): Promise<boolean> {
  const db = initializePool();
  if (!db) return false;

  const maxRetries = 5;
  const baseDelayMs = 150;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      await db.query('SELECT 1');
      return true;
    } catch (error) {
      lastError = error;
      const shouldRetry = attempt < maxRetries && isRetryable(error);
      if (!shouldRetry) break;
      await sleep(baseDelayMs * (attempt + 1));
    }
  }

  console.error('Health check failed:', lastError);
  return false;
}

/**
 * Close database connections
 */
export async function close(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Get current pool instance
 */
export function getPool(): Pool | null {
  return pool;
}
