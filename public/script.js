const API = '/api';
const $ = id => document.getElementById(id);

const PROVIDERS = [
    { id: 'vidrock', name: 'VidRock', base: 'https://vidrock.to' },
    { id: 'vidlink', name: 'VidLink', base: 'https://vidlink.pro' },
    { id: 'vidfast', name: 'VidFast', base: 'https://vidfast.vc' },
    { id: 'vidcore', name: 'VidCore', base: 'https://vidcore.io' },
    { id: 'vidbolt', name: 'VidBolt', base: 'https://vidbolt.pro' },
    { id: 'fmov', name: 'Fmov', base: 'https://fmov.my' },
    { id: 'primesrc', name: 'PrimeSRC', base: 'https://primesrc.me' },
    { id: 'atlantic', name: 'Atlantic', base: 'https://atlantic.st' },
    { id: '0vidads', name: '0vidads', base: 'https://0vidads.top' }
];

const ROWS = {
    movie: [
        { title: 'Trending Movies', path: 'trending/movie/week' },
        { title: 'Adrenaline', path: 'discover/movie', q: { with_genres: 28 } },
        { title: 'Magic & Myth', path: 'discover/movie', q: { with_genres: 14 } },
        { title: 'Laugh Track', path: 'discover/movie', q: { with_genres: 35 } },
        { title: 'Mind Benders', path: 'discover/movie', q: { with_genres: '878,9648' } },
        { title: 'After Dark', path: 'discover/movie', q: { with_genres: 27 } },
        { title: 'Family Night', path: 'discover/movie', q: { with_genres: '10751,16' } },
        { title: 'Slow Burn', path: 'discover/movie', q: { with_genres: '18,10749' } }
    ],
    tv: [
        { title: 'Trending Series', path: 'trending/tv/week' },
        { title: 'Action & Adventure', path: 'discover/tv', q: { with_genres: 10759 } },
        { title: 'Otherworldly', path: 'discover/tv', q: { with_genres: 10765 } },
        { title: 'Sitcom Comfort', path: 'discover/tv', q: { with_genres: 35 } },
        { title: 'Crime Files', path: 'discover/tv', q: { with_genres: 80 } },
        { title: 'Animated', path: 'discover/tv', q: { with_genres: 16 } },
        { title: 'True Stories', path: 'discover/tv', q: { with_genres: 99 } }
    ]
};

const IMG = (p, size = 'w500') => p ? `https://image.tmdb.org/t/p/${size}${p}` : '';

let token = localStorage.getItem('nexa_token');
let me = null;
let mode = 'movie';
let ctx = { id: null, imdb: null, type: 'movie', season: 1, episode: 1, title: '', poster: '', provider: 'vidrock', claimed: null };

/* ---------- TRANSPORT ---------- */
async function apiCall(path, opts = {}) {
    const res = await fetch(API + path, {
        ...opts,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(opts.headers || {})
        }
    });
    if (res.status === 401) { signOut(); throw new Error('unauthorized'); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.message || data.error || 'failed'), { data });
    return data;
}

async function tmdb(path, params = {}) {
    const qs = new URLSearchParams({ path, language: 'en-US', ...params });
    const res = await fetch(`${API}/tmdb?${qs}`);
    return res.json();
}

/* ---------- AUTH FLOW ---------- */
$('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    $('l-error').textContent = '';
    try {
        const data = await apiCall('/login', {
            method: 'POST',
            body: JSON.stringify({
                username: $('l-user').value.trim(),
                password: $('l-pass').value
            })
        });
        token = data.token;
        localStorage.setItem('nexa_token', token);
        me = data.user;
        
        if (me.needs_tos) {
            $('login-card').classList.add('hidden');
            $('tos-card').classList.remove('hidden');
        } else {
            showInstructions();
        }
    } catch (err) {
        $('l-error').textContent = err.data?.error === 'account_banned' 
            ? 'Account suspended.' 
            : 'Wrong username or password.';
    }
});

$('chk-minor').addEventListener('change', e => {
    $('guardian-box').classList.toggle('hidden', !e.target.checked);
});

$('btn-accept-tos').addEventListener('click', async () => {
    const accepted = $('chk-tos').checked;
    const isMinor = $('chk-minor').checked;
    const guardianName = $('g-name').value.trim();
    
    if (!accepted) {
        $('tos-error').textContent = 'You must accept the Terms of Service.';
        return;
    }
    if (isMinor && !guardianName) {
        $('tos-error').textContent = 'Guardian name is required for minors.';
        return;
    }
    
    try {
        await apiCall('/consent', {
            method: 'POST',
            body: JSON.stringify({ accepted_tos: true, is_minor: isMinor, guardian_name: guardianName })
        });
        showInstructions();
    } catch (err) {
        $('tos-error').textContent = 'Failed to save consent.';
    }
});

