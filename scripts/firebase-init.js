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
            'auth/error-code:-39':          'SMS service temporarily unavailable. Please try again later.',
        };
        return map[code] || 'Something went wrong. Please try again.';
    }

    // ── Device UUID ───────────────────────────────────────────
    // Generates a persistent UUID stored in localStorage.
    // Used to limit how many accounts one device can create.
    // Max 3 accounts per device UUID.

    const MAX_ACCOUNTS_PER_DEVICE = 3;

    function getDeviceUUID() {
        let uuid = localStorage.getItem('delivo_device_uuid');
        if (!uuid) {
            uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                const r = Math.random() * 16 | 0;
                return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
            });
            localStorage.setItem('delivo_device_uuid', uuid);
        }
        return uuid;
    }

    async function checkDeviceLimit() {
        const uuid = getDeviceUUID();
        try {
            const snap = await db.collection('devices').doc(uuid).get();
            if (!snap.exists) return { allowed: true, count: 0, uuid };
            const count = snap.data().accountCount || 0;
            if (count >= MAX_ACCOUNTS_PER_DEVICE) {
                return {
                    allowed: false,
                    count,
                    uuid,
                    message: `لا يمكن إنشاء أكثر من ${MAX_ACCOUNTS_PER_DEVICE} حسابات من نفس الجهاز.`,
                };
            }
            return { allowed: true, count, uuid };
        } catch (e) {
            console.error('[Delivo] checkDeviceLimit:', e);
            return { allowed: true, count: 0, uuid }; // fail open
        }
    }

    async function incrementDeviceCount(uuid) {
        try {
            await db.collection('devices').doc(uuid).set({
                accountCount: firebase.firestore.FieldValue.increment(1),
                lastUsed:     firebase.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        } catch (e) {
            console.error('[Delivo] incrementDeviceCount:', e);
        }
    }

    // ── Username validation ───────────────────────────────────
    // Only lowercase letters, numbers, underscores. 3-30 chars.
    function validateUsername(username) {
        return /^[a-z0-9_]{3,30}$/.test(username);
    }

    // Username is stored as username@delivo.internal in Firebase Auth
    // (Firebase requires email format for email/password auth)
    function usernameToEmail(username) {
        return username.toLowerCase().trim() + '@delivo.internal';
    }

    // ── Auth state observer ──────────────────────────────────
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            window.DelivoUser = {
                uid:         user.uid,
                displayName: user.displayName || '',
                email:       user.email || '',
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

        // ── Register with username + password ──────────────────
        async register({ username, displayName, password, lat, lng }) {

            // Validate username
            username = (username || '').toLowerCase().trim();
            if (!validateUsername(username))
                return { error: true, message: 'اسم المستخدم: 3-30 حرف إنجليزي، أرقام أو _  فقط.' };

            // Validate display name
            if (!displayName || displayName.trim().length < 2)
                return { error: true, message: 'أدخل اسمك الظاهر (حرفان على الأقل).' };

            // Validate password
            if (!password || password.length < 8)
                return { error: true, message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.' };

            // Rate limit
            if (!rateLimit('register', 3, 60_000))
                return { error: true, message: 'حاولت كثيراً. انتظر دقيقة.' };

            // Check device limit (max 3 accounts per device)
            const deviceCheck = await checkDeviceLimit();
            if (!deviceCheck.allowed)
                return { error: true, message: deviceCheck.message };

            // Check username not already taken
            try {
                const taken = await db.collection('usernames').doc(username).get();
                if (taken.exists)
                    return { error: true, message: 'اسم المستخدم محجوز. اختر اسماً آخر.' };
            } catch (e) {}

            try {
                const email = usernameToEmail(username);
                const cred  = await auth.createUserWithEmailAndPassword(email, password);
                const user  = cred.user;

                // Set display name in Auth
                await user.updateProfile({ displayName: sanitize(displayName.trim()) });

                // Save user profile to Firestore
                const userData = {
                    username:    username,
                    displayName: sanitize(displayName.trim()),
                    deviceUUID:  deviceCheck.uuid,
                    createdAt:   firebase.firestore.FieldValue.serverTimestamp(),
                };
                if (lat && lng) {
                    userData.location = { lat: Number(lat), lng: Number(lng) };
                }
                await db.collection('users').doc(user.uid).set(userData);

                // Reserve username
                await db.collection('usernames').doc(username).set({
                    uid:       user.uid,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                });

                // Increment device account count
                await incrementDeviceCount(deviceCheck.uuid);

                return { success: true };
            } catch (e) {
                console.error('[Delivo] register:', e.code, e.message);
                if (e.code === 'auth/email-already-in-use')
                    return { error: true, message: 'اسم المستخدم محجوز. اختر اسماً آخر.' };
                return { error: true, message: authMsg(e.code) };
            }
        },

        // ── Login with username + password ─────────────────────
        async login({ username, password }) {
            username = (username || '').toLowerCase().trim();
            if (!username || !password)
                return { error: true, message: 'أدخل اسم المستخدم وكلمة المرور.' };

            if (!rateLimit('login', 5, 600_000))
                return { error: true, message: 'محاولات كثيرة. انتظر 10 دقائق.' };

            try {
                const email = usernameToEmail(username);
                await auth.signInWithEmailAndPassword(email, password);
                return { success: true };
            } catch (e) {
                // Map to Arabic
                if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password')
                    return { error: true, message: 'اسم المستخدم أو كلمة المرور غير صحيحة.' };
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

        // ── SMS methods (kept, ready to re-enable later) ───────
        // When SMS is fixed, just wire these back to the UI.
        async sendOTP({ name, phone }) {
            return { error: true, message: 'SMS verification coming soon.' };
        },
        async verifyOTP({ code }) {
            return { error: true, message: 'SMS verification coming soon.' };
        },
        async resendOTP() {
            return { error: true, message: 'SMS verification coming soon.' };
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

        // ── Check if user is blocked ───────────────────────────
        // Call this before showing the order flow.
        // You block a user by setting blocked:true in their
        // Firestore document from Firebase Console.
        async isUserBlocked(uid) {
            if (!uid) return false;
            try {
                const snap = await db.collection('users').doc(uid).get();
                if (!snap.exists) return false;
                return snap.data().blocked === true;
            } catch (e) {
                console.error('[DB] isUserBlocked:', e);
                return false;
            }
        },

        // ── Check daily order limit ────────────────────────────
        // Returns { allowed: true } or { allowed: false, message, count, limit }
        // MAX_DAILY_ORDERS is read from /settings/orders doc so
        // you can change it anytime from Firebase Console without
        // touching code. Defaults to 3 if not set.
        async checkDailyLimit(uid) {
            if (!uid) return { allowed: false, message: 'يجب تسجيل الدخول أولاً.' };

            try {
                // Get limit from settings (you can change this in Firestore Console)
                let maxOrders = 3; // default
                try {
                    const settingsSnap = await db.collection('settings').doc('orders').get();
                    if (settingsSnap.exists && settingsSnap.data().maxPerDay) {
                        maxOrders = settingsSnap.data().maxPerDay;
                    }
                } catch (_) {}

                // Count today's orders for this user
                const startOfDay = new Date();
                startOfDay.setHours(0, 0, 0, 0);

                const snap = await db.collection('orders')
                    .where('userId', '==', uid)
                    .where('createdAt', '>=', firebase.firestore.Timestamp.fromDate(startOfDay))
                    .get();

                const count = snap.size;

                if (count >= maxOrders) {
                    return {
                        allowed:  false,
                        message:  `لقد وصلت للحد الأقصى من الطلبات اليومية (${maxOrders} طلبات). حاول غداً.`,
                        count,
                        limit:    maxOrders,
                    };
                }

                return { allowed: true, count, limit: maxOrders, remaining: maxOrders - count };
            } catch (e) {
                console.error('[DB] checkDailyLimit:', e);
                // Fail open — don't block user if check fails
                return { allowed: true };
            }
        },

        // ── Place an order (with limit + block check built in) ─
        async placeOrder(uid, { storeId, items, total, address, notes }) {
            if (!uid) return { error: true, message: 'يجب تسجيل الدخول لإتمام الطلب.' };

            // 1. Check if user is blocked
            const blocked = await window.DelivoDB.isUserBlocked(uid);
            if (blocked) {
                return {
                    error:   true,
                    message: 'حسابك موقوف. تواصل مع الدعم للمزيد من المعلومات.',
                    blocked: true,
                };
            }

            // 2. Check daily order limit
            const limitCheck = await window.DelivoDB.checkDailyLimit(uid);
            if (!limitCheck.allowed) {
                return { error: true, message: limitCheck.message, limitReached: true };
            }

            // 3. Validate order data
            if (!items || items.length === 0)
                return { error: true, message: 'السلة فارغة.' };
            if (!total || total <= 0)
                return { error: true, message: 'المبلغ غير صحيح.' };
            if (!storeId)
                return { error: true, message: 'لم يتم تحديد المتجر.' };

            // 4. Place the order
            try {
                const ref = await db.collection('orders').add({
                    userId:    uid,
                    storeId:   sanitize(String(storeId)),
                    items:     items.map(i => ({
                        id:    sanitize(String(i.id)),
                        name:  sanitize(String(i.name)),
                        price: Number(i.price),
                        qty:   Math.max(1, Math.floor(Number(i.qty))),
                    })),
                    total:     Number(total),
                    address:   sanitize(String(address || '')),
                    notes:     sanitize(String(notes   || '')).slice(0, 200),
                    status:    'pending',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                });
                return { success: true, orderId: ref.id };
            } catch (e) {
                console.error('[DB] placeOrder:', e);
                return { error: true, message: 'فشل إرسال الطلب. حاول مجدداً.' };
            }
        },
    };

    console.log('[Delivo] Firebase ready ✓');
}
