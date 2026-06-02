/* ============================================================
   scripts/store-panel.js  v2 — with item customization notes
   Customization (ملاحظات) applies to Restaurants & BakeryShops.
   Keywords are fetched from Firebase: /customization_keywords/{storeType}
   Cart item shape: { id, name, price, storeName, storeType, notes? }
   ============================================================ */

const RTDB_URL  = 'https://deliveryonline-300f7-default-rtdb.firebaseio.com';
const GH_IMAGES = './items';

/* Store types that support customization keywords */
const CUSTOMIZABLE_TYPES = ['Restaurants', 'BakeryShops'];

/* ── Category emoji map ───────────────────────────────────── */
const STORE_TYPE_EMOJI = {
    Restaurants  : '🍽️',
    BakeryShops  : '🥖',
    ButcherShops : '🥩',
    CoffeeShops  : '☕',
    Markets      : '🛒',
    SweetsShops  : '🍰',
    FishShops    : '🐟',
};

/* ── Helpers ──────────────────────────────────────────────── */
function rtdbGet(path) {
    return fetch(`${RTDB_URL}/${path}.json`)
        .then(r => {
            if (!r.ok) throw new Error(`RTDB ${r.status}`);
            return r.json();
        });
}

function formatPrice(p) {
    const n = parseFloat(p);
    if (isNaN(n)) return '';
    if (n < 1000) return '$' + n.toFixed(n % 1 === 0 ? 0 : 2);
    return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + ' ألف ل.ل';
}

/* ── Panel state ──────────────────────────────────────────── */
let _currentStore = null;
let _activeTab    = null;
const _spCache    = {};

/* ── Keywords cache ───────────────────────────────────────── */
const _kwCache = {};   // { storeType: ['بدون ثوم', ...] }

async function _fetchKeywords(storeType) {
    if (_kwCache[storeType] !== undefined) return _kwCache[storeType];
    try {
        const data = await rtdbGet(`customization_keywords/${storeType}`);
        _kwCache[storeType] = Array.isArray(data)
            ? data.filter(Boolean)
            : (data && typeof data === 'object')
                ? Object.values(data).filter(Boolean)
                : [];
    } catch (_) {
        _kwCache[storeType] = [];
    }
    return _kwCache[storeType];
}

/* ── Store Intro ──────────────────────────────────────────── */
function _ensureIntroCard() {
    if (document.getElementById('store-intro')) return;
    const el = document.createElement('div');
    el.className = 'store-intro';
    el.id = 'store-intro';
    el.innerHTML = `
        <div class="store-intro__bg">
            <div class="store-intro__blob"></div>
            <div class="store-intro__blob"></div>
            <div class="store-intro__blob"></div>
        </div>
        <div class="store-intro__logo-wrap" id="si-logo-wrap">
            <img class="store-intro__logo-img" id="si-logo-img" src="" alt=""
                 style="display:none"
                 onerror="this.style.display='none';document.getElementById('si-logo-emoji').style.display='block'">
            <span class="store-intro__logo-emoji" id="si-logo-emoji" style="display:none"></span>
        </div>
        <div class="store-intro__name"  id="si-name"></div>
        <div class="store-intro__cat"   id="si-cat"></div>
        <div class="store-intro__rating" id="si-rating" style="display:none">
            <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            <span id="si-rating-val"></span>
        </div>
        <div class="store-intro__dots" id="si-dots">
            <div class="store-intro__dot active"></div>
            <div class="store-intro__dot"></div>
            <div class="store-intro__dot"></div>
        </div>
        <div class="store-intro__progress" id="si-progress"></div>
    `;
    document.body.appendChild(el);
}

function showStoreIntro(storeId, storeName, storeType, storeMeta, onDone) {
    _ensureIntroCard();
    const card     = document.getElementById('store-intro');
    const logoImg  = document.getElementById('si-logo-img');
    const logoEmoji= document.getElementById('si-logo-emoji');
    const nameEl   = document.getElementById('si-name');
    const catEl    = document.getElementById('si-cat');
    const ratingEl = document.getElementById('si-rating');
    const ratingVal= document.getElementById('si-rating-val');
    const progress = document.getElementById('si-progress');
    const dots     = document.querySelectorAll('.store-intro__dot');
    const DURATION = 2200;

    nameEl.textContent = storeName;
    catEl.textContent  = (_typeEmoji(storeType) || '') + '  ' + (_typeLabel(storeType) || storeType);
    const rank = storeMeta && storeMeta.rank ? parseFloat(storeMeta.rank) : null;
    if (rank) { ratingVal.textContent = rank.toFixed(1); ratingEl.style.display = 'flex'; }
    else       { ratingEl.style.display = 'none'; }

    const logoPath = `assets/${storeId}.png`;
    logoImg.style.display  = 'none';
    logoEmoji.style.display = 'none';
    logoImg.onload  = () => { logoImg.style.display = 'block'; logoEmoji.style.display = 'none'; };
    logoImg.onerror = () => { logoImg.style.display = 'none'; logoEmoji.textContent = _typeEmoji(storeType) || '🏪'; logoEmoji.style.display = 'block'; };
    logoImg.src = logoPath;

    card.classList.remove('exit');
    card.style.display = 'flex';
    document.body.classList.add('modal-open');
    requestAnimationFrame(() => requestAnimationFrame(() => { card.classList.add('visible'); }));

    progress.style.transition = 'none';
    progress.style.width = '0%';
    requestAnimationFrame(() => {
        progress.style.transition = `width ${DURATION}ms linear`;
        progress.style.width = '100%';
    });

    let dotIdx = 0;
    const dotTimer = setInterval(() => {
        dots.forEach(d => d.classList.remove('active'));
        dotIdx = (dotIdx + 1) % dots.length;
        dots[dotIdx].classList.add('active');
    }, DURATION / 4);

    setTimeout(() => {
        clearInterval(dotTimer);
        const logoWrap = document.getElementById('si-logo-wrap');
        const fromRect = logoWrap.getBoundingClientRect();
        const heroH    = Math.min(200, window.innerHeight * 0.28);
        const toX      = window.innerWidth / 2;
        const toY      = heroH / 2;
        const toScale  = 0.55;
        const dX = toX - (fromRect.left + fromRect.width / 2);
        const dY = toY - (fromRect.top  + fromRect.height / 2);
        logoWrap.style.transition = 'transform 0.45s cubic-bezier(0.4,0,0.2,1), opacity 0.4s ease';
        logoWrap.style.transformOrigin = 'center center';
        logoWrap.style.transform = `translate(${dX}px, ${dY}px) scale(${toScale})`;
        logoWrap.style.opacity   = '0';
        nameEl.style.transition = 'opacity 0.25s ease';
        catEl.style.transition  = 'opacity 0.25s ease';
        nameEl.style.opacity    = '0';
        catEl.style.opacity     = '0';
        if (ratingEl) { ratingEl.style.transition = 'opacity 0.25s'; ratingEl.style.opacity = '0'; }
        card.classList.add('exit');
        setTimeout(() => {
            card.classList.remove('visible', 'exit');
            card.style.display = 'none';
            logoWrap.style.transform  = '';
            logoWrap.style.opacity    = '';
            logoWrap.style.transition = '';
            nameEl.style.opacity = catEl.style.opacity = '';
            progress.style.width = '0%';
            onDone();
        }, 460);
    }, DURATION);
}

