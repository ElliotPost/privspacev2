import { query } from './_lib/db.js';
import { requireUser } from './_lib/auth.js';

const CURRENT_TOS_VERSION = 'v2.0-privacy-guardian';

export default async function handler(req, res) {
    const user = await requireUser(req, res);
    if (!user) return;

    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

    const { accepted_tos, is_minor, guardian_name } = req.body;

    if (!accepted_tos) return res.status(400).json({ error: 'must_accept_tos' });

    // Minor check logic: if they claim to be minor, we REQUIRE guardian_name
    if (is_minor && !guardian_name) {
        return res.status(400).json({ error: 'guardian_name_required' });
    }

    await query(
        `UPDATE users 
         SET tos_version = $1, is_minor = $2, guardian_name = $3, guardian_consent_at = NOW() 
         WHERE id = $4`,
        [CURRENT_TOS_VERSION, is_minor, is_minor ? guardian_name : null, user.id]
    );

    // Log it for the owner
    await query(
        'INSERT INTO audit_logs (admin_id, action, target_user_id, details) VALUES ($1, $2, $3, $4)',
        [user.id, 'TOS_ACCEPTED', user.id, JSON.stringify({ version: CURRENT_TOS_VERSION, is_minor, guardian_name })]
    );

    res.json({ success: true });
}
