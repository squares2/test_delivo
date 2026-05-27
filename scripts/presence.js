/* ============================================================
   presence.js — Real-time online visitor counter
   Key: device UUID (stable across tabs/refreshes, same device)
   Payload: { uuid, uid, username, device, connectedAt, lastSeen }
   ============================================================ */

(function () {
    'use strict';

    const RTDB_BASE   = 'https://deliveryonline-300f7-default-rtdb.firebaseio.com';
    const HEARTBEAT   = 5  * 1000;
    const STALE_MS    = 15 * 1000;

    /* ── Get stable device UUID from localStorage ───────────── */
    function getDeviceUUID() {
        /* firebase-init.js stores it here */
        let uuid = localStorage.getItem('delivo_device_uuid');
        if (!uuid) {
            /* Fallback: generate and persist if firebase-init hasn't run yet */
            uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                const r = Math.random() * 16 | 0;
                return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
            });
            localStorage.setItem('delivo_device_uuid', uuid);
        }
        return uuid;
    }

    /* ── REST helpers ───────────────────────────────────────── */
    function rtdbPut(path, data, keepalive = false) {
        return fetch(`${RTDB_BASE}/${path}.json`, {
            method:    'PUT',
            headers:   { 'Content-Type': 'application/json' },
            body:      JSON.stringify(data),
            keepalive,
        }).catch(() => {});
    }

    function rtdbDelete(path, keepalive = false) {
        return fetch(`${RTDB_BASE}/${path}.json`, {
            method: 'DELETE', keepalive,
        }).catch(() => {});
    }

    async function rtdbGet(path) {
        try {
            const r = await fetch(`${RTDB_BASE}/${path}.json`);
            return await r.json();
        } catch (_) { return null; }
    }

    /* ── Build payload ──────────────────────────────────────── */
    function buildPayload(uuid) {
        const auth = window._delivoAuthUser || null;
        return {
            uuid,
            uid:         auth?.uid      || null,
            username:    auth?.username || null,
            device:      /Mobi/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
            connectedAt: Date.now(),
            lastSeen:    Date.now(),
        };
    }

    /* ── Stale sweep ────────────────────────────────────────── */
    async function sweepStale(db) {
        try {
            const snap     = db ? await db.ref('presence').once('value') : null;
            const sessions = db ? (snap.val() || {}) : (await rtdbGet('presence') || {});
            const cutoff   = Date.now() - STALE_MS;
            const stale    = Object.keys(sessions).filter(k => (sessions[k].lastSeen || 0) < cutoff);
            await Promise.all(stale.map(k =>
                db ? db.ref(`presence/${k}`).remove() : rtdbDelete(`presence/${k}`)
            ));
        } catch (_) {}
    }

    /* ── SDK path ───────────────────────────────────────────── */
    function initWithSDK(uuid, db) {
        const ref          = db.ref(`presence/${uuid}`);
        const connectedRef = db.ref('.info/connected');

        connectedRef.on('value', async snap => {
            if (!snap.val()) return;
            await sweepStale(db);
            await ref.onDisconnect().remove();
            await ref.set(buildPayload(uuid));
        });

        /* Heartbeat — keeps lastSeen fresh, re-registers if swept */
        setInterval(() => {
            if (document.visibilityState === 'hidden') return;
            ref.once('value').then(snap => {
                if (!snap.exists()) {
                    ref.onDisconnect().remove();
                    ref.set(buildPayload(uuid));
                } else {
                    ref.update({ lastSeen: Date.now(), uuid,
                        uid:      window._delivoAuthUser?.uid      || null,
                        username: window._delivoAuthUser?.username || null,
                    }).catch(() => {});
                }
            }).catch(() => {});
        }, HEARTBEAT);

        /* Re-register on foreground return */
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState !== 'visible') return;
            ref.onDisconnect().remove().then(() => ref.set(buildPayload(uuid))).catch(() => {});
        });

        /* Live count */
        db.ref('presence').on('value', snap => updateWidget(snap.numChildren()));

        /* Expose API */
        window._delivoPresence = {
            linkUser(uid, username) {
                window._delivoAuthUser = { uid, username };
                ref.update({ uid, username: username || null, lastSeen: Date.now() }).catch(() => {});
            }
        };
    }

    /* ── REST fallback ──────────────────────────────────────── */
    async function initWithREST(uuid) {
        const path = `presence/${uuid}`;
        await sweepStale(null);
        await rtdbPut(path, buildPayload(uuid));

        const hb = setInterval(() => {
            rtdbPut(path, { ...buildPayload(uuid), lastSeen: Date.now() });
        }, HEARTBEAT);

        let cleaned = false;
        function cleanup() {
            if (cleaned) return;
            cleaned = true;
            clearInterval(hb);
            rtdbDelete(path, true);
        }
        window.addEventListener('pagehide',     cleanup);
        window.addEventListener('beforeunload', cleanup);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                cleaned = false;
                rtdbPut(path, buildPayload(uuid));
            }
        });

        async function pollCount() {
            const d = await rtdbGet('presence');
            updateWidget(d ? Object.keys(d).length : 1);
        }
        pollCount();
        setInterval(pollCount, 5_000);

        window._delivoPresence = {
            linkUser(uid, username) {
                window._delivoAuthUser = { uid, username };
                rtdbPut(path, buildPayload(uuid));
            }
        };
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

    /* ── Init — wait for firebase-init to write the UUID ────── */
    function init() {
        /* Give firebase-init.js up to 2s to set delivo_device_uuid */
        setTimeout(() => {
            const uuid = getDeviceUUID();

            function trySDK() {
                if (window.firebase?.database) {
                    initWithSDK(uuid, window.firebase.database());
                    return true;
                }
                return false;
            }
            if (!trySDK()) {
                setTimeout(() => { if (!trySDK()) initWithREST(uuid); }, 1500);
            }
        }, 800);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();