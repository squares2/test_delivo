/* ============================================================
   scripts/pwa.js
   PWA: service worker registration + install banner
   ============================================================ */

// ── 1. Register Service Worker ────────────────────────────────
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => {
                console.log('[PWA] Service worker registered ✓', reg.scope);

                // Check for updates every time the page loads
                reg.update();
            })
            .catch(err => console.warn('[PWA] SW registration failed:', err));

        // Listen for SW_UPDATED message → reload page silently to get fresh files
        navigator.serviceWorker.addEventListener('message', event => {
            if (event.data && event.data.type === 'SW_UPDATED') {
                console.log('[PWA] New version detected — reloading for fresh files');
                // Small delay so the SW fully activates before reload
                setTimeout(() => window.location.reload(), 500);
            }
        });

        // Also handle controller change (new SW took control)
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            refreshing = true;
            window.location.reload();
        });
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

// ── 3. iOS "Add to Home Screen" hint ─────────────────────────
const IOS_HINT_KEY = 'delivo_ios_hint_dismissed';

function isIosSafari() {
    const ua = navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua);
    // Chrome and Firefox on iOS include 'CriOS' / 'FxiOS' — they don't support PWA install
    const isSafari = /safari/i.test(ua) && !/crios|fxios|opios|chromium/i.test(ua);
    return isIos && isSafari;
}

function isAlreadyInstalled() {
    return window.navigator.standalone === true ||
           window.matchMedia('(display-mode: standalone)').matches;
}

function iosHintSnoozed() {
    const t = localStorage.getItem(IOS_HINT_KEY);
    if (!t) return false;
    // Don't show again for 3 days after dismissal
    return Date.now() - parseInt(t) < 3 * 24 * 60 * 60 * 1000;
}

function showIosHint() {
    const hint = document.getElementById('ios-hint');
    if (!hint) return;
    hint.style.display = 'block';
    setTimeout(() => hint.classList.add('ios-hint--visible'), 50);
}

function hideIosHint(snooze = false) {
    const hint = document.getElementById('ios-hint');
    if (!hint) return;
    if (snooze) localStorage.setItem(IOS_HINT_KEY, Date.now().toString());
    hint.classList.remove('ios-hint--visible');
    setTimeout(() => { hint.style.display = 'none'; }, 320);
}

document.addEventListener('click', (e) => {
    if (e.target.closest('#ios-hint-close')) {
        hideIosHint(true);
    }
});

// Show hint after 3 seconds — only on iOS Safari, not installed, not snoozed
if (isIosSafari() && !isAlreadyInstalled() && !iosHintSnoozed()) {
    setTimeout(showIosHint, 3000);
}

// Dev helper — test the hint in console: showIosInstallHint()
window.showIosInstallHint = function() {
    localStorage.removeItem(IOS_HINT_KEY);
    showIosHint();
};