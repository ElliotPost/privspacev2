import { requireUser } from './_lib/auth.js';

export default async function handler(req, res) {
    const user = await requireUser(req, res);
    if (!user) return;

    if (req.method === 'GET') {
        const sorted = [...user.history].sort((a, b) => b.updatedAt - a.updatedAt);
        return res.json(sorted.slice(0, 12));
    }

    if (req.method === 'POST') {
        const { tmdbId, type, title, poster, season, episode, provider } = req.body || {};
        if (!tmdbId || !type) return res.status(400).json({ error: 'missing_fields' });

        const idx = user.history.findIndex(h => h.tmdbId === tmdbId && h.type === type);
        const entry = { tmdbId, type, title, poster, season, episode, provider, updatedAt: new Date() };

        if (idx >= 0) user.history[idx] = { ...user.history[idx].toObject(), ...entry };
        else user.history.unshift(entry);

        user.history = user.history
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .slice(0, 24);

        await user.save();
        return res.json({ ok: true });
    }

    if (req.method === 'DELETE') {
        const { tmdbId, type } = req.body || {};
        user.history = user.history.filter(h => !(h.tmdbId === tmdbId && h.type === type));
        await user.save();
        return res.json({ ok: true });
    }

    res.status(405).json({ error: 'method' });
}
