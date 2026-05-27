/* ============================================================
   presence.js — Real-time online visitor counter
   Uses Firebase RTDB .info/connected + onDisconnect()
   Works for ALL visitors — logged in or not.
   Extensible: each session stored as a full object under
   /presence/{sessionId} so you can later add location,
   device type, page, timestamps, etc.
   ============================================================ */

(function () {
    'use strict';

    const RTDB_BASE   = 'https://deliveryonline-300f7-default-rtdb.firebaseio.com';
    const SESSION_KEY = '_dlv_sid';          /* sessionStorage key for this tab's ID */
    const HEARTBEAT   = 45 * 1000;          /* re-ping every 45 s to fight stale data */

    /* ── Generate or reuse a session ID for this tab ───────── */
    function getSessionId() {
        let sid = sessionStorage.getItem(SESSION_KEY);
        if (!sid) {
            sid = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
            sessionStorage.setItem(SESSION_KEY, sid);
        }
        return sid;
    }

    /* ── RTDB REST helpers ──────────────────────────────────── */
    async function rtdbPut(path, data) {
        try {
            await fetch(`${RTDB_BASE}/${path}.json`, {
                method:  'PUT',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify(data),
            });
        } catch (_) {}
    }

    async function rtdbDelete(path) {
        try {
            await fetch(`${RTDB_BASE}/${path}.json`, { method: 'DELETE' });
        } catch (_) {}
    }

    async function rtdbGet(path) {
        try {
            const r = await fetch(`${RTDB_BASE}/${path}.json`);
            return await r.json();
        } catch (_) { return null; }
    }

    /* ── Build presence payload (extend later as needed) ───── */
    function buildPayload(sid) {
        return {
            sid,
            connectedAt: Date.now(),
            lastSeen:    Date.now(),
            /* Extensible fields — uncomment / add when needed:
            uid:      null,          // filled when user logs in
            page:     location.pathname,
            device:   /Mobi/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
            city:     null,          // fill from geolocation later
            */
        };
    }

    /* ── SDK-based presence (when Firebase SDK is loaded) ───── */
    function initWithSDK(sid, db) {
        const sessionRef   = db.ref(`presence/${sid}`);
        const connectedRef = db.ref('.info/connected');

        connectedRef.on('value', snap => {
            if (!snap.val()) return;                 /* offline — do nothing */

            /* When this session disconnects, Firebase removes it server-side */
            sessionRef.onDisconnect().remove();

            /* Write this session */
            sessionRef.set(buildPayload(sid));
        });

        /* Count /presence children = online sessions */
        db.ref('presence').on('value', snap => {
            const count = snap.numChildren();
            updateWidget(count);
        });

        /* Expose for later login linkage */
        window._delivoPresence = {
            linkUser(uid) {
                sessionRef.update({ uid, lastSeen: Date.now() });
            }
        };
    }

    /* ── REST-based presence fallback (no SDK) ──────────────── */
    function initWithREST(sid) {
        const path = `presence/${sid}`;

        /* Write on load */
        rtdbPut(path, buildPayload(sid));

        /* Heartbeat — keeps session alive */
        let heartbeatTimer = setInterval(() => {
            rtdbPut(path, { ...buildPayload(sid), lastSeen: Date.now() });
        }, HEARTBEAT);

        /* Best-effort cleanup on tab close */
        function cleanup() {
            clearInterval(heartbeatTimer);
            /* sendBeacon is fire-and-forget, works during pagehide */
            if (navigator.sendBeacon) {
                navigator.sendBeacon(
                    `${RTDB_BASE}/${path}.json?method=DELETE`,
                    new Blob(['null'], { type: 'application/json' })
                );
            } else {
                rtdbDelete(path);
            }
        }
        window.addEventListener('pagehide',        cleanup);
        window.addEventListener('beforeunload',    cleanup);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') cleanup();
        });

        /* Poll count every 20 s */
        async function pollCount() {
            const data  = await rtdbGet('presence');
            const count = data ? Object.keys(data).length : 1;
            updateWidget(count);
        }
        pollCount();
        setInterval(pollCount, 20_000);
    }

    /* ── Widget renderer ────────────────────────────────────── */
    function updateWidget(count) {
        const el = document.getElementById('hero-online-count');
        if (!el) return;
        const dot  = el.querySelector('.online-dot');
        const num  = el.querySelector('.online-num');
        const lbl  = el.querySelector('.online-lbl');
        if (!num) return;

        /* Animate number change */
        const prev = parseInt(num.textContent) || 0;
        if (prev !== count) {
            num.style.transform = 'translateY(-4px)';
            num.style.opacity   = '0';
            setTimeout(() => {
                num.textContent     = count;
                num.style.transform = 'translateY(0)';
                num.style.opacity   = '1';
            }, 180);
        }

        /* Pulse the dot */
        dot?.classList.add('pulse');
        setTimeout(() => dot?.classList.remove('pulse'), 600);
    }

    /* ── Entry point — waits for Firebase SDK if available ──── */
    function init() {
        const sid = getSessionId();

        /* Try SDK first (loaded by firebase-init.js) */
        if (window.firebase && window.firebase.database) {
            initWithSDK(sid, window.firebase.database());
        } else {
            /* Retry once after firebase-init may have run */
            setTimeout(() => {
                if (window.firebase && window.firebase.database) {
                    initWithSDK(sid, window.firebase.database());
                } else {
                    initWithREST(sid);
                }
            }, 1200);
        }
    }

    /* Run after DOM is ready */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();