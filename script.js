// ----- DOM References -----
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const filterTabs = document.querySelectorAll('.filter-tab');
const articleList = document.getElementById('article-list');
const statusEl = document.getElementById('status');
const loadMoreBtn = document.getElementById('load-more-btn');
const pageInfo = document.getElementById('page-info');
const savedToggle = document.getElementById('saved-toggle');
const savedCount = document.getElementById('saved-count');

// ----- State -----
let currentFilter = 'top';
let currentPage = 0;
let currentQuery = '';
let isLoading = false;
let hasMore = true;
let showingSaved = false;
let savedArticles = [];

// ----- Load saved from LocalStorage -----
function loadSaved() {
    const stored = localStorage.getItem('hnSaved');
    if (stored) {
        try {
            savedArticles = JSON.parse(stored);
        } catch (e) {
            savedArticles = [];
        }
    } else {
        savedArticles = [];
    }
    updateSavedCount();
}

function saveSaved() {
    localStorage.setItem('hnSaved', JSON.stringify(savedArticles));
    updateSavedCount();
}

function updateSavedCount() {
    savedCount.textContent = savedArticles.length;
}

// ----- Check if an article is saved -----
function isSaved(objectID) {
    return savedArticles.some(a => a.objectID === objectID);
}

// ----- Toggle save -----
function toggleSave(article) {
    const index = savedArticles.findIndex(a => a.objectID === article.objectID);
    if (index > -1) {
        savedArticles.splice(index, 1);
    } else {
        savedArticles.push(article);
    }
    saveSaved();
    // Re-render current view if showing saved
    if (showingSaved) {
        renderSavedView();
    } else {
        // Re-render list to update save button states
        renderArticles(currentArticles);
    }
}

// ----- Debounce Utility -----
function debounce(fn, delay = 400) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(this, args), delay);
    };
}

// ----- API Call -----
async function fetchStories(filter, page = 0, query = '') {
    const baseUrl = 'https://hn.algolia.com/api/v1';
    let url;

    if (query.trim()) {
        // Search endpoint
        url = `${baseUrl}/search?query=${encodeURIComponent(query.trim())}&page=${page}&hitsPerPage=20`;
    } else {
        // Filter endpoints
        const filters = {
            top: 'search?tags=front_page',
            new: 'search?tags=story&sortBy=date',
            ask: 'search?tags=ask_hn',
            show: 'search?tags=show_hn',
            jobs: 'search?tags=job',
        };
        url = `${baseUrl}/${filters[filter] || filters.top}&page=${page}&hitsPerPage=20`;
    }

    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch stories');
    const data = await res.json();
    return data;
}

// ----- Store current articles for re-render -----
let currentArticles = [];

