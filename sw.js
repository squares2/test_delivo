/* ============================================================
   sw.js — Delivo Service Worker
   Strategy: Cache-first for assets, network-first for components.
   Update CACHE_VERSION when you deploy changes.
   ============================================================ */

const CACHE_VERSION = 'delivo-v1';

const PRECACHE_ASSETS = [
    '/',
    '/index.html',
    '/styles/base.css',
    '/styles/navbar.css',
    '/styles/hero.css',
    '/styles/cards.css',
    '/styles/modals.css',
    '/styles/footer.css',
    '/scripts/loader.js',
    '/scripts/navbar.js',
    '/scripts/modals.js',
    '/scripts/stores.js',
    '/scripts/cart.js',
    '/assets/logo.png',
    '/assets/hero_temple_bg.jpg',
];

// Install: pre-cache all core assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then(cache => cache.addAll(PRECACHE_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Activate: delete old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
            )
        ).then(() => self.clients.claim())
    );
});

// Fetch: cache-first for assets, network-first for components
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Network-first for HTML components (so updates show quickly)
    if (url.pathname.startsWith('/components/')) {
        event.respondWith(
            fetch(event.request)
                .then(res => {
                    const clone = res.clone();
                    caches.open(CACHE_VERSION).then(c => c.put(event.request, clone));
                    return res;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // Cache-first for everything else
    event.respondWith(
        caches.match(event.request)
            .then(cached => cached || fetch(event.request))
    );
});
