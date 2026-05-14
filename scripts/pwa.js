/* ============================================================
   scripts/pwa.js
   Handles: service worker registration, install banner prompt
   ============================================================ */

// --- Register Service Worker ---
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => {
        regs.forEach(reg => reg.unregister());
    });
}

// --- Install Banner ---
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    // Show your custom install banner if you have one
    const banner = document.getElementById('install-banner');
    if (banner) banner.classList.add('visible');
});

// When user clicks your custom "Install App" button
function triggerInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(choice => {
        if (choice.outcome === 'accepted') {
            console.log('[PWA] App installed ✓');
        }
        deferredPrompt = null;
        const banner = document.getElementById('install-banner');
        if (banner) banner.classList.remove('visible');
    });
}
