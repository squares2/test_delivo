/* ============================================================
   scripts/pwa.js
   PWA: service worker registration + install banner
   ============================================================ */

// ── 1. Register Service Worker ────────────────────────────────
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('[PWA] Service worker registered ✓', reg.scope))
            .catch(err => console.warn('[PWA] SW registration failed:', err));
    });
}

// ── 2. Install banner ─────────────────────────────────────────
let _deferredPrompt = null;
const DISMISSED_KEY  = 'delivo_install_dismissed';

// Don't show if user already dismissed in last 7 days
function wasDismissed() {
    const t = localStorage.getItem(DISMISSED_KEY);
    if (!t) return false;
    return Date.now() - parseInt(t) < 7 * 24 * 60 * 60 * 1000;
}

function showBanner() {
    if (wasDismissed()) return;
    const banner = document.getElementById('install-banner');
    if (banner) {
        banner.style.display = 'flex';
        // Animate in
        setTimeout(() => banner.classList.add('install-banner--visible'), 50);
    }
}

function hideBanner() {
    const banner = document.getElementById('install-banner');
    if (!banner) return;
    banner.classList.remove('install-banner--visible');
    setTimeout(() => { banner.style.display = 'none'; }, 320);
}

// Capture the install prompt
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _deferredPrompt = e;
    // Show banner after a short delay (don't interrupt page load)
    setTimeout(showBanner, 2500);
});

// Install button
document.addEventListener('click', async (e) => {
    if (e.target.closest('#install-btn')) {
        if (!_deferredPrompt) return;
        _deferredPrompt.prompt();
        const { outcome } = await _deferredPrompt.userChoice;
        console.log('[PWA] Install outcome:', outcome);
        _deferredPrompt = null;
        hideBanner();
    }

    // Dismiss button
    if (e.target.closest('#install-dismiss')) {
        localStorage.setItem(DISMISSED_KEY, Date.now().toString());
        hideBanner();
    }
});

// Hide banner if app is already installed
window.addEventListener('appinstalled', () => {
    console.log('[PWA] App installed ✓');
    _deferredPrompt = null;
    hideBanner();
});