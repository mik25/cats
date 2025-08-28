const fs = require('fs').promises;
const path = require('path');
const log = require('./logger');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const PROVIDERS_FILE = path.join(DATA_DIR, 'providers.json');
const GENRES_FILE = path.join(DATA_DIR, 'genres.json');
const TRAKT_TOKENS_FILE = path.join(DATA_DIR, 'trakt_tokens.json');
const TRAKT_HISTORY_FILE = path.join(DATA_DIR, 'trakt_history.json');

// Ensure data directory exists
async function ensureDataDir() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
    } catch (err) {
        // Directory already exists
    }
}

// Initialize files with empty data if they don't exist
async function initializeFile(filePath, defaultData = []) {
    await ensureDataDir();
    try {
        await fs.access(filePath);
    } catch (err) {
        await fs.writeFile(filePath, JSON.stringify(defaultData, null, 2));
    }
}

// Generic file operations
async function readFile(filePath) {
    await initializeFile(filePath);
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
}

async function writeFile(filePath, data) {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

// Mock pool object to replace PostgreSQL pool
const pool = {
    async query(sql, params = []) {
        const sqlLower = sql.toLowerCase().trim();
        
        // PROVIDERS TABLE QUERIES
        if (sqlLower.includes('providers')) {
            return await handleProviderQuery(sql, params);
        }
        
        // GENRES TABLE QUERIES
        if (sqlLower.includes('genres')) {
            return await handleGenreQuery(sql, params);
        }
        
        // TRAKT_TOKENS TABLE QUERIES
        if (sqlLower.includes('trakt_tokens')) {
            return await handleTraktTokenQuery(sql, params);
        }
        
        // TRAKT_HISTORY TABLE QUERIES
        if (sqlLower.includes('trakt_history')) {
            return await handleTraktHistoryQuery(sql, params);
        }
        
        // Default empty result
        return { rows: [] };
    },
    
    async connect() {
        return {
            async query(sql, params) {
                return await pool.query(sql, params);
            },
            release() {
                // Mock release
            }
        };
    }
};

async function handleProviderQuery(sql, params) {
    const providers = await readFile(PROVIDERS_FILE);
    const sqlLower = sql.toLowerCase();
    
    if (sqlLower.includes('select * from providers where provider_id')) {
        // SELECT * FROM providers WHERE provider_id = $1
        const providerId = params[0];
        const provider = providers.find(p => p.provider_id == providerId);
        return { rows: provider ? [provider] : [] };
    }
    
    if (sqlLower.includes('select * from providers')) {
        // SELECT * FROM providers
        return { rows: providers };
    }
    
    if (sqlLower.includes('insert into providers')) {
        // INSERT INTO providers (provider_id, provider_name, logo_path, display_priorities, last_fetched) VALUES ($1, $2, $3, $4, $5)
        // ON CONFLICT(provider_id) DO UPDATE SET...
        const [provider_id, provider_name, logo_path, display_priorities, last_fetched] = params;
        
        const existingIndex = providers.findIndex(p => p.provider_id == provider_id);
        const providerData = {
            provider_id: parseInt(provider_id),
            provider_name,
            logo_path,
            display_priorities,
            last_fetched
        };
        
        if (existingIndex >= 0) {
            providers[existingIndex] = providerData;
        } else {
            providers.push(providerData);
        }
        
        await writeFile(PROVIDERS_FILE, providers);
        return { rows: [providerData] };
    }
    
    return { rows: [] };
}

async function handleGenreQuery(sql, params) {
    const genres = await readFile(GENRES_FILE);
    const sqlLower = sql.toLowerCase();
    
    if (sqlLower.includes('select genre_id from genres where genre_name')) {
        // SELECT genre_id FROM genres WHERE genre_name = $1 AND media_type = $2
        const [genreName, mediaType] = params;
        const genre = genres.find(g => g.genre_name === genreName && g.media_type === mediaType);
        return { rows: genre ? [{ genre_id: genre.genre_id }] : [] };
    }
    
    if (sqlLower.includes('select genre_name from genres where genre_id')) {
        // SELECT genre_name FROM genres WHERE genre_id = $1 AND media_type = $2 AND language = $3
        const [genreId, mediaType, language] = params;
        const genre = genres.find(g => 
            g.genre_id == genreId && 
            g.media_type === mediaType && 
            g.language === language
        );
        return { rows: genre ? [{ genre_name: genre.genre_name }] : [] };
    }
    
    if (sqlLower.includes('select genre_name from genres where media_type')) {
        // SELECT genre_name FROM genres WHERE media_type = $1 AND language = $2
        const [mediaType, language] = params;
        const matchingGenres = genres.filter(g => 
            g.media_type === mediaType && 
            g.language === language
        );
        return { rows: matchingGenres.map(g => ({ genre_name: g.genre_name })) };
    }
    
    if (sqlLower.includes('insert into genres')) {
        // INSERT INTO genres (genre_id, genre_name, media_type, language) VALUES ($1, $2, $3, $4)
        // ON CONFLICT (genre_id, media_type, language) DO NOTHING
        const [genre_id, genre_name, media_type, language] = params;
        
        const exists = genres.some(g => 
            g.genre_id == genre_id && 
            g.media_type === media_type && 
            g.language === language
        );
        
        if (!exists) {
            genres.push({
                genre_id: parseInt(genre_id),
                genre_name,
                media_type,
                language
            });
            await writeFile(GENRES_FILE, genres);
        }
        
        return { rows: [] };
    }
    
    return { rows: [] };
}

async function handleTraktTokenQuery(sql, params) {
    const tokens = await readFile(TRAKT_TOKENS_FILE);
    const sqlLower = sql.toLowerCase();
    
    if (sqlLower.includes('select access_token, refresh_token from trakt_tokens where username')) {
        // SELECT access_token, refresh_token FROM trakt_tokens WHERE username = $1
        const username = params[0];
        const token = tokens.find(t => t.username === username);
        return { rows: token ? [{ access_token: token.access_token, refresh_token: token.refresh_token }] : [] };
    }
    
    if (sqlLower.includes('insert into trakt_tokens')) {
        // INSERT INTO trakt_tokens (username, access_token, refresh_token) VALUES ($1, $2, $3) ON CONFLICT (username) DO UPDATE SET access_token = $2, refresh_token = $3
        const [username, access_token, refresh_token] = params;
        
        const existingIndex = tokens.findIndex(t => t.username === username);
        const tokenData = {
            id: existingIndex >= 0 ? tokens[existingIndex].id : tokens.length + 1,
            username,
            access_token,
            refresh_token,
            last_fetched_at: null
        };
        
        if (existingIndex >= 0) {
            tokens[existingIndex] = tokenData;
        } else {
            tokens.push(tokenData);
        }
        
        await writeFile(TRAKT_TOKENS_FILE, tokens);
        return { rows: [tokenData] };
    }
    
    return { rows: [] };
}

async function handleTraktHistoryQuery(sql, params) {
    const history = await readFile(TRAKT_HISTORY_FILE);
    const sqlLower = sql.toLowerCase();
    
    if (sqlLower.includes('select') && sqlLower.includes('trakt_history')) {
        // Various SELECT queries for trakt_history
        if (sqlLower.includes('where username')) {
            const username = params[0];
            const userHistory = history.filter(h => h.username === username);
            return { rows: userHistory };
        }
        return { rows: history };
    }
    
    if (sqlLower.includes('insert into trakt_history')) {
        // INSERT INTO trakt_history (username, watched_at, type, title, imdb_id, tmdb_id) VALUES ($1, $2, $3, $4, $5, $6)
        const [username, watched_at, type, title, imdb_id, tmdb_id] = params;
        
        const newEntry = {
            id: history.length + 1,
            username,
            watched_at,
            type,
            title,
            imdb_id,
            tmdb_id: parseInt(tmdb_id)
        };
        
        history.push(newEntry);
        await writeFile(TRAKT_HISTORY_FILE, history);
        return { rows: [newEntry] };
    }
    
    return { rows: [] };
}

// Initialize all files on startup
async function createDatabaseAndTable(createTableSQL) {
    // Mock function - just ensure files exist
    await initializeFile(PROVIDERS_FILE);
    await initializeFile(GENRES_FILE);
    await initializeFile(TRAKT_TOKENS_FILE);
    await initializeFile(TRAKT_HISTORY_FILE);
    log('debug', 'File-based storage initialized');
}

const providersDb = createDatabaseAndTable('');
const genresDb = createDatabaseAndTable('');
const traktDb = createDatabaseAndTable('');

module.exports = {
    pool,
    providersDb,
    genresDb,
    traktDb
};