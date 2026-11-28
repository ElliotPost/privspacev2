import jwt from 'jsonwebtoken';
import { query } from './db.js';

export function signToken(user) {
    return jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
    );
}

export async function requireUser(req, res) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'unauthorized' });
        return null;
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const result = await query('SELECT * FROM users WHERE id = $1', [decoded.id]);
        
        if (result.rows.length === 0 || result.rows[0].role === 'banned') {
            res.status(403).json({ error: 'banned_or_not_found' });
            return null;
        }
        return result.rows[0];
    } catch (err) {
        res.status(401).json({ error: 'invalid_token' });
        return null;
    }
}

export async function requireOwner(req, res) {
    const user = await requireUser(req, res);
    if (!user) return null;
    if (user.role !== 'owner') {
        res.status(403).json({ error: 'forbidden' });
        return null;
    }
    return user;
}
