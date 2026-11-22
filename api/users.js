import bcrypt from 'bcryptjs';
import { requireOwner } from './_lib/auth.js';
import { User } from './_lib/models.js';

export default async function handler(req, res) {
    const owner = await requireOwner(req, res);
    if (!owner) return;

    if (req.method === 'GET') {
        const users = await User.find({ role: { $ne: 'owner' } })
            .select('username role quota createdAt').lean();
        return res.json(users);
    }

    if (req.method === 'POST') {
        const { username, password, role } = req.body || {};
        if (!username || !password) return res.status(400).json({ error: 'missing_fields' });
        if (!['freemium', 'premium'].includes(role)) return res.status(400).json({ error: 'bad_role' });
        if (await User.findOne({ username })) return res.status(409).json({ error: 'username_taken' });

        await User.create({ username, password: await bcrypt.hash(password, 12), role });
        return res.json({ ok: true });
    }

    if (req.method === 'PATCH') {
        const { username, role, password } = req.body || {};
        const target = await User.findOne({ username });
        if (!target || target.role === 'owner') return res.status(404).json({ error: 'not_found' });
        if (role) target.role = role;
        if (password) target.password = await bcrypt.hash(password, 12);
        await target.save();
        return res.json({ ok: true });
    }

    if (req.method === 'DELETE') {
        const { username } = req.body || {};
        const target = await User.findOne({ username });
        if (!target || target.role === 'owner') return res.status(404).json({ error: 'not_found' });
        await target.deleteOne();
        return res.json({ ok: true });
    }

    res.status(405).json({ error: 'method' });
}
