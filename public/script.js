const API = '/api';
const $ = id => document.getElementById(id);

const PROVIDERS = [
    { id:'vidrock',  name:'VidRock',  base:'https://vidrock.to' },
    { id:'vidlink',  name:'VidLink',  base:'https://vidlink.pro' },
    { id:'vidfast',  name:'VidFast',  base:'https://vidfast.vc' },
    { id:'vidcore',  name:'VidCore',  base:'https://vidcore.io' },
    { id:'vidbolt',  name:'VidBolt',  base:'https://vidbolt.pro' },
    { id:'fmov',     name:'Fmov',     base:'https://fmov.my' },
    { id:'primesrc', name:'PrimeSRC', base:'https://primesrc.me' },
    { id:'atlantic', name:'Atlantic', base:'https://atlantic.st' },
    { id:'0vidads',  name:'0vidads',  base:'https://0vidads.top' }
];

const ROWS = {
    movie: [
        { title:'Trending Now',      path:'trending/movie/week' },
        { title:'Adrenaline',        path:'discover/movie', q:{ with_genres:28 } },
        { title:'Magic & Myth',      path:'discover/movie', q:{ with_genres:14 } },
        { title:'Laugh Track',       path:'discover/movie', q:{ with_genres:35 } },
        { title:'Mind Benders',      path:'discover/movie', q:{ with_genres:'878,9648' } },
        { title:'After Dark',        path:'discover/movie', q:{ with_genres:27 } },
        { title:'Family Night',      path:'discover/movie', q:{ with_genres:'10751,16' } },
        { title:'Slow Burn',         path:'discover/movie', q:{ with_genres:'18,10749' } }
    ],
    tv: [
        { title:'Binge-Worthy',      path:'trending/tv/week' },
        { title:'Action & Adventure',path:'discover/tv', q:{ with_genres:10759 } },
        { title:'Otherworldly',      path:'discover/tv', q:{ with_genres:10765 } },
        { title:'Sitcom Comfort',    path:'discover/tv', q:{ with_genres:35 } },
        { title:'Crime Files',       path:'discover/tv', q:{ with_genres:80 } },
        { title:'Animated',          path:'discover/tv', q:{ with_genres:16 } },
        { title:'True Stories',      path:'discover/tv', q:{ with_genres:99 } }
    ]
};

const IMG = (p, size='w500') => p ? `https://image.tmdb.org/t/p/${size}${p}` : '';

let token = localStorage.getItem('ps_token');
let me = null;
let mode = 'movie';
let ctx = { id:null, imdb:null, type:'movie', season:1, episode:1, title:'', poster:'', provider:'vidrock', claimed:null };

/* ---------- transport ---------- */
async function api(path, opts = {}) {
    const res = await fetch(API + path, {
        ...opts,
        headers: {
            'Content-Type':'application/json',
            ...(token ? { Authorization:`Bearer ${token}` } : {}),
            ...(opts.headers || {})
        }
    });
    if (res.status === 401) { signOut(); throw new Error('unauthorized'); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.message || data.error || 'failed'), { data });
    return data;
}

async function tmdb(path, params = {}) {
    const qs = new URLSearchParams({ path, ...params });
    const res = await fetch(`${API}/tmdb?${qs}`);
    return res.json();
}

/* ---------- auth ---------- */
$('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    $('login-error').textContent = '';
    try {
        const data = await api('/login', {
            method:'POST',
            body: JSON.stringify({ username: $('login-user').value.trim(), password: $('login-pass').value })
        });
        token = data.token;
        localStorage.setItem('ps_token', token);
        await boot();
    } catch {
        $('login-error').textContent = 'Wrong username or password.';
    }
});

function signOut() {
    token = null; me = null;
    localStorage.removeItem('ps_token');
    $('app').classList.add('hidden');
    $('login').classList.remove('hidden');
    $('login-pass').value = '';
    closeDetail();
}
$('logout').onclick = signOut;

async function boot() {
    me = await api('/me');
    $('login').classList.add('hidden');
    $('app').classList.remove('hidden');
    $('who-name').textContent = me.username;
    $('owner-btn').classList.toggle('hidden', me.role !== 'owner');
    paintQuota();
    await loadHome();
}

function paintQuota() {
    const pill = $('quota-pill');
    if (me.role !== 'freemium') { pill.classList.add('hidden'); return; }
    pill.classList.remove('hidden');
    pill.textContent = `${me.quota.movies}/4 films · ${me.quota.episodes}/20 eps`;
}

