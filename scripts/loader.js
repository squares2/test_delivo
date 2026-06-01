/* ============================================================
   scripts/loader.js
   1. Loads dynamic HTML components
   2. Inits all feature scripts
   3. Dismisses the splash screen smoothly
   ============================================================ */

const SPLASH_MIN_MS = 2500; // minimum time the HD splash stays visible

async function loadComponent(slotId, file) {
    try {
        const res = await fetch(`components/${file}?v=8`);
        if (!res.ok) throw new Error(`Failed: ${file} (${res.status})`);
        const html = await res.text();
        const slot = document.getElementById(slotId);
        if (slot) slot.innerHTML = html;
    } catch (err) {
        console.warn(`[Delivo Loader] ${err.message}`);
    }
}

function hideSplash() {
    const splash = document.getElementById('delivo-splash');
    if (!splash) return;
    splash.classList.add('hiding');
    setTimeout(() => splash.classList.add('hidden'), 520);
}

/* Wait for the splash image to fully decode before starting the timer.
   This prevents the old low-res cached frame from flashing before the
   HD PNG is ready — we simply don't start counting until it's painted. */
function splashImageReady() {
    return new Promise(resolve => {
        const img = document.querySelector('#delivo-splash img');
        if (!img) return resolve();
        if (img.complete && img.naturalWidth > 0) return resolve();
        img.addEventListener('load',  resolve, { once: true });
        img.addEventListener('error', resolve, { once: true }); // don't block on error
    });
}

async function loadAll() {
    const startTime = Date.now();

    // Safety net: never keep splash longer than 7s on slow connections
    const slowNetTimer = setTimeout(hideSplash, 7000);

    // Wait for the HD splash image to fully render before doing anything else
    await splashImageReady();

    await Promise.all([
        loadComponent('categories',   'categories.html'),
        loadComponent('offers',       'offers.html'),
        loadComponent('join-partner', 'join-partner.html'),
        loadComponent('footer',       'footer.html'),
    ]);

    // Init all scripts — DOM is guaranteed ready
    if (typeof initNavbar      === 'function') initNavbar();
    if (typeof initModals      === 'function') initModals();
    if (typeof initCart        === 'function') initCart();
    if (typeof initModalAuth   === 'function') initModalAuth();
    if (typeof initStores      === 'function') initStores();
    if (typeof initCategories  === 'function') initCategories();
    if (typeof initStorePanel  === 'function') initStorePanel();

    document.body.classList.add('loaded');
    console.log('[Delivo] All components loaded ✓');

    clearTimeout(slowNetTimer);

    // Enforce minimum splash display time so the HD logo is clearly seen
    const elapsed   = Date.now() - startTime;
    const remaining = Math.max(0, SPLASH_MIN_MS - elapsed);
    setTimeout(hideSplash, remaining);
}

document.addEventListener('DOMContentLoaded', loadAll);