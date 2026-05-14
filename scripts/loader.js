/* ============================================================
   scripts/loader.js
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

    // ✅ Load navbar FIRST alone — must be in DOM before initNavbar runs
    await loadComponent('navbar', 'navbar.html');

    // ✅ Then load everything else in parallel
    await Promise.all([
        loadComponent('categories',      'categories.html'),
        loadComponent('stores',          'stores.html'),
        loadComponent('offers',          'offers.html'),
        loadComponent('why-delivo',      'why-delivo.html'),
        loadComponent('app-download',    'app-download.html'),
        loadComponent('join-partner',    'join-partner.html'),
        loadComponent('footer',          'footer.html'),
        loadComponent('modal-login',     'modal-login.html'),
        loadComponent('modal-subscribe', 'modal-subscribe.html'),
    ]);

    // ✅ Now navbar is guaranteed in DOM — init it
    if (typeof initNavbar   === 'function') initNavbar();
    if (typeof initModals   === 'function') initModals();
    if (typeof initStores   === 'function') initStores();
    if (typeof initCart     === 'function') initCart();

    document.body.classList.add('loaded');
    console.log('[Delivo] All components loaded ✓');
}

document.addEventListener('DOMContentLoaded', loadAll);