/* ---------- home ---------- */
async function loadHome() {
    $('results-sec').classList.add('hidden');
    $('rows').classList.remove('hidden');
    await Promise.all([loadContinue(), loadRows(), loadHero()]);
}

async function loadHero() {
    const data = await tmdb(`trending/${mode}/week`);
    const pick = (data.results || []).find(r => r.backdrop_path && r.overview);
    if (!pick) return;
    $('hero').classList.remove('hidden');
    $('hero-img').src = IMG(pick.backdrop_path, 'original');
    $('hero-title').textContent = pick.title || pick.name;
    $('hero-plot').textContent = pick.overview;
    $('hero-play').onclick = () => openDetail(pick, mode);
}

async function loadContinue() {
    let items = [];
    try { items = await api('/history'); } catch {}
    const sec = $('continue-sec'), rail = $('continue-row');
    if (!items.length) { sec.classList.add('hidden'); return; }
    sec.classList.remove('hidden');
    rail.innerHTML = '';
    items.forEach(h => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            ${h.type === 'tv' ? `<div class="card-badge">S${h.season} E${h.episode}</div>` : ''}
            <img src="${IMG(h.poster)}" alt="">
            <div class="card-body"><h4>${esc(h.title)}</h4><span>${h.type === 'tv' ? 'Series' : 'Film'}</span></div>
            <div class="card-bar"><i style="width:${h.type === 'tv' ? 45 : 30}%"></i></div>`;
        card.onclick = () => resume(h);
        rail.appendChild(card);
    });
}

async function loadRows() {
    const host = $('rows');
    host.innerHTML = '';
    for (const cfg of ROWS[mode]) {
        const data = await tmdb(cfg.path, { sort_by:'popularity.desc', ...cfg.q });
        const items = (data.results || []).filter(r => r.poster_path).slice(0, 14);
        if (!items.length) continue;

        const sec = document.createElement('section');
        sec.className = 'row-sec';
        sec.innerHTML = `<h3 class="row-title">${cfg.title}</h3><div class="rail"></div>`;
        const rail = sec.querySelector('.rail');
        items.forEach(item => rail.appendChild(makeCard(item, mode)));
        host.appendChild(sec);
    }
}

function makeCard(item, type) {
    const title = item.title || item.name;
    const year = (item.release_date || item.first_air_date || '').slice(0, 4);
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
        <img loading="lazy" src="${IMG(item.poster_path)}" alt="">
        <div class="card-body"><h4>${esc(title)}</h4><span>${year || '—'}</span></div>`;
    card.onclick = () => openDetail(item, type);
    return card;
}

function esc(s = '') {
    return s.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

/* ---------- search ---------- */
let searchTimer;
$('search').addEventListener('input', e => {
    clearTimeout(searchTimer);
    const q = e.target.value.trim();
    if (!q) { loadHome(); return; }
    searchTimer = setTimeout(async () => {
        const data = await tmdb(`search/${mode}`, { query: q });
        $('hero').classList.add('hidden');
        $('continue-sec').classList.add('hidden');
        $('rows').classList.add('hidden');
        $('results-sec').classList.remove('hidden');
        const grid = $('results');
        grid.innerHTML = '';
        (data.results || []).filter(r => r.poster_path).forEach(r => grid.appendChild(makeCard(r, mode)));
        if (!grid.children.length) grid.innerHTML = '<p class="muted">Nothing matched.</p>';
    }, 320);
});

document.querySelectorAll('.tab').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        mode = btn.dataset.type;
        $('search').value = '';
        loadHome();
    };
});

/* ---------- provider urls ---------- */
function embedUrl(pid, { id, imdb, type, season, episode }) {
    const p = PROVIDERS.find(x => x.id === pid) || PROVIDERS[0];
    const b = p.base;
    if (type === 'movie') {
        switch (pid) {
            case 'vidrock':  return `${b}/embed/movie/${id}`;
            case 'vidfast':
            case 'vidcore':  return `${b}/movie/${id}?autoPlay=true`;
            case 'vidlink':
            case 'vidbolt':  return `${b}/movie/${id}`;
            case 'fmov':
            case 'atlantic': return `${b}/embed/movie/${id}`;
            case 'primesrc': return `${b}/embed/movie?imdb=${imdb || id}`;
            case '0vidads':  return `${b}/embed/movie/${id}?nextEpisode=true&autoplayNextEpisode=true&episodeSelector=true&overlay=true&color=8B5CF6&branding=0vidads&subtitle=english&server=valstrax`;
        }
    } else {
        switch (pid) {
            case 'vidrock':  return `${b}/embed/tv/${id}/${season}/${episode}`;
            case 'vidfast':
            case 'vidcore':  return `${b}/tv/${id}/${season}/${episode}?autoPlay=true`;
            case 'vidlink':
            case 'vidbolt':  return `${b}/tv/${id}/${season}/${episode}`;
            case 'fmov':
            case 'atlantic': return `${b}/embed/tv/${id}/${season}/${episode}`;
            case 'primesrc': return `${b}/embed/tv?imdb=${imdb || id}&season=${season}&episode=${episode}`;
            case '0vidads':  return `${b}/embed/tv/${id}/${season}/${episode}?nextEpisode=true&autoplayNextEpisode=true&episodeSelector=true&overlay=true&color=8B5CF6&branding=0vidads&subtitle=english&server=valstrax`;
        }
    }
    return `${b}/movie/${id}`;
}

