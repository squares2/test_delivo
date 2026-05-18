/* ============================================================
   scripts/firebase-init.js
   Firebase init — plain script, no ES modules.
   Exposes:
     window.DelivoAuth   — auth methods
     window.DelivoDB     — Firestore helpers
     window.DelivoUser   — current user or null
   ============================================================ */

const FIREBASE_CONFIG = {
    apiKey:            "AIzaSyCSTThgge2nSFlEQXjS1ta2tZXvVgNAnZ0",
    authDomain:        "deliveryonline-300f7.firebaseapp.com",
    databaseURL:       "https://deliveryonline-300f7-default-rtdb.firebaseio.com",
    projectId:         "deliveryonline-300f7",
    storageBucket:     "deliveryonline-300f7.firebasestorage.app",
    messagingSenderId: "360058447266",
    appId:             "1:360058447266:web:5ac25e3ad30f636bdd3efb"
};

const _configReady = !Object.values(FIREBASE_CONFIG).some(v => v.startsWith('YOUR_'));
if (!_configReady) {
    console.warn('[Delivo] Firebase config not set.');
}

(function loadFirebase() {
    if (!_configReady) return;
    const scripts = [
        'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
        'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js',
        'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js',
    ];
    let loaded = 0;
    scripts.forEach(src => {
        const s  = document.createElement('script');
        s.src    = src;
        s.async  = false;
        s.onload = () => { if (++loaded === scripts.length) onFirebaseReady(); };
        s.onerror = () => console.error('[Delivo] Failed to load Firebase SDK:', src);
        document.head.appendChild(s);
    });
})();

