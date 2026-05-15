function initStores() {

    const scrollRows = document.querySelectorAll(
        '.categories__scroll, .stores__scroll, .offers__scroll'
    );

    scrollRows.forEach(row => {
        let isDown = false;
        let startX;
        let scrollLeft;
        let hasDragged = false;

        row.addEventListener('mousedown', (e) => {
            isDown = true;
            hasDragged = false;
            row.classList.add('dragging');
            startX = e.pageX - row.offsetLeft;
            scrollLeft = row.scrollLeft;
        });

        row.addEventListener('mouseleave', () => {
            isDown = false;
            hasDragged = false;
            row.classList.remove('dragging');
        });

        row.addEventListener('mouseup', () => {
            isDown = false;
            row.classList.remove('dragging');
        });

        row.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            const x = e.pageX - row.offsetLeft;
            if (Math.abs(x - startX) > 5) {
                hasDragged = true;
                e.preventDefault();
                row.scrollLeft = scrollLeft - (x - startX) * 1.5;
            }
        });

        row.addEventListener('click', (e) => {
            if (hasDragged) {
                e.preventDefault();
                e.stopPropagation();
                hasDragged = false;
            }
        }, true);

        let touchStartX, touchScrollLeft;
        row.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].pageX - row.offsetLeft;
            touchScrollLeft = row.scrollLeft;
        }, { passive: true });

        row.addEventListener('touchmove', (e) => {
            const x = e.touches[0].pageX - row.offsetLeft;
            row.scrollLeft = touchScrollLeft - (x - touchStartX) * 1.5;
        }, { passive: true });
    });

    const categoryBtns = document.querySelectorAll('[data-category]');
    const storeCards   = document.querySelectorAll('[data-store-type]');

    categoryBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const selected = btn.getAttribute('data-category');
            categoryBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            storeCards.forEach(card => {
                const type = card.getAttribute('data-store-type');
                card.style.display = (selected === 'all' || type === selected) ? '' : 'none';
            });
        });
    });

    storeCards.forEach(card => {
        card.addEventListener('click', () => {
            const storeId = card.getAttribute('data-store-id');
            if (storeId) console.log(`[Stores] Opening store: ${storeId}`);
        });
    });

    document.querySelectorAll('.store-card__wish').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            btn.classList.toggle('active');
        });
    });

    initOffersCarousel();
}

function initOffersCarousel() {
    const scroll = document.getElementById('offers-scroll');
    const dotsEl = document.getElementById('offers-dots');
    if (!scroll || !dotsEl) return;

    const cards = scroll.querySelectorAll('.offer-card');
    const total = cards.length;
    if (total === 0) return;

    let current   = 0;
    let autoTimer = null;
    const isPhone = () => window.innerWidth < 540;

    function buildDots() {
        dotsEl.innerHTML = '';
        if (!isPhone()) return;
        cards.forEach((_, i) => {
            const dot = document.createElement('span');
            dot.className = 'offers__dot' + (i === current ? ' active' : '');
            dot.addEventListener('click', () => goTo(i));
            dotsEl.appendChild(dot);
        });
    }

    function updateDots() {
        dotsEl.querySelectorAll('.offers__dot').forEach((d, i) => {
            d.classList.toggle('active', i === current);
        });
    }

    function goTo(index) {
        if (!isPhone()) return;
        current = (index + total) % total;
        const card    = cards[current];
        const padLeft = parseInt(getComputedStyle(scroll).paddingLeft) || 0;
        scroll.scrollTo({ left: card.offsetLeft - padLeft, behavior: 'smooth' });
        updateDots();
    }

    function next() { goTo(current + 1); }

    function startAuto() {
        stopAuto();
        if (!isPhone()) return;
        autoTimer = setInterval(next, 3000);
    }

    function stopAuto() {
        if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
    }

    scroll.addEventListener('touchstart', stopAuto, { passive: true });
    scroll.addEventListener('mousedown',  stopAuto);
    scroll.addEventListener('touchend',   () => setTimeout(startAuto, 4000), { passive: true });
    scroll.addEventListener('mouseup',    () => setTimeout(startAuto, 4000));

    scroll.addEventListener('scrollend', () => {
        if (!isPhone()) return;
        const center = scroll.scrollLeft + scroll.clientWidth / 2;
        let closest = 0, minDist = Infinity;
        cards.forEach((c, i) => {
            const dist = Math.abs(c.offsetLeft + c.offsetWidth / 2 - center);
            if (dist < minDist) { minDist = dist; closest = i; }
        });
        current = closest;
        updateDots();
    });

    window.addEventListener('resize', () => {
        buildDots();
        if (isPhone()) startAuto(); else stopAuto();
    });

    buildDots();
    startAuto();
}