/* ---------- detail + playback ---------- */
async function openDetail(item, type, seed = {}) {
    const details = await tmdb(`${type}/${item.id}`, { append_to_response:'external_ids' });

    ctx = {
        id: item.id,
        imdb: details.external_ids?.imdb_id || null,
        type,
        season: seed.season || 1,
        episode: seed.episode || 1,
        title: details.title || details.name,
        poster: details.poster_path,
        provider: seed.provider || 'vidrock',
        claimed: null
    };

    $('d-title').textContent = ctx.title;
    $('d-plot').textContent = details.overview || 'No synopsis available.';
    $('d-poster').src = IMG(details.poster_path);

    const facts = [];
    const yr = (details.release_date || details.first_air_date || '').slice(0, 4);
    if (yr) facts.push(yr);
    if (details.vote_average) facts.push(`★ ${details.vote_average.toFixed(1)}`);
    if (type === 'movie' && details.runtime) facts.push(`${details.runtime} min`);
    if (type === 'tv' && details.number_of_seasons) facts.push(`${details.number_of_seasons} seasons`);
    (details.genres || []).slice(0, 3).forEach(g => facts.push(g.name));
    $('d-facts').innerHTML = facts.map(f => `<span>${esc(f)}</span>`).join('');

    $('d-warn').classList.add('hidden');
    $('frame-host').innerHTML = '';
    $('stage-load').classList.remove('hidden');
    $('ep-sec').classList.add('hidden');
    $('detail').classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    paintSources();

    if (type === 'tv') {
        await paintSeasons(details.seasons || []);
    } else {
        await play();
    }
}

function paintSources() {
    const host = $('sources');
    host.innerHTML = '';
    PROVIDERS.forEach(p => {
        const b = document.createElement('button');
        b.className = 'chip' + (p.id === ctx.provider ? ' on' : '');
        b.textContent = p.name;
        b.onclick = () => {
            ctx.provider = p.id;
            paintSources();
            mountFrame();          // source swap never touches quota
        };
        host.appendChild(b);
    });
}

async function paintSeasons(seasons) {
    const tabs = $('season-tabs');
    tabs.innerHTML = '';
    const real = seasons.filter(s => s.season_number > 0);
    real.forEach(s => {
        const b = document.createElement('button');
        b.className = 'chip' + (s.season_number === ctx.season ? ' on' : '');
        b.textContent = `Season ${s.season_number}`;
        b.onclick = () => { ctx.season = s.season_number; ctx.episode = 1; paintSeasons(seasons); };
        tabs.appendChild(b);
    });
    $('ep-sec').classList.remove('hidden');

    const data = await tmdb(`tv/${ctx.id}/season/${ctx.season}`);
    const list = $('ep-list');
    list.innerHTML = '';
    (data.episodes || []).forEach(ep => {
        const b = document.createElement('button');
        b.className = 'ep' + (ep.episode_number === ctx.episode ? ' on' : '');
        b.innerHTML = `<b>S${ctx.season} E${ep.episode_number}</b>${esc(ep.name || 'Episode ' + ep.episode_number)}`;
        b.onclick = () => { ctx.episode = ep.episode_number; paintSeasons(seasons); play(); };
        list.appendChild(b);
    });

    await play();
}

