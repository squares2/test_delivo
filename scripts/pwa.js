/* ============================================================
   scripts/pwa.js
   PWA: service worker registration + install banner
   ============================================================ */

// ── 1. Register Service Worker ────────────────────────────────
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('[PWA] Service worker registered ✓', reg.scope))
            .catch(err => console.warn('[PWA] SW registration failed:', err));
    });
}

// ── 2. Install banner ─────────────────────────────────────────
let _deferredPrompt = null;
const SNOOZE_KEY = 'delivo_install_snooze';

// Snooze: hide for 1 day if user taps ✕ (don't block for 7 days)
function isSnoozed() {
    const t = localStorage.getItem(SNOOZE_KEY);
    if (!t) return false;
    return Date.now() - parseInt(t) < 24 * 60 * 60 * 1000; // 1 day
}

function showBanner() {
    if (isSnoozed()) return;
    const banner = document.getElementById('install-banner');
    if (!banner) return;
    banner.style.display = 'flex';
    setTimeout(() => banner.classList.add('install-banner--visible'), 50);
}

function hideBanner(snooze = false) {
    const banner = document.getElementById('install-banner');
    if (!banner) return;
    if (snooze) localStorage.setItem(SNOOZE_KEY, Date.now().toString());
    banner.classList.remove('install-banner--visible');
    setTimeout(() => { banner.style.display = 'none'; }, 320);
}

// ── Dev helper: force show banner (call in console: showInstallBanner()) ──
window.showInstallBanner = function() {
    localStorage.removeItem(SNOOZE_KEY);
    showBanner();
};

// Capture the install prompt — keep it alive, don't consume it on dismiss
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _deferredPrompt = e;
    setTimeout(showBanner, 2500);
});

// Expose triggerInstall so it can be called from anywhere (e.g. app-download section)
window.triggerInstall = async function() {
    if (!_deferredPrompt) return;
    _deferredPrompt.prompt();
    const { outcome } = await _deferredPrompt.userChoice;
    console.log('[PWA] Install outcome:', outcome);
    if (outcome === 'accepted') {
        _deferredPrompt = null;
        hideBanner();
    }
    // If dismissed — keep _deferredPrompt alive so user can try again
};

document.addEventListener('click', async (e) => {
    // Install button
    if (e.target.closest('#install-btn')) {
        await window.triggerInstall();
        return;
    }
    // Dismiss — just snooze 1 day, don't consume the prompt
    if (e.target.closest('#install-dismiss')) {
        hideBanner(true); // snooze = true
        return;
    }
});

// Hide when installed
window.addEventListener('appinstalled', () => {
    console.log('[PWA] App installed ✓');
    _deferredPrompt = null;
    hideBanner();
    localStorage.removeItem(SNOOZE_KEY);
});