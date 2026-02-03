"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializePool = initializePool;
exports.query = query;
exports.queryOne = queryOne;
exports.queryAll = queryAll;
exports.transaction = transaction;
exports.healthCheck = healthCheck;
exports.close = close;
exports.getPool = getPool;
/**
 * Database connection and query helpers
 */
const pg_1 = require("pg");
const index_1 = __importDefault(require("./index"));
let pool = null;
/**
 * Initialize database connection pool
 */
function initializePool() {
    if (pool)
        return pool;
    if (!index_1.default.database.url) {
        console.warn('DATABASE_URL not set, using mock database');
        return null;
    }
    pool = new pg_1.Pool({
        connectionString: index_1.default.database.url,
        ssl: index_1.default.database.ssl,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000
    });
    pool.on('error', (err) => {
        console.error('Unexpected database error:', err);
    });
    return pool;
}
/**
 * Execute a query
 */
async function query(text, params) {
    const db = initializePool();
    if (!db) {
        throw new Error('Database not configured');
    }
    const start = Date.now();
    const result = await db.query(text, params);
    const duration = Date.now() - start;
    if (index_1.default.nodeEnv === 'development') {
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
async function queryOne(text, params) {
    const result = await query(text, params);
    return result.rows[0] || null;
}
/**
 * Execute a query and return all rows
 */
async function queryAll(text, params) {
    const result = await query(text, params);
    return result.rows;
}
/**
 * Execute multiple queries in a transaction
 */
async function transaction(callback) {
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
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}
/**
 * Sleep helper
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function isRetryable(error) {
    if (!error)
        return false;
    const dbError = error;
    if (typeof dbError.code === 'string') {
        return ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED'].includes(dbError.code);
    }
    const message = String(dbError.message || '');
    return (message.includes('Connection terminated unexpectedly') ||
        message.includes('terminating connection'));
}
/**
 * Check database connection
 */
async function healthCheck() {
    const db = initializePool();
    if (!db)
        return false;
    const maxRetries = 5;
    const baseDelayMs = 150;
    let lastError = null;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        try {
            await db.query('SELECT 1');
            return true;
        }
        catch (error) {
            lastError = error;
            const shouldRetry = attempt < maxRetries && isRetryable(error);
            if (!shouldRetry)
                break;
            await sleep(baseDelayMs * (attempt + 1));
        }
    }
    console.error('Health check failed:', lastError);
    return false;
}
/**
 * Close database connections
 */
async function close() {
    if (pool) {
        await pool.end();
        pool = null;
    }
}
/**
 * Get current pool instance
 */
function getPool() {
    return pool;
}
//# sourceMappingURL=database.js.map