function openStorePanel(storeId, storeName, storeType) {
    const _introCacheKey = `pattern_${storeType}`;
    const _introFetch = _spCache[_introCacheKey]
        ? Promise.resolve(_spCache[_introCacheKey])
        : rtdbGet(`pattern/${storeType}`).then(d => { _spCache[_introCacheKey] = d; return d; });

    // Pre-fetch keywords in background while intro plays
    if (CUSTOMIZABLE_TYPES.includes(storeType)) {
        _fetchKeywords(storeType);
    }

    _introFetch
        .then(patternData => {
            let storeMeta = null;
            if (patternData && typeof patternData === 'object') {
                storeMeta = Object.values(patternData).find(s => s && s.companyname === storeName);
            }
            showStoreIntro(storeId, storeName, storeType, storeMeta, () => {
                _openStorePanelNow(storeId, storeName, storeType);
            });
        })
        .catch(() => { _openStorePanelNow(storeId, storeName, storeType); });
}

function _openStorePanelNow(storeId, storeName, storeType) {
    _currentStore = { id: storeId, name: storeName, type: storeType };
    const overlay = document.getElementById('store-panel-overlay');
    const panel   = document.getElementById('store-panel');
    if (!overlay || !panel) return;

    document.getElementById('sp-hero-name').textContent = storeName;
    document.getElementById('sp-hero-meta').innerHTML   = '';
    document.getElementById('sp-tabs-inner').innerHTML  = '';
    document.getElementById('sp-body').innerHTML        = renderSkeleton();
    document.getElementById('sp-cart-bar').classList.remove('visible');

    const logoImg    = document.getElementById('sp-hero-logo');
    const logoEmoji  = document.getElementById('sp-hero-logo-emoji');
    const bgImg      = document.getElementById('sp-hero-bg');
    const fallbackEl = document.getElementById('sp-hero-fallback');
    const logoPath   = `assets/${storeId}.png`;
    const emojiDef   = _typeEmoji(storeType) || '🏪';

    if (logoImg)   { logoImg.style.display = 'none'; logoImg.src = ''; }
    if (logoEmoji) { logoEmoji.style.display = 'none'; logoEmoji.textContent = emojiDef; }
    if (bgImg)     { bgImg.style.display = 'none'; bgImg.src = ''; }
    if (fallbackEl){ fallbackEl.style.display = 'none'; }

    if (logoImg) {
        logoImg.onload = () => {
            logoImg.style.display = 'block';
            if (logoEmoji) logoEmoji.style.display = 'none';
            if (bgImg) { bgImg.src = logoPath; bgImg.style.display = 'block'; }
            if (fallbackEl) fallbackEl.style.display = 'none';
        };
        logoImg.onerror = () => {
            logoImg.style.display = 'none';
            if (logoEmoji) { logoEmoji.textContent = emojiDef; logoEmoji.style.display = 'flex'; }
            if (fallbackEl){ fallbackEl.textContent = emojiDef; fallbackEl.style.display = 'flex'; }
        };
        logoImg.src = logoPath;
        logoImg.alt = storeName;
    }

    overlay.classList.add('active');
    panel.classList.add('active');
    document.body.classList.add('modal-open');
    _loadStorePanel(storeName, storeType);
}

function closeStorePanel() {
    const overlay = document.getElementById('store-panel-overlay');
    const panel   = document.getElementById('store-panel');
    if (overlay) overlay.classList.remove('active');
    if (panel)   panel.classList.remove('active');
    document.body.classList.remove('modal-open');
    const wrap = document.getElementById('sp-subcat-wrap');
    if (wrap) { wrap.style.display = 'none'; wrap.innerHTML = ''; }
    _currentStore = null;
    _activeTab    = null;
}

