/* ============================================================
   scripts/loader.js
   1. Loads dynamic HTML components
   2. Inits all feature scripts
   3. Dismisses the splash screen smoothly
   ============================================================ */

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
    // After fade-out transition (500ms) remove from DOM entirely
    setTimeout(() => splash.classList.add('hidden'), 520);
}

async function loadAll() {
    /* ── Safety net: if loading takes > 6s on slow connections,
       hide splash anyway so the user isn't stuck on a blank screen */
    const slowNetTimer = setTimeout(hideSplash, 6750);

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

    // Clear slow-net timer and hide splash
    clearTimeout(slowNetTimer);
    // Small delay so the page renders at least one frame before fading
    requestAnimationFrame(() => setTimeout(hideSplash, 930));
}

document.addEventListener('DOMContentLoaded', loadAll);