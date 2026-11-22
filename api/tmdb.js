const ALLOWED = [
    /^trending\/(movie|tv)\/(day|week)$/,
    /^discover\/(movie|tv)$/,
    /^search\/(movie|tv)$/,
    /^(movie|tv)\/\d+$/,
    /^tv\/\d+\/season\/\d+$/
];

export default async function handler(req, res) {
    const path = String(req.query.path || '');
    if (!ALLOWED.some(rx => rx.test(path))) return res.status(400).json({ error: 'bad_path' });

    const url = new URL(`https://api.themoviedb.org/3/${path}`);
    for (const [k, v] of Object.entries(req.query)) {
        if (k !== 'path') url.searchParams.set(k, v);
    }
    url.searchParams.set('api_key', process.env.TMDB_API_KEY);

    const upstream = await fetch(url);
    const body = await upstream.text();

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(upstream.status).send(body);
}
