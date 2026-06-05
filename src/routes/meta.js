const express = require('express');
const log = require('../helpers/logger');
const { parseConfigParameters } = require('../helpers/catalog');
const { getImdbId, getContentDetails } = require('../api/tmdb');

const router = express.Router();

router.get("/:configParameters?/meta/:type/:id.json", async (req, res, next) => {
    const { id, configParameters, type } = req.params;

    // Only handle tmdb: IDs — pass anything else to next handler
    if (!id.startsWith('tmdb:')) {
        return next();
    }

    const tmdbId = id.replace('tmdb:', '');
    const parsedConfig = await parseConfigParameters(configParameters);
    const { tmdbApiKey, language = 'en' } = parsedConfig;

    if (!tmdbApiKey) {
        log.warn(`Meta request for ${id} but no tmdbApiKey in config`);
        return res.json({ meta: null });
    }

    try {
        const tmdbType = type === 'series' ? 'tv' : 'movie';

        const [imdbId, details] = await Promise.all([
            getImdbId(tmdbId, tmdbType, tmdbApiKey, language).catch(() => null),
            getContentDetails(tmdbId, tmdbType, tmdbApiKey, language).catch(() => null)
        ]);

        if (!imdbId) {
            log.warn(`No IMDB ID found for tmdb:${tmdbId}`);
            return res.json({ meta: null });
        }

        const releaseInfo = type === 'series'
            ? details?.first_air_date
                ? details?.last_air_date
                    ? `${details.first_air_date.split('-')[0]}-${details.last_air_date.split('-')[0]}`
                    : details.first_air_date.split('-')[0]
                : ''
            : details?.release_date?.split('-')[0] || '';

        const meta = {
            id: imdbId,
            type: type === 'series' ? 'series' : 'movie',
            name: details?.title || details?.name || '',
            poster: details?.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : null,
            background: details?.backdrop_path ? `https://image.tmdb.org/t/p/w1280${details.backdrop_path}` : null,
            description: details?.overview || '',
            releaseInfo: releaseInfo || null,
            imdbRating: details?.vote_average ? details.vote_average.toFixed(1) : null,
        };

        log.debug(`Meta resolved tmdb:${tmdbId} → ${imdbId}`);
        res.json({ meta });

    } catch (error) {
        log.error(`Error resolving meta for ${id}: ${error.message}`);
        res.json({ meta: null });
    }
});

module.exports = router;
