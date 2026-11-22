import { requireUser } from './_lib/auth.js';
import { LIMITS, today } from './_lib/models.js';

export default async function handler(req, res) {
    const user = await requireUser(req, res);
    if (!user) return;

    const day = today();
    const fresh = user.quota.day === day;

    res.json({
        username: user.username,
        role: user.role,
        quota: {
            movies:   fresh ? user.quota.movies : 0,
            episodes: fresh ? user.quota.episodes : 0,
            limits:   user.role === 'freemium' ? LIMITS : null
        }
    });
}