function onFirebaseReady() {
    try { firebase.initializeApp(FIREBASE_CONFIG); }
    catch (e) { if (e.code !== 'app/duplicate-app') throw e; }

    const auth = firebase.auth();
    const db   = firebase.firestore();

    // ── Sanitizer ────────────────────────────────────────────
    function sanitize(val) {
        if (typeof val !== 'string') return val;
        return val.replace(/<[^>]*>/g, '').replace(/javascript:/gi, '').trim().slice(0, 500);
    }

    // ── Rate limiter ─────────────────────────────────────────
    const _limits = {};
    function rateLimit(key, max, windowMs) {
        const now = Date.now();
        if (!_limits[key]) _limits[key] = [];
        _limits[key] = _limits[key].filter(t => now - t < windowMs);
        if (_limits[key].length >= max) return false;
        _limits[key].push(now);
        return true;
    }

    // ── Error messages ────────────────────────────────────────
    function authMsg(code) {
        const map = {
            'auth/user-not-found':          'No account found with this email.',
            'auth/wrong-password':          'Incorrect password.',
            'auth/invalid-credential':      'Incorrect email or password.',
            'auth/invalid-email':           'Invalid email address.',
            'auth/email-already-in-use':    'This email is already registered.',
            'auth/weak-password':           'Password must be at least 8 characters.',
            'auth/too-many-requests':       'Too many attempts. Please wait and try again.',
            'auth/network-request-failed':  'No internet connection.',
            'auth/user-disabled':           'This account has been disabled.',
            'auth/invalid-phone-number':    'Invalid phone number. Use format: 03XXXXXX',
            'auth/missing-phone-number':    'Please enter your phone number.',
            'auth/quota-exceeded':          'SMS quota exceeded. Try again later.',
            'auth/invalid-verification-code': 'Incorrect code. Please try again.',
            'auth/code-expired':            'Code expired. Please request a new one.',
            'auth/session-expired':         'Session expired. Please request a new code.',
        };
        return map[code] || 'Something went wrong. Please try again.';
    }

    // ── Format Lebanese number to E.164 ──────────────────────
    // Accepts: 03123456 / 3123456 / +96103123456 / 96103123456
    function formatLebanesePhone(raw) {
        const digits = raw.replace(/\D/g, '');
        // Already has country code
        if (digits.startsWith('961')) return '+' + digits;
        // Local format: starts with 0
        if (digits.startsWith('0'))   return '+961' + digits.slice(1);
        // 8-digit without leading 0
        if (digits.length === 8)      return '+961' + digits;
        return null; // invalid
    }

    // ── reCAPTCHA verifier (created once, reused) ─────────────
    let _recaptchaVerifier = null;
    let _confirmationResult = null;

    function getRecaptcha() {
        if (_recaptchaVerifier) return _recaptchaVerifier;
        _recaptchaVerifier = new firebase.auth.RecaptchaVerifier(
            'recaptcha-container',
            {
                size: 'invisible',
                callback: () => {},
                'expired-callback': () => {
                    _recaptchaVerifier = null;
                }
            }
        );
        return _recaptchaVerifier;
    }

    // ── Auth state observer ──────────────────────────────────
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            window.DelivoUser = {
                uid:         user.uid,
                phone:       user.phoneNumber || '',
                displayName: user.displayName || '',
            };
            try {
                const snap = await db.collection('users').doc(user.uid).get();
                if (snap.exists) {
                    window.DelivoUser = { ...window.DelivoUser, ...snap.data() };
                }
            } catch (_) {}
        } else {
            window.DelivoUser = null;
        }

        const acctBtn = document.getElementById('account-btn');
        if (acctBtn) {
            if (window.DelivoUser) acctBtn.classList.add('logged-in');
            else                   acctBtn.classList.remove('logged-in');
        }

        if (typeof window.__renderAccountModal === 'function') {
            window.__renderAccountModal();
        }

        console.log('[Delivo Auth] User:', window.DelivoUser
            ? (window.DelivoUser.phone || window.DelivoUser.email || window.DelivoUser.uid)
            : 'none');
    });

    // ── window.DelivoAuth ─────────────────────────────────────
    window.DelivoAuth = {

        // ── Step 1: send OTP ───────────────────────────────────
        async sendOTP({ name, phone }) {
            if (!name || name.trim().length < 2)
                return { error: true, message: 'Please enter your full name.' };

            const formatted = formatLebanesePhone(phone || '');
            if (!formatted)
                return { error: true, message: 'Invalid number. Example: 03 123 456' };

            if (!rateLimit('sendOTP', 3, 120_000))
                return { error: true, message: 'Too many attempts. Wait 2 minutes.' };

            try {
                // Sign out any existing session first — stale session causes 400/500
                if (auth.currentUser) await auth.signOut();

                // Always create a fresh reCAPTCHA for each attempt
                if (_recaptchaVerifier) {
                    try { _recaptchaVerifier.clear(); } catch(_) {}
                    _recaptchaVerifier = null;
                }

                const verifier = getRecaptcha();
                // Render verifier before sending (required for invisible reCAPTCHA)
                await verifier.render();

                _confirmationResult = await auth.signInWithPhoneNumber(formatted, verifier);
                window._pendingRegName  = sanitize(name.trim());
                window._pendingRegPhone = formatted;
                return { success: true, phone: formatted };
            } catch (e) {
                // Always reset on any error so next attempt gets a clean state
                if (_recaptchaVerifier) {
                    try { _recaptchaVerifier.clear(); } catch(_) {}
                    _recaptchaVerifier = null;
                }
                console.error('[Delivo] sendOTP error:', e.code, e.message);
                return { error: true, message: authMsg(e.code) + ' [' + (e.code || 'unknown') + ']' };
            }
        },

        // ── Step 2: verify OTP ─────────────────────────────────
        async verifyOTP({ code }) {
            if (!code || code.length !== 6)
                return { error: true, message: 'Please enter the 6-digit code.' };

            if (!_confirmationResult)
                return { error: true, message: 'Session expired. Please start again.' };

            if (!rateLimit('verifyOTP', 5, 60_000))
                return { error: true, message: 'Too many attempts. Please wait.' };

            try {
                const cred = await _confirmationResult.confirm(code);
                const user = cred.user;

                // Set display name
                const name = window._pendingRegName || '';
                if (name) await user.updateProfile({ displayName: name });

                // Save to Firestore
                await db.collection('users').doc(user.uid).set({
                    name:      name,
                    phone:     window._pendingRegPhone || user.phoneNumber || '',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });

                // Clean up
                _confirmationResult       = null;
                window._pendingRegName    = null;
                window._pendingRegPhone   = null;

                return { success: true };
            } catch (e) {
                return { error: true, message: authMsg(e.code) };
            }
        },

        // ── Resend OTP ──────────────────────────────────────────
        async resendOTP() {
            const phone = window._pendingRegPhone;
            const name  = window._pendingRegName || '';
            if (!phone) return { error: true, message: 'Session expired. Please start again.' };
            _recaptchaVerifier = null; // force fresh recaptcha
            return await window.DelivoAuth.sendOTP({ name, phone });
        },

        // ── Email login (kept for admin / fallback) ────────────
        async login({ email, password }) {
            if (!rateLimit('login', 5, 600_000))
                return { error: true, message: 'Too many attempts. Wait 10 minutes.' };
            if (!email || !password)
                return { error: true, message: 'Please fill in all fields.' };
            try {
                await auth.signInWithEmailAndPassword(email.trim(), password);
                return { success: true };
            } catch (e) {
                return { error: true, message: authMsg(e.code) };
            }
        },

        async logout() {
            try {
                await auth.signOut();
                return { success: true };
            } catch (e) {
                return { error: true, message: authMsg(e.code) };
            }
        },

        async resetPassword(email) {
            if (!email) return { error: true, message: 'Enter your email first.' };
            try {
                await auth.sendPasswordResetEmail(email.trim());
                return { success: true };
            } catch (e) {
                return { error: true, message: authMsg(e.code) };
            }
        },
    };

    // ── window.DelivoDB ───────────────────────────────────────
    window.DelivoDB = {
        async getStores(category = 'all') {
            try {
                let ref = db.collection('stores').where('active', '==', true).orderBy('order');
                if (category !== 'all') ref = ref.where('category', '==', category);
                const snap = await ref.get();
                return snap.docs.map(d => ({ id: d.id, ...d.data() }));
            } catch (e) { console.error('[DB] getStores:', e); return []; }
        },
        async getCategories() {
            try {
                const snap = await db.collection('categories')
                    .where('active', '==', true).orderBy('order').get();
                return snap.docs.map(d => ({ id: d.id, ...d.data() }));
            } catch (e) { console.error('[DB] getCategories:', e); return []; }
        },
        async getOffers() {
            try {
                const snap = await db.collection('offers')
                    .where('active', '==', true).orderBy('order').get();
                return snap.docs.map(d => ({ id: d.id, ...d.data() }));
            } catch (e) { console.error('[DB] getOffers:', e); return []; }
        },
    };

    console.log('[Delivo] Firebase ready ✓');
}