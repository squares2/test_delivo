/* ============================================================
   scripts/modal-auth.js
   Wires all modals to Firebase Auth.
   Plain script — no ES modules. Uses window.DelivoAuth.
   ============================================================ */

function initModalAuth() {
    window.__renderAccountModal = renderAccountModal;

    // ── Login form ──────────────────────────────────────────
    const loginBtn = document.getElementById('login-submit');
    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            const email    = document.getElementById('login-email')?.value    || '';
            const password = document.getElementById('login-password')?.value || '';
            const errorEl  = document.getElementById('login-error');
            setLoading(loginBtn, true, 'Signing in...');
            hideError(errorEl);
            const result = await window.DelivoAuth.login({ email, password });
            setLoading(loginBtn, false, 'دخول');
            if (result.error) showError(errorEl, result.message);
            else {
                closeModal('modal-login');
                clearFields(['login-email', 'login-password']);
            }
        });
    }

    // ── Forgot password ─────────────────────────────────────
    const forgotLink = document.getElementById('login-forgot');
    if (forgotLink) {
        forgotLink.addEventListener('click', async (e) => {
            e.preventDefault();
            const email   = document.getElementById('login-email')?.value || '';
            const errorEl = document.getElementById('login-error');
            if (!email) { showError(errorEl, 'Enter your email above first.'); return; }
            const result = await window.DelivoAuth.resetPassword(email);
            const el = document.getElementById('login-error');
            if (el) {
                el.textContent       = result.error ? result.message : 'Password reset email sent!';
                el.style.display     = 'block';
                el.style.background  = result.error ? '#fff1f1' : '#f0fff4';
                el.style.borderColor = result.error ? '#fca5a5' : '#86efac';
                el.style.color       = result.error ? '#b91c1c' : '#15803d';
            }
        });
    }

    // ── Register: Step 1 — Send OTP ─────────────────────────
    const sendOtpBtn = document.getElementById('reg-send-otp');
    if (sendOtpBtn) {
        sendOtpBtn.addEventListener('click', async () => {
            const name    = document.getElementById('reg-name')?.value  || '';
            const phone   = document.getElementById('reg-phone')?.value || '';
            const errorEl = document.getElementById('reg-error');
            setLoading(sendOtpBtn, true, 'جاري الإرسال...');
            hideError(errorEl);
            const result = await window.DelivoAuth.sendOTP({ name, phone });
            setLoading(sendOtpBtn, false, 'إرسال رمز التحقق');
            if (result.error) {
                showError(errorEl, result.message);
            } else {
                // Update hint with masked number and show step 2
                const hint = document.getElementById('reg-otp-hint');
                if (hint) hint.textContent = `تم إرسال الرمز إلى ${result.phone}`;
                showStep(2);
                focusFirstOtp();
                startResendTimer();
            }
        });
    }

    // ── Register: Step 2 — Verify OTP ───────────────────────
    const verifyBtn = document.getElementById('reg-verify-otp');
    if (verifyBtn) {
        verifyBtn.addEventListener('click', async () => {
            const code    = getOtpValue();
            const errorEl = document.getElementById('reg-otp-error');
            setLoading(verifyBtn, true, 'جاري التحقق...');
            hideError(errorEl);
            const result = await window.DelivoAuth.verifyOTP({ code });
            setLoading(verifyBtn, false, 'تأكيد');
            if (result.error) {
                showError(errorEl, result.message);
                shakeOtpBoxes();
            } else {
                closeModal('modal-subscribe');
                resetRegisterModal();
            }
        });
    }

    // ── Register: Back button ────────────────────────────────
    const backBtn = document.getElementById('reg-back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => showStep(1));
    }

    // ── Register: Resend OTP ─────────────────────────────────
    const resendBtn = document.getElementById('reg-resend-otp');
    if (resendBtn) {
        resendBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (resendBtn.dataset.disabled === 'true') return;
            const errorEl = document.getElementById('reg-otp-error');
            hideError(errorEl);
            const result = await window.DelivoAuth.resendOTP();
            if (result.error) showError(errorEl, result.message);
            else { clearOtpBoxes(); focusFirstOtp(); startResendTimer(); }
        });
    }

    // ── OTP box auto-advance + paste support ─────────────────
    initOtpBoxes();

    // ── Navbar account button ────────────────────────────────
    const accountBtn = document.getElementById('account-btn');
    if (accountBtn) {
        accountBtn.addEventListener('click', () => {
            renderAccountModal();
            openModal('modal-account');
        });
    }

    // ── Mobile menu Sign In button ───────────────────────────
    const mobileSigninBtn = document.getElementById('mobile-signin-btn');
    if (mobileSigninBtn) {
        mobileSigninBtn.addEventListener('click', () => {
            document.getElementById('mobile-menu')?.classList.remove('open');
            renderAccountModal();
            openModal('modal-account');
        });
    }

    // ── Delegated clicks inside account modal ────────────────
    document.addEventListener('click', async (e) => {
        if (e.target.closest('#acct-signout-btn')) {
            const btn = e.target.closest('#acct-signout-btn');
            btn.textContent = 'Signing out...';
            btn.disabled = true;
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

    // ── Reset register modal when closed ─────────────────────
    document.addEventListener('click', (e) => {
        if (e.target.closest('[data-close]')) {
            const overlay = e.target.closest('.modal-overlay');
            if (overlay && overlay.id === 'modal-subscribe') {
                setTimeout(resetRegisterModal, 300);
            }
        }
    });

    // ── Enter key ────────────────────────────────────────────
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        const active = document.querySelector('.modal-overlay.active');
        if (!active) return;
        if (active.id === 'modal-login')     loginBtn?.click();
        if (active.id === 'modal-subscribe') {
            const step2 = document.getElementById('reg-step-2');
            if (step2 && step2.style.display !== 'none') verifyBtn?.click();
            else sendOtpBtn?.click();
        }
    });
}

