/**
 * MemoryStore
 * In-memory storage backend for rate limiting
 * 
 * Uses sliding window log algorithm - stores timestamps of each request
 * 
 * @author Moltbook <hello@moltbook.com>
 * @license MIT
 */

/**
 * In-memory store for rate limiting
 * 
 * Data structure:
 * Map<key, Array<{ timestamp: number, cost: number }>>
 * 
 * @example
 * const store = new MemoryStore();
 */
class MemoryStore {
  /**
   * @param {Object} options - Store options
   * @param {number} options.maxKeys - Max number of keys to store (default: 100,000)
   */
  constructor(options = {}) {
    /**
     * @type {Map<string, Array<{timestamp: number, cost: number}>>}
     */
    this.data = new Map();
    this.maxKeys = options.maxKeys || 100000;

    // Periodic cleanup every 5 minutes
    this._cleanupInterval = setInterval(() => {
      this._globalCleanup();
    }, 5 * 60 * 1000);

    // Prevent interval from keeping process alive
    if (this._cleanupInterval.unref) {
      this._cleanupInterval.unref();
    }
  }

  /**
   * Add a request entry
   * 
   * @param {string} key - Storage key
   * @param {number} timestamp - Request timestamp (ms)
   * @param {number} cost - Cost of request (default: 1)
   * @returns {Promise<void>}
   */
  async add(key, timestamp, cost = 1) {
    if (!this.data.has(key)) {
      // Check limits before adding new key
      if (this.data.size >= this.maxKeys) {
        // Evict oldest key (FIFO)
        // Map iterators yield in insertion order, so first key is oldest
        const oldestKey = this.data.keys().next().value;
        this.data.delete(oldestKey);
      }
      this.data.set(key, []);
    }
    
    const entries = this.data.get(key);
    entries.push({ timestamp, cost });
  }

  /**
   * Count requests within window
   * 
   * @param {string} key - Storage key
   * @param {number} windowStart - Start of window (ms)
   * @returns {Promise<number>} Count of requests
   */
  async count(key, windowStart) {
    const entries = this.data.get(key);
    
    if (!entries || entries.length === 0) {
      return 0;
    }

    return entries
      .filter(entry => entry.timestamp >= windowStart)
      .reduce((sum, entry) => sum + entry.cost, 0);
  }

  /**
   * Get oldest timestamp within window
   * 
   * @param {string} key - Storage key
   * @param {number} windowStart - Start of window (ms)
   * @returns {Promise<number|null>} Oldest timestamp or null
   */
  async oldest(key, windowStart) {
    const entries = this.data.get(key);
    
    if (!entries || entries.length === 0) {
      return null;
    }

    const validEntries = entries.filter(entry => entry.timestamp >= windowStart);
    
    if (validEntries.length === 0) {
      return null;
    }

    return Math.min(...validEntries.map(e => e.timestamp));
  }

  /**
   * Cleanup old entries outside window
   * 
   * @param {string} key - Storage key
   * @param {number} windowStart - Start of window (ms)
   * @returns {Promise<void>}
   */
  async cleanup(key, windowStart) {
    const entries = this.data.get(key);
    
    if (!entries) {
      return;
    }

    const filtered = entries.filter(entry => entry.timestamp >= windowStart);
    
    if (filtered.length === 0) {
      this.data.delete(key);
    } else {
      this.data.set(key, filtered);
    }
  }

  /**
   * Clear all entries for a key
   * 
   * @param {string} key - Storage key
   * @returns {Promise<void>}
   */
  async clear(key) {
    this.data.delete(key);
  }

  /**
   * Get all entries for a key (for debugging)
   * 
   * @param {string} key - Storage key
   * @returns {Promise<Array>} All entries
   */
  async getEntries(key) {
    return this.data.get(key) || [];
  }

  /**
   * Global cleanup of all expired entries
   * 
   * @private
   */
  _globalCleanup() {
    const now = Date.now();
    // Cleanup entries older than 2 hours (max window we expect)
    const cutoff = now - (2 * 60 * 60 * 1000);

    for (const [key, entries] of this.data.entries()) {
      const filtered = entries.filter(entry => entry.timestamp >= cutoff);
      
      if (filtered.length === 0) {
        this.data.delete(key);
      } else {
        this.data.set(key, filtered);
      }
    }
  }

  /**
   * Stop cleanup interval
   * Call when shutting down
   */
  destroy() {
    if (this._cleanupInterval) {
      clearInterval(this._cleanupInterval);
    }
  }

  /**
   * Get store statistics
   * 
   * @returns {Object} Statistics
   */
  getStats() {
    let totalEntries = 0;
    for (const entries of this.data.values()) {
      totalEntries += entries.length;
    }

    return {
      keys: this.data.size,
      totalEntries,
      memoryUsage: process.memoryUsage().heapUsed
    };
  }
}

module.exports = MemoryStore;
