/* ============================================================
   scripts/back-handler.js
   Intercepts the mobile/browser back button so it closes open
   UI layers (modals, panels, sidebars) instead of exiting the app.

   Strategy: History API "fake entry"
   ─ Every time a layer opens  → push a state: history.pushState({layer}, '')
   ─ Every time a layer closes → if we pushed, history.back() or do nothing
   ─ On popstate              → figure out what's open and close it

   Layer priority (highest → lowest — first open wins the back press):
     1. Track modal (full-screen order detail)
     2. Orders modal
     3. Auth modal (login / account / edit-profile)
     4. Track sheet (bottom sheet)
     5. Store panel (slide-in menu)
     6. Cart sidebar
     7. Mobile nav menu
   ============================================================ */

(function() {

    /* ── Helpers ─────────────────────────────────────────────── */

    let _pushed = false;
    let _exitDialogOpen = false;

    function _push() {
        if (!_pushed) {
            history.pushState({ delivoLayer: true }, '');
            _pushed = true;
        }
    }

    function _clearPush() {
        _pushed = false;
    }

    /* ── Layer detectors ─────────────────────────────────────── */

    function _getTopLayer() {

        // 1. Track modal
        const trackModal = document.getElementById('track-modal') ||
                           document.querySelector('.track-modal');
        if (trackModal && (trackModal.classList.contains('active') || trackModal.style.display === 'flex' || trackModal.open)) {
            return () => { if (typeof window._closeTrackModal === 'function') window._closeTrackModal(); };
        }

        // 2. Orders modal
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

        // 4. Track sheet (bottom sheet)
        const trackSheet = document.getElementById('bb-track-sheet');
        if (trackSheet && trackSheet.classList.contains('open')) {
            return () => { if (typeof window._closeTrackSheet === 'function') window._closeTrackSheet(); };
        }

        // 5. Store panel
        const storePanel = document.getElementById('store-panel') ||
                           document.querySelector('.store-panel');
        if (storePanel && (storePanel.classList.contains('open') || storePanel.classList.contains('active'))) {
            return () => { if (typeof window.closeStorePanel === 'function') window.closeStorePanel(); };
        }

        // 6. Cart sidebar
        const cartSidebar = document.getElementById('cart-sidebar');
        if (cartSidebar && cartSidebar.classList.contains('active')) {
            return () => { if (typeof window.closeCartSidebar === 'function') window.closeCartSidebar(); };
        }

        // 7. Mobile nav menu
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

        _exitDialogOpen = true;
        // No _push() here — we do NOT push a new entry while dialog is open

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

        // Cancel — stay in app, re-push so next back press is intercepted again
        document.getElementById('exit-cancel-btn').addEventListener('click', () => {
            _close();
            _exitDialogOpen = false;
            _push();
        });

        // Confirm exit
        document.getElementById('exit-confirm-btn').addEventListener('click', () => {
            _close();
            _exitDialogOpen = false;
            _clearPush();
            setTimeout(() => {
                // Try window.close() first (works if opened via window.open or PWA)
                window.close();
                // Fallback: navigate to a blank page to effectively "exit"
                setTimeout(() => {
                    window.location.replace('about:blank');
                }, 300);
            }, 300);
        });

        // Tap backdrop to cancel
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                _close();
                _exitDialogOpen = false;
                _push();
            }
        });
    }

    /* ── popstate — fired when back button is pressed ────────── */

    window.addEventListener('popstate', function(e) {
        // Ignore popstate while exit dialog is open
        if (_exitDialogOpen) return;

        _clearPush();

        const closer = _getTopLayer();
        if (closer) {
            closer();
            setTimeout(() => {
                if (_getTopLayer()) _push();
            }, 50);
        } else {
            // Nothing open → show exit confirm
            _showExitConfirm();
        }
    });

    /* ── Patch open functions after DOM is ready ─────────────── */

    function _patchAll() {

        // ── store panel ──
        const _origOpenStore = window.openStorePanel;
        if (_origOpenStore) {
            window.openStorePanel = function(...args) {
                _push();
                return _origOpenStore.apply(this, args);
            };
        }

        const _origCloseStore = window.closeStorePanel;
        if (_origCloseStore) {
            window.closeStorePanel = function(...args) {
                _clearPush();
                return _origCloseStore.apply(this, args);
            };
        }

        // ── cart sidebar ──
        const _origOpenCart = window.openCartSidebar;
        if (_origOpenCart) {
            window.openCartSidebar = function(...args) {
                _push();
                return _origOpenCart.apply(this, args);
            };
        }

        const _origCloseCart = window.closeCartSidebar;
        if (_origCloseCart) {
            window.closeCartSidebar = function(...args) {
                _clearPush();
                return _origCloseCart.apply(this, args);
            };
        }

        // ── track sheet ──
        const _origOpenTrack = window._openTrackSheet;
        if (_origOpenTrack) {
            window._openTrackSheet = function(...args) {
                _push();
                return _origOpenTrack.apply(this, args);
            };
        }

        const _origCloseTrack = window._closeTrackSheet;
        if (_origCloseTrack) {
            window._closeTrackSheet = function(...args) {
                _clearPush();
                return _origCloseTrack.apply(this, args);
            };
        }

        // ── track modal ──
        const _origCloseTrackModal = window._closeTrackModal;
        if (_origCloseTrackModal) {
            window._closeTrackModal = function(...args) {
                _clearPush();
                return _origCloseTrackModal.apply(this, args);
            };
        }

        // ── generic modal open/close ──
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

    /* ── Mobile nav menu — patch hamburger click ─────────────── */

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