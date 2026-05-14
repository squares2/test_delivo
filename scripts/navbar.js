/* ============================================================
   scripts/navbar.js
   ============================================================ */

function initNavbar() {
    const menuBtn    = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const navLinks   = document.getElementById('navbar-links');


    if (!menuBtn || !mobileMenu || !navLinks) {
        console.error('[Navbar] Missing elements. Check navbar.html IDs.');
        return; // ← stop, no retry
    }

    function checkNavFit() {
        const inner     = document.querySelector('.navbar__inner');
        const logoEl    = document.querySelector('.navbar__logo');
        const controlEl = document.querySelector('.navbar__controls');
        if (!inner || !logoEl || !controlEl) return;

        navLinks.classList.remove('hidden');
        menuBtn.classList.remove('visible');

        const innerW = inner.offsetWidth;
        const logoW  = logoEl.offsetWidth;
        const linksW = navLinks.offsetWidth;
        const ctrlW  = controlEl.offsetWidth;

        if (logoW + linksW + ctrlW + 150 > innerW) {
            navLinks.classList.add('hidden');
            menuBtn.classList.add('visible');
        }
    }

    checkNavFit();
    window.addEventListener('resize', checkNavFit);

    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = mobileMenu.classList.toggle('open');
        menuBtn.setAttribute('aria-expanded', isOpen);
    });

    document.addEventListener('click', (e) => {
        if (!mobileMenu.contains(e.target) && e.target !== menuBtn) {
            mobileMenu.classList.remove('open');
            menuBtn.setAttribute('aria-expanded', false);
        }
    });

    mobileMenu.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            mobileMenu.classList.remove('open');
            menuBtn.setAttribute('aria-expanded', false);
        });
    });

    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            document.querySelectorAll('.nav-link')
                .forEach(l => l.classList.remove('active'));
            document.querySelectorAll(
                `.nav-link[href="${link.getAttribute('href')}"]`
            ).forEach(l => l.classList.add('active'));
        });
    });

    updateCartBadge();
}

function updateCartBadge() {
    const badge = document.getElementById('cart-badge');
    if (!badge) return;
    const count = window.DelivoCart ? window.DelivoCart.getCount() : 0;
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
}