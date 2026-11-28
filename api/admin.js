import bcrypt from 'bcryptjs';
import { query } from './_lib/db.js';
import { requireOwner } from './_lib/auth.js';

export default async function handler(req, res) {
    const admin = await requireOwner(req, res);
    if (!admin) return;

    const { action, target_username, target_id, role, password } = req.body;

    // --- USER MANAGEMENT ---
    if (req.method === 'POST' && action === 'create_user') {
        if (!target_username || !password || !role) return res.status(400).json({ error: 'missing_fields' });
        const hash = await bcrypt.hash(password, 12);
        try {
            await query('INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)', [target_username, hash, role]);
            await query('INSERT INTO audit_logs (admin_id, action, details) VALUES ($1, $2, $3)', [admin.id, 'USER_CREATED', JSON.stringify({ username: target_username, role })]);
            return res.json({ success: true });
        } catch (e) {
            return res.status(400).json({ error: 'username_taken' });
        }
    }

    if (req.method === 'POST' && action === 'update_role') {
        if (!target_id || !role) return res.status(400).json({ error: 'missing_fields' });
        await query('UPDATE users SET role = $1 WHERE id = $2', [role, target_id]);
        await query('INSERT INTO audit_logs (admin_id, action, target_user_id, details) VALUES ($1, $2, $3, $4)', [admin.id, 'ROLE_UPDATED', target_id, JSON.stringify({ new_role: role })]);
        return res.json({ success: true });
    }

    if (req.method === 'POST' && action === 'reset_quota') {
        await query('UPDATE users SET quota_movies = 0, quota_episodes = 0 WHERE id = $1', [target_id]);
        return res.json({ success: true });
    }

    // --- DASHBOARD DATA ---
    if (req.method === 'GET' && req.query.data === 'dashboard') {
        const users = await query('SELECT id, username, role, is_minor, quota_movies, quota_episodes, guardian_name, created_at FROM users ORDER BY created_at DESC');
        const logs = await query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 15');
        const health = await query('SELECT * FROM provider_health ORDER BY checked_at DESC LIMIT 10');
        
        return res.json({
            users: users.rows,
            logs: logs.rows,
            health: health.rows,
            stats: {
                total_users: users.rows.length,
                minors: users.rows.filter(u => u.is_minor).length
            }
        });
    }

    res.status(400).json({ error: 'invalid_action' });
}
