/* ============================================================
   sw.js — Delivo Service Worker v2
   Cache-first for assets, network-first for HTML/components.
   Bump CACHE_VERSION on every deployment.
   ============================================================ */

const CACHE_VERSION = 'delivo-v2';

const PRECACHE_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/styles/base.css',
    '/styles/navbar.css',
    '/styles/hero.css',
    '/styles/cards.css',
    '/styles/modals.css',
    '/styles/footer.css',
    '/scripts/loader.js',
    '/scripts/navbar.js',
    '/scripts/modals.js',
    '/scripts/modal-auth.js',
    '/scripts/stores.js',
    '/scripts/cart.js',
    '/scripts/pwa.js',
    '/assets/logo.png',
    '/assets/hero_temple_bg.jpg',
];

// Install — pre-cache core assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then(cache => cache.addAll(
                // Skip assets that might not exist yet
                PRECACHE_ASSETS.map(url => new Request(url, { cache: 'reload' }))
            ))
            .catch(err => console.warn('[SW] Precache partial fail:', err))
            .then(() => self.skipWaiting())
    );
});

// Activate — delete old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

// Fetch strategy
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Skip non-GET and cross-origin requests
    if (event.request.method !== 'GET') return;
    if (!url.origin.includes(self.location.origin) &&
        !url.origin.includes('gstatic.com') &&
        !url.origin.includes('googleapis.com') &&
        !url.origin.includes('fonts.googleapis.com')) return;

    // Network-first for HTML and components (always fresh)
    if (url.pathname.endsWith('.html') ||
        url.pathname.startsWith('/components/')) {
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

    // Cache-first for CSS, JS, images
    event.respondWith(
        caches.match(event.request)
            .then(cached => cached || fetch(event.request)
                .then(res => {
                    const clone = res.clone();
                    caches.open(CACHE_VERSION).then(c => c.put(event.request, clone));
                    return res;
                })
            )
    );
});