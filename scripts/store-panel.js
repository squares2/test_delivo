/* ============================================================
   scripts/store-panel.js
   Fetches store items from Firebase Realtime Database,
   renders a full-screen store menu panel.

   Firebase paths used:
     pattern/{CompanyType}         → store list (companyname, rank, soon)
     items/{companyname}/{itemID}  → items (name, price, sale, catmain, pngExist, ID)

   Images: https://raw.githubusercontent.com/squares2/delivery-plus/main/items/{ID}.png
   ============================================================ */

const RTDB_URL  = 'https://deliveryonline-300f7-default-rtdb.firebaseio.com';
const GH_IMAGES = './items';

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
    if (n < 1000) return '$' + n.toFixed(n % 1 === 0 ? 0 : 2);   // dollar
    return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + ' ألف ل.ل'; // Lebanese
}

/* ── Panel state ──────────────────────────────────────────── */
let _currentStore = null;   // { id, name, type }
let _activeTab    = null;
const _spCache    = {};     // pattern data cache

/* ── Open store panel ─────────────────────────────────────── */
/* ════════════════════════════════════════════════════════════
   STORE INTRO CARD
════════════════════════════════════════════════════════════ */

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

    const DURATION = 2200; // ms total intro time

    // ── Populate content ──────────────────────────────────────
    nameEl.textContent = storeName;
    catEl.textContent  = (_typeEmoji(storeType) || '') + '  ' + (_typeLabel(storeType) || storeType);

    // Rating
    const rank = storeMeta && storeMeta.rank ? parseFloat(storeMeta.rank) : null;
    if (rank) {
        ratingVal.textContent = rank.toFixed(1);
        ratingEl.style.display = 'flex';
    } else {
        ratingEl.style.display = 'none';
    }

    // Logo
    const logoPath = `assets/${storeId}.png`;
    logoImg.style.display  = 'none';
    logoEmoji.style.display = 'none';

    logoImg.onload = () => {
        logoImg.style.display   = 'block';
        logoEmoji.style.display = 'none';
    };
    logoImg.onerror = () => {
        logoImg.style.display   = 'none';
        logoEmoji.textContent   = _typeEmoji(storeType) || '🏪';
        logoEmoji.style.display = 'block';
    };
    logoImg.src = logoPath;

    // ── Show card ─────────────────────────────────────────────
    card.classList.remove('exit');
    card.style.display = 'flex';
    document.body.classList.add('modal-open');

    requestAnimationFrame(() => requestAnimationFrame(() => {
        card.classList.add('visible');
    }));

    // ── Progress bar ──────────────────────────────────────────
    progress.style.transition = 'none';
    progress.style.width = '0%';
    requestAnimationFrame(() => {
        progress.style.transition = `width ${DURATION}ms linear`;
        progress.style.width = '100%';
    });

    // ── Dot animation ─────────────────────────────────────────
    let dotIdx = 0;
    const dotTimer = setInterval(() => {
        dots.forEach(d => d.classList.remove('active'));
        dotIdx = (dotIdx + 1) % dots.length;
        dots[dotIdx].classList.add('active');
    }, DURATION / 4);

    // ── After duration: animate logo to hero, then open panel ─
    setTimeout(() => {
        clearInterval(dotTimer);

        // Get logo wrap current position (to animate FROM)
        const logoWrap  = document.getElementById('si-logo-wrap');
        const fromRect  = logoWrap.getBoundingClientRect();

        // Target: center of the store hero area (top of screen)
        const heroH    = Math.min(200, window.innerHeight * 0.28);
        const toX      = window.innerWidth / 2;
        const toY      = heroH / 2;
        const toScale  = 0.55; // shrinks to hero logo size

        // Animate logo wrap flying to hero
        const dX = toX - (fromRect.left + fromRect.width / 2);
        const dY = toY - (fromRect.top  + fromRect.height / 2);

        logoWrap.style.transition = 'transform 0.45s cubic-bezier(0.4,0,0.2,1), opacity 0.4s ease';
        logoWrap.style.transformOrigin = 'center center';
        logoWrap.style.transform = `translate(${dX}px, ${dY}px) scale(${toScale})`;
        logoWrap.style.opacity   = '0';

        // Fade out rest of intro
        nameEl.style.transition = 'opacity 0.25s ease';
        catEl.style.transition  = 'opacity 0.25s ease';
        nameEl.style.opacity    = '0';
        catEl.style.opacity     = '0';
        if (ratingEl) { ratingEl.style.transition = 'opacity 0.25s'; ratingEl.style.opacity = '0'; }

        card.classList.add('exit');

        setTimeout(() => {
            // Fully hide intro
            card.classList.remove('visible', 'exit');
            card.style.display = 'none';
            // Reset for next use
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
    // ── Fetch store meta for intro rating, then show intro ────
    const _introCacheKey = `pattern_${storeType}`;
    const _introFetch = _spCache[_introCacheKey]
        ? Promise.resolve(_spCache[_introCacheKey])
        : rtdbGet(`pattern/${storeType}`).then(d => { _spCache[_introCacheKey] = d; return d; });
    _introFetch
        .then(patternData => {
            let storeMeta = null;
            if (patternData && typeof patternData === 'object') {
                storeMeta = Object.values(patternData)
                    .find(s => s && s.companyname === storeName);
            }
            showStoreIntro(storeId, storeName, storeType, storeMeta, () => {
                _openStorePanelNow(storeId, storeName, storeType);
            });
        })
        .catch(() => {
            // If fetch fails, skip intro and open directly
            _openStorePanelNow(storeId, storeName, storeType);
        });
}

function _openStorePanelNow(storeId, storeName, storeType) {
    _currentStore = { id: storeId, name: storeName, type: storeType };

    const overlay = document.getElementById('store-panel-overlay');
    const panel   = document.getElementById('store-panel');
    if (!overlay || !panel) return;

    // Reset panel body
    document.getElementById('sp-hero-name').textContent = storeName;
    document.getElementById('sp-hero-meta').innerHTML   = '';
    document.getElementById('sp-tabs-inner').innerHTML  = '';
    document.getElementById('sp-body').innerHTML        = renderSkeleton();
    document.getElementById('sp-cart-bar').classList.remove('visible');

    // ── Store logo — circle badge + blurred background ─────────
    const logoImg      = document.getElementById('sp-hero-logo');
    const logoEmoji    = document.getElementById('sp-hero-logo-emoji');
    const bgImg        = document.getElementById('sp-hero-bg');
    const fallbackEl   = document.getElementById('sp-hero-fallback');
    const logoPath     = `assets/${storeId}.png`;
    const emojiDefault = _typeEmoji(storeType) || '🏪';

    // Reset
    if (logoImg)   { logoImg.style.display = 'none'; logoImg.src = ''; }
    if (logoEmoji) { logoEmoji.style.display = 'none'; logoEmoji.textContent = emojiDefault; }
    if (bgImg)     { bgImg.style.display = 'none'; bgImg.src = ''; }
    if (fallbackEl){ fallbackEl.style.display = 'none'; }

    if (logoImg) {
        logoImg.onload = () => {
            logoImg.style.display = 'block';
            if (logoEmoji) logoEmoji.style.display = 'none';
            // Use same image as blurred background
            if (bgImg) { bgImg.src = logoPath; bgImg.style.display = 'block'; }
            if (fallbackEl) fallbackEl.style.display = 'none';
        };
        logoImg.onerror = () => {
            logoImg.style.display = 'none';
            if (logoEmoji) { logoEmoji.textContent = emojiDefault; logoEmoji.style.display = 'flex'; }
            if (fallbackEl){ fallbackEl.textContent = emojiDefault; fallbackEl.style.display = 'flex'; }
        };
        logoImg.src = logoPath;
        logoImg.alt = storeName;
    }

    // Show
    overlay.classList.add('active');
    panel.classList.add('active');
    document.body.classList.add('modal-open');

    // Fetch (patternData already cached from intro fetch via _cache in categories.js)
    _loadStorePanel(storeName, storeType);
}

function closeStorePanel() {
    const overlay = document.getElementById('store-panel-overlay');
    const panel   = document.getElementById('store-panel');
    if (overlay) overlay.classList.remove('active');
    if (panel)   panel.classList.remove('active');
    document.body.classList.remove('modal-open');
    // Hide sub-cat wrap
    const wrap = document.getElementById('sp-subcat-wrap');
    if (wrap) { wrap.style.display = 'none'; wrap.innerHTML = ''; }
    _currentStore = null;
    _activeTab    = null;
}

/* ── Load & render ────────────────────────────────────────── */
async function _loadStorePanel(storeName, storeType) {
    const body = document.getElementById('sp-body');
    try {
        // 1. Fetch store meta from pattern (use cache if available from intro)
        const _cacheKey   = `pattern_${storeType}`;
        const patternData = _spCache[_cacheKey] || await rtdbGet(`pattern/${storeType}`);
        _spCache[_cacheKey] = patternData;
        let storeMeta = null;
        if (patternData && typeof patternData === 'object') {
            storeMeta = Object.values(patternData)
                .find(s => s && s.companyname === storeName);
        }

        // 2. Update hero badges
        const metaEl = document.getElementById('sp-hero-meta');
        const emoji  = STORE_TYPE_EMOJI[storeType] || '🏪';
        if (storeMeta) {
            metaEl.innerHTML = `
                <span class="sp-hero__badge">${emoji} ${_typeLabel(storeType)}</span>
                ${storeMeta.rank ? `<span class="sp-hero__badge sp-hero__badge--orange">⭐ ${storeMeta.rank}</span>` : ''}
                ${storeMeta.soon == '1' || storeMeta.soon === 1 ? '<span class="sp-hero__badge sp-hero__badge--soon">⏳ قريباً</span>' : ''}
            `;
            // Show "coming soon" if flagged
            if (storeMeta.soon == '1' || storeMeta.soon === 1) {
                body.innerHTML = `
                    <div class="sp-soon">
                        <div class="sp-soon__icon">🚧</div>
                        <div class="sp-soon__title">قريباً!</div>
                        <div class="sp-soon__sub">هذا المتجر سيكون متاحاً قريباً.<br>ترقّبوا العروض والأصناف الجديدة.</div>
                    </div>`;
                return;
            }
        }

        // 3. Fetch items
        const items = await rtdbGet(`items/${storeName}`);
        if (!items) {
            body.innerHTML = `<div class="sp-empty">
                <div class="sp-empty__icon">🛍️</div>
                <div class="sp-empty__title">لا توجد أصناف</div>
                <div class="sp-empty__sub">لم يتم إضافة منتجات لهذا المتجر بعد</div>
            </div>`;
            return;
        }

        // 4. Build two-level structure: catmain → { cat → [items] }
        const tree = {};   // { catmain: { cat: [items] } }
        Object.values(items).forEach(item => {
            if (!item || !item.name) return;
            const main = (item.catmain || 'عام').trim();
            const sub  = (item.cat    || 'عام').trim();
            if (!tree[main])       tree[main] = {};
            if (!tree[main][sub])  tree[main][sub] = [];
            tree[main][sub].push(item);
        });

        const mains = Object.keys(tree).sort();

        // 5. Build main-category tabs
        const tabsEl = document.getElementById('sp-tabs-inner');
        tabsEl.innerHTML = mains.map((main, i) => `
            <button class="sp-tab ${i === 0 ? 'active' : ''}"
                    data-cat="${main}"
                    onclick="spSelectMain('${main}')">
                ${main}
            </button>`).join('');

        // 6. Store tree globally for sub-tab switching
        window._spTree      = tree;
        window._spStoreName = storeName;

        // 7. Render first main category
        _renderMainSection(mains[0], tree, storeName, body);

        // 8. Observe sections for tab highlighting
        _initSectionObserver(mains);

        // 8. Update cart bar
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

/* ── Render one item card ─────────────────────────────────── */
function renderItem(item, storeName) {
    const id       = item.ID || item.id || '';
    const name     = item.name || '';
    const price    = parseFloat(item.price) || 0;
    const sale     = parseFloat(item.sale)  || 0;
    const hasSale  = sale > 0 && sale < price;
    const dispPrice = hasSale ? sale : price;
    const pngExist = item.pngExist === '1' || item.pngExist === 1;
    const imgUrl   = pngExist ? `${GH_IMAGES}/${String(id).toLowerCase()}.png` : '';
    const cartQty  = _getItemQty(`${storeName}__${id}`);
    const uniqueId = `${storeName}__${id}`;
    const sType    = _currentStore ? _currentStore.type : '';

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
        <div class="sp-item__actions">
            ${cartQty > 0 ? `
            <div class="sp-item__qty-control" id="sp-qty-ctrl-${_slugify(uniqueId)}">
                <button class="sp-item__qty-btn"
                        onclick="spChangeQty('${uniqueId}','${name}',${dispPrice},-1,'${storeName}','${sType}')">−</button>
                <span class="sp-item__qty-num" id="sp-qty-${_slugify(uniqueId)}">${cartQty}</span>
                <button class="sp-item__qty-btn"
                        onclick="spChangeQty('${uniqueId}','${name}',${dispPrice},1,'${storeName}','${sType}')">+</button>
            </div>` : `
            <button class="sp-item__add-btn" id="sp-add-btn-${_slugify(uniqueId)}"
                    onclick="spAddItem('${uniqueId}','${name}',${dispPrice},'${storeName}','${sType}')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2.5"
                     stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
            </button>`}
        </div>
    </div>`;
}

/* ── Cart interactions from store panel ───────────────────── */
function spAddItem(uniqueId, name, price, storeName, storeType) {
    if (!window.DelivoCart) return;
    window.DelivoCart.addItem(uniqueId, name, price, storeName, storeType);

    // Swap add button → qty control
    const slug     = _slugify(uniqueId);
    const addBtn   = document.getElementById(`sp-add-btn-${slug}`);
    const actionsEl = addBtn ? addBtn.parentElement : null;
    if (actionsEl) {
        actionsEl.innerHTML = `
            <div class="sp-item__qty-control" id="sp-qty-ctrl-${slug}">
                <button class="sp-item__qty-btn"
                        onclick="spChangeQty('${uniqueId}','${name}',${price},-1,'${storeName}')">−</button>
                <span class="sp-item__qty-num" id="sp-qty-${slug}">1</span>
                <button class="sp-item__qty-btn"
                        onclick="spChangeQty('${uniqueId}','${name}',${price},1,'${storeName}')">+</button>
            </div>`;
    }
    _updateSpCartBar();
    if (window.renderCartSidebar) window.renderCartSidebar();
}

function spChangeQty(uniqueId, name, price, delta, storeName, storeType) {
    if (!window.DelivoCart) return;
    const slug = _slugify(uniqueId);

    if (delta > 0) {
        window.DelivoCart.addItem(uniqueId, name, price, storeName, storeType);
    } else {
        window.DelivoCart.decrementItem(uniqueId, storeName);
    }

    const qty = _getItemQty(uniqueId);
    const actionsEl = document.getElementById(`sp-qty-ctrl-${slug}`)?.parentElement;

    if (qty <= 0 && actionsEl) {
        // Swap back to add button
        actionsEl.innerHTML = `
            <button class="sp-item__add-btn" id="sp-add-btn-${slug}"
                    onclick="spAddItem('${uniqueId}','${name}',${price},'${storeName}')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2.5"
                     stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
            </button>`;
    } else {
        const qtyEl = document.getElementById(`sp-qty-${slug}`);
        if (qtyEl) qtyEl.textContent = qty;
    }

    _updateSpCartBar();
    if (window.renderCartSidebar) window.renderCartSidebar();
}

function _updateSpCartBar() {
    const bar      = document.getElementById('sp-cart-bar');
    const countEl  = document.getElementById('sp-cart-count');
    const totalEl  = document.getElementById('sp-cart-total');
    if (!bar) return;
    const count = window.DelivoCart ? window.DelivoCart.getCount() : 0;
    // Total always in USD
    const totalUSD = window.DelivoCart ? window.DelivoCart.items.reduce((sum, item) => {
        const p = parseFloat(item.price) || 0;
        return sum + (p < 1000 ? p : p / 90000) * item.qty;
    }, 0) : 0;
    bar.classList.toggle('visible', count > 0);
    if (countEl) countEl.textContent = count + ' منتج';
    if (totalEl) totalEl.textContent = '$' + totalUSD.toFixed(2);
}

/* ══════════════════════════════════════════════════════════
   TWO-LEVEL NAVIGATION  catmain → cat → items
══════════════════════════════════════════════════════════ */

/* Called when user taps a main-category tab */
function spSelectMain(main) {
    const tree     = window._spTree;
    const storeName = window._spStoreName;
    const body     = document.getElementById('sp-body');
    if (!tree || !tree[main] || !body) return;

    // Highlight main tab
    _setActiveTab(main);

    // Re-render body for this main category
    _renderMainSection(main, tree, storeName, body);

    // Scroll body to top
    body.scrollTo({ top: 0, behavior: 'smooth' });
}

/* Called when user taps a sub-category chip */
function spSelectSub(slug) {
    _setActiveSub(slug);

    requestAnimationFrame(() => requestAnimationFrame(() => {
        const sec  = document.getElementById(`sp-subsec-${slug}`);
        if (!sec) return;
        const body = document.getElementById('sp-body');
        // Bar is now outside sp-body so no offset adjustment needed
        const target = sec.offsetTop - 2;

        // Clamp to valid scroll range
        const maxScroll = body.scrollHeight - body.clientHeight;
        const clamped = Math.max(0, Math.min(target, maxScroll));
        body.scrollTo({ top: clamped, behavior: 'smooth' });
    }));
}

/* Render all sub-sections for a given catmain */
function _renderMainSection(main, tree, storeName, body) {
    const subs = Object.keys(tree[main]).sort();
    const multiSub = subs.length > 1;

    // ── Render chips into the fixed wrap outside sp-body ──────
    const wrap = document.getElementById('sp-subcat-wrap');
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

    // ── Render item sections into sp-body (no chips bar here) ─
    body.innerHTML = subs.map(sub => `
        <div class="sp-section" id="sp-subsec-${_slugify(sub)}" data-slug="${_slugify(sub)}" data-sub="${sub}">
            ${multiSub ? `<div class="sp-section__title sp-section__title--sub">${sub}</div>` : ''}
            <div class="sp-items">
                ${tree[main][sub].map(item => renderItem(item, storeName)).join('')}
            </div>
        </div>`).join('');

    // Observe sub-sections for chip auto-highlight on scroll
    if (multiSub) _initSubObserver(subs);

    _updateSpCartBar();
}

/* Observe sub-sections to auto-highlight chips on scroll */
function _initSubObserver(subs) {
    const body = document.getElementById('sp-body');
    if (!body || !('IntersectionObserver' in window)) return;

    // Disconnect previous observer if any
    if (window._spSubObserver) window._spSubObserver.disconnect();

    window._spSubObserver = new IntersectionObserver((entries) => {
        entries.forEach(e => {
            if (e.isIntersecting) _setActiveSub(e.target.dataset.slug);
        });
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

/* ── Main-tab scroll sync (unchanged, uses catmain) ───────── */
function spScrollToSection(cat) {
    spSelectMain(cat);
}

function _initSectionObserver(mains) {
    // Main tabs are switched via click (spSelectMain), not scroll
    // so no IntersectionObserver needed at this level
}

function _setActiveTab(cat) {
    document.querySelectorAll('.sp-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.cat === cat);
    });
    const activeTab = document.querySelector(`.sp-tab[data-cat="${cat}"]`);
    if (activeTab) activeTab.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
    _activeTab = cat;
}

/* ── Skeleton ─────────────────────────────────────────────── */
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
function _slugify(s) {
    return String(s).replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '_');
}
function _getItemQty(id) {
    if (!window.DelivoCart) return 0;
    const item = window.DelivoCart.items.find(i => i.id === id);
    return item ? item.qty : 0;
}
function _typeLabel(t) {
    const map = {
        Restaurants  : 'مطاعم',
        CoffeeShops  : 'قهوة',
        Markets      : 'سوبرماركت',
        SweetsShops  : 'حلويات',
        ButcherShops : 'ملاحم',
        FishShops    : 'أسماك',
        BakeryShops  : 'مخابز',
    };
    return map[t] || t;
}
function _typeEmoji(t) {
    const map = {
        Restaurants  : '🍔',
        CoffeeShops  : '☕',
        Markets      : '🛒',
        SweetsShops  : '🍰',
        ButcherShops : '🥩',
        FishShops    : '🐟',
        BakeryShops  : '🥖',
    };
    return map[t] || '🏪';
}

/* ── Init ─────────────────────────────────────────────────── */
function initStorePanel() {
    // Close on backdrop click
    const overlay = document.getElementById('store-panel-overlay');
    if (overlay) overlay.addEventListener('click', closeStorePanel);

    // Back button
    const backBtn = document.getElementById('sp-back-btn');
    if (backBtn) backBtn.addEventListener('click', closeStorePanel);

    // Cart bar button → open cart sidebar
    const cartBarBtn = document.getElementById('sp-cart-bar-btn');
    if (cartBarBtn) cartBarBtn.addEventListener('click', () => {
        closeStorePanel();
        setTimeout(() => openCartSidebar(), 180);
    });

    // Escape key
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeStorePanel();
    });

    // Wire up existing store cards in HTML
    document.querySelectorAll('[data-store-id]').forEach(card => {
        card.addEventListener('click', () => {
            const storeId   = card.dataset.storeId;
            const storeType = card.dataset.storeType || 'Restaurants';
            // Map HTML data-store-id to Firebase companyname
            const nameMap = {
                'classic-food'    : 'Classic-Food',
                'king-pizza'      : 'King-Pizza',
                'zahret-lobnan'   : 'Zahret-Lobnan',
                'burger-house'    : 'AL-Beik',
                'store-burger'    : 'AL-Beik',
                'al-beik'         : 'AL-Beik',
                'al-fajr'         : 'AL-Fajr',
                'al-amana'        : 'Al-Amana',
                'assaf-grocery'   : 'Assaf-Grocery',
                'bhalib'          : 'Bhalib',
                'foodigo'         : 'Foodigo',
                'hellani-kitchen' : 'Hellani-Kitchen',
                'minini'          : 'Minini',
            };
            const fireName = nameMap[storeId] || _toFirebaseName(storeId);
            const typeMap  = {
                restaurants  : 'Restaurants',
                coffee       : 'CoffeeShops',
                supermarket  : 'Markets',
                sweets       : 'SweetsShops',
                meat         : 'ButcherShops',
                fish         : 'FishShops',
                bakery       : 'BakeryShops',
            };
            const fireType = typeMap[storeType] || 'Restaurants';
            openStorePanel(storeId, fireName, fireType);
        });
    });

    // Expose for cart sidebar to call
    window.openStorePanel   = openStorePanel;
    window.spSelectMain     = spSelectMain;
    window.spSelectSub      = spSelectSub;
    window.closeStorePanel  = closeStorePanel;
    window.spAddItem        = spAddItem;
    window.spChangeQty      = spChangeQty;
    window.spScrollToSection = spScrollToSection;
    window.updateSpCartBar  = _updateSpCartBar;
}

function _toFirebaseName(id) {
    // Convert kebab-case store IDs to Firebase name format
    return id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('-');
}

/* ════════════════════════════════════════════════════════════
   ITEM DETAIL POPUP
════════════════════════════════════════════════════════════ */

/* ── Inject popup shell once ──────────────────────────────── */
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
        <!-- Orange hero -->
        <div class="item-popup__hero" id="ip-hero">
            <button class="item-popup__close" id="ip-close" aria-label="رجوع">
                <svg viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="15 18 9 12 15 6"/>
                </svg>
            </button>
            <span class="item-popup__sale-hero" id="ip-sale-hero" style="display:none"></span>
            <!-- Image sits here, absolute positioned to overflow onto white card -->
            <div class="item-popup__img-wrap" id="ip-img-wrap">
                <img id="ip-img" src="" alt=""
                     onerror="this.style.display='none';document.getElementById('ip-img-fallback').style.display='flex'">
                <div class="item-popup__img-fallback" id="ip-img-fallback" style="display:none"></div>
            </div>
        </div>

        <!-- White rounded card -->
        <div class="item-popup__body" id="ip-body">

            <!-- Qty stepper -->
            <div class="item-popup__qty-row">
                <div class="item-popup__qty-pill">
                    <button class="item-popup__qty-btn" id="ip-minus">&#8722;</button>
                    <span   class="item-popup__qty-num"  id="ip-qty">1</span>
                    <button class="item-popup__qty-btn" id="ip-plus">+</button>
                </div>
            </div>

            <!-- Name -->
            <div class="item-popup__name" id="ip-name"></div>

            <!-- Description -->
            <div class="item-popup__desc" id="ip-desc-wrap" style="display:none">
                <span id="ip-desc-text"></span>
                <button class="item-popup__desc-toggle" id="ip-desc-toggle" style="display:none">... اقرأ المزيد</button>
            </div>

            <!-- Price -->
            <div class="item-popup__price-block" id="ip-price-block">
                <span class="item-popup__price-main" id="ip-price"></span>
                <span class="item-popup__price-old"  id="ip-price-old"  style="display:none"></span>
                <span class="item-popup__sale-pct"   id="ip-sale-pct"   style="display:none"></span>
            </div>

            <!-- Add to cart -->
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

/* ── Popup state ──────────────────────────────────────────── */
let _ipItem = null;   // current item data
let _ipQty  = 1;
const DESC_LIMIT = 90; // chars before "read more"

/* ── Open ─────────────────────────────────────────────────── */
function openItemPopup(item, storeName) {
    _ensureItemPopup();

    const price   = parseFloat(item.price) || 0;
    const sale    = parseFloat(item.sale)  || 0;
    const hasSale = sale > 0 && sale < price;
    const disp    = hasSale ? sale : price;
    const id      = item.ID || item.id || '';
    const pngExist = item.pngExist === '1' || item.pngExist === 1;
    const imgUrl  = pngExist ? `${GH_IMAGES}/${String(id).toLowerCase()}.png` : '';
    const desc    = (item.unitdesc || '').trim();

    _ipItem = { item, storeName, price: disp, uniqueId: `${storeName}__${id}` };
    _ipQty  = Math.max(1, _getItemQty(_ipItem.uniqueId)) || 1;

    /* image */
    const imgEl      = document.getElementById('ip-img');
    const fallbackEl = document.getElementById('ip-img-fallback');
    if (pngExist && imgUrl) {
        imgEl.src = imgUrl;
        imgEl.alt = item.name || '';
        imgEl.style.display = 'block';
        fallbackEl.style.display = 'none';
    } else {
        imgEl.style.display = 'none';
        fallbackEl.textContent = _typeEmoji(item.companytype);
        fallbackEl.style.display = 'flex';
    }

    /* sale badge on hero */
    const saleBadge = document.getElementById('ip-sale-hero');
    if (hasSale) {
        const pct = Math.round((1 - sale / price) * 100);
        saleBadge.textContent = `خصم ${pct}%`;
        saleBadge.style.display = 'inline-block';
    } else {
        saleBadge.style.display = 'none';
    }

    /* name */
    document.getElementById('ip-name').textContent = item.name || '';

    /* description */
    const descWrap   = document.getElementById('ip-desc-wrap');
    const descText   = document.getElementById('ip-desc-text');
    const descToggle = document.getElementById('ip-desc-toggle');
    if (desc) {
        descWrap.style.display = 'block';
        if (desc.length > DESC_LIMIT) {
            descText.textContent = desc.slice(0, DESC_LIMIT);
            descToggle.style.display = 'inline';
            descToggle.onclick = () => {
                descText.textContent = desc;
                descToggle.style.display = 'none';
            };
        } else {
            descText.textContent = desc;
            descToggle.style.display = 'none';
        }
    } else {
        descWrap.style.display = 'none';
    }

    /* price */
    document.getElementById('ip-price').textContent = formatPrice(disp);
    const oldEl = document.getElementById('ip-price-old');
    const pctEl = document.getElementById('ip-sale-pct');
    if (hasSale) {
        oldEl.textContent = formatPrice(price);
        oldEl.style.display = 'inline';
        const pct = Math.round((1 - sale / price) * 100);
        pctEl.textContent = `-${pct}%`;
        pctEl.style.display = 'inline-block';
    } else {
        oldEl.style.display = 'none';
        pctEl.style.display = 'none';
    }

    /* qty */
    document.getElementById('ip-qty').textContent = _ipQty;

    /* reset add button */
    _ipResetAddBtn();

    /* show */
    document.getElementById('item-popup-overlay').classList.add('active');
    document.getElementById('item-popup').classList.add('active');
    document.body.classList.add('modal-open');
}

/* ── Close ────────────────────────────────────────────────── */
function closeItemPopup() {
    const overlay = document.getElementById('item-popup-overlay');
    const popup   = document.getElementById('item-popup');
    if (overlay) overlay.classList.remove('active');
    if (popup)   popup.classList.remove('active');
    // don't remove modal-open if store panel is still open
    if (!document.getElementById('store-panel')?.classList.contains('active')) {
        document.body.classList.remove('modal-open');
    }
    _ipItem = null;
}

/* ── Qty controls ─────────────────────────────────────────── */
function _ipDecrement() {
    if (_ipQty > 1) {
        _ipQty--;
        document.getElementById('ip-qty').textContent = _ipQty;
    }
}
function _ipIncrement() {
    _ipQty++;
    document.getElementById('ip-qty').textContent = _ipQty;
}

/* ── Add to cart ──────────────────────────────────────────── */
function _ipAddToCart() {
    if (!_ipItem || !window.DelivoCart) return;
    const { uniqueId, item, storeName, price } = _ipItem;
    const sType = _currentStore ? _currentStore.type : '';

    // Add _ipQty times (or set qty directly if possible)
    const current = _getItemQty(uniqueId);
    const diff = _ipQty - current;
    if (diff > 0) {
        for (let i = 0; i < diff; i++) {
            window.DelivoCart.addItem(uniqueId, item.name, price, storeName, sType);
        }
    } else if (diff < 0) {
        for (let i = 0; i < Math.abs(diff); i++) {
            window.DelivoCart.decrementItem(uniqueId, storeName);
        }
    } else {
        // qty unchanged — still confirm add of at least 1
        window.DelivoCart.addItem(uniqueId, item.name, price, storeName, sType);
    }

    // Update store panel qty control if visible
    const slug = _slugify(uniqueId);
    const itemEl = document.getElementById(`sp-item-${slug}`);
    if (itemEl) {
        const actionsEl = itemEl.querySelector('.sp-item__actions');
        const newQty    = _getItemQty(uniqueId);
        if (actionsEl) {
            actionsEl.innerHTML = `
                <div class="sp-item__qty-control" id="sp-qty-ctrl-${slug}">
                    <button class="sp-item__qty-btn"
                            onclick="spChangeQty('${uniqueId}','${item.name}',${price},-1,'${storeName}','${sType}')">−</button>
                    <span class="sp-item__qty-num" id="sp-qty-${slug}">${newQty}</span>
                    <button class="sp-item__qty-btn"
                            onclick="spChangeQty('${uniqueId}','${item.name}',${price},1,'${storeName}','${sType}')">+</button>
                </div>`;
        }
    }

    _updateSpCartBar();
    if (window.renderCartSidebar) window.renderCartSidebar();

    /* flash green */
    const btn = document.getElementById('ip-add-btn');
    btn.classList.add('added');
    btn.textContent = '✓ تمت الإضافة';
    setTimeout(() => {
        _ipResetAddBtn();
        btn.classList.remove('added');
        closeItemPopup();
    }, 900);
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

/* expose */
window.openItemPopup  = openItemPopup;
window.closeItemPopup = closeItemPopup;