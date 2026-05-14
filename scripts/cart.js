/* ============================================================
   scripts/cart.js
   Handles: cart state, add/remove items, badge update, persistence
   Exposes: window.DelivoCart for use by other scripts
   ============================================================ */

function initCart() {
    window.DelivoCart = {
        items: JSON.parse(localStorage.getItem('delivo_cart') || '[]'),

        getCount() {
            return this.items.reduce((sum, item) => sum + item.qty, 0);
        },

        addItem(id, name, price) {
            const existing = this.items.find(i => i.id === id);
            if (existing) {
                existing.qty++;
            } else {
                this.items.push({ id, name, price, qty: 1 });
            }
            this.save();
            this.updateBadge();
        },

        removeItem(id) {
            this.items = this.items.filter(i => i.id !== id);
            this.save();
            this.updateBadge();
        },

        clear() {
            this.items = [];
            this.save();
            this.updateBadge();
        },

        save() {
            localStorage.setItem('delivo_cart', JSON.stringify(this.items));
        },

        updateBadge() {
            const badge = document.getElementById('cart-badge');
            if (!badge) return;
            const count = this.getCount();
            badge.textContent = count;
            badge.style.display = count > 0 ? 'flex' : 'none';
        }
    };

    // Sync badge on load
    window.DelivoCart.updateBadge();
}
