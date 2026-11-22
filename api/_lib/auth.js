import jwt from 'jsonwebtoken';
import { db } from './db.js';
import { User } from './models.js';

export function sign(username, role) {
    return jwt.sign({ sub: username, role }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

export async function requireUser(req, res) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) { res.status(401).json({ error: 'no_token' }); return null; }

    let payload;
    try {
        payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
        res.status(401).json({ error: 'bad_token' });
        return null;
    }

    await db();
    const user = await User.findOne({ username: payload.sub });
    if (!user) { res.status(401).json({ error: 'no_user' }); return null; }
    return user;
}

export async function requireOwner(req, res) {
    const user = await requireUser(req, res);
    if (!user) return null;
    if (user.role !== 'owner') { res.status(403).json({ error: 'forbidden' }); return null; }
    return user;
}