/* ── Load & render ────────────────────────────────────────── */
async function _loadStorePanel(storeName, storeType) {
    const body = document.getElementById('sp-body');
    try {
        const _cacheKey   = `pattern_${storeType}`;
        const patternData = _spCache[_cacheKey] || await rtdbGet(`pattern/${storeType}`);
        _spCache[_cacheKey] = patternData;
        let storeMeta = null;
        if (patternData && typeof patternData === 'object') {
            storeMeta = Object.values(patternData).find(s => s && s.companyname === storeName);
        }

        const metaEl = document.getElementById('sp-hero-meta');
        const emoji  = STORE_TYPE_EMOJI[storeType] || '🏪';
        if (storeMeta) {
            metaEl.innerHTML = `
                <span class="sp-hero__badge">${emoji} ${_typeLabel(storeType)}</span>
                ${storeMeta.rank ? `<span class="sp-hero__badge sp-hero__badge--orange">⭐ ${storeMeta.rank}</span>` : ''}
                ${storeMeta.soon == '1' || storeMeta.soon === 1 ? '<span class="sp-hero__badge sp-hero__badge--soon">⏳ قريباً</span>' : ''}
            `;
            if (storeMeta.soon == '1' || storeMeta.soon === 1) {
                body.innerHTML = `<div class="sp-soon">
                    <div class="sp-soon__icon">🚧</div>
                    <div class="sp-soon__title">قريباً!</div>
                    <div class="sp-soon__sub">هذا المتجر سيكون متاحاً قريباً.<br>ترقّبوا العروض والأصناف الجديدة.</div>
                </div>`;
                return;
            }
        }

        const items = await rtdbGet(`items/${storeName}`);
        if (!items) {
            body.innerHTML = `<div class="sp-empty">
                <div class="sp-empty__icon">🛍️</div>
                <div class="sp-empty__title">لا توجد أصناف</div>
                <div class="sp-empty__sub">لم يتم إضافة منتجات لهذا المتجر بعد</div>
            </div>`;
            return;
        }

        const tree = {};
        Object.values(items).forEach(item => {
            if (!item || !item.name) return;
            const main = (item.catmain || 'عام').trim();
            const sub  = (item.cat    || 'عام').trim();
            if (!tree[main])      tree[main] = {};
            if (!tree[main][sub]) tree[main][sub] = [];
            tree[main][sub].push(item);
        });

        const mains = Object.keys(tree).sort();
        const tabsEl = document.getElementById('sp-tabs-inner');
        tabsEl.innerHTML = mains.map((main, i) => `
            <button class="sp-tab ${i === 0 ? 'active' : ''}"
                    data-cat="${main}"
                    onclick="spSelectMain('${main}')">
                ${main}
            </button>`).join('');

        window._spTree      = tree;
        window._spStoreName = storeName;
        _renderMainSection(mains[0], tree, storeName, body);
        _initSectionObserver(mains);
        _updateSpCartBar();

    } catch (err) {
        console.error('[StorePanel]', err);
        body.innerHTML = `<div class="sp-error">
            <div class="sp-error__icon">⚠️</div>
            <div class="sp-error__title">تعذّر تحميل المنتجات</div>
            <div class="sp-error__sub">تحقق من اتصالك وحاول مجدداً</div>
        </div>`;
    }
}

/* ── Render item card ─────────────────────────────────────── */
function renderItem(item, storeName) {
    const id        = item.ID || item.id || '';
    const name      = item.name || '';
    const price     = parseFloat(item.price) || 0;
    const sale      = parseFloat(item.sale)  || 0;
    const hasSale   = sale > 0 && sale < price;
    const dispPrice = hasSale ? sale : price;
    const pngExist  = item.pngExist === '1' || item.pngExist === 1;
    const imgUrl    = pngExist ? `${GH_IMAGES}/${String(id).toLowerCase()}.png` : '';
    const cartQty   = _getBaseItemQty(`${storeName}__${id}`, storeName);
    const uniqueId  = `${storeName}__${id}`;
    const sType     = _currentStore ? _currentStore.type : '';

    return `
    <div class="sp-item" id="sp-item-${_slugify(uniqueId)}">
        <div class="sp-item__img-wrap" style="cursor:pointer"
             onclick="openItemPopup(${JSON.stringify(item).replace(/"/g,'&quot;')},'${storeName.replace(/'/g,"\\'")}')">
            ${pngExist
                ? `<img class="sp-item__img" src="${imgUrl}" alt="${name}"
                       onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
                       loading="lazy">
                   <div class="sp-item__img-fallback" style="display:none">${_typeEmoji(item.companytype)}</div>`
                : `<div class="sp-item__img-fallback">${_typeEmoji(item.companytype)}</div>`
            }
            ${hasSale ? `<span class="sp-item__sale-badge">خصم</span>` : ''}
            <div style="position:absolute;bottom:5px;right:5px;width:22px;height:22px;background:rgba(0,0,0,0.45);border-radius:50%;display:flex;align-items:center;justify-content:center;pointer-events:none">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
            </div>
        </div>
        <div class="sp-item__info">
            <div class="sp-item__name">${name}</div>
            ${item.catar ? `<div class="sp-item__cat">${item.catar}</div>` : ''}
            <div class="sp-item__price-row">
                <span class="sp-item__price">${formatPrice(dispPrice)}</span>
                ${hasSale ? `<span class="sp-item__price-old">${formatPrice(price)}</span>` : ''}
            </div>
        </div>
        <div class="sp-item__actions" id="sp-actions-${_slugify(uniqueId)}">
            ${cartQty > 0 ? `
            <div class="sp-item__qty-control" id="sp-qty-ctrl-${_slugify(uniqueId)}">
                <button class="sp-item__qty-btn"
                        onclick="spRemoveLastInstance('${uniqueId}','${storeName}')">−</button>
                <span class="sp-item__qty-num" id="sp-qty-${_slugify(uniqueId)}">${cartQty}</span>
                <button class="sp-item__qty-btn sp-item__qty-btn--add"
                        onclick="spAddItem('${uniqueId}','${name}',${dispPrice},'${storeName}','${sType}',event)">+</button>
            </div>` : `
            <button class="sp-item__add-btn" id="sp-add-btn-${_slugify(uniqueId)}"
                    onclick="spAddItem('${uniqueId}','${name}',${dispPrice},'${storeName}','${sType}',event)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2.5"
                     stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
            </button>`}
        </div>
    </div>`;
}

/* ── Cart interactions ────────────────────────────────────── */
async function spAddItem(uniqueId, name, price, storeName, storeType, event) {
    if (!window.DelivoCart) return;
    if (event) event.stopPropagation();

    if (CUSTOMIZABLE_TYPES.includes(storeType)) {
        const keywords = await _fetchKeywords(storeType);
        _openNotesModal({ baseId: uniqueId, name, price, storeName, storeType, keywords }, (selectedKws) => {
            // Each add creates a NEW instance with its own unique ID
            // instanceId = baseId + '__' + timestamp so identical items with diff notes are separate entries
            const instanceId = uniqueId + '__i' + Date.now();
            _doAddItem(instanceId, name, price, storeName, storeType, selectedKws, uniqueId);
        });
        return;
    }

    _doAddItem(uniqueId, name, price, storeName, storeType, '', uniqueId);
}

/* Remove the most-recently-added instance of an item */
function spRemoveLastInstance(baseId, storeName) {
    if (!window.DelivoCart) return;
    // Find all instances of this base item (id starts with baseId)
    const instances = window.DelivoCart.items.filter(i =>
        i.storeName === storeName && (i.id === baseId || i.id.startsWith(baseId + '__i'))
    );
    if (!instances.length) return;
    // Remove the last instance (most recently added)
    const last = instances[instances.length - 1];
    window.DelivoCart.decrementItem(last.id, storeName);
    _updatePanelQtyDisplay(baseId, storeName);
    if (window.renderCartSidebar) window.renderCartSidebar();
    _updateSpCartBar();
}

