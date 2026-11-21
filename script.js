const API_KEY = '68838ceeee95b5f7a28ddd04dcad19cc'; // ← PUT YOUR KEY HERE
const GRID = document.getElementById('grid');
const MODAL = document.getElementById('modal');
const SEARCH = document.getElementById('search');
const OUTPUT = document.getElementById('output');
const LOADING = document.getElementById('loading');
const ERROR_MSG = document.getElementById('error-msg');
const SOURCE_LIST = document.getElementById('source-list');
const EPISODE_SELECTOR = document.getElementById('episode-selector');
const SEASON_TABS = document.getElementById('season-tabs');
const EPISODE_LIST = document.getElementById('episode-list');

let currentShow = null;
let currentSeason = 1;
let currentEpisode = 1;
let currentTMDBId = null;
let currentType = 'movie';
let activeProvider = 'vidsrc_to';

// The Ultimate Provider List (Verified Working Endpoints)
const PROVIDERS = [
    { name: 'VidSrc (Main)', id: 'vidsrc_to', base: 'https://vidsrc.to' },
    { name: 'VidSrc (Backup)', id: 'vidsrc_me', base: 'https://vidsrc.me' },
    { name: 'SuperEmbed', id: 'superembed', base: 'https://multiembed.mov' }, // Powers many sites
    { name: 'AutoEmbed', id: 'autoembed', base: 'https://autoembed.co' },
    { name: 'VidRock', id: 'vidrock', base: 'https://vidrock.to' },
    { name: '2Embed', id: '2embed', base: 'https://2embed.cc' },
    { name: 'Embed.su', id: 'embed_su', base: 'https://embed.su' },
    { name: 'MoviesAPI', id: 'moviesapi', base: 'https://moviesapi.club' },
    { name: 'VidCloud', id: 'vidcloud', base: 'https://vidcloud.icu' }, // Often used by fmov
    { name: 'UpCloud', id: 'upcloud', base: 'https://upcloud.pro' }     // Backup for vidcloud
];

window.addEventListener('scroll', () => {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 50) navbar.classList.add('scrolled');
    else navbar.classList.remove('scrolled');
});

async function searchTMDB(query, type = 'movie') {
    const url = type === 'movie' 
        ? `https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(query)}`
        : `https://api.themoviedb.org/3/search/tv?api_key=${API_KEY}&query=${encodeURIComponent(query)}`;
    
    try {
        const res = await fetch(url);
        const data = await res.json();
        renderGrid(data.results, type);
    } catch (e) { console.error('TMDB error:', e); }
}