$('btn-close-instructions').addEventListener('click', enterApp);

function showInstructions() {
    $('login-card').classList.add('hidden');
    $('tos-card').classList.add('hidden');
    $('instructions-card').classList.remove('hidden');
}

function enterApp() {
    $('instructions-card').classList.add('hidden');
    $('auth-layer').classList.add('hidden');
    $('app').classList.remove('hidden');
    $('user-display').textContent = me.username;
    $('owner-btn').classList.toggle('hidden', me.role !== 'owner');
    paintQuota();
    loadHome();
}

function signOut() {
    token = null;
    me = null;
    localStorage.removeItem('nexa_token');
    $('app').classList.add('hidden');
    $('auth-layer').classList.remove('hidden');
    $('login-card').classList.remove('hidden');
    $('tos-card').classList.add('hidden');
    $('instructions-card').classList.add('hidden');
    $('l-pass').value = '';
    closeDetail();
}
$('logout-btn').onclick = signOut;

function paintQuota() {
    const pill = $('quota-pill');
    if (!me || me.role !== 'freemium') { pill.classList.add('hidden'); return; }
    pill.classList.remove('hidden');
    pill.textContent = `${me.quota_movies}/4 · ${me.quota_episodes}/20`;
}

/* ---------- HOME ---------- */
async function loadHome() {
    $('results-sec').classList.add('hidden');
    $('content-section').classList.remove('hidden');
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
    try { items = await apiCall('/history'); } catch {}
    const sec = $('continue-section'), rail = $('continue-row');
    if (!items.length) { sec.classList.add('hidden'); return; }
    sec.classList.remove('hidden');
    rail.innerHTML = '';
    items.forEach(h => {
        const card = document.createElement('div');
        card.className = 'media-card';
        card.style.width = '180px';
        card.innerHTML = `
            ${h.type === 'tv' ? `<div class="card-badge">S${h.season} E${h.episode}</div>` : ''}
            <img src="${IMG(h.poster_path)}" alt="">
            <div class="card-body"><h4>${esc(h.title)}</h4><span>${h.type === 'tv' ? 'Series' : 'Film'}</span></div>`;
        card.onclick = () => resume(h);
        rail.appendChild(card);
    });
}

async function loadRows() {
    const host = $('content-grid');
    host.innerHTML = '';
    for (const cfg of ROWS[mode]) {
        const data = await tmdb(cfg.path, { 
            sort_by: 'popularity.desc', 
            with_original_language: 'en',
            ...cfg.q 
        });
        const items = (data.results || []).filter(r => r.poster_path).slice(0, 14);
        if (!items.length) continue;

        const sec = document.createElement('section');
        sec.className = 'row-sec';
        sec.innerHTML = `<h3 class="section-title">${cfg.title}</h3><div class="rail"></div>`;
        const rail = sec.querySelector('.rail');
        items.forEach(item => rail.appendChild(makeCard(item, mode)));
        host.appendChild(sec);
    }
}

function makeCard(item, type) {
    const title = item.title || item.name;
    const year = (item.release_date || item.first_air_date || '').slice(0, 4);
    const card = document.createElement('div');
    card.className = 'media-card';
    card.innerHTML = `
        <img loading="lazy" src="${IMG(item.poster_path)}" alt="">
        <div class="card-body"><h4>${esc(title)}</h4><span>${year || '—'}</span></div>`;
    card.onclick = () => openDetail(item, type);
    return card;
}

function esc(s = '') {
    return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- SEARCH ---------- */
let searchTimer;
$('search').addEventListener('input', e => {
    clearTimeout(searchTimer);
    const q = e.target.value.trim();
    if (!q) { loadHome(); return; }
    searchTimer = setTimeout(async () => {
        const data = await tmdb(`search/${mode}`, { query: q });
        $('hero').classList.add('hidden');
        $('continue-section').classList.add('hidden');
        $('content-section').classList.add('hidden');
        $('results-sec').classList.remove('hidden');
        const grid = $('results');
        grid.innerHTML = '';
        (data.results || []).filter(r => r.poster_path).forEach(r => grid.appendChild(makeCard(r, mode)));
        if (!grid.children.length) grid.innerHTML = '<p class="muted">Nothing matched.</p>';
    }, 320);
});

document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        mode = btn.dataset.type;
        $('search').value = '';
        loadHome();
    };
});

