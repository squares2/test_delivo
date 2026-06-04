/* ============================================================
   scripts/back-handler.js  v4
   Abandon History API depth-counting — too unreliable across
   Android Chrome / PWA WebView.

   New approach — two-state machine:
   ─ State A "root":  only one sentinel entry in stack.
                      Back press → show exit confirm.
   ─ State B "layer": a layer is open, one extra entry pushed.
                      Back press → close the layer, go back to A.

   Key rules:
   • We push EXACTLY once on load (sentinel).
   • We push EXACTLY once when a layer opens.
   • We call history.back() when a layer closes programmatically
     (so the stack stays clean — no accumulated garbage).
   • Exit confirm uses window.close() + location.replace('about:blank')
     fallback so we never touch history and never re-trigger popstate.
   ============================================================ */

(function () {

    /* ── state ───────────────────────────────────────────────── */
    let _layerOpen = false;   // true = we pushed a layer entry

    /* ── push sentinel immediately on load ───────────────────── */
    history.replaceState({ delivoSentinel: true }, '');  // replace real entry
    history.pushState({ delivoSentinel: true }, '');      // this IS our sentinel
    // Stack is now: [real(replaced-as-sentinel), sentinel]
    // First back always fires popstate. ✓

    /* ── helpers ─────────────────────────────────────────────── */
    function _pushLayer() {
        if (!_layerOpen) {
            history.pushState({ delivoLayer: true }, '');
            _layerOpen = true;
        }
    }

    function _popLayer() {
        if (_layerOpen) {
            _layerOpen = false;
            history.back();   // removes the layer entry from stack
        }
    }

    /* ── layer detectors ─────────────────────────────────────── */
    function _getTopLayer() {

        const trackModal = document.getElementById('track-modal') ||
                           document.querySelector('.track-modal');
        if (trackModal && (trackModal.classList.contains('active') ||
                           trackModal.style.display === 'flex' || trackModal.open))
            return () => { if (typeof window._closeTrackModal === 'function') window._closeTrackModal(); };

        const ordersSheet = document.getElementById('orders-sheet');
        if (ordersSheet && ordersSheet.classList.contains('active'))
            return () => { if (typeof closeOrdersModal === 'function') closeOrdersModal(); };

        const ordersModal = document.getElementById('modal-orders') ||
                            document.querySelector('.orders-modal');
        if (ordersModal && ordersModal.classList.contains('active'))
            return () => { if (typeof closeOrdersModal === 'function') closeOrdersModal(); };

        const activeModal = document.querySelector('.modal-overlay.active');
        if (activeModal)
            return () => {
                activeModal.classList.remove('active');
                document.body.classList.remove('modal-open');
            };

        const loyaltySheet = document.getElementById('loyalty-sheet');
        if (loyaltySheet && loyaltySheet.classList.contains('active'))
            return () => { if (typeof closeLoyaltyModal === 'function') closeLoyaltyModal(); };

        const trackSheet = document.getElementById('bb-track-sheet');
        if (trackSheet && trackSheet.classList.contains('open'))
            return () => { if (typeof window._closeTrackSheet === 'function') window._closeTrackSheet(); };

        const storePanel = document.getElementById('store-panel');
        if (storePanel && (storePanel.classList.contains('open') ||
                           storePanel.classList.contains('active')))
            return () => { if (typeof window.closeStorePanel === 'function') window.closeStorePanel(); };

        const cartSidebar = document.getElementById('cart-sidebar');
        if (cartSidebar && cartSidebar.classList.contains('active'))
            return () => { if (typeof window.closeCartSidebar === 'function') window.closeCartSidebar(); };

        const mobileMenu = document.getElementById('mobile-menu');
        if (mobileMenu && mobileMenu.classList.contains('open'))
            return () => {
                mobileMenu.classList.remove('open');
                const btn = document.getElementById('mobile-menu-btn');
                if (btn) btn.setAttribute('aria-expanded', 'false');
            };

        return null;
    }

    /* ── exit confirm ────────────────────────────────────────── */
    function _showExitConfirm() {
        if (document.getElementById('exit-confirm-overlay')) return;

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
                    <button class="exit-confirm-btn exit-confirm-btn--exit"   id="exit-go-btn">خروج</button>
                </div>
            </div>`;

        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('exit-confirm-overlay--visible'));

        function _closeDialog() {
            overlay.classList.remove('exit-confirm-overlay--visible');
            setTimeout(() => overlay.parentNode && overlay.parentNode.removeChild(overlay), 280);
        }

        // Stay: close dialog, push sentinel back so next back shows confirm again
        document.getElementById('exit-cancel-btn').addEventListener('click', () => {
            _closeDialog();
            history.pushState({ delivoSentinel: true }, '');
        });

        // Exit: close dialog then actually exit — never call history API again
        document.getElementById('exit-go-btn').addEventListener('click', () => {
            _closeDialog();
            setTimeout(_doExit, 320);
        });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                _closeDialog();
                history.pushState({ delivoSentinel: true }, '');
            }
        });
    }

    /* ── actual exit ─────────────────────────────────────────── */
    function _doExit() {
        // Remove our popstate listener so history navigation below
        // doesn't re-trigger confirm
        window.removeEventListener('popstate', _onPopstate);

        // Try window.close() (works in some Android WebViews / TWA)
        try { window.close(); } catch (_) {}

        // Fallback: navigate to a blank page so the app content is gone
        setTimeout(() => {
            try { window.location.replace('about:blank'); } catch (_) {}
        }, 100);
    }

    /* ── popstate handler ────────────────────────────────────── */
    function _onPopstate() {
        const closer = _getTopLayer();
        if (closer) {
            // Close the layer — but DON'T call _popLayer() here because
            // history.back() was already called by the browser (that's what
            // fired popstate). Just reset the flag and close the UI.
            _layerOpen = false;
            closer();
            // Re-push so the next back is still intercepted
            _pushLayer();
        } else {
            // At root → show exit confirm, push sentinel to stay on page
            history.pushState({ delivoSentinel: true }, '');
            _showExitConfirm();
        }
    }

    window.addEventListener('popstate', _onPopstate);

    /* ── patch open/close to sync _layerOpen ────────────────── */
    function _patchAll() {

        function _wrapOpen(fn) {
            return function (...a) { _pushLayer(); return fn.apply(this, a); };
        }
        function _wrapClose(fn) {
            return function (...a) {
                const r = fn.apply(this, a);
                // If we pushed for this layer, pop it from history too
                _popLayer();
                return r;
            };
        }

        if (window.openStorePanel  && !window.openStorePanel._bp)  { window.openStorePanel  = _wrapOpen(window.openStorePanel);  window.openStorePanel._bp  = true; }
        if (window.closeStorePanel && !window.closeStorePanel._bp) { window.closeStorePanel = _wrapClose(window.closeStorePanel); window.closeStorePanel._bp = true; }

        if (window.openCartSidebar  && !window.openCartSidebar._bp)  { window.openCartSidebar  = _wrapOpen(window.openCartSidebar);  window.openCartSidebar._bp  = true; }
        if (window.closeCartSidebar && !window.closeCartSidebar._bp) { window.closeCartSidebar = _wrapClose(window.closeCartSidebar); window.closeCartSidebar._bp = true; }

        if (window._openTrackSheet  && !window._openTrackSheet._bp)  { window._openTrackSheet  = _wrapOpen(window._openTrackSheet);  window._openTrackSheet._bp  = true; }
        if (window._closeTrackSheet && !window._closeTrackSheet._bp) { window._closeTrackSheet = _wrapClose(window._closeTrackSheet); window._closeTrackSheet._bp = true; }

        if (window._closeTrackModal && !window._closeTrackModal._bp) { window._closeTrackModal = _wrapClose(window._closeTrackModal); window._closeTrackModal._bp = true; }

        if (typeof openModal  === 'function' && !openModal._bp)  { const o = openModal;  window.openModal  = function(id){ _pushLayer(); return o(id); }; window.openModal._bp  = true; }
        if (typeof closeModal === 'function' && !closeModal._bp) { const o = closeModal; window.closeModal = function(id){ const r=o(id); _popLayer(); return r; }; window.closeModal._bp = true; }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { _patchAll(); setTimeout(_patchAll, 800); });
    } else {
        _patchAll();
        setTimeout(_patchAll, 800);
    }

    /* ── hamburger nav ───────────────────────────────────────── */
    document.addEventListener('click', function (e) {
        if (e.target.closest('#mobile-menu-btn')) {
            const menu = document.getElementById('mobile-menu');
            if (menu) setTimeout(() => {
                if (menu.classList.contains('open')) _pushLayer();
                else _popLayer();
            }, 10);
        }
    }, true);

})();