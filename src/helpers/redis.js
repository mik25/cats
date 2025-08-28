const fs = require('fs').promises;
const path = require('path');

class FileCache {
    constructor() {
        this.cacheDir = path.join(__dirname, '..', '..', 'data', 'cache');
        this.memoryCache = new Map();
        this.cacheStats = {
            hits: 0,
            misses: 0,
            sets: 0
        };
        
        // Cache settings
        this.defaultTTL = 3600; // 1 hour in seconds
        this.maxMemoryItems = 1000;
        this.cleanupInterval = 300000; // 5 minutes
        
        this.initializeCache();
        this.startCleanupTimer();
    }

    async initializeCache() {
        try {
            await fs.mkdir(this.cacheDir, { recursive: true });
            console.log('File cache initialized');
        } catch (error) {
            console.error('Error initializing file cache:', error);
        }
    }

    startCleanupTimer() {
        setInterval(() => {
            this.cleanExpiredItems();
        }, this.cleanupInterval);
    }

    // Generate cache key hash for file names
    generateCacheKey(key) {
        return key.replace(/[^a-zA-Z0-9]/g, '_');
    }

    // Set cache value
    async set(key, value, ttlSeconds = this.defaultTTL) {
        try {
            const cacheKey = this.generateCacheKey(key);
            const expiresAt = Date.now() + (ttlSeconds * 1000);
            
            const cacheItem = {
                value: value,
                expiresAt: expiresAt,
                createdAt: Date.now(),
                key: key
            };

            // Store in memory cache (for faster access)
            if (this.memoryCache.size < this.maxMemoryItems) {
                this.memoryCache.set(key, cacheItem);
            }

            // Store in file (for persistence)
            const filePath = path.join(this.cacheDir, `${cacheKey}.json`);
            await fs.writeFile(filePath, JSON.stringify(cacheItem, null, 2));
            
            this.cacheStats.sets++;
            return true;
        } catch (error) {
            console.error(`Error setting cache for key ${key}:`, error);
            return false;
        }
    }

    // Get cache value
    async get(key) {
        try {
            // Check memory cache first
            if (this.memoryCache.has(key)) {
                const cached = this.memoryCache.get(key);
                if (Date.now() < cached.expiresAt) {
                    this.cacheStats.hits++;
                    return cached.value;
                } else {
                    // Expired in memory
                    this.memoryCache.delete(key);
                }
            }

            // Check file cache
            const cacheKey = this.generateCacheKey(key);
            const filePath = path.join(this.cacheDir, `${cacheKey}.json`);
            
            try {
                const data = await fs.readFile(filePath, 'utf8');
                const cacheItem = JSON.parse(data);
                
                if (Date.now() < cacheItem.expiresAt) {
                    // Valid cache, add back to memory if space
                    if (this.memoryCache.size < this.maxMemoryItems) {
                        this.memoryCache.set(key, cacheItem);
                    }
                    this.cacheStats.hits++;
                    return cacheItem.value;
                } else {
                    // Expired, delete file
                    await fs.unlink(filePath).catch(() => {});
                }
            } catch (fileError) {
                // File doesn't exist or corrupted
            }

            this.cacheStats.misses++;
            return null;
        } catch (error) {
            console.error(`Error getting cache for key ${key}:`, error);
            this.cacheStats.misses++;
            return null;
        }
    }

    // Delete cache value
    async del(key) {
        try {
            // Remove from memory
            this.memoryCache.delete(key);

            // Remove file
            const cacheKey = this.generateCacheKey(key);
            const filePath = path.join(this.cacheDir, `${cacheKey}.json`);
            await fs.unlink(filePath).catch(() => {});
            
            return true;
        } catch (error) {
            console.error(`Error deleting cache for key ${key}:`, error);
            return false;
        }
    }

    // Check if key exists
    async exists(key) {
        const value = await this.get(key);
        return value !== null;
    }

    // Set expiration time
    async expire(key, seconds) {
        try {
            const value = await this.get(key);
            if (value !== null) {
                return await this.set(key, value, seconds);
            }
            return false;
        } catch (error) {
            console.error(`Error setting expiration for key ${key}:`, error);
            return false;
        }
    }

    // Get multiple keys
    async mget(keys) {
        const results = [];
        for (const key of keys) {
            const value = await this.get(key);
            results.push(value);
        }
        return results;
    }

