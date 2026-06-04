/* ============================================================
   scripts/back-handler.js  v2
   Intercepts the mobile/browser back button so it closes open
   UI layers (modals, panels, sidebars) instead of exiting the app.

   Strategy: History API "fake entry"
   ─ Push a sentinel entry IMMEDIATELY on load so the very first
     back press always fires popstate (never exits silently).
   ─ Every time a layer opens  → push another state
   ─ Every time a layer closes → _clearPush()
   ─ On popstate              → close topmost layer, or show exit confirm

   Layer priority (highest → lowest):
     1. Track modal
     2. Orders sheet
     3. Any .modal-overlay.active
     4. Loyalty sheet
     5. Track sheet
     6. Store panel
     7. Cart sidebar
     8. Mobile nav menu
   ============================================================ */

(function() {

    /* ── State ───────────────────────────────────────────────── */

    let _pushed = false;   // true = we have a fake layer entry pending

    /* Push a fake history entry (deduplicated) */
    function _push() {
        if (!_pushed) {
            history.pushState({ delivoLayer: true }, '');
            _pushed = true;
        }
    }

    function _clearPush() {
        _pushed = false;
    }

    /* ── Sentinel push on page load ──────────────────────────── */
    // Push once immediately so the very first back press fires popstate
    // instead of letting the browser exit the PWA/tab without warning.
    // We mark it with delivoRoot so we can distinguish it from layer entries.
    history.pushState({ delivoRoot: true }, '');

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

        // 3. Any .modal-overlay that is active
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
        if (storePanel && (storePanel.classList.contains('open') || storePanel.classList.contains('active'))) {
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

        // Re-push so we remain on the page while the dialog is visible
        history.pushState({ delivoRoot: true }, '');

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

        document.getElementById('exit-cancel-btn').addEventListener('click', () => {
            _close();
            // Push again so next back press shows confirm again
            history.pushState({ delivoRoot: true }, '');
        });

        document.getElementById('exit-confirm-btn').addEventListener('click', () => {
            _close();
            // Navigate back past our sentinel — browser exits the PWA
            setTimeout(() => history.back(), 300);
        });

        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                _close();
                history.pushState({ delivoRoot: true }, '');
            }
        });
    }

    /* ── popstate — fired on every back press ────────────────── */

    window.addEventListener('popstate', function(e) {
        _clearPush();

        const closer = _getTopLayer();
        if (closer) {
            closer();
            // Re-push so the next back press is also intercepted
            setTimeout(() => {
                if (_getTopLayer()) _push();
                else history.pushState({ delivoRoot: true }, '');
            }, 50);
        } else {
            // Nothing open → at root → show exit confirm
            _showExitConfirm();
        }
    });

    /* ── Patch open/close functions after DOM is ready ───────── */

    function _patchAll() {

        // ── store panel ──
        const _origOpenStore = window.openStorePanel;
        if (_origOpenStore && !_origOpenStore._backPatched) {
            window.openStorePanel = function(...args) {
                _push();
                return _origOpenStore.apply(this, args);
            };
            window.openStorePanel._backPatched = true;
        }

        const _origCloseStore = window.closeStorePanel;
        if (_origCloseStore && !_origCloseStore._backPatched) {
            window.closeStorePanel = function(...args) {
                _clearPush();
                return _origCloseStore.apply(this, args);
            };
            window.closeStorePanel._backPatched = true;
        }

        // ── cart sidebar ──
        const _origOpenCart = window.openCartSidebar;
        if (_origOpenCart && !_origOpenCart._backPatched) {
            window.openCartSidebar = function(...args) {
                _push();
                return _origOpenCart.apply(this, args);
            };
            window.openCartSidebar._backPatched = true;
        }

        const _origCloseCart = window.closeCartSidebar;
        if (_origCloseCart && !_origCloseCart._backPatched) {
            window.closeCartSidebar = function(...args) {
                _clearPush();
                return _origCloseCart.apply(this, args);
            };
            window.closeCartSidebar._backPatched = true;
        }

        // ── track sheet ──
        const _origOpenTrack = window._openTrackSheet;
        if (_origOpenTrack && !_origOpenTrack._backPatched) {
            window._openTrackSheet = function(...args) {
                _push();
                return _origOpenTrack.apply(this, args);
            };
            window._openTrackSheet._backPatched = true;
        }

        const _origCloseTrack = window._closeTrackSheet;
        if (_origCloseTrack && !_origCloseTrack._backPatched) {
            window._closeTrackSheet = function(...args) {
                _clearPush();
                return _origCloseTrack.apply(this, args);
            };
            window._closeTrackSheet._backPatched = true;
        }

        // ── track modal ──
        const _origCloseTrackModal = window._closeTrackModal;
        if (_origCloseTrackModal && !_origCloseTrackModal._backPatched) {
            window._closeTrackModal = function(...args) {
                _clearPush();
                return _origCloseTrackModal.apply(this, args);
            };
            window._closeTrackModal._backPatched = true;
        }

        // ── generic openModal / closeModal ──
        if (typeof openModal === 'function' && !openModal._backPatched) {
            const _origOpen = openModal;
            window.openModal = function(id) {
                _push();
                return _origOpen(id);
            };
            window.openModal._backPatched = true;
        }

        if (typeof closeModal === 'function' && !closeModal._backPatched) {
            const _origClose = closeModal;
            window.closeModal = function(id) {
                _clearPush();
                return _origClose(id);
            };
            window.closeModal._backPatched = true;
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            _patchAll();
            setTimeout(_patchAll, 800);
        });
    } else {
        _patchAll();
        setTimeout(_patchAll, 800);
    }

    /* ── Mobile nav menu — hamburger delegation ──────────────── */
    document.addEventListener('click', function(e) {
        if (e.target.closest('#mobile-menu-btn')) {
            const menu = document.getElementById('mobile-menu');
            if (menu) {
                setTimeout(() => {
                    if (menu.classList.contains('open')) _push();
                    else _clearPush();
                }, 10);
            }
        }
    }, true);

})();