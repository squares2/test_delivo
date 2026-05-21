/* ============================================================
   scripts/navbar.js  —  Bottom bar logic
   ============================================================ */

function initNavbar() {

    /* ── Inject bottom bar HTML into <body> ─────────────────── */
    const bar = document.createElement('nav');
    bar.className = 'bottom-bar';
    bar.setAttribute('aria-label', 'القائمة الرئيسية');
    bar.innerHTML = `
        <div class="bottom-bar__inner">

            <!-- 1. Cart -->
            <button class="bb-tab" id="bb-cart-btn" aria-label="سلة التسوق">
                <span class="bb-tab__icon">
                    <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
                    </svg>
                    <span id="bb-cart-badge"></span>
                </span>
                <span class="bb-tab__label">السلة</span>
            </button>

            <!-- 2. اطلب -->
            <button class="bb-order-btn" id="bb-order-btn" aria-label="اطلب الآن">
                <span class="bb-order-btn__icon">
                    <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                        <circle cx="12" cy="9" r="2.5"/>
                    </svg>
                </span>
                <span class="bb-order-btn__label">اطلب</span>
            </button>

            <!-- 3. Logo (center, elevated) -->
            <button class="bb-logo-btn" id="bb-logo-btn" aria-label="الرئيسية">
                <div class="bb-logo-btn__circle">
                    <img src="assets/icon-192.png" alt="Delivo">
                </div>
                <span class="bb-logo-btn__label">Delivo</span>
            </button>

            <!-- 4. My orders -->
            <button class="bb-tab" id="bb-orders-btn" aria-label="طلباتي">
                <span class="bb-tab__icon">
                    <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M9 17H5a2 2 0 0 0-2 2"/>
                        <path d="M9 3H5a2 2 0 0 0-2 2v14"/>
                        <rect x="9" y="3" width="12" height="18" rx="2"/>
                    </svg>
                </span>
                <span class="bb-tab__label">طلباتي</span>
            </button>

            <!-- 5. Account -->
            <button class="bb-account-btn" id="bb-account-btn" aria-label="حسابي">
                <span class="bb-account-btn__icon">
                    <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                    </svg>
                </span>
                <span class="bb-account-btn__label">حسابي</span>
            </button>

        </div>
    `;
    document.body.appendChild(bar);

    /* ── Wire up buttons ─────────────────────────────────────── */

    // Cart → open cart sidebar
    document.getElementById('bb-cart-btn').addEventListener('click', () => {
        if (typeof openCartSidebar === 'function') openCartSidebar();
    });

    // اطلب → scroll to categories section
    document.getElementById('bb-order-btn').addEventListener('click', () => {
        const target = document.getElementById('categories') || document.getElementById('stores-section');
        if (target) target.scrollIntoView({ behavior: 'smooth' });
    });

    // Logo → scroll to top
    document.getElementById('bb-logo-btn').addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // My orders → open account modal then trigger orders tab
    document.getElementById('bb-orders-btn').addEventListener('click', () => {
        const overlay = document.getElementById('modal-account');
        if (overlay) {
            overlay.classList.add('open');
            document.body.classList.add('modal-open');
            // trigger orders button inside account modal if logged in
            setTimeout(() => {
                const ordersBtn = document.getElementById('acct-orders-btn');
                if (ordersBtn) ordersBtn.click();
            }, 80);
        }
    });

    // Account → open account modal
    document.getElementById('bb-account-btn').addEventListener('click', () => {
        const btn = document.getElementById('account-btn');
        if (btn) btn.click();
    });

    /* ── Sync logged-in state ─────────────────────────────────── */
    window.updateBottomBarAuth = function(loggedIn) {
        const accBtn = document.getElementById('bb-account-btn');
        if (!accBtn) return;
        if (loggedIn) accBtn.classList.add('logged-in');
        else          accBtn.classList.remove('logged-in');
    };

    /* ── Cart badge sync ─────────────────────────────────────── */
    updateCartBadge();
}

function updateCartBadge() {
    // old badge (kept in DOM for compatibility, hidden)
    const oldBadge = document.getElementById('cart-badge');
    if (oldBadge) oldBadge.style.display = 'none';

    // new bottom-bar badge
    const badge = document.getElementById('bb-cart-badge');
    if (!badge) return;
    const count = window.DelivoCart ? window.DelivoCart.getCount() : 0;
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
}