/* ============================================================
   scripts/cart.js
   Multi-store cart — items grouped by store in sidebar.
   Each item carries { id, name, price, storeName, storeType }.
   Checkout writes one request per store to Firebase.
   ============================================================ */

const RTDB_CART_URL = 'https://deliveryonline-300f7-default-rtdb.firebaseio.com';
const DELIVERY_FEE_PER_STORE = 2; // $2 per store

function initCart() {

    /* ── State ──────────────────────────────────────────────── */
    window.DelivoCart = {
        items: JSON.parse(localStorage.getItem('delivo_cart_v2') || '[]'),

        /* All unique store names in cart */
        getStores() {
            return [...new Set(this.items.map(i => i.storeName))];
        },

        /* Items for one specific store */
        getStoreItems(storeName) {
            return this.items.filter(i => i.storeName === storeName);
        },

        getCount() {
            return this.items.reduce((s, i) => s + i.qty, 0);
        },

        /* Raw sum (mixed currencies — use _cartTotalUSD for display) */
        getTotal() {
            return this.items.reduce((s, i) => s + i.price * i.qty, 0);
        },

        addItem(id, name, price, storeName, storeType) {
            const existing = this.items.find(i => i.id === id && i.storeName === storeName);
            if (existing) {
                existing.qty++;
            } else {
                this.items.push({
                    id,
                    name,
                    price : parseFloat(price),
                    qty   : 1,
                    storeName : storeName || '',
                    storeType : storeType || '',
                });
            }
            this.save();
            this.updateBadge();
        },

        decrementItem(id, storeName) {
            const existing = this.items.find(i => i.id === id && i.storeName === storeName);
            if (!existing) return;
            existing.qty--;
            if (existing.qty <= 0) {
                this.items = this.items.filter(i => !(i.id === id && i.storeName === storeName));
            }
            this.save();
            this.updateBadge();
        },

        removeItem(id, storeName) {
            this.items = this.items.filter(i => !(i.id === id && i.storeName === storeName));
            this.save();
            this.updateBadge();
        },

        clearStore(storeName) {
            this.items = this.items.filter(i => i.storeName !== storeName);
            this.save();
            this.updateBadge();
        },

        clear() {
            this.items = [];
            this.save();
            this.updateBadge();
        },

        save() {
            localStorage.setItem('delivo_cart_v2', JSON.stringify(this.items));
        },

        updateBadge() {
            const count = this.getCount();
            // old top navbar badge (hidden — bottom bar used instead)
            const badge = document.getElementById('cart-badge');
            if (badge) badge.style.display = 'none';
            // bottom bar badge
            const bbBadge = document.getElementById('bb-cart-badge');
            if (bbBadge) {
                bbBadge.textContent = count;
                bbBadge.style.display = count > 0 ? 'flex' : 'none';
            }
        }
    };

    window.DelivoCart.updateBadge();

    /* ── Open / Close ───────────────────────────────────────── */
    window.openCartSidebar = function() {
        const overlay = document.getElementById('cart-overlay');
        const sidebar = document.getElementById('cart-sidebar');
        if (!overlay || !sidebar) return;
        renderCartSidebar();
        overlay.classList.add('active');
        sidebar.classList.add('active');
        document.body.classList.add('modal-open');
        if (typeof window._cartLocationRefresh === 'function') window._cartLocationRefresh();
    };

    window.closeCartSidebar = function() {
        const overlay = document.getElementById('cart-overlay');
        const sidebar = document.getElementById('cart-sidebar');
        if (overlay) overlay.classList.remove('active');
        if (sidebar) sidebar.classList.remove('active');
        document.body.classList.remove('modal-open');
    };

    /* ── Render sidebar ─────────────────────────────────────── */
    window.renderCartSidebar = function() {
        const cart     = window.DelivoCart;
        const countEl  = document.getElementById('cart-header-count');
        const bodyEl   = document.getElementById('cart-body');
        const footerEl = document.getElementById('cart-footer');
        const storeLabel = document.getElementById('cart-store-label');

        if (!bodyEl) return;

        const count  = cart.getCount();
        const stores = cart.getStores();

        if (countEl) {
            countEl.textContent   = count;
            countEl.style.display = count > 0 ? 'inline' : 'none';
        }

        if (storeLabel) storeLabel.style.display = 'none';

        if (count === 0) {
            bodyEl.innerHTML = `
                <div class="cart-empty">
                    <div class="cart-empty__icon">🛒</div>
                    <div class="cart-empty__title">السلة فارغة</div>
                    <div class="cart-empty__sub">أضف منتجات من أي متجر لتبدأ طلبك</div>
                </div>`;
            if (footerEl) footerEl.style.display = 'none';
            return;
        }

        /* Group items by store — one section per store */
        bodyEl.innerHTML = `<div class="cart-items" id="cart-items-list">
            ${stores.map(storeName => _renderStoreGroup(storeName, cart.getStoreItems(storeName))).join('')}
        </div>`;

        /* Footer */
        if (footerEl) {
            footerEl.style.display = 'flex';
            const subtotalUSD  = _cartTotalUSD();
            const deliveryFee  = stores.length * DELIVERY_FEE_PER_STORE;
            const grandTotal   = subtotalUSD + deliveryFee;
            document.getElementById('cart-subtotal').textContent   = '$' + subtotalUSD.toFixed(2);
            document.getElementById('cart-delivery').textContent   = deliveryFee > 0 ? '$' + deliveryFee.toFixed(2) : 'مجاناً';
            document.getElementById('cart-grandtotal').textContent = '$' + grandTotal.toFixed(2);
        }
    
        // re-init mouse drag each render (body is rebuilt)
        setTimeout(_initMouseDragScroll, 0);
    };

    /* ── Store group section HTML ───────────────────────────── */
    function _renderStoreGroup(storeName, items) {
        return `
        <div class="cart-store-group" id="csg-${_cslug(storeName)}">
            <div class="cart-store-group__header">
                <span class="cart-store-group__name">🏪 ${storeName}</span>
                <button class="cart-store-group__clear"
                        onclick="cartClearStore('${storeName}')"
                        title="مسح متجر">✕</button>
            </div>
            ${items.map(item => _renderCartItem(item)).join('')}
            <div class="cart-store-group__subtotal">
                المجموع: <strong>${'$' + _storeUSD(items).toFixed(2)}</strong>
            </div>
            <div class="cart-store-group__delivery-hint">
                🛵 رسوم توصيل هذا المتجر: <strong>$${DELIVERY_FEE_PER_STORE.toFixed(2)}</strong>
            </div>
        </div>`;
    }

    /* ── Single cart item row HTML ──────────────────────────── */
    function _renderCartItem(item) {
        const itemIdParts = item.id.split('__');
        const rawId       = itemIdParts[itemIdParts.length - 1];
        const imgUrl      = `./items/${rawId.toLowerCase()}.png`;
        const uniqueKey   = `${item.storeName}__${item.id}`;
        return `
        <div class="cart-item" id="ci-${_cslug(uniqueKey)}">
            <img class="cart-item__img" src="${imgUrl}" alt="${item.name}"
                 onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
            <div class="cart-item__img-fallback" style="display:none">🛍️</div>
            <div class="cart-item__info">
                <div class="cart-item__name">${item.name}</div>
                <div class="cart-item__unit-price">${_fmt(item.price)} / قطعة</div>
                <div class="cart-item__subtotal">${_fmt(item.price * item.qty)}</div>
            </div>
            <div class="cart-item__controls">
                <button class="cart-item__btn cart-item__btn--remove"
                        onclick="cartRemoveItem('${item.id}','${item.storeName}')" title="حذف">🗑</button>
                <button class="cart-item__btn"
                        onclick="cartDecrement('${item.id}','${item.storeName}')">−</button>
                <span class="cart-item__qty" id="cqty-${_cslug(uniqueKey)}">${item.qty}</span>
                <button class="cart-item__btn"
                        onclick="cartIncrement('${item.id}','${item.name}',${item.price},'${item.storeName}','${item.storeType}')">+</button>
            </div>
        </div>`;
    }

    /* ── Mutations ──────────────────────────────────────────── */
    window.cartIncrement = function(id, name, price, storeName, storeType) {
        window.DelivoCart.addItem(id, name, price, storeName, storeType);
        _refreshCartItem(id, storeName);
        if (window.updateSpCartBar) window.updateSpCartBar();
    };

    window.cartDecrement = function(id, storeName) {
        window.DelivoCart.decrementItem(id, storeName);
        const qty = _getQty(id, storeName);
        if (qty <= 0) {
            const row = document.getElementById(`ci-${_cslug(storeName + '__' + id)}`);
            if (row) row.remove();
            _checkEmptyStore(storeName);
        } else {
            _refreshCartItem(id, storeName);
        }
        _checkEmptyCart();
        if (window.updateSpCartBar) window.updateSpCartBar();
        _syncStorePanelQty(id, qty);
    };

    window.cartRemoveItem = function(id, storeName) {
        window.DelivoCart.removeItem(id, storeName);
        const row = document.getElementById(`ci-${_cslug(storeName + '__' + id)}`);
        if (row) row.remove();
        _checkEmptyStore(storeName);
        _checkEmptyCart();
        if (window.updateSpCartBar) window.updateSpCartBar();
        _syncStorePanelQty(id, 0);
    };

    window.cartClearStore = function(storeName) {
        window.DelivoCart.clearStore(storeName);
        const group = document.getElementById(`csg-${_cslug(storeName)}`);
        if (group) group.remove();
        _checkEmptyCart();
        if (window.updateSpCartBar) window.updateSpCartBar();
    };

    function _checkEmptyStore(storeName) {
        const remaining = window.DelivoCart.getStoreItems(storeName);
        if (remaining.length === 0) {
            const group = document.getElementById(`csg-${_cslug(storeName)}`);
            if (group) group.remove();
        } else {
            // Refresh subtotal for this store
            const group = document.getElementById(`csg-${_cslug(storeName)}`);
            if (group) {
                const subEl = group.querySelector('.cart-store-group__subtotal strong');
                if (subEl) subEl.textContent = '$' + _storeUSD(remaining).toFixed(2);
            }
        }
    }

    function _refreshCartItem(id, storeName) {
        const item = window.DelivoCart.items.find(i => i.id === id && i.storeName === storeName);
        if (!item) return;
        const uniqueKey = `${storeName}__${id}`;
        const qtyEl = document.getElementById(`cqty-${_cslug(uniqueKey)}`);
        if (qtyEl) qtyEl.textContent = item.qty;
        const row = document.getElementById(`ci-${_cslug(uniqueKey)}`);
        if (row) {
            const sub = row.querySelector('.cart-item__subtotal');
            if (sub) sub.textContent = _fmt(item.price * item.qty);
        }
        _refreshTotals();
        window.DelivoCart.updateBadge();
    }

    function _refreshTotals() {
        const cart         = window.DelivoCart;
        const subtotalEl   = document.getElementById('cart-subtotal');
        const deliveryEl   = document.getElementById('cart-delivery');
        const grandtotalEl = document.getElementById('cart-grandtotal');
        const subtotalUSD  = _cartTotalUSD();
        const storeCount   = cart.getStores().length;
        const deliveryFee  = storeCount * DELIVERY_FEE_PER_STORE;
        const grandTotal   = subtotalUSD + deliveryFee;
        if (subtotalEl)   subtotalEl.textContent   = '$' + subtotalUSD.toFixed(2);
        if (deliveryEl)   deliveryEl.textContent   = deliveryFee > 0 ? '$' + deliveryFee.toFixed(2) : 'مجاناً';
        if (grandtotalEl) grandtotalEl.textContent = '$' + grandTotal.toFixed(2);
    }

    function _syncStorePanelQty(id, qty) {
        const slug  = id.replace(/[^a-zA-Z0-9]/g, '_');
        const qtyEl = document.getElementById(`sp-qty-${slug}`);
        if (qtyEl) qtyEl.textContent = qty;
    }

    function _checkEmptyCart() {
        window.DelivoCart.updateBadge();
        if (window.DelivoCart.getCount() === 0) renderCartSidebar();
        else _refreshTotals();
    }

    /* ── Checkout — one request per store ───────────────────── */
    window.cartCheckout = async function() {
        const cart   = window.DelivoCart;
        const stores = cart.getStores();
        if (stores.length === 0) return;

        const user = window.DelivoUser;
        if (!user) {
            closeCartSidebar();
            setTimeout(() => { if (typeof openModal === 'function') openModal('modal-login'); }, 200);
            return;
        }

        // Block checkout if no phone number on file
        const userPhone = (window.DelivoUser && window.DelivoUser.phone) || '';
        if (!userPhone) {
            closeCartSidebar();
            setTimeout(() => {
                _showToast('⚠️ يجب إضافة رقم هاتفك أولاً لإتمام الطلب', 'error');
                if (typeof openModal === 'function') openModal('modal-account');
            }, 200);
            return;
        }

        const btn = document.getElementById('cart-checkout-btn');
        if (btn) { btn.disabled = true; btn.innerHTML = '<span>جاري الإرسال…</span>'; }

        try {
            // Get current counter
            const counterResp = await fetch(`${RTDB_CART_URL}/globalCounter.json`);
            const counterData = await counterResp.json();
            let nextId = 200;
            if (counterData && counterData.requestId) nextId = parseInt(counterData.requestId) + 1;
            else if (typeof counterData === 'number')  nextId = counterData + 1;

            const note        = (document.getElementById('cart-note')?.value || '').trim();
            const userProfile = window.DelivoUser || {};
            const now         = new Date();
            const dateStr     = `${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()} ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;

            // Normalize phone — always store as +961XXXXXXXX
            const phone = userPhone.startsWith('+961') ? userPhone : '+961' + userPhone;

            // Delivery location — cart picker overrides profile location
            const cartLat = document.getElementById('cart-loc-lat')?.value || '';
            const cartLng = document.getElementById('cart-loc-lng')?.value || '';
            const orderLat = cartLat || String(userProfile.location?.lat || userProfile.lat || '');
            const orderLng = cartLng || String(userProfile.location?.lng || userProfile.lng || '');

            // Write one request per store
            for (const storeName of stores) {
                const storeItems = cart.getStoreItems(storeName);
                const cartStr    = storeItems.map(i => `${i.qty}:${i.name}:${i.price}:${storeName}`).join(',');
                const storeTotal = (parseFloat(_storeUSD(storeItems)) + DELIVERY_FEE_PER_STORE).toFixed(2);
                const requestKey = `id_${nextId}`;

                const requestObj = {
                    cart         : cartStr,
                    city         : 'Baalbeck',
                    date         : dateStr,
                    delivryplusid: user.uid || '',
                    driver       : '0',
                    fullname     : userProfile.displayName || user.displayName || user.email || '',
                    lat          : String(orderLat),
                    lng          : String(orderLng),
                    phone        : phone,
                    read         : '0',
                    state        : '0',
                    street       : userProfile.street || '',
                    total        : storeTotal,
                    trackorder   : '0',
                    username     : userProfile.username || user.email || '',
                    vault        : '0',
                    xnote        : note,
                };

                await fetch(`${RTDB_CART_URL}/requests/${requestKey}.json`, {
                    method  : 'PUT',
                    headers : { 'Content-Type': 'application/json' },
                    body    : JSON.stringify(requestObj),
                });

                nextId++;
            }

            // Update counter to last used ID
            await fetch(`${RTDB_CART_URL}/globalCounter/requestId.json`, {
                method  : 'PUT',
                headers : { 'Content-Type': 'application/json' },
                body    : JSON.stringify(nextId - 1),
            });

            cart.clear();
            closeCartSidebar();
            _showToast(`✅ تم إرسال ${stores.length > 1 ? stores.length + ' طلبات' : 'طلبك'} بنجاح!`, 'success');

        } catch (err) {
            console.error('[Cart] Checkout error:', err);
            _showToast('❌ حدث خطأ، حاول مجدداً', 'error');
        } finally {
            if (btn) {
                btn.disabled  = false;
                btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg> إتمام الطلب`;
            }
        }
    };

    /* ── Toast ──────────────────────────────────────────────── */
    function _showToast(msg, type = 'success') {
        let toast = document.getElementById('cart-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'cart-toast';
            toast.className = 'cart-toast';
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.className   = `cart-toast cart-toast--${type}`;
        requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('visible')));
        setTimeout(() => toast.classList.remove('visible'), 3200);
    }

    /* ── Wire events ────────────────────────────────────────── */
    const cartIcon = document.getElementById('cart-icon');
    if (cartIcon) cartIcon.addEventListener('click', openCartSidebar);

    const overlay  = document.getElementById('cart-overlay');
    if (overlay)   overlay.addEventListener('click', closeCartSidebar);

    const closeBtn = document.getElementById('cart-close-btn');
    if (closeBtn)  closeBtn.addEventListener('click', closeCartSidebar);

    const clearBtn = document.getElementById('cart-clear-btn');
    if (clearBtn)  clearBtn.addEventListener('click', () => {
        if (window.DelivoCart.getCount() === 0) return;
        if (confirm('هل تريد مسح السلة كاملاً؟')) {
            window.DelivoCart.clear();
            renderCartSidebar();
            if (window.updateSpCartBar) window.updateSpCartBar();
        }
    });

    const checkoutBtn = document.getElementById('cart-checkout-btn');
    if (checkoutBtn)  checkoutBtn.addEventListener('click', cartCheckout);

    /* ── Extras toggle (note + location) ───────────────────── */
    const extrasToggle = document.getElementById('cart-extras-toggle');
    const extrasPanel  = document.getElementById('cart-extras-panel');
    if (extrasToggle && extrasPanel) {
        extrasToggle.addEventListener('click', () => {
            const open = extrasPanel.classList.toggle('open');
            extrasToggle.classList.toggle('open', open);
        });
    }

    /* ── Cart location picker ───────────────────────────────── */
    _initCartLocation();

    /* ── Mouse drag scroll ──────────────────────────────────── */
    _initMouseDragScroll();

    /* ── Swipe-to-close (mobile touch) ─────────────────────── */
    _initCartSwipe();
}

