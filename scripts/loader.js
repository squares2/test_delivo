/* ============================================================
   scripts/loader.js  v2
   1. Loads dynamic HTML components
   2. Inits all feature scripts
   3. Dismisses the splash screen — with extended duration for PWA
   ============================================================ */

/* ── Detect launch context ───────────────────────────────────
   isPWA = launched from home screen (standalone / fullscreen)
   In PWA mode we hold the JS splash longer so the OS splash
   (low-res) transitions directly into our HD splash, with no
   visible flash of the main page in between.
   ──────────────────────────────────────────────────────────── */
const _isPWA = window.matchMedia('(display-mode: standalone)').matches ||
               window.matchMedia('(display-mode: fullscreen)').matches ||
               window.navigator.standalone === true;

/* How long to keep the HD splash visible after everything is ready */
const SPLASH_HOLD_MS = _isPWA ? 2800 : 1600;

/* ── Ensure the splash is visible from the very first paint ──
   body starts as visibility:hidden (base.css).
   We make the splash itself visible immediately so there is
   zero gap between OS splash → JS splash.                    */
(function () {
    const splash = document.getElementById('delivo-splash');
    if (splash) {
        splash.style.opacity    = '1';
        splash.style.visibility = 'visible';
    }
})();

/* ── Component loader ────────────────────────────────────────*/
async function loadComponent(slotId, file) {
    try {
        const res = await fetch(`components/${file}?v=${Date.now()}`);
        if (!res.ok) throw new Error(`Failed: ${file} (${res.status})`);
        const html = await res.text();
        const slot = document.getElementById(slotId);
        if (slot) slot.innerHTML = html;
    } catch (err) {
        console.warn(`[Delivo Loader] ${err.message}`);
    }
}

/* ── Splash hide ─────────────────────────────────────────────*/
function hideSplash() {
    const splash = document.getElementById('delivo-splash');
    if (!splash) return;
    splash.classList.add('hiding');
    setTimeout(() => splash.classList.add('hidden'), 520);
}

/* ── Main boot sequence ──────────────────────────────────────*/
async function loadAll() {

    /* Record when boot started so we can honour SPLASH_HOLD_MS
       regardless of how fast or slow the network is.          */
    const bootStart = Date.now();

    /* Safety net: never leave user on a blank screen > 7s */
    const slowNetTimer = setTimeout(hideSplash, 7000);

    /* Fetch all components in parallel */
    await Promise.all([
        loadComponent('categories',   'categories.html'),
        loadComponent('offers',       'offers.html'),
        loadComponent('join-partner', 'join-partner.html'),
        loadComponent('footer',       'footer.html'),
    ]);

    /* Init scripts — DOM is fully ready */
    if (typeof initNavbar     === 'function') initNavbar();
    if (typeof initModals     === 'function') initModals();
    if (typeof initCart       === 'function') initCart();
    if (typeof initModalAuth  === 'function') initModalAuth();
    if (typeof initStores     === 'function') initStores();
    if (typeof initCategories === 'function') initCategories();
    if (typeof initStorePanel === 'function') initStorePanel();

    /* Reveal the page content UNDER the splash (no flash —
       splash is still covering everything at this point)     */
    document.body.classList.add('loaded');
    if (typeof initOnboarding === 'function') initOnboarding();
    console.log('[Delivo] All components loaded ✓');

    clearTimeout(slowNetTimer);

    /* Wait at least SPLASH_HOLD_MS from boot start before hiding */
    const elapsed   = Date.now() - bootStart;
    const remaining = Math.max(0, SPLASH_HOLD_MS - elapsed);

    setTimeout(() => {
        /* One rAF to guarantee the page has painted under the splash */
        requestAnimationFrame(() => hideSplash());
    }, remaining);
}

document.addEventListener('DOMContentLoaded', loadAll);