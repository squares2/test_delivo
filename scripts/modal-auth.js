/* ============================================================
   scripts/modal-auth.js
   Wires login, register, and account modals.
   Username + Password auth. SMS ready to re-enable later.
   ============================================================ */

function initModalAuth() {
    window.__renderAccountModal = renderAccountModal;

    // ── Login ───────────────────────────────────────────────
    const loginBtn = document.getElementById('login-submit');
    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            const username = document.getElementById('login-username')?.value || '';
            const password = document.getElementById('login-password')?.value || '';
            const errorEl  = document.getElementById('login-error');
            setLoading(loginBtn, true, 'جاري الدخول...');
            hideError(errorEl);
            const result = await window.DelivoAuth.login({ username, password });
            setLoading(loginBtn, false, 'دخول');
            if (result.error) showError(errorEl, result.message);
            else {
                closeModal('modal-login');
                clearFields(['login-username', 'login-password']);
            }
        });
    }

    // ── Register ────────────────────────────────────────────
    const regBtn = document.getElementById('reg-submit');
    if (regBtn) {
        regBtn.addEventListener('click', async () => {
            const username    = document.getElementById('reg-username')?.value    || '';
            const displayName = document.getElementById('reg-displayname')?.value || '';
            const password    = document.getElementById('reg-password')?.value    || '';
            const lat         = document.getElementById('reg-lat')?.value         || null;
            const lng         = document.getElementById('reg-lng')?.value         || null;
            const errorEl     = document.getElementById('reg-error');

            setLoading(regBtn, true, 'جاري الإنشاء...');
            hideError(errorEl);

            const result = await window.DelivoAuth.register({
                username, displayName, password, lat, lng
            });

            setLoading(regBtn, false, 'إنشاء الحساب');
            if (result.error) {
                showError(errorEl, result.message);
            } else {
                closeModal('modal-subscribe');
                clearFields(['reg-username','reg-displayname','reg-password']);
                resetLocationBtn();
            }
        });
    }

    // ── Location button ─────────────────────────────────────
    const locationBtn = document.getElementById('reg-location-btn');
    if (locationBtn) {
        locationBtn.addEventListener('click', () => {
            const label = document.getElementById('reg-location-label');
            if (!navigator.geolocation) {
                if (label) label.textContent = 'الجهاز لا يدعم GPS';
                return;
            }
            if (label) label.textContent = 'جاري التحديد...';
            locationBtn.disabled = true;

            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    document.getElementById('reg-lat').value = pos.coords.latitude;
                    document.getElementById('reg-lng').value = pos.coords.longitude;
                    if (label) label.textContent = '✓ تم تحديد موقعك';
                    locationBtn.classList.add('location-btn--success');
                    locationBtn.disabled = false;
                },
                () => {
                    if (label) label.textContent = 'تعذّر تحديد الموقع';
                    locationBtn.disabled = false;
                },
                { timeout: 8000, maximumAge: 60000 }
            );
        });
    }

    // ── Password show/hide toggle ───────────────────────────
    document.addEventListener('click', (e) => {
        const toggle = e.target.closest('.password-toggle');
        if (!toggle) return;
        const targetId = toggle.dataset.target;
        const input    = document.getElementById(targetId);
        if (!input) return;
        input.type = input.type === 'password' ? 'text' : 'password';
        // Swap icon
        const svg = toggle.querySelector('svg');
        if (svg) svg.style.opacity = input.type === 'text' ? '0.5' : '1';
    });

    // ── Username live validation hint ───────────────────────
    const usernameInput = document.getElementById('reg-username');
    if (usernameInput) {
        usernameInput.addEventListener('input', () => {
            const val   = usernameInput.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
            usernameInput.value = val;
        });
    }

    // ── Navbar account button ────────────────────────────────
    const accountBtn = document.getElementById('account-btn');
    if (accountBtn) {
        accountBtn.addEventListener('click', () => {
            renderAccountModal();
            openModal('modal-account');
        });
    }

    // ── Mobile menu Sign In ──────────────────────────────────
    const mobileSigninBtn = document.getElementById('mobile-signin-btn');
    if (mobileSigninBtn) {
        mobileSigninBtn.addEventListener('click', () => {
            document.getElementById('mobile-menu')?.classList.remove('open');
            renderAccountModal();
            openModal('modal-account');
        });
    }

    // ── Account modal delegated clicks ───────────────────────
    document.addEventListener('click', async (e) => {
        if (e.target.closest('#acct-signout-btn')) {
            const btn = e.target.closest('#acct-signout-btn');
            btn.textContent = 'Signing out...';
            btn.disabled    = true;
            await window.DelivoAuth.logout();
            closeModal('modal-account');
            return;
        }
        if (e.target.closest('.acct-btn-signin')) {
            closeModal('modal-account');
            setTimeout(() => openModal('modal-login'), 180);
            return;
        }
        if (e.target.closest('.acct-btn-register')) {
            closeModal('modal-account');
            setTimeout(() => openModal('modal-subscribe'), 180);
            return;
        }
    });

    // ── Enter key ────────────────────────────────────────────
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        const active = document.querySelector('.modal-overlay.active');
        if (!active) return;
        if (active.id === 'modal-login')     loginBtn?.click();
        if (active.id === 'modal-subscribe') regBtn?.click();
    });
}

// ── Render account modal ──────────────────────────────────────
function renderAccountModal() {
    const user    = window.DelivoUser;
    const guestEl = document.getElementById('acct-guest');
    const userEl  = document.getElementById('acct-user');
    const acctBtn = document.getElementById('account-btn');
    if (!guestEl || !userEl) return;

    if (user) {
        guestEl.style.display = 'none';
        userEl.style.display  = '';
        const initial  = (user.displayName || user.username || 'U').charAt(0).toUpperCase();
        const avatarEl = document.getElementById('acct-avatar');
        const nameEl   = document.getElementById('acct-name');
        const emailEl  = document.getElementById('acct-email');
        if (avatarEl) avatarEl.textContent = initial;
        if (nameEl)   nameEl.textContent   = user.displayName || user.username || 'User';
        if (emailEl)  emailEl.textContent  = user.username ? '@' + user.username : '';
        if (acctBtn)  acctBtn.classList.add('logged-in');
    } else {
        guestEl.style.display = '';
        userEl.style.display  = 'none';
        if (acctBtn) acctBtn.classList.remove('logged-in');
    }
}

// ── Location button reset ─────────────────────────────────────
function resetLocationBtn() {
    const label = document.getElementById('reg-location-label');
    const btn   = document.getElementById('reg-location-btn');
    if (label) label.textContent = 'تحديد موقعي';
    if (btn)   btn.classList.remove('location-btn--success');
    const lat = document.getElementById('reg-lat');
    const lng = document.getElementById('reg-lng');
    if (lat) lat.value = '';
    if (lng) lng.value = '';
}

// ── Helpers ───────────────────────────────────────────────────
function setLoading(btn, loading, label) {
    btn.disabled    = loading;
    btn.textContent = label;
}
function showError(el, message) {
    if (!el) return;
    el.textContent       = message;
    el.style.display     = 'block';
    el.style.background  = '#fff1f1';
    el.style.borderColor = '#fca5a5';
    el.style.color       = '#b91c1c';
}
function hideError(el) {
    if (!el) return;
    el.textContent   = '';
    el.style.display = 'none';
}
function clearFields(ids) {
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
}
function openModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.add('active');
    document.body.classList.add('modal-open');
}
function closeModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.remove('active');
    document.body.classList.remove('modal-open');
}
