/* ============================================================
   scripts/back-handler.js  v4 — simplified & reliable
   
   Two jobs only:
   1. Back button while a layer is open → close that layer
   2. Back button on clean home screen → exit confirm dialog
      → window.close() called DIRECTLY inside user click (no setTimeout)
   ============================================================ */

(function () {
    'use strict';

    /* ── Single fake entry so we always catch one back press ── */
    history.replaceState({ delivo: true }, '');
    history.pushState({ delivo: true }, '');

    /* ── Layer detector ──────────────────────────────────────── */
    function _closeTopLayer() {

        // Track modal
        const trackModal = document.getElementById('track-modal') ||
                           document.querySelector('.track-modal');
        if (trackModal && (trackModal.classList.contains('active') ||
                           trackModal.style.display === 'flex')) {
            if (typeof window._closeTrackModal === 'function') window._closeTrackModal();
            return true;
        }

        // Orders modal
        const ordersModal = document.getElementById('modal-orders') ||
                            document.querySelector('.orders-modal');
        if (ordersModal && ordersModal.classList.contains('active')) {
            if (typeof closeOrdersModal === 'function') closeOrdersModal();
            return true;
        }

        // Any active modal overlay
        const overlay = document.querySelector('.modal-overlay.active');
        if (overlay) {
            overlay.classList.remove('active');
            document.body.classList.remove('modal-open');
            return true;
        }

        // Track bottom sheet
        const trackSheet = document.getElementById('bb-track-sheet');
        if (trackSheet && trackSheet.classList.contains('open')) {
            if (typeof window._closeTrackSheet === 'function') window._closeTrackSheet();
            return true;
        }

        // Store panel
        const sp = document.getElementById('store-panel') ||
                   document.querySelector('.store-panel');
        if (sp && (sp.classList.contains('open') || sp.classList.contains('active'))) {
            if (typeof window.closeStorePanel === 'function') window.closeStorePanel();
            return true;
        }

        // Cart sidebar
        const cart = document.getElementById('cart-sidebar');
        if (cart && cart.classList.contains('active')) {
            if (typeof window.closeCartSidebar === 'function') window.closeCartSidebar();
            return true;
        }

        // Mobile nav
        const nav = document.getElementById('mobile-menu');
        if (nav && nav.classList.contains('open')) {
            nav.classList.remove('open');
            const btn = document.getElementById('mobile-menu-btn');
            if (btn) btn.setAttribute('aria-expanded', 'false');
            return true;
        }

        return false;
    }

    /* ── Exit dialog ─────────────────────────────────────────── */
    let _dialogOpen = false;

    function _showExitDialog() {
        if (_dialogOpen) return;
        _dialogOpen = true;

        const overlay = document.createElement('div');
        overlay.id = 'exit-confirm-overlay';
        overlay.className = 'exit-confirm-overlay';
        overlay.innerHTML = `
            <div class="exit-confirm-box" role="dialog" aria-modal="true">
                <div class="exit-confirm-icon">🚪</div>
                <h3 class="exit-confirm-title">إغلاق التطبيق</h3>
                <p class="exit-confirm-msg">هل تريد فعلاً الخروج من Delivo؟</p>
                <div class="exit-confirm-actions">
                    <button class="exit-confirm-btn exit-confirm-btn--cancel" id="exit-stay">البقاء</button>
                    <button class="exit-confirm-btn exit-confirm-btn--exit"   id="exit-go">خروج</button>
                </div>
            </div>`;

        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('exit-confirm-overlay--visible'));

        function _dismiss() {
            overlay.classList.remove('exit-confirm-overlay--visible');
            setTimeout(() => overlay.remove(), 280);
            _dialogOpen = false;
            // Re-push so next back is caught again
            history.pushState({ delivo: true }, '');
        }

        // Stay — dismiss and re-push
        document.getElementById('exit-stay').onclick = _dismiss;
        overlay.addEventListener('click', e => { if (e.target === overlay) _dismiss(); });

        // Exit — called directly in onclick (satisfies user-gesture requirement)
        document.getElementById('exit-go').onclick = function () {
            overlay.classList.remove('exit-confirm-overlay--visible');
            setTimeout(() => overlay.remove(), 280);
            _dialogOpen = false;

            // window.close() works in PWA standalone and when opened via script
            // In a regular browser tab it is silently ignored — that's fine,
            // the user can just close the tab themselves
            window.close();
        };
    }

    /* ── popstate — fires on every back/forward press ────────── */
    window.addEventListener('popstate', function () {
        if (_dialogOpen) {
            // Back pressed while dialog open → dismiss dialog, stay in app
            const d = document.getElementById('exit-confirm-overlay');
            if (d) {
                d.classList.remove('exit-confirm-overlay--visible');
                setTimeout(() => d.remove(), 280);
                _dialogOpen = false;
            }
            history.pushState({ delivo: true }, '');
            return;
        }

        const closed = _closeTopLayer();

        if (closed) {
            // Layer was closed — re-push so next back is caught
            history.pushState({ delivo: true }, '');
        } else {
            // Nothing open → show exit dialog
            // Do NOT re-push here — let the dialog handle it
            _showExitDialog();
        }
    });

})();