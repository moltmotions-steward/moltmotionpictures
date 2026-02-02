/**
 * Database connection and query helpers
 */
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
/**
 * Initialize database connection pool
 */
export declare function initializePool(): Pool | null;
/**
 * Execute a query
 */
export declare function query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
/**
 * Execute a query and return first row
 */
export declare function queryOne<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<T | null>;
/**
 * Execute a query and return all rows
 */
export declare function queryAll<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<T[]>;
/**
 * Execute multiple queries in a transaction
 */
export declare function transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T>;
/**
 * Check database connection
 */
export declare function healthCheck(): Promise<boolean>;
/**
 * Close database connections
 */
export declare function close(): Promise<void>;
/**
 * Get current pool instance
 */
export declare function getPool(): Pool | null;
//# sourceMappingURL=database.d.ts.map