function _doAddItem(instanceId, name, price, storeName, storeType, notes, baseId) {
    // baseId is the original storeName__itemId used for UI element IDs
    // instanceId may have a __iXXXX suffix for separate instances
    const bId = baseId || instanceId;
    window.DelivoCart.addItem(instanceId, name, price, storeName, storeType, notes);
    _updatePanelQtyDisplay(bId, storeName);
    _updateSpCartBar();
    if (window.renderCartSidebar) window.renderCartSidebar();
}

/* Update the qty display in the store panel for a base item */
function _updatePanelQtyDisplay(baseId, storeName) {
    const slug     = _slugify(baseId);
    const total    = _getBaseItemQty(baseId, storeName);
    const actionsEl = document.getElementById(`sp-actions-${slug}`);
    if (!actionsEl) return;

    // Parse name and price from baseId context (needed for onclick)
    // We read them from the existing cart item
    const sample = window.DelivoCart?.items.find(i =>
        i.storeName === storeName && (i.id === baseId || i.id.startsWith(baseId + '__i'))
    );
    if (!sample) return;
    const { name, price, storeType } = sample;

    if (total > 0) {
        actionsEl.innerHTML = `
            <div class="sp-item__qty-control" id="sp-qty-ctrl-${slug}">
                <button class="sp-item__qty-btn"
                        onclick="spRemoveLastInstance('${baseId}','${storeName}')">−</button>
                <span class="sp-item__qty-num" id="sp-qty-${slug}">${total}</span>
                <button class="sp-item__qty-btn sp-item__qty-btn--add"
                        onclick="spAddItem('${baseId}','${name.replace(/'/g,"\'")}',${price},'${storeName}','${storeType}',event)">+</button>
            </div>`;
    } else {
        actionsEl.innerHTML = `
            <button class="sp-item__add-btn" id="sp-add-btn-${slug}"
                    onclick="spAddItem('${baseId}','${name.replace(/'/g,"\'")}',${price},'${storeName}','${storeType}',event)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2.5"
                     stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
            </button>`;
    }
}

/* spChangeQty kept for compatibility but routes through instance logic */
function spChangeQty(baseId, name, price, delta, storeName, storeType) {
    if (!window.DelivoCart) return;
    if (delta > 0) {
        spAddItem(baseId, name, price, storeName, storeType, null);
    } else {
        spRemoveLastInstance(baseId, storeName);
    }
}

function _updateSpCartBar() {
    const bar     = document.getElementById('sp-cart-bar');
    const countEl = document.getElementById('sp-cart-count');
    const totalEl = document.getElementById('sp-cart-total');
    if (!bar) return;
    const count    = window.DelivoCart ? window.DelivoCart.getCount() : 0;
    const totalUSD = window.DelivoCart ? window.DelivoCart.items.reduce((sum, item) => {
        const p = parseFloat(item.price) || 0;
        return sum + (p < 1000 ? p : p / 90000) * item.qty;
    }, 0) : 0;
    bar.classList.toggle('visible', count > 0);
    if (countEl) countEl.textContent = count + ' منتج';
    if (totalEl) totalEl.textContent = '$' + totalUSD.toFixed(2);
}

/* ══════════════════════════════════════════════════════════
   NOTES MODAL — keyword chips + free text input
══════════════════════════════════════════════════════════ */
function _ensureNotesModal() {
    if (document.getElementById('nm-overlay')) return;

    const style = document.createElement('style');
    style.textContent = `
    #nm-overlay {
        position:fixed;inset:0;z-index:100000;
        background:rgba(10,10,15,0.72);
        backdrop-filter:blur(8px);
        display:flex;align-items:flex-end;justify-content:center;
        direction:rtl;
        opacity:1;transition:opacity 0.22s;
    }
    #nm-overlay.nm-hidden { opacity:0;pointer-events:none; }
    #nm-box {
        background:#fff;border-radius:24px 24px 0 0;
        width:100%;max-width:520px;
        padding-bottom:env(safe-area-inset-bottom,0);
        box-shadow:0 -8px 40px rgba(0,0,0,0.22);
        transform:translateY(0);
        transition:transform 0.28s cubic-bezier(0.4,0,0.2,1);
        font-family:'Almarai',sans-serif;
    }
    #nm-overlay.nm-hidden #nm-box { transform:translateY(100%); }
    .nm-handle {
        width:40px;height:4px;border-radius:2px;
        background:#e2e2e6;margin:12px auto 0;
    }
    .nm-header {
        display:flex;align-items:flex-start;justify-content:space-between;
        padding:14px 20px 12px;border-bottom:1px solid #f0f0f2;
    }
    .nm-header-left { display:flex;flex-direction:column;gap:2px; }
    .nm-title { font-size:1rem;font-weight:800;color:#111; }
    .nm-item-name {
        font-size:0.8rem;color:#FF5C00;font-weight:700;
        max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
    }
    .nm-close {
        background:none;border:none;width:32px;height:32px;
        border-radius:50%;display:flex;align-items:center;justify-content:center;
        font-size:1rem;color:#aaa;cursor:pointer;flex-shrink:0;
        transition:background 0.15s;margin-top:2px;
    }
    .nm-close:hover { background:#f0f0f2;color:#555; }
    .nm-body { padding:18px 20px 0; }
    .nm-kw-label {
        font-size:0.68rem;font-weight:800;color:#9898a6;
        letter-spacing:0.8px;text-transform:uppercase;margin-bottom:12px;
    }
    .nm-chips {
        display:flex;flex-wrap:wrap;gap:9px;margin-bottom:6px;
        max-height:200px;overflow-y:auto;padding-bottom:4px;
    }
    .nm-chip {
        padding:9px 16px;
        border:1.5px solid #e2e2e6;border-radius:50px;
        font-size:0.82rem;font-weight:700;color:#555;background:#fff;
        cursor:pointer;transition:all 0.15s;
        font-family:'Almarai',sans-serif;
        user-select:none;
    }
    .nm-chip:hover { border-color:#FF5C00;color:#FF5C00;background:#fff8f5; }
    .nm-chip.nm-chip--active {
        background:#FF5C00;border-color:#FF5C00;color:#fff;
        box-shadow:0 2px 8px rgba(255,92,0,0.3);
    }
    .nm-empty-kw {
        font-size:0.8rem;color:#bbb;
        padding:24px 0;text-align:center;
    }
    .nm-footer {
        display:flex;gap:10px;
        padding:14px 20px 20px;
        border-top:1px solid #f0f0f2;
        margin-top:16px;
    }
    .nm-btn-skip {
        padding:13px 20px;
        border:1.5px solid #e2e2e6;border-radius:12px;
        background:#fff;color:#888;
        font-family:'Almarai',sans-serif;font-size:0.85rem;font-weight:700;
        cursor:pointer;white-space:nowrap;transition:all 0.15s;flex-shrink:0;
    }
    .nm-btn-skip:hover { background:#f7f7f8;color:#555; }
    .nm-btn-add {
        flex:1;padding:13px;border:none;border-radius:12px;
        background:#FF5C00;color:#fff;
        font-family:'Almarai',sans-serif;font-size:0.92rem;font-weight:800;
        cursor:pointer;
        box-shadow:0 4px 14px rgba(255,92,0,0.35);
        transition:all 0.15s;
        display:flex;align-items:center;justify-content:center;gap:8px;
    }
    .nm-btn-add:hover { background:#cc4800; }
    .nm-btn-add:disabled { background:#e2e2e6;color:#aaa;box-shadow:none;cursor:not-allowed; }
    .nm-selected-preview {
        font-size:0.72rem;color:#FF5C00;font-weight:700;
        min-height:20px;padding:0 20px 10px;text-align:center;
        transition:opacity 0.2s;
    }
    `;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.id = 'nm-overlay';
    overlay.className = 'nm-hidden';
    overlay.innerHTML = `
    <div id="nm-box" role="dialog" aria-modal="true">
        <div class="nm-handle"></div>
        <div class="nm-header">
            <div class="nm-header-left">
                <div class="nm-title">اختر خصائص الصنف</div>
                <div class="nm-item-name" id="nm-item-name"></div>
            </div>
            <button class="nm-close" id="nm-close">✕</button>
        </div>
        <div class="nm-body">
            <div class="nm-kw-label" id="nm-kw-label">الخصائص المتاحة</div>
            <div class="nm-chips" id="nm-chips"></div>
        </div>
        <div class="nm-selected-preview" id="nm-preview"></div>
        <div class="nm-footer">
            <button class="nm-btn-skip" id="nm-btn-skip">بدون خاصية</button>
            <button class="nm-btn-add" id="nm-btn-add">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 3h2l.4 2M7 13h10l4-8H5.4"/><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                </svg>
                أضف للسلة
            </button>
        </div>
    </div>`;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', e => { if (e.target === overlay) _closeNotesModal(null); });
    document.getElementById('nm-close').addEventListener('click', () => _closeNotesModal(null));
}

