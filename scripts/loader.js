/* ============================================================
   scripts/loader.js
   Loads only the dynamic components (not navbar or modals,
   those are inlined directly in index.html).
   ============================================================ */

async function loadComponent(slotId, file) {
    try {
        const res = await fetch(`components/${file}?v=${Date.now()}`);
        if (!res.ok) throw new Error(`Failed to load: ${file} (${res.status})`);
        const html = await res.text();
        const slot = document.getElementById(slotId);
        if (slot) slot.innerHTML = html;
    } catch (err) {
        console.warn(`[Delivo Loader] ${err.message}`);
    }
}

async function loadAll() {
    // Load only dynamic sections — navbar and modals are inlined in index.html
    await Promise.all([
        loadComponent('categories',   'categories.html'),
        loadComponent('offers',       'offers.html'),
        loadComponent('join-partner', 'join-partner.html'),
        loadComponent('footer',       'footer.html'),
    ]);

    // Init all scripts — DOM is guaranteed ready
    if (typeof initNavbar    === 'function') initNavbar();
    if (typeof initModals    === 'function') initModals();
    if (typeof initCart      === 'function') initCart();
    if (typeof initModalAuth === 'function') initModalAuth();
    if (typeof initStores      === 'function') initStores();
    if (typeof initCategories  === 'function') initCategories();
    if (typeof initStorePanel  === 'function') initStorePanel();

    document.body.classList.add('loaded');
    console.log('[Delivo] All components loaded ✓');
}

document.addEventListener('DOMContentLoaded', loadAll);