import bcrypt from 'bcryptjs';
import { query } from './_lib/db.js';
import { signToken } from './_lib/auth.js';

const CURRENT_TOS_VERSION = 'v2.0-privacy-guardian';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'missing_fields' });

    // Auto-seed Owner (Kris)
    const ownerCheck = await query('SELECT id FROM users WHERE username = $1', ['Kris']);
    if (ownerCheck.rows.length === 0 && username === 'Kris') {
        const hash = await bcrypt.hash(process.env.OWNER_PASSWORD || 'Krismas', 12);
        await query('INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)', ['Kris', hash, 'owner']);
    }

    const result = await query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'invalid_credentials' });

    const user = result.rows[0];
    if (user.role === 'banned') return res.status(403).json({ error: 'account_banned' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'invalid_credentials' });

    // Reset daily quotas if 24h passed
    const now = new Date();
    if (new Date(user.quota_reset_at) < now) {
        await query('UPDATE users SET quota_movies = 0, quota_episodes = 0, quota_reset_at = NOW() + INTERVAL \'24 hours\' WHERE id = $1', [user.id]);
        user.quota_movies = 0;
        user.quota_episodes = 0;
    }

    const needs_tos = user.tos_version !== CURRENT_TOS_VERSION;
    const token = signToken(user);

    res.json({
        token,
        user: {
            id: user.id,
            username: user.username,
            role: user.role,
            is_minor: user.is_minor,
            needs_tos,
            quota_movies: user.quota_movies,
            quota_episodes: user.quota_episodes
        }
    });
}
