import { requireUser } from './_lib/auth.js';
import { LIMITS, today } from './_lib/models.js';

export default async function handler(req, res) {
    const user = await requireUser(req, res);
    if (!user) return;

    const day = today();
    if (user.quota.day !== day) {
        user.quota = { day, movies: 0, episodes: 0, claimed: [] };
        await user.save();
    }

    if (req.method === 'GET') {
        return res.json({
            role: user.role,
            movies: user.quota.movies,
            episodes: user.quota.episodes,
            limits: user.role === 'freemium' ? LIMITS : null
        });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'method' });

    const { kind, tmdbId, season, episode } = req.body || {};
    if (!['movie', 'episode'].includes(kind)) return res.status(400).json({ error: 'bad_kind' });

    if (user.role !== 'freemium') return res.json({ allowed: true, unlimited: true });

    const key = kind === 'movie'
        ? `m:${tmdbId}`
        : `e:${tmdbId}:${season}:${episode}`;

    if (user.quota.claimed.includes(key)) return res.json({ allowed: true, alreadyClaimed: true });

    const used = kind === 'movie' ? user.quota.movies : user.quota.episodes;
    if (used >= LIMITS[kind]) {
        return res.status(403).json({
            allowed: false,
            message: kind === 'movie'
                ? 'Daily film allowance reached — 4 per day. Resets at midnight UTC.'
                : 'Daily episode allowance reached — 20 per day. Resets at midnight UTC.'
        });
    }

    if (kind === 'movie') user.quota.movies += 1;
    else user.quota.episodes += 1;
    user.quota.claimed.push(key);
    await user.save();

    res.json({ allowed: true, movies: user.quota.movies, episodes: user.quota.episodes });
}
