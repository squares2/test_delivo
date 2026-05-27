/* ============================================================
   presence.js — Real-time online visitor counter
   Strategy:
   - SDK path: .info/connected + onDisconnect().remove()
   - Every session has a TTL timestamp; a cleanup sweep removes
     any session older than STALE_MS on each connect (handles
     crashed tabs / lost connections that never disconnected)
   - REST fallback uses keepalive fetch for reliable cleanup
   ============================================================ */

(function () {
    'use strict';

    const RTDB_BASE   = 'https://deliveryonline-300f7-default-rtdb.firebaseio.com';
    const SESSION_KEY = '_dlv_sid';
    const HEARTBEAT   = 5 * 1000;        /* update lastSeen every 5s   */
    const STALE_MS    = 15 * 1000;       /* session older than 15s = stale */

    /* ── Session ID ─────────────────────────────────────────── */
    function getSessionId() {
        let sid = sessionStorage.getItem(SESSION_KEY);
        if (!sid) {
            sid = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
            sessionStorage.setItem(SESSION_KEY, sid);
        }
        return sid;
    }

    /* ── REST helpers ───────────────────────────────────────── */
    function rtdbPut(path, data, keepalive = false) {
        return fetch(`${RTDB_BASE}/${path}.json`, {
            method:    'PUT',
            headers:   { 'Content-Type': 'application/json' },
            body:      JSON.stringify(data),
            keepalive,                    /* stays alive past pagehide */
        }).catch(() => {});
    }

    function rtdbDelete(path, keepalive = false) {
        return fetch(`${RTDB_BASE}/${path}.json`, {
            method:    'DELETE',
            keepalive,
        }).catch(() => {});
    }

    async function rtdbGet(path) {
        try {
            const r = await fetch(`${RTDB_BASE}/${path}.json`);
            return await r.json();
        } catch (_) { return null; }
    }

    /* ── Payload ────────────────────────────────────────────── */
    function buildPayload(sid) {
        return {
            sid,
            connectedAt: Date.now(),
            lastSeen:    Date.now(),
            /* Future fields (uncomment when needed):
            uid:    null,
            device: /Mobi/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
            page:   location.pathname,
            */
        };
    }

    /* ── Stale session cleanup ──────────────────────────────── */
    async function sweepStale(db) {
        /* Called once on connect — removes sessions whose lastSeen
           is older than STALE_MS (crashed tabs, lost connections) */
        try {
            const snap = await (db
                ? db.ref('presence').once('value')
                : rtdbGet('presence'));

            const sessions = db ? snap.val() : snap;
            if (!sessions) return;

            const cutoff = Date.now() - STALE_MS;
            const staleKeys = Object.entries(sessions)
                .filter(([, v]) => v.lastSeen < cutoff)
                .map(([k]) => k);

            await Promise.all(staleKeys.map(k =>
                db
                    ? db.ref(`presence/${k}`).remove()
                    : rtdbDelete(`presence/${k}`)
            ));
        } catch (_) {}
    }

    /* ── SDK path (preferred) ───────────────────────────────── */
    function initWithSDK(sid, db) {
        const sessionRef   = db.ref(`presence/${sid}`);
        const connectedRef = db.ref('.info/connected');

        connectedRef.on('value', async snap => {
            if (!snap.val()) return;

            /* 1. Clean up stale sessions from previous crashes */
            await sweepStale(db);

            /* 2. Register server-side disconnect handler FIRST */
            await sessionRef.onDisconnect().remove();

            /* 3. Then write this session */
            await sessionRef.set(buildPayload(sid));
        });

        /* Heartbeat — keeps lastSeen fresh + re-registers if tab was hidden */
        setInterval(() => {
            if (document.visibilityState === 'hidden') return; /* skip when hidden */
            sessionRef.once('value').then(snap => {
                if (!snap.exists()) {
                    /* Session was swept while in background — re-register */
                    sessionRef.onDisconnect().remove();
                    sessionRef.set(buildPayload(sid));
                } else {
                    sessionRef.update({ lastSeen: Date.now() }).catch(() => {});
                }
            }).catch(() => {});
        }, HEARTBEAT);

        /* Re-register when tab comes back to foreground */
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState !== 'visible') return;
            sessionRef.onDisconnect().remove().then(() => {
                sessionRef.set(buildPayload(sid));
            }).catch(() => {});
        });

        /* Live count listener */
        db.ref('presence').on('value', snap => {
            updateWidget(snap.numChildren());
        });

        /* Expose for login linkage */
        window._delivoPresence = {
            linkUser(uid) { sessionRef.update({ uid, lastSeen: Date.now() }); }
        };
    }

    /* ── REST fallback ──────────────────────────────────────── */
    async function initWithREST(sid) {
        const path = `presence/${sid}`;

        await sweepStale(null);
        await rtdbPut(path, buildPayload(sid));

        /* Heartbeat */
        const hb = setInterval(() => {
            rtdbPut(path, { ...buildPayload(sid), lastSeen: Date.now() });
        }, HEARTBEAT);

        /* Cleanup — keepalive:true survives pagehide */
        let cleaned = false;
        function cleanup() {
            if (cleaned) return;
            cleaned = true;
            clearInterval(hb);
            rtdbDelete(path, true);   /* keepalive fetch — works on tab close */
        }

        window.addEventListener('pagehide',     cleanup);
        window.addEventListener('beforeunload', cleanup);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                /* Tab came back to foreground — re-register session */
                cleaned = false;
                rtdbPut(path, { ...buildPayload(sid), lastSeen: Date.now() });
            }
            /* Do NOT cleanup on hidden — stale sweep handles it */
        });

        /* Poll count */
        async function pollCount() {
            const data  = await rtdbGet('presence');
            const count = data ? Object.keys(data).length : 1;
            updateWidget(count);
        }
        pollCount();
        setInterval(pollCount, 5_000);
    }

    /* ── Widget ─────────────────────────────────────────────── */
    function updateWidget(count) {
        const el  = document.getElementById('hero-online-count');
        if (!el) return;
        const num = el.querySelector('.online-num');
        const dot = el.querySelector('.online-dot');
        if (!num) return;

        const prev = parseInt(num.textContent) || 0;
        if (prev === count) return;

        num.style.transform = 'translateY(-5px)';
        num.style.opacity   = '0';
        setTimeout(() => {
            num.textContent     = count;
            num.style.transform = 'translateY(0)';
            num.style.opacity   = '1';
        }, 180);

        dot?.classList.add('pulse');
        setTimeout(() => dot?.classList.remove('pulse'), 600);
    }

    /* ── Init ───────────────────────────────────────────────── */
    function init() {
        const sid = getSessionId();

        function trySDK() {
            if (window.firebase?.database) {
                initWithSDK(sid, window.firebase.database());
                return true;
            }
            return false;
        }

        if (!trySDK()) {
            setTimeout(() => {
                if (!trySDK()) initWithREST(sid);
            }, 1500);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();