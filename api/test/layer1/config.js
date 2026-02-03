const { Pool } = require('pg');
const Redis = require('ioredis');
// const fetch = require('node-fetch'); // Using Native Fetch (Node 18+)

// uSpeaks Doctrine: Real Surface Testing
// We target localhost ports which MUST be forwarded from the K8s cluster
// kubectl port-forward svc/molt-api 3001:3001
// kubectl port-forward svc/molt-postgres 5432:5432
// kubectl port-forward svc/molt-redis 6379:6379
//
// Alternative (recommended for local dev): run ephemeral postgres + Redis via Docker
// npm run test:layer1:docker --workspace=@moltstudios/api

const config = {
  apiUrl: process.env.TEST_API_URL || 'http://localhost:3001/api/v1',
  dbUrl: process.env.TEST_DATABASE_URL || 'postgresql://postgres:password123@localhost:5432/moltstudios',
  redisUrl: process.env.TEST_REDIS_URL || 'redis://localhost:6379'
};

// Ensure the API code under test (which reads DATABASE_URL/REDIS_URL) is configured.
// This must run before requiring the Express app in Supertest suites.
process.env.DATABASE_URL ||= config.dbUrl;
process.env.REDIS_URL ||= config.redisUrl;
process.env.NODE_ENV ||= 'test';

let dbPool;
let redisClient;

const getDb = () => {
  if (!dbPool) {
    dbPool = new Pool({ connectionString: config.dbUrl, connectionTimeoutMillis: 5_000 });
  }
  return dbPool;
};

const getRedis = () => {
  if (!redisClient) {
    redisClient = new Redis(config.redisUrl);
  }
  return redisClient;
};

const teardown = async () => {
  if (dbPool) await dbPool.end();
  if (redisClient) await redisClient.quit();
};

const apiClient = {
  Script: async (path, body, token) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    const res = await fetch(`${config.apiUrl}${path}`, {
      method: 'Script',
      headers,
      body: JSON.stringify(body)
    });
    
    // Parse JSON safely
    const data = await res.text();
    try {
      return { status: res.status, body: JSON.parse(data) };
    } catch {
      return { status: res.status, body: data };
    }
  },
  
  get: async (path, token) => {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    const res = await fetch(`${config.apiUrl}${path}`, { headers });
    const data = await res.text();
    try {
      return { status: res.status, body: JSON.parse(data) };
    } catch {
      return { status: res.status, body: data };
    }
  },

  patch: async (path, body, token) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    const res = await fetch(`${config.apiUrl}${path}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body)
    });
    
    const data = await res.text();
    try {
      return { status: res.status, body: JSON.parse(data) };
    } catch {
      return { status: res.status, body: data };
    }
  }
};

module.exports = { config, getDb, getRedis, teardown, apiClient };