    // Set multiple key-value pairs
    async mset(keyValuePairs, ttlSeconds = this.defaultTTL) {
        const results = [];
        for (let i = 0; i < keyValuePairs.length; i += 2) {
            const key = keyValuePairs[i];
            const value = keyValuePairs[i + 1];
            const result = await this.set(key, value, ttlSeconds);
            results.push(result);
        }
        return results.every(result => result === true);
    }

    // Clean expired items
    async cleanExpiredItems() {
        try {
            // Clean memory cache
            const now = Date.now();
            for (const [key, item] of this.memoryCache.entries()) {
                if (now >= item.expiresAt) {
                    this.memoryCache.delete(key);
                }
            }

            // Clean file cache
            const files = await fs.readdir(this.cacheDir);
            let cleanedCount = 0;

            for (const file of files) {
                if (!file.endsWith('.json')) continue;

                try {
                    const filePath = path.join(this.cacheDir, file);
                    const data = await fs.readFile(filePath, 'utf8');
                    const cacheItem = JSON.parse(data);

                    if (now >= cacheItem.expiresAt) {
                        await fs.unlink(filePath);
                        cleanedCount++;
                    }
                } catch (error) {
                    // File might be corrupted, delete it
                    const filePath = path.join(this.cacheDir, file);
                    await fs.unlink(filePath).catch(() => {});
                    cleanedCount++;
                }
            }

            if (cleanedCount > 0) {
                console.log(`Cleaned ${cleanedCount} expired cache items`);
            }
        } catch (error) {
            console.error('Error cleaning expired cache items:', error);
        }
    }

    // Clear all cache
    async flushall() {
        try {
            // Clear memory cache
            this.memoryCache.clear();

            // Clear file cache
            const files = await fs.readdir(this.cacheDir);
            for (const file of files) {
                if (file.endsWith('.json')) {
                    await fs.unlink(path.join(this.cacheDir, file));
                }
            }

            // Reset stats
            this.cacheStats = { hits: 0, misses: 0, sets: 0 };
            return true;
        } catch (error) {
            console.error('Error flushing cache:', error);
            return false;
        }
    }

    // Get cache statistics
    async stats() {
        try {
            const files = await fs.readdir(this.cacheDir);
            const jsonFiles = files.filter(file => file.endsWith('.json'));

            return {
                ...this.cacheStats,
                memoryItems: this.memoryCache.size,
                fileItems: jsonFiles.length,
                hitRate: this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) || 0
            };
        } catch (error) {
            return {
                ...this.cacheStats,
                memoryItems: this.memoryCache.size,
                fileItems: 0,
                hitRate: 0
            };
        }
    }

    // Quit/disconnect (for Redis compatibility)
    async quit() {
        await this.cleanExpiredItems();
        console.log('File cache disconnected');
        return true;
    }

    async disconnect() {
        return await this.quit();
    }
}

// Create and export singleton instance
const cache = new FileCache();

// Create Redis-compatible client object
const redisClient = {
    // Redis-compatible methods
    set: (key, value, ex, seconds) => {
        if (ex === 'EX' && typeof seconds === 'number') {
            return cache.set(key, value, seconds);
        }
        return cache.set(key, value);
    },
    get: (key) => cache.get(key),
    del: (key) => cache.del(key),
    exists: (key) => cache.exists(key),
    expire: (key, seconds) => cache.expire(key, seconds),
    mget: (keys) => cache.mget(keys),
    mset: (...args) => cache.mset(args),
    flushall: () => cache.flushall(),
    quit: () => cache.quit(),
    disconnect: () => cache.disconnect(),
    
    // Redis client methods that might be expected
    setex: (key, seconds, value) => cache.set(key, value, seconds),
    ttl: async (key) => {
        // Simple TTL check - return -1 if no expiry, -2 if doesn't exist
        const exists = await cache.exists(key);
        return exists ? -1 : -2; // Simplified for now
    },
    keys: async (pattern) => {
        // Simple pattern matching - for now just return empty array
        return [];
    }
};

// Export both the client and utility methods
module.exports = {
    // Main Redis client
    ...redisClient,
    
    // Additional utility methods
    stats: () => cache.stats(),
    cleanExpired: () => cache.cleanExpiredItems(),
    
    // Direct access to cache instance
    cache,
    
    // Export client as default property for compatibility
    client: redisClient
};