import bcrypt from 'bcryptjs';
import { db } from './_lib/db.js';
import { User } from './_lib/models.js';
import { sign } from './_lib/auth.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method' });

    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'missing_fields' });

    await db();

    const ownerName = process.env.OWNER_USERNAME || 'Kris';
    if (username === ownerName && !(await User.findOne({ username: ownerName }))) {
        await User.create({
            username: ownerName,
            password: await bcrypt.hash(process.env.OWNER_PASSWORD || 'Krismas', 12),
            role: 'owner'
        });
    }

    const user = await User.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: 'invalid_credentials' });
    }

    res.json({ token: sign(user.username, user.role), username: user.username, role: user.role });
}
