import { query } from './_lib/db.js';
import { requireUser } from './_lib/auth.js';

const LIMITS = { freemium: { movies: 4, episodes: 20 }, premium: { movies: Infinity, episodes: Infinity } };

export default async function handler(req, res) {
    const user = await requireUser(req, res);
    if (!user) return;

    if (req.method === 'GET') {
        const result = await query(
            'SELECT * FROM watch_history WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 20',
            [user.id]
        );
        return res.json(result.rows);
    }

    if (req.method === 'POST') {
        const { tmdb_id, type, title, poster_path, season, episode, progress_seconds, duration_seconds, provider, action } = req.body;

        // QUOTA LOGIC
        if (action === 'play') {
            const limits = LIMITS[user.role] || LIMITS.freemium;
            
            if (type === 'movie' && user.quota_movies >= limits.movies) {
                return res.status(403).json({ error: 'quota_reached_movies' });
            }
            if (type === 'tv' && user.quota_episodes >= limits.episodes) {
                return res.status(403).json({ error: 'quota_reached_episodes' });
            }

            // Increment quota
            const quotaField = type === 'movie' ? 'quota_movies' : 'quota_episodes';
            await query(`UPDATE users SET ${quotaField} = ${quotaField} + 1 WHERE id = $1`, [user.id]);
        }

        // UPSERT WATCH PROGRESS
        await query(
            `INSERT INTO watch_history (user_id, tmdb_id, type, title, poster_path, season, episode, progress_seconds, duration_seconds, provider, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
             ON CONFLICT (user_id, tmdb_id, type, season, episode) 
             DO UPDATE SET 
                progress_seconds = EXCLUDED.progress_seconds,
                duration_seconds = EXCLUDED.duration_seconds,
                provider = EXCLUDED.provider,
                updated_at = NOW()`,
            [user.id, tmdb_id, type, title, poster_path, season, episode, progress_seconds, duration_seconds, provider]
        );

        return res.json({ success: true, new_quota: type === 'movie' ? user.quota_movies + 1 : user.quota_episodes + 1 });
    }

    res.status(405).json({ error: 'method_not_allowed' });
}
