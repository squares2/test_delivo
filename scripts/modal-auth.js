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

    // ── Location: GPS button ────────────────────────────────
    const gpsBtn = document.getElementById('reg-location-gps');
    if (gpsBtn) {
        gpsBtn.addEventListener('click', () => {
            if (!navigator.geolocation) {
                setLocationStatus('error', 'جهازك لا يدعم تحديد الموقع.');
                return;
            }
            setLocationStatus('loading', 'جاري تحديد موقعك...');
            gpsBtn.disabled = true;

            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const lat = pos.coords.latitude;
                    const lng = pos.coords.longitude;
                    document.getElementById('reg-lat').value = lat;
                    document.getElementById('reg-lng').value = lng;
                    setLocationStatus('success', '✓ تم تحديد موقعك بنجاح');
                    gpsBtn.disabled = false;
                    gpsBtn.classList.add('location-opt-btn--active');
                    // Hide map if open
                    document.getElementById('reg-map-wrap').style.display = 'none';
                    // If map already initialized, update its marker too
                    if (window._regMap) {
                        window._regMap.setView([lat, lng], 16);
                        window._regMarker.setLatLng([lat, lng]);
                    }
                },
                (err) => {
                    gpsBtn.disabled = false;
                    const msgs = {
                        1: 'رفضت الإذن. يرجى السماح بالوصول للموقع.',
                        2: 'تعذّر تحديد الموقع. حاول مرة أخرى.',
                        3: 'انتهت المهلة. حاول مرة أخرى.',
                    };
                    setLocationStatus('error', msgs[err.code] || 'تعذّر تحديد الموقع.');
                },
                { timeout: 10000, maximumAge: 60000, enableHighAccuracy: true }
            );
        });
    }

    // ── Location: Map picker button ──────────────────────────
    const mapBtn = document.getElementById('reg-location-map');
    if (mapBtn) {
        mapBtn.addEventListener('click', () => {
            const mapWrap = document.getElementById('reg-map-wrap');
            mapWrap.style.display = 'block';
            mapBtn.classList.add('location-opt-btn--active');

            // Initialize Leaflet map once
            if (!window._regMap) {
                const defaultLat = 34.0040;
                const defaultLng = 36.2100;
                const savedLat   = parseFloat(document.getElementById('reg-lat').value) || defaultLat;
                const savedLng   = parseFloat(document.getElementById('reg-lng').value) || defaultLng;

                // ── Google Maps API key ───────────────────────────
                const GOOGLE_KEY = 'AIzaSyCSTThgge2nSFlEQXjS1ta2tZXvVgNAnZ0';

                // ── Tile layers ───────────────────────────────────
                window._tileLayers = {
                    satellite: L.tileLayer(
                        `https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&key=${GOOGLE_KEY}`,
                        { attribution: '© Google Maps', maxZoom: 20, subdomains: '0123' }
                    ),
                    standard: L.tileLayer(
                        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                        { attribution: '© OpenStreetMap', maxZoom: 19 }
                    ),
                };

                // Default = satellite
                window._currentLayer = 'satellite';

                window._regMap = L.map('reg-map', {
                    zoomControl: true,
                    attributionControl: true,
                }).setView([savedLat, savedLng], 17);

                window._tileLayers.satellite.addTo(window._regMap);

                // ── Toggle control (satellite ↔ standard) ─────────
                const toggleCtrl = L.control({ position: 'topright' });
                toggleCtrl.onAdd = function() {
                    const btn = L.DomUtil.create('button', 'map-toggle-btn');
                    btn.innerHTML = '🗺 خريطة';
                    btn.title     = 'تبديل نوع الخريطة';
                    btn.style.cssText = `
                        background:#fff; border:2px solid #FF5C00;
                        border-radius:6px; padding:5px 9px;
                        font-size:12px; font-weight:700;
                        cursor:pointer; color:#FF5C00;
                        box-shadow:0 1px 5px rgba(0,0,0,0.3);
                        white-space:nowrap;
                    `;
                    L.DomEvent.on(btn, 'click', function(e) {
                        L.DomEvent.stopPropagation(e);
                        if (window._currentLayer === 'satellite') {
                            window._regMap.removeLayer(window._tileLayers.satellite);
                            window._tileLayers.standard.addTo(window._regMap);
                            window._currentLayer = 'standard';
                            btn.innerHTML = '🛰 صورة جوية';
                        } else {
                            window._regMap.removeLayer(window._tileLayers.standard);
                            window._tileLayers.satellite.addTo(window._regMap);
                            window._currentLayer = 'satellite';
                            btn.innerHTML = '🗺 خريطة';
                        }
                    });
                    return btn;
                };
                toggleCtrl.addTo(window._regMap);

                // ── Orange draggable marker ───────────────────────
                const orangeIcon = L.divIcon({
                    className: '',
                    html: `<div style="
                        width:30px;height:30px;
                        background:#FF5C00;
                        border:3px solid #fff;
                        border-radius:50% 50% 50% 0;
                        transform:rotate(-45deg);
                        box-shadow:0 2px 8px rgba(0,0,0,0.4);
                    "></div>`,
                    iconSize: [30, 30],
                    iconAnchor: [15, 30],
                });

                window._regMarker = L.marker([savedLat, savedLng], {
                    icon: orangeIcon,
                    draggable: true,
                }).addTo(window._regMap);

                // Drag marker
                window._regMarker.on('dragend', (e) => {
                    const pos = e.target.getLatLng();
                    document.getElementById('reg-lat').value = pos.lat.toFixed(6);
                    document.getElementById('reg-lng').value = pos.lng.toFixed(6);
                    setLocationStatus('success', '✓ تم تحديد الموقع على الخريطة');
                });

                // Click anywhere on map
                window._regMap.on('click', (e) => {
                    window._regMarker.setLatLng(e.latlng);
                    document.getElementById('reg-lat').value = e.latlng.lat.toFixed(6);
                    document.getElementById('reg-lng').value = e.latlng.lng.toFixed(6);
                    setLocationStatus('success', '✓ تم تحديد الموقع على الخريطة');
                });

                document.getElementById('reg-lat').value = savedLat.toFixed(6);
                document.getElementById('reg-lng').value = savedLng.toFixed(6);

            } else {
                setTimeout(() => window._regMap.invalidateSize(), 100);
            }

            setLocationStatus('info', 'اسحب الدبوس أو انقر على الخريطة لتحديد موقعك');
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

    // ── Edit profile modal — open ───────────────────────────
    document.addEventListener('click', (e) => {
        // Both the edit chip and Personal Information row open it
        if (e.target.closest('#acct-edit-btn') || e.target.closest('#acct-profile-btn')) {
            closeModal('modal-account');
            populateEditForm();
            setTimeout(() => openModal('modal-edit-profile'), 180);
        }
        // Change Password row also opens edit modal (scrolled to password section)
        if (e.target.closest('#acct-password-btn')) {
            closeModal('modal-account');
            populateEditForm();
            setTimeout(() => {
                openModal('modal-edit-profile');
                // Scroll to password section
                setTimeout(() => {
                    const pwdField = document.getElementById('edit-current-password');
                    if (pwdField) pwdField.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 300);
            }, 180);
        }
    });

    // ── Edit profile — GPS button ────────────────────────────
    const editGpsBtn = document.getElementById('edit-location-gps');
    if (editGpsBtn) {
        editGpsBtn.addEventListener('click', () => {
            if (!navigator.geolocation) {
                setEditLocationStatus('error', 'جهازك لا يدعم تحديد الموقع.');
                return;
            }
            setEditLocationStatus('loading', 'جاري تحديد موقعك...');
            editGpsBtn.disabled = true;
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const lat = pos.coords.latitude;
                    const lng = pos.coords.longitude;
                    document.getElementById('edit-lat').value = lat;
                    document.getElementById('edit-lng').value = lng;
                    setEditLocationStatus('success', '✓ تم تحديد موقعك بنجاح');
                    editGpsBtn.disabled = false;
                    editGpsBtn.classList.add('location-opt-btn--active');
                    document.getElementById('edit-map-wrap').style.display = 'none';
                    if (window._editMap) {
                        window._editMap.setView([lat, lng], 16);
                        window._editMarker.setLatLng([lat, lng]);
                    }
                },
                (err) => {
                    editGpsBtn.disabled = false;
                    const msgs = { 1: 'رفضت الإذن.', 2: 'تعذّر تحديد الموقع.', 3: 'انتهت المهلة.' };
                    setEditLocationStatus('error', msgs[err.code] || 'تعذّر تحديد الموقع.');
                },
                { timeout: 10000, maximumAge: 60000, enableHighAccuracy: true }
            );
        });
    }

    // ── Edit profile — Map button ─────────────────────────────
    const editMapBtn = document.getElementById('edit-location-map');
    if (editMapBtn) {
        editMapBtn.addEventListener('click', () => {
            const mapWrap = document.getElementById('edit-map-wrap');
            mapWrap.style.display = 'block';
            editMapBtn.classList.add('location-opt-btn--active');

            if (!window._editMap) {
                const GOOGLE_KEY = 'AIzaSyCSTThgge2nSFlEQXjS1ta2tZXvVgNAnZ0';

                // Use saved location if exists, else Baalbek default
                const savedLat = parseFloat(document.getElementById('edit-lat').value) || 34.0040;
                const savedLng = parseFloat(document.getElementById('edit-lng').value) || 36.2100;

                window._editTileLayers = {
                    satellite: L.tileLayer(
                        `https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&key=${GOOGLE_KEY}`,
                        { attribution: '© Google Maps', maxZoom: 20, subdomains: '0123' }
                    ),
                    standard: L.tileLayer(
                        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                        { attribution: '© OpenStreetMap', maxZoom: 19 }
                    ),
                };
                window._editCurrentLayer = 'satellite';

                window._editMap = L.map('edit-map', { zoomControl: true })
                    .setView([savedLat, savedLng], 17);
                window._editTileLayers.satellite.addTo(window._editMap);

                // Toggle control
                const toggleCtrl = L.control({ position: 'topright' });
                toggleCtrl.onAdd = function() {
                    const btn = L.DomUtil.create('button', '');
                    btn.innerHTML = '🗺 خريطة';
                    btn.style.cssText = `
                        background:#fff; border:2px solid #FF5C00;
                        border-radius:6px; padding:5px 9px;
                        font-size:12px; font-weight:700;
                        cursor:pointer; color:#FF5C00;
                        box-shadow:0 1px 5px rgba(0,0,0,0.3);
                        white-space:nowrap;
                    `;
                    L.DomEvent.on(btn, 'click', function(e) {
                        L.DomEvent.stopPropagation(e);
                        if (window._editCurrentLayer === 'satellite') {
                            window._editMap.removeLayer(window._editTileLayers.satellite);
                            window._editTileLayers.standard.addTo(window._editMap);
                            window._editCurrentLayer = 'standard';
                            btn.innerHTML = '🛰 صورة جوية';
                        } else {
                            window._editMap.removeLayer(window._editTileLayers.standard);
                            window._editTileLayers.satellite.addTo(window._editMap);
                            window._editCurrentLayer = 'satellite';
                            btn.innerHTML = '🗺 خريطة';
                        }
                    });
                    return btn;
                };
                toggleCtrl.addTo(window._editMap);

                // Orange marker
                const orangeIcon = L.divIcon({
                    className: '',
                    html: `<div style="width:30px;height:30px;background:#FF5C00;border:3px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 8px rgba(0,0,0,0.4);"></div>`,
                    iconSize: [30, 30],
                    iconAnchor: [15, 30],
                });
                window._editMarker = L.marker([savedLat, savedLng], {
                    icon: orangeIcon, draggable: true,
                }).addTo(window._editMap);

                window._editMarker.on('dragend', (e) => {
                    const pos = e.target.getLatLng();
                    document.getElementById('edit-lat').value = pos.lat.toFixed(6);
                    document.getElementById('edit-lng').value = pos.lng.toFixed(6);
                    setEditLocationStatus('success', '✓ تم تحديد الموقع على الخريطة');
                });
                window._editMap.on('click', (e) => {
                    window._editMarker.setLatLng(e.latlng);
                    document.getElementById('edit-lat').value = e.latlng.lat.toFixed(6);
                    document.getElementById('edit-lng').value = e.latlng.lng.toFixed(6);
                    setEditLocationStatus('success', '✓ تم تحديد الموقع على الخريطة');
                });

                document.getElementById('edit-lat').value = savedLat.toFixed(6);
                document.getElementById('edit-lng').value = savedLng.toFixed(6);

            } else {
                setTimeout(() => window._editMap.invalidateSize(), 100);
            }
            setEditLocationStatus('info', 'اسحب الدبوس أو انقر على الخريطة لتحديد موقعك');
        });
    }

    // ── Edit profile — save display name + phone ─────────────
    const editSubmit = document.getElementById('edit-submit');
    if (editSubmit) {
        editSubmit.addEventListener('click', async () => {
            const displayName = document.getElementById('edit-displayname')?.value || '';
            const phone       = document.getElementById('edit-phone')?.value        || '';
            const lat         = document.getElementById('edit-lat')?.value          || null;
            const lng         = document.getElementById('edit-lng')?.value          || null;
            const errorEl     = document.getElementById('edit-error');
            const successEl   = document.getElementById('edit-success');

            setLoading(editSubmit, true, 'جاري الحفظ...');
            hideError(errorEl);
            hideSuccess(successEl);

            const result = await window.DelivoAuth.updateProfile({ displayName, phone, lat, lng });

            setLoading(editSubmit, false, 'حفظ التغييرات');

            if (result.error) {
                showError(errorEl, result.message);
            } else {
                showSuccess(successEl, '✓ تم حفظ التغييرات بنجاح');
                // Update account modal with new name
                renderAccountModal();
            }
        });
    }

    // ── Edit profile — change password ───────────────────────
    const editPasswordSubmit = document.getElementById('edit-password-submit');
    if (editPasswordSubmit) {
        editPasswordSubmit.addEventListener('click', async () => {
            const currentPwd = document.getElementById('edit-current-password')?.value || '';
            const newPwd     = document.getElementById('edit-new-password')?.value     || '';
            const errorEl    = document.getElementById('edit-error');
            const successEl  = document.getElementById('edit-success');

            setLoading(editPasswordSubmit, true, 'جاري التغيير...');
            hideError(errorEl);
            hideSuccess(successEl);

            const result = await window.DelivoAuth.changePassword({
                currentPassword: currentPwd,
                newPassword:     newPwd,
            });

            setLoading(editPasswordSubmit, false, 'تغيير كلمة المرور');

            if (result.error) {
                showError(errorEl, result.message);
            } else {
                showSuccess(successEl, '✓ تم تغيير كلمة المرور بنجاح');
                clearFields(['edit-current-password', 'edit-new-password']);
            }
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
            // Close modal immediately, then sign out
            // onAuthStateChanged will re-render everything cleanly
            closeModal('modal-account');
            try { await window.DelivoAuth.logout(); } catch(_) {}
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
        // sync bottom bar
        const bbBtn = document.getElementById('bb-account-btn');
        if (bbBtn) bbBtn.classList.add('logged-in');
    } else {
        guestEl.style.display = '';
        userEl.style.display  = 'none';
        if (acctBtn) acctBtn.classList.remove('logged-in');
        // sync bottom bar
        const bbBtn = document.getElementById('bb-account-btn');
        if (bbBtn) bbBtn.classList.remove('logged-in');
    }
}

// ── Location status display ──────────────────────────────────
function setLocationStatus(type, message) {
    const el = document.getElementById('reg-location-status');
    if (!el) return;
    el.style.display = 'block';
    el.textContent   = message;
    el.className     = 'location-status location-status--' + type;
}

// ── Location reset ────────────────────────────────────────────
function resetLocationBtn() {
    const statusEl = document.getElementById('reg-location-status');
    if (statusEl) { statusEl.style.display = 'none'; statusEl.textContent = ''; }

    const mapWrap = document.getElementById('reg-map-wrap');
    if (mapWrap) mapWrap.style.display = 'none';

    // Reset map instance so it re-initializes fresh next time
    if (window._regMap) {
        window._regMap.remove();
        window._regMap      = null;
        window._regMarker   = null;
        window._tileLayers  = null;
        window._currentLayer = null;
    }

    // Reset option buttons
    document.querySelectorAll('.location-opt-btn').forEach(b => {
        b.classList.remove('location-opt-btn--active');
        b.disabled = false;
    });

    const lat = document.getElementById('reg-lat');
    const lng = document.getElementById('reg-lng');
    if (lat) lat.value = '';
    if (lng) lng.value = '';
}

// ── Helpers ───────────────────────────────────────────────────
// ── Populate edit form with current user data ────────────────
function populateEditForm() {
    const user = window.DelivoUser;
    if (!user) return;
    const nameEl  = document.getElementById('edit-displayname');
    const phoneEl = document.getElementById('edit-phone');
    const latEl   = document.getElementById('edit-lat');
    const lngEl   = document.getElementById('edit-lng');
    if (nameEl)  nameEl.value  = user.displayName || '';
    if (phoneEl) phoneEl.value = (user.phone || '').replace('+961', '').replace(/\s/g, '');

    // Pre-fill existing location coords
    if (latEl && user.location?.lat) latEl.value = user.location.lat;
    if (lngEl && user.location?.lng) lngEl.value = user.location.lng;

    // Reset map instance so it recenters on existing location next open
    if (window._editMap) {
        window._editMap.remove();
        window._editMap         = null;
        window._editMarker      = null;
        window._editTileLayers  = null;
        window._editCurrentLayer = null;
    }
    document.getElementById('edit-map-wrap').style.display = 'none';

    // Show existing location status if saved
    const statusEl = document.getElementById('edit-location-status');
    if (statusEl) {
        if (user.location?.lat) {
            statusEl.style.display = 'block';
            statusEl.textContent   = '✓ يوجد موقع محفوظ — يمكنك تحديثه';
            statusEl.className     = 'location-status location-status--success';
        } else {
            statusEl.style.display = 'none';
        }
    }

    // Reset opt buttons
    document.querySelectorAll('#modal-edit-profile .location-opt-btn').forEach(b => {
        b.classList.remove('location-opt-btn--active');
        b.disabled = false;
    });

    // Clear messages
    const errEl = document.getElementById('edit-error');
    const sucEl = document.getElementById('edit-success');
    if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
    if (sucEl) { sucEl.style.display = 'none'; sucEl.textContent = ''; }
    clearFields(['edit-current-password', 'edit-new-password']);
}

function setEditLocationStatus(type, message) {
    const el = document.getElementById('edit-location-status');
    if (!el) return;
    el.style.display = 'block';
    el.textContent   = message;
    el.className     = 'location-status location-status--' + type;
}

function showSuccess(el, message) {
    if (!el) return;
    el.textContent       = message;
    el.style.display     = 'block';
    el.style.background  = '#edfaf3';
    el.style.borderColor = '#86efac';
    el.style.color       = '#15803d';
}
function hideSuccess(el) {
    if (!el) return;
    el.textContent   = '';
    el.style.display = 'none';
}

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