let _nmCallback = null;
let _nmSelected = new Set();

function _openNotesModal({ baseId, name, price, storeName, storeType, keywords }, onConfirm) {
    _ensureNotesModal();
    _nmCallback = onConfirm;
    _nmSelected = new Set();

    document.getElementById('nm-item-name').textContent = name;
    _nmUpdatePreview();

    const chipsEl   = document.getElementById('nm-chips');
    const labelEl   = document.getElementById('nm-kw-label');
    const addBtn    = document.getElementById('nm-btn-add');

    if (keywords && keywords.length > 0) {
        labelEl.style.display = '';
        chipsEl.innerHTML = keywords.map(kw => `
            <button class="nm-chip" data-kw="${kw}">${kw}</button>
        `).join('');

        // Wire chip clicks
        chipsEl.querySelectorAll('.nm-chip').forEach(btn => {
            btn.addEventListener('click', () => {
                const kw = btn.dataset.kw;
                if (_nmSelected.has(kw)) {
                    _nmSelected.delete(kw);
                    btn.classList.remove('nm-chip--active');
                } else {
                    _nmSelected.add(kw);
                    btn.classList.add('nm-chip--active');
                }
                _nmUpdatePreview();
            });
        });
    } else {
        labelEl.style.display = 'none';
        chipsEl.innerHTML = '<div class="nm-empty-kw">لا توجد خصائص لهذا النوع من المتاجر</div>';
    }

    // Wire footer buttons
    document.getElementById('nm-btn-skip').onclick = () => _closeNotesModal('');
    document.getElementById('nm-btn-add').onclick  = () => {
        const result = [..._nmSelected].join('، ');
        _closeNotesModal(result);
    };

    // Show with animation
    const overlay = document.getElementById('nm-overlay');
    overlay.classList.remove('nm-hidden');
}

function _nmUpdatePreview() {
    const el = document.getElementById('nm-preview');
    if (!el) return;
    const selected = [..._nmSelected];
    el.textContent = selected.length ? selected.join(' • ') : '';
    el.style.opacity = selected.length ? '1' : '0';
}

function _closeNotesModal(result) {
    const overlay = document.getElementById('nm-overlay');
    if (overlay) overlay.classList.add('nm-hidden');
    if (result !== null && typeof _nmCallback === 'function') {
        _nmCallback(result);
    }
    _nmCallback = null;
}

/* ══════════════════════════════════════════════════════════
   TWO-LEVEL NAVIGATION
══════════════════════════════════════════════════════════ */
function spSelectMain(main) {
    const tree      = window._spTree;
    const storeName = window._spStoreName;
    const body      = document.getElementById('sp-body');
    if (!tree || !tree[main] || !body) return;
    _setActiveTab(main);
    _renderMainSection(main, tree, storeName, body);
    body.scrollTo({ top: 0, behavior: 'smooth' });
}

function spSelectSub(slug) {
    _setActiveSub(slug);
    requestAnimationFrame(() => requestAnimationFrame(() => {
        const sec  = document.getElementById(`sp-subsec-${slug}`);
        if (!sec) return;
        const body   = document.getElementById('sp-body');
        const target = sec.offsetTop - 2;
        const maxScroll = body.scrollHeight - body.clientHeight;
        body.scrollTo({ top: Math.max(0, Math.min(target, maxScroll)), behavior: 'smooth' });
    }));
}