async function play() {
    const kind = ctx.type === 'movie' ? 'movie' : 'episode';
    const key = kind === 'movie' ? `m:${ctx.id}` : `e:${ctx.id}:${ctx.season}:${ctx.episode}`;

    if (ctx.claimed !== key) {
        try {
            await api('/limits', {
                method:'POST',
                body: JSON.stringify({ kind, tmdbId: ctx.id, season: ctx.season, episode: ctx.episode })
            });
            ctx.claimed = key;
            $('d-warn').classList.add('hidden');
            me = await api('/me');
            paintQuota();
        } catch (err) {
            $('stage-load').classList.add('hidden');
            $('frame-host').innerHTML = '';
            $('d-warn').textContent = err.data?.message || 'Playback blocked.';
            $('d-warn').classList.remove('hidden');
            return;
        }
    }

    mountFrame();

    api('/history', {
        method:'POST',
        body: JSON.stringify({
            tmdbId: ctx.id, type: ctx.type, title: ctx.title, poster: ctx.poster,
            season: ctx.type === 'tv' ? ctx.season : null,
            episode: ctx.type === 'tv' ? ctx.episode : null,
            provider: ctx.provider
        })
    }).then(loadContinue).catch(() => {});
}

function mountFrame() {
    $('stage-load').classList.remove('hidden');
    const host = $('frame-host');
    host.innerHTML = '';

    const f = document.createElement('iframe');
    f.src = embedUrl(ctx.provider, ctx);
    f.allowFullscreen = true;
    f.allow = 'encrypted-media; autoplay; fullscreen; clipboard-write';
    f.referrerPolicy = 'origin';
    f.onload = () => $('stage-load').classList.add('hidden');
    host.appendChild(f);

    setTimeout(() => $('stage-load').classList.add('hidden'), 4500);
}

async function resume(h) {
    const details = await tmdb(`${h.type}/${h.tmdbId}`);
    await openDetail(details, h.type, { season: h.season, episode: h.episode, provider: h.provider });
}

function closeDetail() {
    $('detail').classList.add('hidden');
    $('frame-host').innerHTML = '';
    document.body.style.overflow = '';
}
$('detail-close').onclick = closeDetail;
$('detail').onclick = e => { if (e.target === $('detail')) closeDetail(); };

/* ---------- owner console ---------- */
$('owner-btn').onclick = () => { $('owner').classList.remove('hidden'); loadUsers(); };
$('owner-close').onclick = () => $('owner').classList.add('hidden');
$('owner').onclick = e => { if (e.target === $('owner')) $('owner').classList.add('hidden'); };

$('mk-user').addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('mk-msg');
    try {
        await api('/users', {
            method:'POST',
            body: JSON.stringify({
                username: $('mk-name').value.trim(),
                password: $('mk-pass').value,
                role: $('mk-role').value
            })
        });
        msg.style.color = '#4fe08a';
        msg.textContent = `Account "${$('mk-name').value.trim()}" created.`;
        $('mk-user').reset();
        loadUsers();
    } catch (err) {
        msg.style.color = '#ff6b6b';
        msg.textContent = err.data?.error === 'username_taken' ? 'That username is taken.' : 'Could not create account.';
    }
});

async function loadUsers() {
    const users = await api('/users');
    const host = $('user-list');
    host.innerHTML = users.length ? '' : '<p class="muted">No accounts yet.</p>';
    users.forEach(u => {
        const row = document.createElement('div');
        row.className = 'urow';
        const used = u.quota?.day === new Date().toISOString().slice(0, 10)
            ? `${u.quota.movies || 0} films · ${u.quota.episodes || 0} eps today`
            : 'no activity today';
        row.innerHTML = `
            <div>
                <div class="u-n">${esc(u.username)}</div>
                <div class="u-q">${u.role === 'freemium' ? used : 'unlimited'}</div>
            </div>
            <div style="display:flex;align-items:center;gap:10px">
                <span class="tag ${u.role}">${u.role}</span>
                <button class="u-del" title="Delete">&times;</button>
            </div>`;
        row.querySelector('.tag').onclick = async () => {
            const next = u.role === 'freemium' ? 'premium' : 'freemium';
            await api('/users', { method:'PATCH', body: JSON.stringify({ username: u.username, role: next }) });
            loadUsers();
        };
        row.querySelector('.tag').style.cursor = 'pointer';
        row.querySelector('.u-del').onclick = async () => {
            await api('/users', { method:'DELETE', body: JSON.stringify({ username: u.username }) });
            loadUsers();
        };
        host.appendChild(row);
    });
}

/* ---------- misc ---------- */
addEventListener('scroll', () => $('nav').classList.toggle('solid', scrollY > 40));
addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!$('detail').classList.contains('hidden')) closeDetail();
    else if (!$('owner').classList.contains('hidden')) $('owner').classList.add('hidden');
});

if (token) boot().catch(signOut);