/* ---------- PROVIDER URLS ---------- */
function embedUrl(pid, { id, imdb, type, season, episode }) {
    const p = PROVIDERS.find(x => x.id === pid) || PROVIDERS[0];
    const b = p.base;
    if (type === 'movie') {
        switch (pid) {
            case 'vidrock': return `${b}/embed/movie/${id}`;
            case 'vidfast':
            case 'vidcore': return `${b}/movie/${id}?autoPlay=true`;
            case 'vidlink':
            case 'vidbolt': return `${b}/movie/${id}`;
            case 'fmov':
            case 'atlantic': return `${b}/embed/movie/${id}`;
            case 'primesrc': return `${b}/embed/movie?imdb=${imdb || id}`;
            case '0vidads': return `${b}/embed/movie/${id}?nextEpisode=true&autoplayNextEpisode=true&episodeSelector=true&overlay=true&color=8B5CF6&branding=0vidads&subtitle=english&server=valstrax`;
        }
    } else {
        switch (pid) {
            case 'vidrock': return `${b}/embed/tv/${id}/${season}/${episode}`;
            case 'vidfast':
            case 'vidcore': return `${b}/tv/${id}/${season}/${episode}?autoPlay=true`;
            case 'vidlink':
            case 'vidbolt': return `${b}/tv/${id}/${season}/${episode}`;
            case 'fmov':
            case 'atlantic': return `${b}/embed/tv/${id}/${season}/${episode}`;
            case 'primesrc': return `${b}/embed/tv?imdb=${imdb || id}&season=${season}&episode=${episode}`;
            case '0vidads': return `${b}/embed/tv/${id}/${season}/${episode}?nextEpisode=true&autoplayNextEpisode=true&episodeSelector=true&overlay=true&color=8B5CF6&branding=0vidads&subtitle=english&server=valstrax`;
        }
    }
    return `${b}/movie/${id}`;
}