function _renderMainSection(main, tree, storeName, body) {
    const subs     = Object.keys(tree[main]).sort();
    const multiSub = subs.length > 1;
    const wrap     = document.getElementById('sp-subcat-wrap');

    if (wrap) {
        if (multiSub) {
            wrap.style.display = 'block';
            wrap.innerHTML = `
                <div class="sp-subcat-bar" id="sp-subcat-bar">
                    ${subs.map((sub, i) => `
                        <button class="sp-subchip ${i === 0 ? 'active' : ''}"
                                data-slug="${_slugify(sub)}"
                                onclick="spSelectSub('${_slugify(sub)}')">
                            ${sub}
                        </button>`).join('')}
                </div>`;
        } else {
            wrap.style.display = 'none';
            wrap.innerHTML = '';
        }
    }

    body.innerHTML = subs.map(sub => `
        <div class="sp-section" id="sp-subsec-${_slugify(sub)}" data-slug="${_slugify(sub)}" data-sub="${sub}">
            ${multiSub ? `<div class="sp-section__title sp-section__title--sub">${sub}</div>` : ''}
            <div class="sp-items">
                ${tree[main][sub].map(item => renderItem(item, storeName)).join('')}
            </div>
        </div>`).join('');

    if (multiSub) _initSubObserver(subs);
    _updateSpCartBar();
}

function _initSubObserver(subs) {
    const body = document.getElementById('sp-body');
    if (!body || !('IntersectionObserver' in window)) return;
    if (window._spSubObserver) window._spSubObserver.disconnect();
    window._spSubObserver = new IntersectionObserver((entries) => {
        entries.forEach(e => { if (e.isIntersecting) _setActiveSub(e.target.dataset.slug); });
    }, { root: body, rootMargin: '-10% 0px -60% 0px', threshold: 0 });
    subs.forEach(sub => {
        const el = document.getElementById(`sp-subsec-${_slugify(sub)}`);
        if (el) window._spSubObserver.observe(el);
    });
}

function _setActiveSub(slug) {
    document.querySelectorAll('.sp-subchip').forEach(c => {
        c.classList.toggle('active', c.dataset.slug === slug);
    });
    const activeChip = document.querySelector(`.sp-subchip[data-slug="${slug}"]`);
    if (activeChip) activeChip.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
}

function spScrollToSection(cat) { spSelectMain(cat); }
function _initSectionObserver(mains) {}

function _setActiveTab(cat) {
    document.querySelectorAll('.sp-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.cat === cat);
    });
    const activeTab = document.querySelector(`.sp-tab[data-cat="${cat}"]`);
    if (activeTab) activeTab.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
    _activeTab = cat;
}

function renderSkeleton() {
    return `<div class="sp-skeleton">${Array(5).fill(0).map(() => `
        <div class="sp-skeleton__item">
            <div class="sp-skeleton__img"></div>
            <div class="sp-skeleton__lines">
                <div class="sp-skeleton__line"></div>
                <div class="sp-skeleton__line"></div>
                <div class="sp-skeleton__line"></div>
            </div>
        </div>`).join('')}</div>`;
}

/* ── Utilities ────────────────────────────────────────────── */
function _slugify(s)     { return String(s).replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '_'); }
function _getItemQty(id) {
    if (!window.DelivoCart) return 0;
    const item = window.DelivoCart.items.find(i => i.id === id);
    return item ? item.qty : 0;
}

/* Sum qty across all instances of a base item (id === baseId OR starts with baseId + __i) */
function _getBaseItemQty(baseId, storeName) {
    if (!window.DelivoCart) return 0;
    return window.DelivoCart.items
        .filter(i => i.storeName === storeName && (i.id === baseId || i.id.startsWith(baseId + '__i')))
        .reduce((s, i) => s + i.qty, 0);
}
function _typeLabel(t) {
    const map = { Restaurants:'مطاعم', CoffeeShops:'قهوة', Markets:'سوبرماركت', SweetsShops:'حلويات', ButcherShops:'ملاحم', FishShops:'أسماك', BakeryShops:'مخابز' };
    return map[t] || t;
}
function _typeEmoji(t) {
    const map = { Restaurants:'🍔', CoffeeShops:'☕', Markets:'🛒', SweetsShops:'🍰', ButcherShops:'🥩', FishShops:'🐟', BakeryShops:'🥖' };
    return map[t] || '🏪';
}

/* ── Init ─────────────────────────────────────────────────── */
function initStorePanel() {
    const overlay = document.getElementById('store-panel-overlay');
    if (overlay) overlay.addEventListener('click', closeStorePanel);
    const backBtn = document.getElementById('sp-back-btn');
    if (backBtn) backBtn.addEventListener('click', closeStorePanel);
    const cartBarBtn = document.getElementById('sp-cart-bar-btn');
    if (cartBarBtn) cartBarBtn.addEventListener('click', () => {
        closeStorePanel();
        setTimeout(() => openCartSidebar(), 180);
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeStorePanel(); });

    document.querySelectorAll('[data-store-id]').forEach(card => {
        card.addEventListener('click', () => {
            const storeId   = card.dataset.storeId;
            const storeType = card.dataset.storeType || 'Restaurants';
            const nameMap   = {
                'classic-food':'Classic-Food','king-pizza':'King-Pizza','zahret-lobnan':'Zahret-Lobnan',
                'burger-house':'AL-Beik','store-burger':'AL-Beik','al-beik':'AL-Beik',
                'al-fajr':'AL-Fajr','al-amana':'Al-Amana','assaf-grocery':'Assaf-Grocery',
                'bhalib':'Bhalib','foodigo':'Foodigo','hellani-kitchen':'Hellani-Kitchen','minini':'Minini',
            };
            const typeMap   = { restaurants:'Restaurants', coffee:'CoffeeShops', supermarket:'Markets', sweets:'SweetsShops', meat:'ButcherShops', fish:'FishShops', bakery:'BakeryShops' };
            const fireName  = nameMap[storeId]  || _toFirebaseName(storeId);
            const fireType  = typeMap[storeType] || 'Restaurants';
            openStorePanel(storeId, fireName, fireType);
        });
    });

    window.openStorePanel    = openStorePanel;
    window.spSelectMain      = spSelectMain;
    window.spSelectSub       = spSelectSub;
    window.closeStorePanel   = closeStorePanel;
    window.spAddItem              = spAddItem;
    window.spRemoveLastInstance  = spRemoveLastInstance;
    window._updatePanelQtyDisplay = _updatePanelQtyDisplay;
    window.spChangeQty       = spChangeQty;
    window.spScrollToSection = spScrollToSection;
    window.updateSpCartBar   = _updateSpCartBar;
}