// ----- Render Articles -----
function renderArticles(articles) {
    if (showingSaved) return;

    if (!articles || articles.length === 0) {
        if (currentPage === 0) {
            articleList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📭</div>
                    <h3>No stories found</h3>
                    <p>Try a different search or filter.</p>
                </div>
            `;
        }
        return;
    }

    articleList.innerHTML = articles.map(article => {
        const saved = isSaved(article.objectID);
        const title = article.title || 'Untitled';
        const url = article.url || `https://news.ycombinator.com/item?id=${article.objectID}`;
        const points = article.points || 0;
        const author = article.author || 'anonymous';
        const comments = article.num_comments || 0;
        const timeAgo = article.created_at ? timeSince(new Date(article.created_at)) : 'recently';

        return `
            <div class="article-card" data-id="${article.objectID}">
                <div class="article-info">
                    <a href="${url}" target="_blank" rel="noopener noreferrer" class="article-title">
                        ${escapeHtml(title)}
                    </a>
                    <div class="article-meta">
                        <span>⭐ ${points} points</span>
                        <span>👤 ${escapeHtml(author)}</span>
                        <span>💬 ${comments} comments</span>
                        <span>🕐 ${timeAgo}</span>
                    </div>
                </div>
                <div class="article-actions">
                    <span class="article-score">${points}</span>
                    <button class="btn-save-article ${saved ? 'saved' : ''}" data-id="${article.objectID}">
                        ${saved ? '⭐ Saved' : '☆ Save'}
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // Add event listeners to save buttons
    document.querySelectorAll('.btn-save-article').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const article = currentArticles.find(a => a.objectID === id);
            if (article) {
                toggleSave(article);
            }
        });
    });
}

// ----- Render Saved View -----
function renderSavedView() {
    showingSaved = true;
    loadMoreBtn.style.display = 'none';
    pageInfo.style.display = 'none';
    statusEl.textContent = `⭐ Showing ${savedArticles.length} saved articles`;
    statusEl.className = 'status success';

    if (savedArticles.length === 0) {
        articleList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⭐</div>
                <h3>No saved articles yet</h3>
                <p>Click "Save" on any article to add it here.</p>
            </div>
        `;
        return;
    }

    // Display saved articles (sort by saved order, newest first)
    const sorted = [...savedArticles].reverse();
    articleList.innerHTML = sorted.map(article => {
        const title = article.title || 'Untitled';
        const url = article.url || `https://news.ycombinator.com/item?id=${article.objectID}`;
        const points = article.points || 0;
        const author = article.author || 'anonymous';
        const comments = article.num_comments || 0;
        const timeAgo = article.created_at ? timeSince(new Date(article.created_at)) : 'recently';

        return `
            <div class="article-card" data-id="${article.objectID}">
                <div class="article-info">
                    <a href="${url}" target="_blank" rel="noopener noreferrer" class="article-title">
                        ${escapeHtml(title)}
                    </a>
                    <div class="article-meta">
                        <span>⭐ ${points} points</span>
                        <span>👤 ${escapeHtml(author)}</span>
                        <span>💬 ${comments} comments</span>
                        <span>🕐 ${timeAgo}</span>
                    </div>
                </div>
                <div class="article-actions">
                    <span class="article-score">${points}</span>
                    <button class="btn-save-article saved" data-id="${article.objectID}">
                        ☆ Remove
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // Remove event listeners for saved view
    document.querySelectorAll('.btn-save-article').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const article = savedArticles.find(a => a.objectID === id);
            if (article) {
                toggleSave(article);
                renderSavedView(); // re-render saved view
            }
        });
    });
}

// ----- Helper: Escape HTML -----
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ----- Helper: Time ago -----
function timeSince(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    const intervals = {
        year: 31536000,
        month: 2592000,
        week: 604800,
        day: 86400,
        hour: 3600,
        minute: 60,
    };
    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
        const interval = Math.floor(seconds / secondsInUnit);
        if (interval >= 1) {
            return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
        }
    }
    return 'just now';
}

// ----- Load Stories -----
async function loadStories(reset = true) {
    if (isLoading) return;
    if (showingSaved) return;

    if (reset) {
        currentPage = 0;
        hasMore = true;
        currentArticles = [];
        articleList.innerHTML = '';
    }

    isLoading = true;
    loadMoreBtn.disabled = true;
    statusEl.textContent = '⏳ Loading stories...';
    statusEl.className = 'status';

    try {
        const data = await fetchStories(currentFilter, currentPage, currentQuery);
        const hits = data.hits || [];
        hasMore = data.page < data.nbPages - 1;

        if (reset) {
            currentArticles = hits;
        } else {
            currentArticles = [...currentArticles, ...hits];
        }

        renderArticles(currentArticles);
        pageInfo.textContent = `Page ${currentPage + 1}`;

        if (currentArticles.length === 0 && currentPage === 0) {
            statusEl.textContent = '📭 No stories found. Try a different filter or search.';
            statusEl.className = 'status';
        } else {
            statusEl.textContent = `✅ Showing ${currentArticles.length} stories`;
            statusEl.className = 'status success';
        }

        currentPage++;
        loadMoreBtn.style.display = hasMore ? 'block' : 'none';

    } catch (error) {
        statusEl.textContent = `❌ ${error.message}`;
        statusEl.className = 'status error';
    } finally {
        isLoading = false;
        loadMoreBtn.disabled = false;
    }
}

// ----- Search with Debouncing -----
const debouncedSearch = debounce(() => {
    const query = searchInput.value.trim();
    currentQuery = query;
    // Reset to first page
    loadStories(true);
}, 400);

// ----- Event Listeners -----

// Search input with debounce
searchInput.addEventListener('input', debouncedSearch);

// Search button (immediate)
searchBtn.addEventListener('click', () => {
    currentQuery = searchInput.value.trim();
    loadStories(true);
});

// Enter key on search
searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        currentQuery = searchInput.value.trim();
        loadStories(true);
    }
});

// Filter tabs
filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        filterTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentFilter = tab.dataset.filter;
        // Clear search when switching filters
        searchInput.value = '';
        currentQuery = '';
        // Exit saved view if active
        if (showingSaved) {
            showingSaved = false;
            loadMoreBtn.style.display = 'block';
            pageInfo.style.display = 'block';
            savedToggle.classList.remove('active');
        }
        loadStories(true);
    });
});

// Load more
loadMoreBtn.addEventListener('click', () => {
    if (!isLoading && hasMore) {
        loadStories(false);
    }
});

// Saved toggle
savedToggle.addEventListener('click', () => {
    if (showingSaved) {
        // Exit saved view
        showingSaved = false;
        savedToggle.classList.remove('active');
        loadMoreBtn.style.display = 'block';
        pageInfo.style.display = 'block';
        // Re-render current articles
        if (currentArticles.length > 0) {
            renderArticles(currentArticles);
            statusEl.textContent = `✅ Showing ${currentArticles.length} stories`;
            statusEl.className = 'status success';
        } else {
            loadStories(true);
        }
    } else {
        renderSavedView();
        savedToggle.classList.add('active');
        loadMoreBtn.style.display = 'none';
        pageInfo.style.display = 'none';
    }
});

// ----- Initialize -----
loadSaved();
loadStories(true);
