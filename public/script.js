const API = '/api';
let token = localStorage.getItem('nexa_token');
let currentUser = null;
let currentMedia = { id: null, type: 'movie', season: 1, episode: 1, title: '', poster: '' };
let activeProvider = 'vidrock';

const PROVIDERS = [
    { id: 'vidrock', name: 'VidRock', base: 'https://vidrock.to' },
    { id: 'vidlink', name: 'VidLink', base: 'https://vidlink.pro' },
    { id: 'vidfast', name: 'VidFast', base: 'https://vidfast.vc' },
    { id: 'vidcore', name: 'VidCore', base: 'https://vidcore.io' }
];

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    if (token) await validateSession();
    setupAuthListeners();
});

async function validateSession() {
    try {
        const res = await fetch(`${API}/history`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error('Invalid token');
        // We need to re-fetch user info. In a real app, you'd have a /me endpoint.
        // For now, we'll decode token or just load app and assume valid.
        // To properly handle needs_tos, we modify login to store user in sessionStorage.
        const cachedUser = JSON.parse(sessionStorage.getItem('nexa_user'));
        if (!cachedUser) return logout();
        
        currentUser = cachedUser;
        enterApp();
    } catch (e) {
        logout();
    }
}

function enterApp() {
    document.getElementById('auth-layer').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('user-display').textContent = currentUser.username;
    
    if (currentUser.role === 'owner') {
        document.getElementById('owner-btn').classList.remove('hidden');
    }
    
    updateQuotaUI();
    loadHomeContent('movie');
    loadContinueWatching();
}

// --- AUTH & TOS FLOW ---
function setupAuthListeners() {
    // Login
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('l-user').value;
        const password = document.getElementById('l-pass').value;
        
        try {
            const res = await fetch(`${API}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            
            token = data.token;
            currentUser = data.user;
            localStorage.setItem('nexa_token', token);
            sessionStorage.setItem('nexa_user', JSON.stringify(currentUser));
            
            handlePostLogin();
        } catch (err) {
            document.getElementById('l-error').textContent = err.message === 'account_banned' ? 'Account suspended.' : 'Invalid credentials.';
        }
    });

    // TOS Checkbox Logic
    document.getElementById('chk-minor').addEventListener('change', (e) => {
        document.getElementById('guardian-box').classList.toggle('hidden', !e.target.checked);
    });

    // Accept TOS
    document.getElementById('btn-accept-tos').addEventListener('click', async () => {
        const accepted = document.getElementById('chk-tos').checked;
        const isMinor = document.getElementById('chk-minor').checked;
        const guardianName = document.getElementById('g-name').value.trim();

        if (!accepted) return showTosError('You must accept the Terms of Service.');
        if (isMinor && !guardianName) return showTosError('Guardian name is required for minors.');

        try {
            const res = await fetch(`${API}/consent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ accepted_tos: true, is_minor: isMinor, guardian_name: guardianName })
            });
            if (!res.ok) throw new Error();
            
            // Update local state
            currentUser.needs_tos = false;
            sessionStorage.setItem('nexa_user', JSON.stringify(currentUser));
            showInstructions();
        } catch (e) {
            showTosError('Failed to save consent.');
        }
    });

    document.getElementById('btn-close-instructions').addEventListener('click', enterApp);
    document.getElementById('logout-btn').addEventListener('click', logout);
}

function handlePostLogin() {
    if (currentUser.needs_tos) {
        document.getElementById('login-card').classList.add('hidden');
        document.getElementById('tos-card').classList.remove('hidden');
    } else {
        showInstructions();
    }
}

function showInstructions() {
    document.getElementById('login-card').classList.add('hidden');
    document.getElementById('tos-card').classList.add('hidden');
    document.getElementById('instructions-card').classList.remove('hidden');
}

function showTosError(msg) {
    document.getElementById('tos-error').textContent = msg;
}

