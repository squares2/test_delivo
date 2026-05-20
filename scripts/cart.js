/* ============================================================
   scripts/cart.js
   Multi-store cart — items grouped by store in sidebar.
   Each item carries { id, name, price, storeName, storeType }.
   Checkout writes one request per store to Firebase.
   ============================================================ */

const RTDB_CART_URL = 'https://deliveryonline-300f7-default-rtdb.firebaseio.com';

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
            const badge = document.getElementById('cart-badge');
            if (!badge) return;
            const count = this.getCount();
            badge.textContent = count;
            badge.style.display = count > 0 ? 'flex' : 'none';
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
            const totalUSD = _cartTotalUSD();
            document.getElementById('cart-subtotal').textContent   = '$' + totalUSD.toFixed(2);
            document.getElementById('cart-delivery').textContent   = 'مجاناً';
            document.getElementById('cart-grandtotal').textContent = '$' + totalUSD.toFixed(2);
        }
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
        const subtotalEl   = document.getElementById('cart-subtotal');
        const grandtotalEl = document.getElementById('cart-grandtotal');
        const total = '$' + _cartTotalUSD().toFixed(2);
        if (subtotalEl)   subtotalEl.textContent   = total;
        if (grandtotalEl) grandtotalEl.textContent = total;
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
            const userProfile = window.DelivoUserProfile || {};
            const now         = new Date();
            const dateStr     = `${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()} ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;

            // Write one request per store
            for (const storeName of stores) {
                const storeItems = cart.getStoreItems(storeName);
                const cartStr    = storeItems.map(i => `${i.qty}:${i.name}:${i.price}:${storeName}`).join(',');
                const storeTotal = _storeUSD(storeItems).toFixed(2);
                const requestKey = `id_${nextId}`;

                const requestObj = {
                    cart         : cartStr,
                    city         : 'Baalbeck',
                    date         : dateStr,
                    delivryplusid: user.uid || '',
                    driver       : '0',
                    fullname     : userProfile.displayName || user.displayName || user.email || '',
                    lat          : String(userProfile.lat  || ''),
                    lng          : String(userProfile.lng  || ''),
                    phone        : userProfile.phone || '',
                    read         : '0',
                    state        : '0',
                    street       : userProfile.street || '',
                    total        : storeTotal,
                    trackorder   : '0',
                    username     : user.email || '',
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