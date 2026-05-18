/* ============================================================
   sw.js — Delivo Service Worker v3
   Uses relative URLs so it works on any subfolder hosting
   (e.g. squares2.github.io/test_delivo/ or a real domain).
   Bump CACHE_VERSION on every deployment.
   ============================================================ */

const CACHE_VERSION = 'delivo-v3';

const PRECACHE_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './styles/base.css',
    './styles/navbar.css',
    './styles/hero.css',
    './styles/cards.css',
    './styles/modals.css',
    './styles/footer.css',
    './scripts/loader.js',
    './scripts/navbar.js',
    './scripts/modals.js',
    './scripts/modal-auth.js',
    './scripts/firebase-init.js',
    './scripts/stores.js',
    './scripts/cart.js',
    './scripts/pwa.js',
    './assets/logo.png',
    './assets/hero_temple_bg.jpg',
];

// Install — pre-cache core assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then(cache => {
                // Add one by one so a missing asset doesn't kill the whole SW
                return Promise.allSettled(
                    PRECACHE_ASSETS.map(url => cache.add(url).catch(e => {
                        console.warn('[SW] Could not cache:', url, e.message);
                    }))
                );
            })
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
    // Only handle GET requests
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // Skip Firebase, Google APIs — always network
    if (url.hostname.includes('googleapis.com') ||
        url.hostname.includes('gstatic.com') ||
        url.hostname.includes('firebaseio.com')) return;

    // Network-first for HTML and components (always fresh content)
    if (url.pathname.endsWith('.html') ||
        url.pathname.includes('/components/')) {
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

    // Cache-first for CSS, JS, images, fonts
    event.respondWith(
        caches.match(event.request)
            .then(cached => {
                if (cached) return cached;
                return fetch(event.request).then(res => {
                    if (!res || res.status !== 200) return res;
                    const clone = res.clone();
                    caches.open(CACHE_VERSION).then(c => c.put(event.request, clone));
                    return res;
                });
            })
    );
});