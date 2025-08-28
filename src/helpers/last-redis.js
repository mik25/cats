const fs = require('fs').promises;
const path = require('path');
const log = require('./logger');

const CACHE_DIR = path.join(__dirname, '..', '..', 'cache', 'redis');

// Ensure cache directory exists
async function ensureCacheDir() {
    try {
        await fs.mkdir(CACHE_DIR, { recursive: true });
    } catch (err) {
        // Directory already exists
    }
}

// Generate safe filename from key
function getSafeFilename(key) {
    return key.replace(/[^a-zA-Z0-9]/g, '_') + '.json';
}

// Get cache file path
function getCacheFilePath(key) {
    return path.join(CACHE_DIR, getSafeFilename(key));
}

// Mock Redis client that matches your redis.js interface
const redisClient = {
    async get(key) {
        try {
            await ensureCacheDir();
            const filePath = getCacheFilePath(key);
            const data = await fs.readFile(filePath, 'utf8');
            const cached = JSON.parse(data);
            
            // Check if expired
            if (cached.expires && Date.now() > cached.expires) {
                await fs.unlink(filePath).catch(() => {});
                return null;
            }
            
            return cached.value;
        } catch (err) {
            return null;
        }
    },

    async set(key, value, options = {}) {
        try {
            await ensureCacheDir();
            const filePath = getCacheFilePath(key);
            
            const cached = {
                value: value,
                created: Date.now(),
                expires: null
            };
            
            // Handle expiration options
            if (options.EX) {
                cached.expires = Date.now() + (options.EX * 1000);
            }
            if (options.PX) {
                cached.expires = Date.now() + options.PX;
            }
            
            await fs.writeFile(filePath, JSON.stringify(cached, null, 2));
            return 'OK';
        } catch (err) {
            log('error', `Error setting cache key ${key}: ${err.message}`);
            return null;
        }
    },

    async setEx(key, seconds, value) {
        return await this.set(key, value, { EX: seconds });
    },

    async del(key) {
        try {
            const filePath = getCacheFilePath(key);
            await fs.unlink(filePath);
            return 1;
        } catch (err) {
            return 0;
        }
    },

    async exists(key) {
        try {
            const filePath = getCacheFilePath(key);
            await fs.access(filePath);
            return 1;
        } catch (err) {
            return 0;
        }
    },

    async flushAll() {
        try {
            await ensureCacheDir();
            const files = await fs.readdir(CACHE_DIR);
            for (const file of files) {
                if (file.endsWith('.json')) {
                    await fs.unlink(path.join(CACHE_DIR, file));
                }
            }
            return 'OK';
        } catch (err) {
            log('error', `Error flushing cache: ${err.message}`);
            return null;
        }
    },

    // Connection methods (mock - always succeeds)
    async connect() {
        log('info', 'File-based Redis cache initialized');
        return 'OK';
    },

    async disconnect() {
        log('info', 'File-based Redis cache disconnected');
        return 'OK';
    },

    async quit() {
        return await this.disconnect();
    },

    // Status check
    ping() {
        return 'PONG';
    },

    // Event handlers (mock)
    on(event, handler) {
        // Mock event handling - immediately trigger ready
        if (event === 'ready') {
            setTimeout(handler, 0);
        }
        return this;
    }
};

// Mock the safeRedisCall function from your original
const safeRedisCall = async (operation, ...args) => {
    try {
        return await redisClient[operation](...args);
    } catch (err) {
        log('warn', `File-based Redis operation failed: ${err.message}`);
        return null;
    }
};

// Initialize on import
redisClient.connect().catch(err => {
    log('error', `Failed to initialize file-based Redis: ${err.message}`);
});

module.exports = {
    redisClient,
    safeRedisCall
};