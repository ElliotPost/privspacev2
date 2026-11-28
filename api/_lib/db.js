import { Pool } from 'pg';

// Aiven/Neon/Heroku usually require SSL. 
// If your provider doesn't, remove the ssl object.
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10, // Connection pool size
    idleTimeoutMillis: 30000,
});

export async function query(text, params) {
    const client = await pool.connect();
    try {
        const res = await client.query(text, params);
        return res;
    } finally {
        client.release();
    }
}