function _initCartLocation() {
    const gpsBtn    = document.getElementById('cart-loc-gps');
    const mapBtn    = document.getElementById('cart-loc-map');
    const clearBtn  = document.getElementById('cart-loc-clear');
    const mapWrap   = document.getElementById('cart-loc-map-wrap');
    const statusTxt = document.getElementById('cart-loc-status-text');
    const latInput  = document.getElementById('cart-loc-lat');
    const lngInput  = document.getElementById('cart-loc-lng');
    if (!gpsBtn || !mapBtn) return;


    function setLocation(lat, lng, label) {
        latInput.value  = lat;
        lngInput.value  = lng;
        statusTxt.textContent = label || `${parseFloat(lat).toFixed(5)}, ${parseFloat(lng).toFixed(5)}`;
        statusTxt.classList.add('set');
        clearBtn.style.display = 'inline-flex';
        gpsBtn.classList.remove('active');
        mapBtn.classList.remove('active');
        const locDot = document.getElementById('cart-extras-loc-dot');
        if (locDot) locDot.style.display = 'inline';
    }

    function clearLocation() {
        latInput.value  = '';
        lngInput.value  = '';
        statusTxt.textContent = 'لم يتم تحديد الموقع';
        statusTxt.classList.remove('set');
        clearBtn.style.display = 'none';
        gpsBtn.classList.remove('active');
        mapBtn.classList.remove('active');
        const locDot = document.getElementById('cart-extras-loc-dot');
        if (locDot) locDot.style.display = 'none';
        if (mapWrap) mapWrap.style.display = 'none';
    }

    // Pre-fill from saved profile location if available
    const prof = window.DelivoUser || {};
    const savedLat = prof.location?.lat || prof.lat || '';
    const savedLng = prof.location?.lng || prof.lng || '';
    if (savedLat && savedLng) {
        setLocation(savedLat, savedLng, '📍 موقعك المحفوظ');
    }

    // GPS button
    gpsBtn.addEventListener('click', () => {
        if (!navigator.geolocation) {
            statusTxt.textContent = 'جهازك لا يدعم تحديد الموقع.';
            return;
        }
        gpsBtn.classList.add('active');
        gpsBtn.textContent = '⏳ جاري التحديد...';
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                setLocation(lat, lng, '📍 موقعك الحالي');
                gpsBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg> موقعي الحالي`;
                if (mapWrap) mapWrap.style.display = 'none';
            },
            () => {
                gpsBtn.classList.remove('active');
                gpsBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg> موقعي الحالي`;
                statusTxt.textContent = 'تعذّر تحديد الموقع.';
            },
            { timeout: 10000, enableHighAccuracy: true }
        );
    });

    // Map button — opens fullscreen modal OUTSIDE the transformed sidebar
    let _cartMap = null, _cartMarker = null;

    mapBtn.addEventListener('click', () => {
        const modal  = document.getElementById('cart-map-modal');
        const mapDiv = document.getElementById('cart-map-modal-map');
        if (!modal || !mapDiv) return;

        // Show modal
        modal.style.display = 'flex';

        const initLat    = parseFloat(latInput.value) || 34.004;
        const initLng    = parseFloat(lngInput.value) || 36.210;
        const GOOGLE_KEY = 'AIzaSyCSTThgge2nSFlEQXjS1ta2tZXvVgNAnZ0';

        // Destroy stale instance
        if (_cartMap) { _cartMap.remove(); _cartMap = null; _cartMarker = null; }
        mapDiv.innerHTML = '';

        // Modal is position:fixed — no transform parent — safe to init immediately
        requestAnimationFrame(() => {
            const tileSatellite = L.tileLayer(
                `https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&key=${GOOGLE_KEY}`,
                { attribution: '© Google Maps', maxZoom: 20, subdomains: '0123' }
            );
            const tileStandard = L.tileLayer(
                'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                { attribution: '© OpenStreetMap', maxZoom: 19 }
            );
            let currentLayer = 'satellite';

            _cartMap = L.map(mapDiv, {
                zoomControl: true,
                tap: false,
                attributionControl: true,
            }).setView([initLat, initLng], 16);

            tileSatellite.addTo(_cartMap);

            // Toggle satellite ↔ standard
            const toggleCtrl = L.control({ position: 'topright' });
            toggleCtrl.onAdd = function() {
                const btn = L.DomUtil.create('button', '');
                btn.innerHTML = '🗺 خريطة';
                btn.style.cssText = 'background:#fff;border:2px solid #FF5C00;border-radius:6px;padding:5px 9px;font-size:12px;font-weight:700;cursor:pointer;color:#FF5C00;box-shadow:0 1px 5px rgba(0,0,0,0.3);white-space:nowrap;';
                L.DomEvent.on(btn, 'click', function(e) {
                    L.DomEvent.stopPropagation(e);
                    if (currentLayer === 'satellite') {
                        _cartMap.removeLayer(tileSatellite);
                        tileStandard.addTo(_cartMap);
                        currentLayer = 'standard';
                        btn.innerHTML = '🛰 صورة جوية';
                    } else {
                        _cartMap.removeLayer(tileStandard);
                        tileSatellite.addTo(_cartMap);
                        currentLayer = 'satellite';
                        btn.innerHTML = '🗺 خريطة';
                    }
                });
                return btn;
            };
            toggleCtrl.addTo(_cartMap);

            // Orange teardrop marker
            const orangeIcon = L.divIcon({
                className: '',
                html: '<div style="width:30px;height:30px;background:#FF5C00;border:3px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 8px rgba(0,0,0,0.4);"></div>',
                iconSize: [30, 30],
                iconAnchor: [15, 30],
            });

            _cartMarker = L.marker([initLat, initLng], {
                icon: orangeIcon,
                draggable: true,
            }).addTo(_cartMap);

            _cartMap.on('click', (e) => { _cartMarker.setLatLng(e.latlng); });
            _cartMap.invalidateSize();
        });
    });

    // Confirm button — read marker position, close modal, update status
    const confirmBtn = document.getElementById('cart-map-modal-confirm');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
            if (_cartMarker) {
                const pos = _cartMarker.getLatLng();
                setLocation(pos.lat.toFixed(6), pos.lng.toFixed(6));
                mapBtn.classList.add('active');
            }
            document.getElementById('cart-map-modal').style.display = 'none';
            if (_cartMap) { _cartMap.remove(); _cartMap = null; _cartMarker = null; }
        });
    }

    // Close button
    const modalClose = document.getElementById('cart-map-modal-close');
    if (modalClose) {
        modalClose.addEventListener('click', () => {
            document.getElementById('cart-map-modal').style.display = 'none';
            if (_cartMap) { _cartMap.remove(); _cartMap = null; _cartMarker = null; }
        });
    }

        // Clear button
    clearBtn.addEventListener('click', clearLocation);

    // Re-fill from profile when sidebar opens (user may have just logged in)
    window._cartLocationRefresh = function() {
        if (latInput.value) return; // already set manually
        const p = window.DelivoUser || {};
        const lat = p.location?.lat || p.lat || '';
        const lng = p.location?.lng || p.lng || '';
        if (lat && lng) setLocation(lat, lng, '📍 موقعك المحفوظ');
    };
}