/* ---------- DETAIL + PLAYBACK ---------- */
async function openDetail(item, type, seed = {}) {
    const details = await tmdb(`${type}/${item.id}`, { append_to_response: 'external_ids' });

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

    $('p-title').textContent = ctx.title;
    $('p-meta').innerHTML = ''; // Clear previous meta tags
    
    const facts = [];
    const yr = (details.release_date || details.first_air_date || '').slice(0, 4);
    if (yr) facts.push(yr);
    if (details.vote_average) facts.push(`★ ${details.vote_average.toFixed(1)}`);
    if (type === 'movie' && details.runtime) facts.push(`${details.runtime} min`);
    if (type === 'tv' && details.number_of_seasons) facts.push(`${details.number_of_seasons} seasons`);
    (details.genres || []).slice(0, 3).forEach(g => facts.push(g.name));
    facts.forEach(f => {
        const span = document.createElement('span');
        span.textContent = f;
        span.style.marginRight = '10px';
        span.style.color = 'var(--dim)';
        span.style.fontSize = '0.9rem';
        $('p-meta').appendChild(span);
    });

    $('frame-host') && ($('frame-host').innerHTML = ''); // Clear iframe if host exists
    $('p-loading').classList.remove('hidden');
    $('ep-sec').classList.add('hidden');
    $('player-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    paintSources();

    if (type === 'tv') {
        await paintSeasons(details.seasons || []);
    } else {
        await play();
    }
}

function paintSources() {
    const host = $('p-sources');
    host.innerHTML = '';
    PROVIDERS.forEach(p => {
        const b = document.createElement('button');
        b.className = 'chip' + (p.id === ctx.provider ? ' on' : '');
        b.textContent = p.name;
        b.onclick = () => {
            ctx.provider = p.id;
            paintSources();
            mountFrame();
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
            await apiCall('/limits', {
                method: 'POST',
                body: JSON.stringify({ kind, tmdbId: ctx.id, season: ctx.season, episode: ctx.episode })
            });
            ctx.claimed = key;
            // Refresh user data for quota display
            const freshMe = await apiCall('/me');
            me = { ...me, ...freshMe };
            paintQuota();
        } catch (err) {
            $('p-loading').classList.add('hidden');
            $('p-iframe').src = '';
            alert(err.data?.message || 'Playback blocked by quota limits.');
            return;
        }
    }

    mountFrame();

    apiCall('/history', {
        method: 'POST',
        body: JSON.stringify({
            tmdbId: ctx.id, type: ctx.type, title: ctx.title, poster_path: ctx.poster,
            season: ctx.type === 'tv' ? ctx.season : null,
            episode: ctx.type === 'tv' ? ctx.episode : null,
            provider: ctx.provider
        })
    }).then(loadContinue).catch(() => {});
}

function mountFrame() {
    $('p-loading').classList.remove('hidden');
    const iframe = $('p-iframe');
    iframe.src = ''; // Clear previous
    
    const provider = PROVIDERS.find(p => p.id === ctx.provider);
    let url = '';
    
    if (ctx.type === 'movie') {
        url = `${provider.base}/embed/movie/${ctx.id}`;
        if (ctx.provider === 'vidfast' || ctx.provider === 'vidcore') url += '?autoPlay=true';
    } else {
        url = `${provider.base}/embed/tv/${ctx.id}/${ctx.season}/${ctx.episode}`;
    }
    
    iframe.src = url;
    iframe.onload = () => $('p-loading').classList.add('hidden');
    setTimeout(() => $('p-loading').classList.add('hidden'), 4500);
}

async function resume(h) {
    const details = await tmdb(`${h.type}/${h.tmdbId}`);
    await openDetail(details, h.type, { season: h.season, episode: h.episode, provider: h.provider });
}

function closeDetail() {
    $('player-modal').classList.add('hidden');
    $('p-iframe').src = '';
    document.body.style.overflow = '';
}
$('close-player').onclick = closeDetail;
$('player-modal').onclick = e => { if (e.target === $('player-modal')) closeDetail(); };

/* ---------- OWNER CONSOLE ---------- */
$('owner-btn').onclick = () => { $('owner-modal').classList.remove('hidden'); loadDashboard(); };
$('close-owner').onclick = () => $('owner-modal').classList.add('hidden');
$('owner-modal').onclick = e => { if (e.target === $('owner-modal')) $('owner-modal').classList.add('hidden'); };

$('btn-create-user').onclick = async () => {
    const username = $('new-user').value.trim();
    const password = $('new-pass').value;
    const role = $('new-role').value;
    
    if (!username || !password) {
        alert('Username and password required.');
        return;
    }
    
    try {
        await apiCall('/admin', {
            method: 'POST',
            body: JSON.stringify({ action: 'create_user', target_username: username, password, role })
        });
        $('new-user').value = '';
        $('new-pass').value = '';
        await loadDashboard();
    } catch (err) {
        alert(err.data?.error === 'username_taken' ? 'Username already exists.' : 'Failed to create user.');
    }
};

async function loadDashboard() {
    const data = await apiCall('/admin?data=dashboard');
    
    const userList = $('user-list');
    userList.innerHTML = '';
    data.users.forEach(u => {
        const div = document.createElement('div');
        div.className = 'list-item';
        div.innerHTML = `
            <div>
                <strong>${esc(u.username)}</strong> 
                <span class="badge ${u.role}">${u.role}</span>
                ${u.is_minor ? '<span style="font-size:0.7rem;color:var(--success);margin-left:5px;">[Minor]</span>' : ''}
                <div style="font-size:0.75rem;color:var(--dim)">Quota: ${u.quota_movies}/4M · ${u.quota_episodes}/20E</div>
            </div>
            <div class="action-btns">
                ${u.role !== 'owner' ? `
                    <button class="mini-btn" onclick="adminAction('update_role', ${u.id}, 'premium')">Premium</button>
                    <button class="mini-btn" onclick="adminAction('update_role', ${u.id}, 'freemium')">Freemium</button>
                    <button class="mini-btn" onclick="adminAction('update_role', ${u.id}, 'banned')">Ban</button>
                    <button class="mini-btn" onclick="adminAction('reset_quota', ${u.id})">Reset Quota</button>
                ` : '<span style="font-size:0.7rem;color:gold">System Admin</span>'}
            </div>
        `;
        userList.appendChild(div);
    });
    
    const auditList = $('audit-list');
    auditList.innerHTML = data.logs.map(log => `
        <div class="list-item logs">
            [${new Date(log.created_at).toLocaleString()}] <strong>${log.action}</strong>
        </div>
    `).join('') || '<p class="muted">No activity.</p>';
}

window.adminAction = async function(action, target_id, role = null) {
    await apiCall('/admin', {
        method: 'POST',
        body: JSON.stringify({ action, target_id, role })
    });
    await loadDashboard();
};

/* ---------- MISC ---------- */
addEventListener('scroll', () => {
    const nav = $('nav');
    if (nav) nav.classList.toggle('solid', scrollY > 40);
});

addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!$('player-modal').classList.contains('hidden')) closeDetail();
    else if (!$('owner-modal').classList.contains('hidden')) $('owner-modal').classList.add('hidden');
});

if (token) {
    apiCall('/me').then(userData => {
        me = userData;
        $('auth-layer').classList.add('hidden');
        $('app').classList.remove('hidden');
        $('user-display').textContent = me.username;
        $('owner-btn').classList.toggle('hidden', me.role !== 'owner');
        paintQuota();
        loadHome();
    }).catch(signOut);
    }