function renderGrid(items, type) {
    GRID.innerHTML = '';
    items.forEach(item => {
        if (!item.poster_path) return;
        const title = type === 'movie' ? item.title : item.name;
        const year = (item.release_date || item.first_air_date || '').split('-')[0];
        
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <img src="https://image.tmdb.org/t/p/w500${item.poster_path}" alt="${title}">
            <h3>${title}</h3>
            <div class="year">${year}</div>
        `;
        card.onclick = () => openModal(item, type);
        GRID.appendChild(card);
    });
}

function getEmbedUrl(providerId, tmdbId, season, episode) {
    const provider = PROVIDERS.find(p => p.id === providerId) || PROVIDERS[0];
    const base = provider.base;
    
    if (currentType === 'movie') {
        switch(providerId) {
            case 'vidsrc_to': return `${base}/embed/movie/${tmdbId}`;
            case 'vidsrc_me': return `${base}/embed/movie?tmdb=${tmdbId}`;
            case 'superembed': return `${base}/?video_id=${tmdbId}&tmdb=1`;
            case 'autoembed': return `${base}/movie/${tmdbId}`;
            case 'vidrock': return `${base}/embed/movie/${tmdbId}`;
            case '2embed': return `${base}/embed/movie/${tmdbId}`;
            case 'embed_su': return `${base}/embed/movie/${tmdbId}`;
            case 'moviesapi': return `${base}/movie/${tmdbId}`;
            case 'vidcloud': return `${base}/embed/movie/${tmdbId}`;
            case 'upcloud': return `${base}/embed/movie/${tmdbId}`;
            default: return `${base}/embed/movie/${tmdbId}`;
        }
    } else {
        switch(providerId) {
            case 'vidsrc_to': return `${base}/embed/tv/${tmdbId}/${season}/${episode}`;
            case 'vidsrc_me': return `${base}/embed/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}`;
            case 'superembed': return `${base}/?video_id=${tmdbId}&tmdb=1&s=${season}&e=${episode}`;
            case 'autoembed': return `${base}/tv/${tmdbId}/${season}/${episode}`;
            case 'vidrock': return `${base}/embed/tv/${tmdbId}/${season}/${episode}`;
            case '2embed': return `${base}/embed/tv/${tmdbId}/${season}/${episode}`;
            case 'embed_su': return `${base}/embed/tv/${tmdbId}/${season}/${episode}`;
            case 'moviesapi': return `${base}/tv/${tmdbId}-${season}-${episode}`;
            case 'vidcloud': return `${base}/embed/tv/${tmdbId}/${season}/${episode}`;
            case 'upcloud': return `${base}/embed/tv/${tmdbId}/${season}/${episode}`;
            default: return `${base}/embed/tv/${tmdbId}/${season}/${episode}`;
        }
    }
}

function playStream(url) {
    LOADING.classList.remove('hidden');
    ERROR_MSG.classList.add('hidden');
    OUTPUT.innerHTML = '';
    
    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.allowFullscreen = true;
    iframe.allow = "encrypted-media; autoplay; clipboard-write";
    
    // Error handling for iframes
    // Note: Cross-origin iframes don't always trigger onload/onerror correctly for content errors,
    // but this catches network failures. For "content not available" pages, we rely on the user seeing it.
    iframe.onerror = () => {
        LOADING.classList.add('hidden');
        ERROR_MSG.classList.remove('hidden');
    };

    // Fallback timeout: if loading takes too long, assume it's stuck or blocked
    setTimeout(() => {
        LOADING.classList.add('hidden');
    }, 4000);
    
    OUTPUT.appendChild(iframe);
}

function displaySourceButtons() {
    SOURCE_LIST.innerHTML = '';
    
    PROVIDERS.forEach((provider) => {
        const btn = document.createElement('button');
        btn.className = 'source-btn';
        btn.innerText = provider.name;
        btn.dataset.id = provider.id;
        
        if (provider.id === activeProvider) btn.classList.add('active');
        
        btn.onclick = () => {
            activeProvider = provider.id;
            document.querySelectorAll('.source-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const url = getEmbedUrl(activeProvider, currentTMDBId, currentSeason, currentEpisode);
            playStream(url);
        };
        SOURCE_LIST.appendChild(btn);
    });
    
    const url = getEmbedUrl(activeProvider, currentTMDBId, currentSeason, currentEpisode);
    playStream(url);
}

async function getShowDetails(tvId) {
    const res = await fetch(`https://api.themoviedb.org/3/tv/${tvId}?api_key=${API_KEY}`);
    return await res.json();
}

async function renderEpisodeSelector(show) {
    const details = await getShowDetails(show.id);
    currentShow = show;
    currentTMDBId = show.id;
    currentSeason = 1;
    currentEpisode = 1;
    
    SEASON_TABS.innerHTML = '';
    details.seasons.forEach(season => {
        if (season.season_number === 0) return;
        
        const tab = document.createElement('button');
        tab.className = 'season-tab' + (season.season_number === 1 ? ' active' : '');
        tab.textContent = `Season ${season.season_number}`;
        tab.onclick = () => selectSeason(season.season_number, details.seasons);
        SEASON_TABS.appendChild(tab);
    });
    
    selectSeason(1, details.seasons);
    EPISODE_SELECTOR.classList.remove('hidden');
}

async function selectSeason(seasonNum, seasons) {
    currentSeason = seasonNum;
    currentEpisode = 1;
    
    document.querySelectorAll('.season-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.textContent === `Season ${seasonNum}`) tab.classList.add('active');
    });
    
    const season = seasons.find(s => s.season_number === seasonNum);
    if (!season) return;
    
    const res = await fetch(`https://api.themoviedb.org/3/tv/${currentShow.id}/season/${seasonNum}?api_key=${API_KEY}`);
    const seasonData = await res.json();
    
    EPISODE_LIST.innerHTML = '';
    seasonData.episodes.forEach(ep => {
        const btn = document.createElement('button');
        btn.className = 'episode-btn';
        btn.textContent = `E${ep.episode_number}: ${ep.name}`;
        btn.onclick = () => selectEpisode(ep.episode_number);
        EPISODE_LIST.appendChild(btn);
    });
    
    selectEpisode(1);
}

function selectEpisode(episodeNum) {
    currentEpisode = episodeNum;
    
    document.querySelectorAll('.episode-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent.startsWith(`E${episodeNum}:`)) btn.classList.add('active');
    });
    
    const url = getEmbedUrl(activeProvider, currentTMDBId, currentSeason, currentEpisode);
    playStream(url);
}

async function openModal(item, type) {
    currentType = type;
    currentTMDBId = item.id;
    currentSeason = 1;
    currentEpisode = 1;
    activeProvider = 'vidsrc_to';
    
    const title = type === 'movie' ? item.title : item.name;
    
    document.getElementById('m-title').innerText = title;
    document.getElementById('m-plot').innerText = item.overview;
    document.getElementById('m-poster').src = `https://image.tmdb.org/t/p/w500${item.poster_path}`;
    
    SOURCE_LIST.innerHTML = '';
    OUTPUT.innerHTML = '';
    LOADING.classList.remove('hidden');
    ERROR_MSG.classList.add('hidden');
    EPISODE_SELECTOR.classList.add('hidden');
    
    if (type === 'movie') {
        displaySourceButtons();
    } else {
        await renderEpisodeSelector(item);
        displaySourceButtons();
    }
    
    MODAL.classList.remove('hidden');
}

document.getElementById('close').onclick = () => {
    MODAL.classList.add('hidden');
    OUTPUT.innerHTML = '';
};

document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const type = btn.dataset.type;
        searchTMDB(SEARCH.value || 'avengers', type);
    };
});

SEARCH.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
        const type = document.querySelector('.nav-btn.active').dataset.type;
        searchTMDB(e.target.value, type);
    }
});

searchTMDB('avengers', 'movie');
