/* ============================================================
   scripts/stores.js
   ============================================================ */

function initStores() {

    // --- Drag to scroll (categories + stores + offers) ---
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

        // Touch support
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

    // --- Category filter ---
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

    // --- Store card click ---
    storeCards.forEach(card => {
        card.addEventListener('click', () => {
            const storeId = card.getAttribute('data-store-id');
            if (storeId) console.log(`[Stores] Opening store: ${storeId}`);
        });
    });

    // --- Wishlist toggle ---
    document.querySelectorAll('.store-card__wish').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            btn.classList.toggle('active');
        });
    });
}