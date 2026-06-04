/* ============================================================
   scripts/back-handler.js  v3
   Precise stack counter — tracks every pushState so history.go()
   always jumps exactly the right number of steps to exit.

   Rule:
     _depth = how many fake entries WE have pushed since page load.
     On popstate  → _depth--  (browser already consumed one)
     On _push()   → history.pushState + _depth++
     On exit btn  → history.go(-_depth)  clears all our entries → exit
   ============================================================ */

(function () {

    /* ── Depth counter ───────────────────────────────────────── */
    // Counts every pushState we make. Decremented in popstate.
    let _depth   = 0;
    let _exiting = false;   // true while history.go(-N) is in flight

    function _push() {
        history.pushState({ delivoApp: true }, '');
        _depth++;
    }

    /* ── Sentinel: push once on load so first back always fires popstate ── */
    _push();

    /* ── Layer detectors ─────────────────────────────────────── */
    function _getTopLayer() {

        // 1. Track modal
        const trackModal = document.getElementById('track-modal') ||
                           document.querySelector('.track-modal');
        if (trackModal && (trackModal.classList.contains('active') ||
                           trackModal.style.display === 'flex' || trackModal.open)) {
            return () => { if (typeof window._closeTrackModal === 'function') window._closeTrackModal(); };
        }

        // 2. Orders sheet
        const ordersSheet = document.getElementById('orders-sheet');
        if (ordersSheet && ordersSheet.classList.contains('active')) {
            return () => { if (typeof closeOrdersModal === 'function') closeOrdersModal(); };
        }
        const ordersModal = document.getElementById('modal-orders') ||
                            document.querySelector('.orders-modal');
        if (ordersModal && ordersModal.classList.contains('active')) {
            return () => { if (typeof closeOrdersModal === 'function') closeOrdersModal(); };
        }

        // 3. Any .modal-overlay active (login, account, edit-profile…)
        const activeModal = document.querySelector('.modal-overlay.active');
        if (activeModal) {
            return () => {
                activeModal.classList.remove('active');
                document.body.classList.remove('modal-open');
            };
        }

        // 4. Loyalty sheet
        const loyaltySheet = document.getElementById('loyalty-sheet');
        if (loyaltySheet && loyaltySheet.classList.contains('active')) {
            return () => { if (typeof closeLoyaltyModal === 'function') closeLoyaltyModal(); };
        }

        // 5. Track sheet
        const trackSheet = document.getElementById('bb-track-sheet');
        if (trackSheet && trackSheet.classList.contains('open')) {
            return () => { if (typeof window._closeTrackSheet === 'function') window._closeTrackSheet(); };
        }

        // 6. Store panel
        const storePanel = document.getElementById('store-panel');
        if (storePanel && (storePanel.classList.contains('open') ||
                           storePanel.classList.contains('active'))) {
            return () => { if (typeof window.closeStorePanel === 'function') window.closeStorePanel(); };
        }

        // 7. Cart sidebar
        const cartSidebar = document.getElementById('cart-sidebar');
        if (cartSidebar && cartSidebar.classList.contains('active')) {
            return () => { if (typeof window.closeCartSidebar === 'function') window.closeCartSidebar(); };
        }

        // 8. Mobile nav menu
        const mobileMenu = document.getElementById('mobile-menu');
        if (mobileMenu && mobileMenu.classList.contains('open')) {
            return () => {
                mobileMenu.classList.remove('open');
                const btn = document.getElementById('mobile-menu-btn');
                if (btn) btn.setAttribute('aria-expanded', 'false');
            };
        }

        return null;
    }

    /* ── Exit confirm dialog ─────────────────────────────────── */
    function _showExitConfirm() {
        if (document.getElementById('exit-confirm-overlay')) return;

        // Push one more so the dialog doesn't get dismissed by a stray popstate
        _push();

        const overlay = document.createElement('div');
        overlay.id = 'exit-confirm-overlay';
        overlay.className = 'exit-confirm-overlay';
        overlay.innerHTML = `
            <div class="exit-confirm-box" role="dialog" aria-modal="true" aria-labelledby="exit-confirm-title">
                <div class="exit-confirm-icon">🚪</div>
                <h3 class="exit-confirm-title" id="exit-confirm-title">إغلاق التطبيق</h3>
                <p class="exit-confirm-msg">هل تريد فعلاً الخروج من Delivo؟</p>
                <div class="exit-confirm-actions">
                    <button class="exit-confirm-btn exit-confirm-btn--cancel" id="exit-cancel-btn">البقاء</button>
                    <button class="exit-confirm-btn exit-confirm-btn--exit"   id="exit-confirm-btn">خروج</button>
                </div>
            </div>`;

        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('exit-confirm-overlay--visible'));

        function _close() {
            overlay.classList.remove('exit-confirm-overlay--visible');
            setTimeout(() => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 280);
        }

        // Stay — close dialog, push a fresh sentinel so next back shows confirm again
        document.getElementById('exit-cancel-btn').addEventListener('click', () => {
            _close();
            _push();
        });

        // Exit — jump back past every entry we have pushed
        document.getElementById('exit-confirm-btn').addEventListener('click', () => {
            _close();
            const stepsBack = _depth;   // snapshot before go() triggers popstate(s)
            _depth   = 0;
            _exiting = true;            // suppress popstate handler during exit
            setTimeout(() => history.go(-stepsBack), 300);
        });

        // Tap backdrop = stay
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                _close();
                _push();
            }
        });
    }

    /* ── popstate ────────────────────────────────────────────── */
    window.addEventListener('popstate', function () {
        if (_exiting) return;   // ignore all popstates fired by history.go(-N) during exit
        // Browser just consumed one of our entries
        if (_depth > 0) _depth--;

        const closer = _getTopLayer();
        if (closer) {
            closer();
            // Re-push so next back press is still intercepted
            _push();
        } else {
            _showExitConfirm();
        }
    });

    /* ── Patch open/close functions ──────────────────────────── */
    function _patchAll() {

        // store panel
        const _origOpenStore = window.openStorePanel;
        if (_origOpenStore && !_origOpenStore._backPatched) {
            window.openStorePanel = function (...a) { _push(); return _origOpenStore.apply(this, a); };
            window.openStorePanel._backPatched = true;
        }
        const _origCloseStore = window.closeStorePanel;
        if (_origCloseStore && !_origCloseStore._backPatched) {
            window.closeStorePanel = function (...a) { return _origCloseStore.apply(this, a); };
            window.closeStorePanel._backPatched = true;
        }

        // cart sidebar
        const _origOpenCart = window.openCartSidebar;
        if (_origOpenCart && !_origOpenCart._backPatched) {
            window.openCartSidebar = function (...a) { _push(); return _origOpenCart.apply(this, a); };
            window.openCartSidebar._backPatched = true;
        }
        const _origCloseCart = window.closeCartSidebar;
        if (_origCloseCart && !_origCloseCart._backPatched) {
            window.closeCartSidebar = function (...a) { return _origCloseCart.apply(this, a); };
            window.closeCartSidebar._backPatched = true;
        }

        // track sheet
        const _origOpenTrack = window._openTrackSheet;
        if (_origOpenTrack && !_origOpenTrack._backPatched) {
            window._openTrackSheet = function (...a) { _push(); return _origOpenTrack.apply(this, a); };
            window._openTrackSheet._backPatched = true;
        }
        const _origCloseTrack = window._closeTrackSheet;
        if (_origCloseTrack && !_origCloseTrack._backPatched) {
            window._closeTrackSheet = function (...a) { return _origCloseTrack.apply(this, a); };
            window._closeTrackSheet._backPatched = true;
        }

        // track modal
        const _origCloseTrackModal = window._closeTrackModal;
        if (_origCloseTrackModal && !_origCloseTrackModal._backPatched) {
            window._closeTrackModal = function (...a) { return _origCloseTrackModal.apply(this, a); };
            window._closeTrackModal._backPatched = true;
        }

        // generic openModal / closeModal
        if (typeof openModal === 'function' && !openModal._backPatched) {
            const _origOpen = openModal;
            window.openModal = function (id) { _push(); return _origOpen(id); };
            window.openModal._backPatched = true;
        }
        if (typeof closeModal === 'function' && !closeModal._backPatched) {
            const _origClose = closeModal;
            window.closeModal = function (id) { return _origClose(id); };
            window.closeModal._backPatched = true;
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { _patchAll(); setTimeout(_patchAll, 800); });
    } else {
        _patchAll();
        setTimeout(_patchAll, 800);
    }

    /* ── Mobile nav menu hamburger ───────────────────────────── */
    document.addEventListener('click', function (e) {
        if (e.target.closest('#mobile-menu-btn')) {
            const menu = document.getElementById('mobile-menu');
            if (menu) {
                setTimeout(() => { if (menu.classList.contains('open')) _push(); }, 10);
            }
        }
    }, true);

})();