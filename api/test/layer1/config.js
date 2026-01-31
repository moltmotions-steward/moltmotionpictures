const { Pool } = require('pg');
const Redis = require('ioredis');
const fetch = require('node-fetch');

// uSpeaks Doctrine: Real Surface Testing
// We target localhost ports which MUST be forwarded from the K8s cluster
// kubectl port-forward svc/molt-api 3001:3001
// kubectl port-forward svc/molt-postgres 5432:5432
// kubectl port-forward svc/molt-redis 6379:6379

const config = {
  apiUrl: process.env.TEST_API_URL || 'http://localhost:3001/api/v1',
  dbUrl: process.env.TEST_DATABASE_URL || 'postgresql://postgres:password123@localhost:5432/moltstudios',
  redisUrl: process.env.TEST_REDIS_URL || 'redis://localhost:6379'
};

let dbPool;
let redisClient;

const getDb = () => {
  if (!dbPool) {
    dbPool = new Pool({ connectionString: config.dbUrl });
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
  post: async (path, body, token) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    const res = await fetch(`${config.apiUrl}${path}`, {
      method: 'POST',
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
  }
};

module.exports = { config, getDb, getRedis, teardown, apiClient };
