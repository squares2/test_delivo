/* ============================================================
   scripts/back-handler.js  v5
   
   Core insight:
   - replaceState on load → marks base entry, does NOT add entries
   - pushState ONCE → gives us one back-press to intercept
   - popstate fires → close layer OR show exit dialog
   - After closing a layer, push again to keep catching
   - Exit: history.back() to let OS/browser handle naturally
     + window.close() as PWA bonus (works only in standalone)
   ============================================================ */

(function () {
    'use strict';

    let _intercepting = false; // true = we have pushed a fake entry

    /* ── Mark base entry ─────────────────────────────────────── */
    history.replaceState({ delivoBase: true }, '');

    /* ── Push one interception entry ─────────────────────────── */
    function _arm() {
        if (!_intercepting) {
            history.pushState({ delivoLayer: true }, '');
            _intercepting = true;
        }
    }

    /* ── Disarm (we consumed the entry via popstate) ─────────── */
    function _disarm() {
        _intercepting = false;
    }

    /* ── Layer detector ──────────────────────────────────────── */
    function _closeTopLayer() {

        const trackModal = document.getElementById('track-modal') ||
                           document.querySelector('.track-modal');
        if (trackModal && (trackModal.classList.contains('active') ||
                           trackModal.style.display === 'flex')) {
            if (typeof window._closeTrackModal === 'function') window._closeTrackModal();
            return true;
        }

        const ordersModal = document.getElementById('modal-orders') ||
                            document.querySelector('.orders-modal');
        if (ordersModal && ordersModal.classList.contains('active')) {
            if (typeof closeOrdersModal === 'function') closeOrdersModal();
            return true;
        }

        const activeOverlay = document.querySelector('.modal-overlay.active');
        if (activeOverlay) {
            activeOverlay.classList.remove('active');
            document.body.classList.remove('modal-open');
            return true;
        }

        const trackSheet = document.getElementById('bb-track-sheet');
        if (trackSheet && trackSheet.classList.contains('open')) {
            if (typeof window._closeTrackSheet === 'function') window._closeTrackSheet();
            return true;
        }

        const sp = document.getElementById('store-panel') ||
                   document.querySelector('.store-panel');
        if (sp && (sp.classList.contains('open') || sp.classList.contains('active'))) {
            if (typeof window.closeStorePanel === 'function') window.closeStorePanel();
            return true;
        }

        const cart = document.getElementById('cart-sidebar');
        if (cart && cart.classList.contains('active')) {
            if (typeof window.closeCartSidebar === 'function') window.closeCartSidebar();
            return true;
        }

        const nav = document.getElementById('mobile-menu');
        if (nav && nav.classList.contains('open')) {
            nav.classList.remove('open');
            const btn = document.getElementById('mobile-menu-btn');
            if (btn) btn.setAttribute('aria-expanded', 'false');
            return true;
        }

        return false;
    }

    /* ── Arm whenever a layer opens ──────────────────────────── */
    // Watch for layers opening via MutationObserver — no patching needed
    const _observer = new MutationObserver(() => {
        if (_closeTopLayer !== null && _anyLayerOpen()) {
            _arm();
        }
    });

    function _anyLayerOpen() {
        if (document.querySelector('.modal-overlay.active')) return true;
        if (document.querySelector('#track-modal.active, .track-modal.active')) return true;
        if (document.querySelector('#modal-orders.active, .orders-modal.active')) return true;
        if (document.querySelector('#bb-track-sheet.open')) return true;
        const sp = document.getElementById('store-panel') || document.querySelector('.store-panel');
        if (sp && (sp.classList.contains('open') || sp.classList.contains('active'))) return true;
        const cart = document.getElementById('cart-sidebar');
        if (cart && cart.classList.contains('active')) return true;
        const nav = document.getElementById('mobile-menu');
        if (nav && nav.classList.contains('open')) return true;
        return false;
    }

    document.addEventListener('DOMContentLoaded', () => {
        _observer.observe(document.body, {
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style']
        });
    });

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
            _arm(); // re-arm so next back is caught
        }

        function _exit() {
            overlay.classList.remove('exit-confirm-overlay--visible');
            setTimeout(() => overlay.remove(), 280);
            _dialogOpen = false;
            _disarm();

            // 1. PWA standalone: window.close() works (called in onclick = user gesture ✓)
            const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                          window.navigator.standalone === true;
            if (isPWA) {
                window.close();
                return;
            }

            // 2. Regular browser tab:
            // Go back to the real base entry (before our fake layer)
            // This makes browser show "are you sure you want to leave" or closes tab
            history.back();
        }

        document.getElementById('exit-stay').onclick = _dismiss;
        document.getElementById('exit-go').onclick   = _exit;
        overlay.addEventListener('click', e => { if (e.target === overlay) _dismiss(); });
    }

    /* ── popstate ────────────────────────────────────────────── */
    window.addEventListener('popstate', function (e) {
        _disarm();

        // Back pressed while dialog open → dismiss (stay)
        if (_dialogOpen) {
            const d = document.getElementById('exit-confirm-overlay');
            if (d) {
                d.classList.remove('exit-confirm-overlay--visible');
                setTimeout(() => d.remove(), 280);
            }
            _dialogOpen = false;
            _arm();
            return;
        }

        const closed = _closeTopLayer();

        if (closed) {
            // Layer closed — if another layer is still open, re-arm
            setTimeout(() => { if (_anyLayerOpen()) _arm(); }, 80);
        } else {
            // Nothing open → exit dialog
            _showExitDialog();
        }
    });

})();