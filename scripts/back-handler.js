/* ============================================================
   scripts/back-handler.js  v3
   Intercepts back button to close UI layers one at a time.
   On the base page (nothing open) shows an exit confirm dialog.

   Exit strategy (PWA + browser):
   ─ PWA standalone: history has only 1 entry at launch.
     We push states as layers open. When all closed and back
     pressed, we are at the real base → show exit dialog →
     user confirms → window.close() (works in PWA) or
     history.go(-history.length) as fallback.
   ─ Browser tab: same flow; exit dialog cancels navigation.

   Layer stack: push one history entry per layer open.
   ─ Close: call history.back() which fires popstate → handler closes layer.
   ─ This ensures Android hardware back steps through layers correctly.
   ============================================================ */

(function () {
    'use strict';

    /* ── State ───────────────────────────────────────────────── */
    let _depth          = 0;   // how many history entries we've pushed
    let _exitDialogOpen = false;
    let _domReady       = false;

    /* ── Push / pop helpers ──────────────────────────────────── */
    function _push() {
        history.pushState({ delivoLayer: true, depth: ++_depth }, '');
    }

    function _didPop() {
        if (_depth > 0) _depth--;
    }

    /* ── Layer detector — returns close-fn or null ───────────── */
    function _getTopLayer() {

        // 1. Track modal
        const trackModal = document.getElementById('track-modal') ||
                           document.querySelector('.track-modal');
        if (trackModal && (trackModal.classList.contains('active') ||
            trackModal.style.display === 'flex' || trackModal.open)) {
            return () => typeof window._closeTrackModal === 'function' && window._closeTrackModal();
        }

        // 2. Orders modal
        const ordersModal = document.getElementById('modal-orders') ||
                            document.querySelector('.orders-modal');
        if (ordersModal && ordersModal.classList.contains('active')) {
            return () => typeof closeOrdersModal === 'function' && closeOrdersModal();
        }

        // 3. Any active .modal-overlay
        const activeModal = document.querySelector('.modal-overlay.active');
        if (activeModal) {
            return () => {
                activeModal.classList.remove('active');
                document.body.classList.remove('modal-open');
            };
        }

        // 4. Track bottom sheet
        const trackSheet = document.getElementById('bb-track-sheet');
        if (trackSheet && trackSheet.classList.contains('open')) {
            return () => typeof window._closeTrackSheet === 'function' && window._closeTrackSheet();
        }

        // 5. Store panel
        const sp = document.getElementById('store-panel') ||
                   document.querySelector('.store-panel');
        if (sp && (sp.classList.contains('open') || sp.classList.contains('active'))) {
            return () => typeof window.closeStorePanel === 'function' && window.closeStorePanel();
        }

        // 6. Cart sidebar
        const cart = document.getElementById('cart-sidebar');
        if (cart && cart.classList.contains('active')) {
            return () => typeof window.closeCartSidebar === 'function' && window.closeCartSidebar();
        }

        // 7. Mobile nav menu
        const nav = document.getElementById('mobile-menu');
        if (nav && nav.classList.contains('open')) {
            return () => {
                nav.classList.remove('open');
                const btn = document.getElementById('mobile-menu-btn');
                if (btn) btn.setAttribute('aria-expanded', 'false');
            };
        }

        return null;
    }

    /* ── Exit confirm dialog ─────────────────────────────────── */
    function _showExitConfirm() {
        if (_exitDialogOpen || document.getElementById('exit-confirm-overlay')) return;
        _exitDialogOpen = true;

        const overlay = document.createElement('div');
        overlay.id = 'exit-confirm-overlay';
        overlay.className = 'exit-confirm-overlay';
        overlay.innerHTML = `
            <div class="exit-confirm-box" role="dialog" aria-modal="true">
                <div class="exit-confirm-icon">🚪</div>
                <h3 class="exit-confirm-title">إغلاق التطبيق</h3>
                <p class="exit-confirm-msg">هل تريد فعلاً الخروج من Delivo؟</p>
                <div class="exit-confirm-actions">
                    <button class="exit-confirm-btn exit-confirm-btn--cancel" id="exit-cancel-btn">البقاء</button>
                    <button class="exit-confirm-btn exit-confirm-btn--exit"   id="exit-do-btn">خروج</button>
                </div>
            </div>`;

        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('exit-confirm-overlay--visible'));

        function _closeDialog(andExit) {
            overlay.classList.remove('exit-confirm-overlay--visible');
            setTimeout(() => overlay.parentNode && overlay.parentNode.removeChild(overlay), 280);
            _exitDialogOpen = false;

            if (andExit) {
                /* ── Real exit logic ── */
                // 1. PWA installed: window.close() works
                window.close();

                // 2. If still here after 400ms → go back past our pushed entries
                //    so browser/OS sees the real previous page (or exits tab)
                setTimeout(() => {
                    if (_depth > 0) {
                        history.go(-(_depth + 1));
                    } else {
                        // Last resort: replace with a benign blank that auto-closes
                        history.back();
                    }
                }, 400);
            } else {
                // Stay → re-push so next back press is caught again
                _push();
            }
        }

        document.getElementById('exit-cancel-btn').onclick = () => _closeDialog(false);
        document.getElementById('exit-do-btn').onclick     = () => _closeDialog(true);
        overlay.addEventListener('click', e => { if (e.target === overlay) _closeDialog(false); });

        // Hardware back while dialog open → cancel (stay)
        const _guardPop = () => { _closeDialog(false); };
        window.addEventListener('popstate', _guardPop, { once: true });
    }

    /* ── popstate handler ────────────────────────────────────── */
    window.addEventListener('popstate', function (e) {
        if (_exitDialogOpen) return;   // guarded above

        _didPop();

        const closer = _getTopLayer();
        if (closer) {
            closer();
            // If another layer is still open, push again so next back is caught
            setTimeout(() => {
                if (_getTopLayer()) _push();
            }, 60);
        } else {
            // Nothing open → exit confirm
            _showExitConfirm();
        }
    });

    /* ── Auto-push when a layer opens ───────────────────────── */
    // We observe the window functions lazily so patching always catches
    // the real function regardless of load order.

    function _watch(openFnName, closeFnName) {
        let _openPatched  = false;
        let _closePatched = false;

        function _tryPatch() {
            if (!_openPatched && typeof window[openFnName] === 'function') {
                const orig = window[openFnName];
                window[openFnName] = function (...a) {
                    _push();
                    return orig.apply(this, a);
                };
                window[openFnName]._bhPatched = true;
                _openPatched = true;
            }
            if (!_closePatched && typeof window[closeFnName] === 'function') {
                const orig = window[closeFnName];
                window[closeFnName] = function (...a) {
                    // Don't touch history — popstate already fired or will fire
                    return orig.apply(this, a);
                };
                _closePatched = true;
            }
        }

        // Try immediately and retry until both patched
        const iv = setInterval(() => {
            _tryPatch();
            if (_openPatched && _closePatched) clearInterval(iv);
        }, 200);
        setTimeout(() => clearInterval(iv), 8000); // stop after 8s
    }

    _watch('openStorePanel',  'closeStorePanel');
    _watch('openCartSidebar', 'closeCartSidebar');
    _watch('_openTrackSheet', '_closeTrackSheet');
    _watch('openOrdersModal', 'closeOrdersModal');

    // openModal / closeModal generic
    setTimeout(() => {
        if (typeof openModal === 'function' && !openModal._bhPatched) {
            const orig = openModal;
            window.openModal = function (id) { _push(); return orig(id); };
            window.openModal._bhPatched = true;
        }
    }, 1000);

    /* ── Mobile nav hamburger ────────────────────────────────── */
    document.addEventListener('click', function (e) {
        if (e.target.closest('#mobile-menu-btn')) {
            const menu = document.getElementById('mobile-menu');
            if (menu) {
                setTimeout(() => {
                    if (menu.classList.contains('open')) _push();
                    // close handled by popstate
                }, 10);
            }
        }
    }, true);

    /* ── Push initial base entry so first back is always caught ─ */
    // Only in PWA standalone mode (where history.length is 1)
    function _init() {
        _domReady = true;
        const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                      window.navigator.standalone === true;
        if (isPWA && history.length <= 1) {
            // Replace the base entry so we always have a catch-all beneath
            history.replaceState({ delivoBase: true }, '');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _init);
    } else {
        _init();
    }

})();