function logout() {
    localStorage.removeItem('nexa_token');
    sessionStorage.removeItem('nexa_user');
    location.reload();
}

// --- MAIN APP LOGIC ---
function updateQuotaUI() {
    const pill = document.getElementById('quota-pill');
    if (currentUser.role === 'freemium') {
        pill.classList.remove('hidden');
        // This is simplified. In production, you'd fetch exact limits.
        pill.textContent = `Movies: ${currentUser.quota_movies}/4`;
    } else {
        pill.classList.add('hidden');
    }
}

async function loadHomeContent(type) {
    const grid = document.getElementById('content-grid');
    const title = document.getElementById('content-title');
    title.textContent = type === 'movie' ? 'Trending Movies' : 'Trending Series';
    grid.innerHTML = '<div class="loader" style="height:200px"></div>';

    // Using TMDB API (In production, put this behind your API to hide the key)
    const tmdbKey = 'YOUR_TMDB_API_KEY'; 
    const url = type === 'movie' 
        ? `https://api.themoviedb.org/3/trending/movie/week?api_key=${tmdbKey}`
        : `https://api.themoviedb.org/3/trending/tv/week?api_key=${tmdbKey}`;

    const res = await fetch(url);
    const data = await res.json();
    
    grid.innerHTML = '';
    data.results.forEach(item => {
        const img = `https://image.tmdb.org/t/p/w500${item.poster_path}`;
        const name = item.title || item.name;
        
        const card = document.createElement('div');
        card.className = 'media-card';
        card.innerHTML = `
            <img src="${img}" alt="${name}">
            <div class="card-info">
                <h4>${name}</h4>
                <span>${item.release_date || item.first_air_date || ''}</span>
            </div>
        `;
        card.onclick = () => openPlayer(item.id, type, name, item.poster_path);
        grid.appendChild(card);
    });
}

async function loadContinueWatching() {
    const res = await fetch(`${API}/history`, { headers: { Authorization: `Bearer ${token}` } });
    const history = await res.json();
    
    if (history.length === 0) return;
    
    document.getElementById('continue-section').classList.remove('hidden');
    const row = document.getElementById('continue-row');
    row.innerHTML = '';
    
    history.forEach(item => {
        const progress = item.duration_seconds > 0 ? (item.progress_seconds / item.duration_seconds) * 100 : 0;
        const card = document.createElement('div');
        card.className = 'media-card';
        card.style.width = '180px';
        card.innerHTML = `
            <img src="https://image.tmdb.org/t/p/w500${item.poster_path}">
            <div class="card-info">
                <h4>${item.title}</h4>
                <span>${item.type === 'tv' ? `S${item.season} E${item.episode}` : 'Movie'}</span>
            </div>
            <div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div>
        `;
        card.onclick = () => openPlayer(item.tmdb_id, item.type, item.title, item.poster_path, item.season, item.episode);
        row.appendChild(card);
    });
}

// --- PLAYER ---
function openPlayer(id, type, title, poster, season = 1, episode = 1) {
    currentMedia = { id, type, title, poster, season, episode };
    document.getElementById('p-title').textContent = title;
    document.getElementById('player-modal').classList.remove('hidden');
    
    // Render Sources
    const srcContainer = document.getElementById('p-sources');
    srcContainer.innerHTML = '';
    PROVIDERS.forEach(p => {
        const chip = document.createElement('div');
        chip.className = `chip ${p.id === activeProvider ? 'active' : ''}`;
        chip.textContent = p.name;
        chip.onclick = () => {
            activeProvider = p.id;
            document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            mountStream();
        };
        srcContainer.appendChild(chip);
    });
    
    mountStream();
}