function _initMouseDragScroll() {
    const el = document.getElementById('cart-body');
    if (!el) return;

    let isDown   = false;
    let startY   = 0;
    let scrollTop = 0;

    el.addEventListener('mousedown', (e) => {
        /* Ignore clicks on buttons/inputs inside the cart */
        if (e.target.closest('button, input, textarea, a')) return;
        isDown    = true;
        startY    = e.pageY - el.offsetTop;
        scrollTop = el.scrollTop;
        el.classList.add('is-mouse-dragging');
    });

    el.addEventListener('mouseleave', () => {
        isDown = false;
        el.classList.remove('is-mouse-dragging');
    });

    el.addEventListener('mouseup', () => {
        isDown = false;
        el.classList.remove('is-mouse-dragging');
    });

    el.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const y    = e.pageY - el.offsetTop;
        const walk = (y - startY) * 1.4;
        el.scrollTop = scrollTop - walk;
    });
}

function _initCartSwipe() {
    const sidebar = document.getElementById('cart-sidebar');
    if (!sidebar) return;

    /* Sidebar slides from LEFT (translateX -100% → 0).
       Dismiss by swiping LEFT past threshold or fast flick. */

    let touchStartX  = 0;
    let touchStartY  = 0;
    let touchStartT  = 0;
    let currentDeltaX = 0;
    let isSwiping    = false;
    let isScrolling  = null;

    const THRESHOLD   = 72;   // px to commit close
    const VELOCITY_TH = 0.35; // px/ms fast flick

    sidebar.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        const rect  = sidebar.getBoundingClientRect();
        const relX  = touch.clientX - rect.left;

        // Only start swipe in the left 35% of the sidebar (near the edge)
        if (relX > sidebar.offsetWidth * 0.35) return;

        touchStartX   = touch.clientX;
        touchStartY   = touch.clientY;
        touchStartT   = e.timeStamp;
        currentDeltaX = 0;
        isSwiping     = true;
        isScrolling   = null;
    }, { passive: true });

    sidebar.addEventListener('touchmove', (e) => {
        if (!isSwiping) return;
        const touch  = e.touches[0];
        const dX = touch.clientX - touchStartX;
        const dY = touch.clientY - touchStartY;

        if (isScrolling === null) {
            isScrolling = Math.abs(dY) > Math.abs(dX);
        }
        if (isScrolling) { isSwiping = false; return; }

        // Only allow leftward swipe (negative)
        currentDeltaX = Math.min(0, dX);

        sidebar.classList.add('is-dragging');
        sidebar.style.transform = 'translateX(' + currentDeltaX + 'px)';

        // Fade the overlay proportionally
        const progress  = Math.abs(currentDeltaX) / sidebar.offsetWidth;
        const overlayEl = document.getElementById('cart-overlay');
        if (overlayEl) overlayEl.style.opacity = String(0.55 * (1 - progress));

    }, { passive: true });

    sidebar.addEventListener('touchend', (e) => {
        if (!isSwiping) return;
        isSwiping = false;
        sidebar.classList.remove('is-dragging');
        sidebar.style.transform = '';

        const touch    = e.changedTouches[0];
        const dX       = touch.clientX - touchStartX;
        const dt       = Math.max(1, e.timeStamp - touchStartT);
        const velocity = Math.abs(dX) / dt;

        const overlayEl = document.getElementById('cart-overlay');
        if (overlayEl) overlayEl.style.opacity = '';

        if (dX < -THRESHOLD || velocity > VELOCITY_TH) {
            window.closeCartSidebar();
        }
        // else snap back — transform reset above handles it
    }, { passive: true });
}

/* ── Utilities ──────────────────────────────────────────────── */

// Display price — dual currency
function _fmt(n) {
    const v = parseFloat(n);
    if (isNaN(v)) return '';
    if (v < 1000) return '$' + v.toFixed(v % 1 === 0 ? 0 : 2);
    return (v / 1000).toFixed(v % 1000 === 0 ? 0 : 1) + ' ألف ل.ل';
}

// Convert any price to USD
function _toUSD(n) {
    const v = parseFloat(n);
    if (isNaN(v)) return 0;
    return v < 1000 ? v : v / 90000;
}

// Total USD for a list of items
function _storeUSD(items) {
    return items.reduce((sum, i) => sum + _toUSD(i.price) * i.qty, 0);
}

// Grand total USD across all stores
function _cartTotalUSD() {
    if (!window.DelivoCart) return 0;
    return _storeUSD(window.DelivoCart.items);
}

function _cslug(s) {
    return String(s).replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '_');
}

function _getQty(id, storeName) {
    if (!window.DelivoCart) return 0;
    const item = window.DelivoCart.items.find(i => i.id === id && i.storeName === storeName);
    return item ? item.qty : 0;
}