// ── Step switcher ────────────────────────────────────────────
function showStep(n) {
    document.getElementById('reg-step-1').style.display = n === 1 ? '' : 'none';
    document.getElementById('reg-step-2').style.display = n === 2 ? '' : 'none';
}

// ── OTP boxes ────────────────────────────────────────────────
function initOtpBoxes() {
    const boxes = document.querySelectorAll('.otp-input');
    boxes.forEach((box, i) => {
        // Auto-advance on input
        box.addEventListener('input', (e) => {
            const val = e.target.value.replace(/\D/g, '');
            e.target.value = val ? val[val.length - 1] : '';
            if (val && i < boxes.length - 1) boxes[i + 1].focus();
            box.classList.toggle('filled', !!e.target.value);
            // Auto-submit when all filled
            if (getOtpValue().length === 6) {
                document.getElementById('reg-verify-otp')?.click();
            }
        });
        // Backspace goes back
        box.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !box.value && i > 0) {
                boxes[i - 1].focus();
                boxes[i - 1].value = '';
                boxes[i - 1].classList.remove('filled');
            }
        });
        // Paste full code
        box.addEventListener('paste', (e) => {
            e.preventDefault();
            const pasted = (e.clipboardData || window.clipboardData)
                .getData('text').replace(/\D/g, '').slice(0, 6);
            boxes.forEach((b, j) => {
                b.value = pasted[j] || '';
                b.classList.toggle('filled', !!b.value);
            });
            if (pasted.length === 6) {
                boxes[5].focus();
                document.getElementById('reg-verify-otp')?.click();
            }
        });
    });
}

function getOtpValue() {
    return Array.from(document.querySelectorAll('.otp-input'))
        .map(b => b.value).join('');
}

function focusFirstOtp() {
    setTimeout(() => document.querySelector('.otp-input')?.focus(), 100);
}

function clearOtpBoxes() {
    document.querySelectorAll('.otp-input').forEach(b => {
        b.value = '';
        b.classList.remove('filled');
    });
}

function shakeOtpBoxes() {
    const boxes = document.getElementById('otp-boxes');
    if (!boxes) return;
    boxes.classList.add('otp-shake');
    clearOtpBoxes();
    setTimeout(() => { boxes.classList.remove('otp-shake'); focusFirstOtp(); }, 500);
}

// ── Resend timer (60s countdown) ─────────────────────────────
let _resendInterval = null;
function startResendTimer() {
    const btn   = document.getElementById('reg-resend-otp');
    const timer = document.getElementById('reg-resend-timer');
    if (!btn || !timer) return;
    let secs = 60;
    btn.dataset.disabled = 'true';
    btn.style.opacity    = '0.4';
    timer.textContent    = ` (${secs}s)`;
    clearInterval(_resendInterval);
    _resendInterval = setInterval(() => {
        secs--;
        timer.textContent = ` (${secs}s)`;
        if (secs <= 0) {
            clearInterval(_resendInterval);
            btn.dataset.disabled = 'false';
            btn.style.opacity    = '1';
            timer.textContent    = '';
        }
    }, 1000);
}

// ── Reset full register modal back to step 1 ─────────────────
function resetRegisterModal() {
    showStep(1);
    clearOtpBoxes();
    clearInterval(_resendInterval);
    ['reg-name', 'reg-phone'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const errorEl = document.getElementById('reg-error');
    const otpErr  = document.getElementById('reg-otp-error');
    if (errorEl) { errorEl.style.display = 'none'; errorEl.textContent = ''; }
    if (otpErr)  { otpErr.style.display  = 'none'; otpErr.textContent  = ''; }
    const timer = document.getElementById('reg-resend-timer');
    const btn   = document.getElementById('reg-resend-otp');
    if (timer) timer.textContent = '';
    if (btn)   { btn.dataset.disabled = 'false'; btn.style.opacity = '1'; }
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
        const initial  = (user.displayName || user.name || 'U').charAt(0).toUpperCase();
        const avatarEl = document.getElementById('acct-avatar');
        const nameEl   = document.getElementById('acct-name');
        const emailEl  = document.getElementById('acct-email');
        if (avatarEl) avatarEl.textContent = initial;
        if (nameEl)   nameEl.textContent   = user.displayName || user.name || 'User';
        if (emailEl)  emailEl.textContent  = user.phone || user.email || '';
        if (acctBtn)  acctBtn.classList.add('logged-in');
    } else {
        guestEl.style.display = '';
        userEl.style.display  = 'none';
        if (acctBtn) acctBtn.classList.remove('logged-in');
    }
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
