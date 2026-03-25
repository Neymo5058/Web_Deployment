import { defineStore } from 'pinia';

export const useCartStore = defineStore('cart', {
  state: () => ({
    items: [],
  }),

  getters: {
    totalPrice: (state) =>
      state.items.reduce(
        (sum, i) => sum + Number(i.price) * Number(i.quantity),
        0
      ),
    totalItems: (state) =>
      state.items.reduce((sum, i) => sum + Number(i.quantity), 0),
    getItemById: (state) => (id) => state.items.find((i) => i.id === id),
    subtotalById: (state) => (id) => {
      const it = state.items.find((i) => i.id === id);
      return it ? Number(it.price) * Number(it.quantity) : 0;
    },
  },

  actions: {
    add(item) {
      const existing = this.items.find((i) => i.id === item.id);
      const qty = Number(item.quantity ?? 1);
      if (existing) {
        existing.quantity = Number(existing.quantity) + qty;
      } else {
        this.items.push({ ...item, quantity: qty });
      }
    },
    setQuantity(id, quantity) {
      const it = this.items.find((i) => i.id === id);
      if (!it) return;
      const q = Math.max(0, Number(quantity));
      if (q === 0) {
        this.remove(id);
      } else {
        it.quantity = q;
      }
    },
    increment(id, step = 1) {
      const it = this.items.find((i) => i.id === id);
      if (it) it.quantity = Number(it.quantity) + Number(step);
    },
    decrement(id, step = 1) {
      const it = this.items.find((i) => i.id === id);
      if (it) {
        const next = Number(it.quantity) - Number(step);
        if (next <= 0) this.remove(id);
        else it.quantity = next;
      }
    },
    remove(id) {
      this.items = this.items.filter((i) => i.id !== id);
    },
    clear() {
      this.items = [];
    },
  },
});