async function mountStream() {
    const iframe = document.getElementById('p-iframe');
    document.getElementById('p-loading').classList.remove('hidden');
    
    // Record Play (Quota Check)
    try {
        const res = await fetch(`${API}/history`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
                action: 'play',
                tmdb_id: currentMedia.id,
                type: currentMedia.type,
                title: currentMedia.title,
                poster_path: currentMedia.poster,
                season: currentMedia.type === 'tv' ? currentMedia.season : null,
                episode: currentMedia.type === 'tv' ? currentMedia.episode : null,
                provider: activeProvider
            })
        });
        
        if (!res.ok) {
            const err = await res.json();
            alert(err.error === 'quota_reached_movies' ? 'Daily movie limit reached.' : 'Daily episode limit reached.');
            document.getElementById('player-modal').classList.add('hidden');
            return;
        }
    } catch (e) { console.error(e); }

    // Build URL
    const provider = PROVIDERS.find(p => p.id === activeProvider);
    let url = '';
    
    if (currentMedia.type === 'movie') {
        url = `${provider.base}/embed/movie/${currentMedia.id}`;
        if (activeProvider === 'vidfast' || activeProvider === 'vidcore') url += '?autoPlay=true';
    } else {
        url = `${provider.base}/embed/tv/${currentMedia.id}/${currentMedia.season}/${currentMedia.episode}`;
    }
    
    iframe.src = url;
    iframe.onload = () => document.getElementById('p-loading').classList.add('hidden');
}

document.getElementById('close-player').onclick = () => {
    document.getElementById('player-modal').classList.add('hidden');
    document.getElementById('p-iframe').src = '';
};

// --- OWNER COMMAND CENTER ---
document.getElementById('owner-btn').onclick = async () => {
    document.getElementById('owner-modal').classList.remove('hidden');
    await loadDashboard();
};
document.getElementById('close-owner').onclick = () => document.getElementById('owner-modal').classList.add('hidden');

async function loadDashboard() {
    const res = await fetch(`${API}/admin?data=dashboard`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    
    // Render Users
    const userList = document.getElementById('user-list');
    userList.innerHTML = '';
    data.users.forEach(u => {
        const div = document.createElement('div');
        div.className = 'list-item';
        div.innerHTML = `
            <div>
                <strong>${u.username}</strong> 
                <span class="badge ${u.role}">${u.role}</span>
                ${u.is_minor ? '<span style="font-size:0.7rem;color:var(--success);margin-left:5px;">[Minor]</span>' : ''}
                <div style="font-size:0.75rem;color:var(--text-dim)">Quota: ${u.quota_movies}M / ${u.quota_episodes}E</div>
            </div>
            <div class="action-btns">
                ${u.role !== 'owner' ? `
                    <button class="mini-btn" onclick="adminAction('update_role', ${u.id}, 'premium')">Premium</button>
                    <button class="mini-btn" onclick="adminAction('update_role', ${u.id}, 'banned')">Ban</button>
                    <button class="mini-btn" onclick="adminAction('reset_quota', ${u.id})">Reset Quota</button>
                ` : '<span style="font-size:0.7rem;color:gold">System Admin</span>'}
            </div>
        `;
        userList.appendChild(div);
    });
    
    // Render Logs
    const auditList = document.getElementById('audit-list');
    auditList.innerHTML = data.logs.map(log => `
        <div class="list-item logs">
            [${new Date(log.created_at).toLocaleTimeString()}] <strong>${log.action}</strong> - Details: ${JSON.stringify(log.details)}
        </div>
    `).join('') || 'No activity.';
}

async function adminAction(action, target_id, role = null) {
    await fetch(`${API}/admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, target_id, role })
    });
    await loadDashboard();
}

document.getElementById('btn-create-user').onclick = async () => {
    const username = document.getElementById('new-user').value;
    const password = document.getElementById('new-pass').value;
    const role = document.getElementById('new-role').value;
    
    const res = await fetch(`${API}/admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'create_user', target_username: username, password, role })
    });
    
    if (res.ok) {
        document.getElementById('new-user').value = '';
        document.getElementById('new-pass').value = '';
        await loadDashboard();
    } else {
        alert('Username already taken.');
    }
};