function _toFirebaseName(id) {
    return id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('-');
}

/* ══════════════════════════════════════════════════════════
   ITEM DETAIL POPUP — with notes support
══════════════════════════════════════════════════════════ */
function _ensureItemPopup() {
    if (document.getElementById('item-popup')) return;

    const overlay = document.createElement('div');
    overlay.className = 'item-popup-overlay';
    overlay.id = 'item-popup-overlay';
    overlay.addEventListener('click', closeItemPopup);

    const popup = document.createElement('div');
    popup.className = 'item-popup';
    popup.id = 'item-popup';
    popup.innerHTML = `
        <div class="item-popup__hero" id="ip-hero">
            <button class="item-popup__close" id="ip-close" aria-label="رجوع">
                <svg viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="15 18 9 12 15 6"/>
                </svg>
            </button>
            <span class="item-popup__sale-hero" id="ip-sale-hero" style="display:none"></span>
            <div class="item-popup__img-wrap" id="ip-img-wrap">
                <img id="ip-img" src="" alt=""
                     onerror="this.style.display='none';document.getElementById('ip-img-fallback').style.display='flex'">
                <div class="item-popup__img-fallback" id="ip-img-fallback" style="display:none"></div>
            </div>
        </div>
        <div class="item-popup__body" id="ip-body">
            <div class="item-popup__qty-row">
                <div class="item-popup__qty-pill">
                    <button class="item-popup__qty-btn" id="ip-minus">&#8722;</button>
                    <span   class="item-popup__qty-num"  id="ip-qty">1</span>
                    <button class="item-popup__qty-btn" id="ip-plus">+</button>
                </div>
            </div>
            <div class="item-popup__name" id="ip-name"></div>
            <div class="item-popup__desc" id="ip-desc-wrap" style="display:none">
                <span id="ip-desc-text"></span>
                <button class="item-popup__desc-toggle" id="ip-desc-toggle" style="display:none">... اقرأ المزيد</button>
            </div>
            <div class="item-popup__price-block" id="ip-price-block">
                <span class="item-popup__price-main" id="ip-price"></span>
                <span class="item-popup__price-old"  id="ip-price-old"  style="display:none"></span>
                <span class="item-popup__sale-pct"   id="ip-sale-pct"   style="display:none"></span>
            </div>
            <!-- Notes section — keyword chips only, visible for customizable types -->
            <div id="ip-notes-section" style="display:none;margin-top:14px;">
                <div style="font-size:0.68rem;font-weight:800;color:#9898a6;letter-spacing:0.8px;margin-bottom:10px;text-transform:uppercase;">اختر خصائص</div>
                <div id="ip-notes-chips" style="display:flex;flex-wrap:wrap;gap:8px;"></div>
                <div id="ip-notes-preview" style="font-size:0.72rem;color:#FF5C00;font-weight:700;min-height:18px;margin-top:8px;transition:opacity 0.2s;opacity:0;"></div>
            </div>
            <button class="item-popup__add-btn" id="ip-add-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
                </svg>
                أضف إلى السلة
            </button>
        </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(popup);

    document.getElementById('ip-close').addEventListener('click', closeItemPopup);
    document.getElementById('ip-minus').addEventListener('click', _ipDecrement);
    document.getElementById('ip-plus').addEventListener('click',  _ipIncrement);
    document.getElementById('ip-add-btn').addEventListener('click', _ipAddToCart);
}

let _ipItem     = null;
let _ipQty      = 1;
let _ipKwActive = new Set();
const DESC_LIMIT = 90;

async function openItemPopup(item, storeName) {
    _ensureItemPopup();

    const price    = parseFloat(item.price) || 0;
    const sale     = parseFloat(item.sale)  || 0;
    const hasSale  = sale > 0 && sale < price;
    const disp     = hasSale ? sale : price;
    const id       = item.ID || item.id || '';
    const pngExist = item.pngExist === '1' || item.pngExist === 1;
    const imgUrl   = pngExist ? `${GH_IMAGES}/${String(id).toLowerCase()}.png` : '';
    const desc     = (item.unitdesc || '').trim();
    const sType    = _currentStore ? _currentStore.type : '';

    _ipItem     = { item, storeName, price: disp, uniqueId: `${storeName}__${id}`, storeType: sType };
    _ipQty      = Math.max(1, _getItemQty(_ipItem.uniqueId)) || 1;
    _ipKwActive = new Set();

    // Image
    const imgEl      = document.getElementById('ip-img');
    const fallbackEl = document.getElementById('ip-img-fallback');
    if (pngExist && imgUrl) {
        imgEl.src = imgUrl; imgEl.alt = item.name || '';
        imgEl.style.display = 'block'; fallbackEl.style.display = 'none';
    } else {
        imgEl.style.display = 'none';
        fallbackEl.textContent = _typeEmoji(item.companytype);
        fallbackEl.style.display = 'flex';
    }

    // Sale badge
    const saleBadge = document.getElementById('ip-sale-hero');
    if (hasSale) { const pct = Math.round((1 - sale / price) * 100); saleBadge.textContent = `خصم ${pct}%`; saleBadge.style.display = 'inline-block'; }
    else { saleBadge.style.display = 'none'; }

    // Name
    document.getElementById('ip-name').textContent = item.name || '';

    // Description
    const descWrap   = document.getElementById('ip-desc-wrap');
    const descText   = document.getElementById('ip-desc-text');
    const descToggle = document.getElementById('ip-desc-toggle');
    if (desc) {
        descWrap.style.display = 'block';
        if (desc.length > DESC_LIMIT) {
            descText.textContent = desc.slice(0, DESC_LIMIT);
            descToggle.style.display = 'inline';
            descToggle.onclick = () => { descText.textContent = desc; descToggle.style.display = 'none'; };
        } else { descText.textContent = desc; descToggle.style.display = 'none'; }
    } else { descWrap.style.display = 'none'; }

    // Price
    document.getElementById('ip-price').textContent = formatPrice(disp);
    const oldEl = document.getElementById('ip-price-old');
    const pctEl = document.getElementById('ip-sale-pct');
    if (hasSale) {
        oldEl.textContent = formatPrice(price); oldEl.style.display = 'inline';
        const pct = Math.round((1 - sale / price) * 100);
        pctEl.textContent = `-${pct}%`; pctEl.style.display = 'inline-block';
    } else { oldEl.style.display = 'none'; pctEl.style.display = 'none'; }

    // Qty
    document.getElementById('ip-qty').textContent = _ipQty;

    // Notes section — show only for customizable types
    const notesSection = document.getElementById('ip-notes-section');
    const chipsEl      = document.getElementById('ip-notes-chips');
    // ip-notes-text removed (keyword-only mode)

    if (CUSTOMIZABLE_TYPES.includes(sType)) {
        notesSection.style.display = 'block';
        const keywords = await _fetchKeywords(sType);
        if (keywords.length > 0) {
            chipsEl.innerHTML = keywords.map(kw => `
                <button onclick="_ipToggleKw(this,'${kw.replace(/'/g,"\\'")}')"
                    style="padding:6px 13px;border:1.5px solid #e2e2e6;border-radius:50px;
                           font-size:0.75rem;font-weight:700;color:#555;background:#fff;
                           cursor:pointer;font-family:'Almarai',sans-serif;transition:all 0.15s;"
                    data-kw="${kw}">${kw}</button>
            `).join('');
        } else {
            chipsEl.innerHTML = '';
        }
    } else {
        notesSection.style.display = 'none';
        chipsEl.innerHTML = '';
    }

    _ipResetAddBtn();
    document.getElementById('item-popup-overlay').classList.add('active');
    document.getElementById('item-popup').classList.add('active');
    document.body.classList.add('modal-open');
}

function _ipToggleKw(btn, kw) {
    if (_ipKwActive.has(kw)) {
        _ipKwActive.delete(kw);
        btn.style.cssText = 'padding:6px 13px;border:1.5px solid #e2e2e6;border-radius:50px;font-size:0.75rem;font-weight:700;color:#555;background:#fff;cursor:pointer;font-family:Almarai,sans-serif;transition:all 0.15s;';
    } else {
        _ipKwActive.add(kw);
        btn.style.cssText = 'padding:6px 13px;border:1.5px solid #FF5C00;border-radius:50px;font-size:0.75rem;font-weight:700;color:#fff;background:#FF5C00;cursor:pointer;font-family:Almarai,sans-serif;box-shadow:0 2px 8px rgba(255,92,0,0.3);transition:all 0.15s;';
    }
    // Update preview line
    const preview = document.getElementById('ip-notes-preview');
    if (preview) {
        const sel = [..._ipKwActive];
        preview.textContent = sel.length ? sel.join(' • ') : '';
        preview.style.opacity = sel.length ? '1' : '0';
    }
}

function closeItemPopup() {
    const overlay = document.getElementById('item-popup-overlay');
    const popup   = document.getElementById('item-popup');
    if (overlay) overlay.classList.remove('active');
    if (popup)   popup.classList.remove('active');
    if (!document.getElementById('store-panel')?.classList.contains('active')) {
        document.body.classList.remove('modal-open');
    }
    _ipItem = null;
}

function _ipDecrement() { if (_ipQty > 1) { _ipQty--; document.getElementById('ip-qty').textContent = _ipQty; } }
function _ipIncrement() { _ipQty++; document.getElementById('ip-qty').textContent = _ipQty; }

function _ipAddToCart() {
    if (!_ipItem || !window.DelivoCart) return;
    const { uniqueId, item, storeName, price, storeType } = _ipItem;

    // Collect only keyword chip selections — no free text
    const notes = [..._ipKwActive].join('، ');

    const isCustomizable = CUSTOMIZABLE_TYPES.includes(storeType);

    if (isCustomizable) {
        // Each popup add = a brand new instance with its own notes
        for (let i = 0; i < _ipQty; i++) {
            const instanceId = uniqueId + '__i' + (Date.now() + i);
            window.DelivoCart.addItem(instanceId, item.name, price, storeName, storeType, notes);
        }
        _updatePanelQtyDisplay(uniqueId, storeName);
    } else {
        // Non-customizable: stack qty on single entry
        const current = _getItemQty(uniqueId);
        const diff    = _ipQty - current;
        if (diff > 0) {
            for (let i = 0; i < diff; i++) {
                window.DelivoCart.addItem(uniqueId, item.name, price, storeName, storeType, '');
            }
        } else if (diff < 0) {
            for (let i = 0; i < Math.abs(diff); i++) window.DelivoCart.decrementItem(uniqueId, storeName);
        } else {
            window.DelivoCart.addItem(uniqueId, item.name, price, storeName, storeType, '');
        }
    }

    // Sync store panel
    const slug    = _slugify(uniqueId);
    const itemEl  = document.getElementById(`sp-item-${slug}`);
    if (itemEl) {
        const actionsEl = itemEl.querySelector('.sp-item__actions');
        const newQty    = _getItemQty(uniqueId);
        if (actionsEl) {
            actionsEl.innerHTML = `
                <div class="sp-item__qty-control" id="sp-qty-ctrl-${slug}">
                    <button class="sp-item__qty-btn"
                            onclick="spChangeQty('${uniqueId}','${item.name}',${price},-1,'${storeName}','${storeType}')">−</button>
                    <span class="sp-item__qty-num" id="sp-qty-${slug}">${newQty}</span>
                    <button class="sp-item__qty-btn"
                            onclick="spChangeQty('${uniqueId}','${item.name}',${price},1,'${storeName}','${storeType}')">+</button>
                </div>`;
        }
    }

    _updateSpCartBar();
    if (window.renderCartSidebar) window.renderCartSidebar();

    const btn = document.getElementById('ip-add-btn');
    btn.classList.add('added');
    btn.textContent = '✓ تمت الإضافة';
    setTimeout(() => { _ipResetAddBtn(); btn.classList.remove('added'); closeItemPopup(); }, 900);
}

function _ipResetAddBtn() {
    const btn = document.getElementById('ip-add-btn');
    if (!btn) return;
    btn.classList.remove('added');
    btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
        </svg>
        أضف إلى السلة`;
}

window.openItemPopup  = openItemPopup;
window.closeItemPopup = closeItemPopup;
window._ipToggleKw    = _ipToggleKw;