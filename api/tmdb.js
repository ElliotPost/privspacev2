export default async function handler(req, res) {
    try {
        const path = req.query.path;
        if (!path) {
            return res.status(400).json({ error: 'missing_path' });
        }

        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(req.query)) {
            if (key !== 'path') {
                params.append(key, value);
            }
        }
        params.append('api_key', process.env.TMDB_API_KEY);

        const url = `https://api.themoviedb.org/3/${path}?${params.toString()}`;
        
        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({ error: 'tmdb_error', details: data });
        }

        res.json(data);
    } catch (err) {
        console.error('TMDB Error:', err);
        res.status(500).json({ error: 'tmdb_proxy_failed', details: err.message });
    }
}
