import { defineStore } from 'pinia';
import axios from 'axios';
import { useAuthStore } from './authStore.js';
import { API_URL } from '@/services/apiClient.js';
import { getUserCurrency } from '@/utils/currency.js';

export const useEventStore = defineStore('events', {
  state: () => ({
    items: [],
    loading: false,
    error: null,
    page: 1,
    limit: 6,
    total: 0,
    totalPages: 1,
  }),

  actions: {
    async fetchAll({ page = this.page, limit = this.limit } = {}) {
      this.loading = true;
      this.error = null;
      try {
        const envBase = import.meta.env.VITE_API_URL;
        const base = envBase
          ? API_URL
          : '/api';
        const authStore = useAuthStore();
        const preferredCurrency = getUserCurrency(authStore?.user?.value);
        const params = { page, limit };
        if (preferredCurrency) {
          params.currency = preferredCurrency;
        }

        const { data } = await axios.get(`${base}/events`, {
          params,
        });
        const list = Array.isArray(data?.events)
          ? data.events
          : data?.items || data?.data || [];
        this.items = list;

        this.page = Number(data?.page ?? page);
        this.limit = Number(data?.limit ?? limit);
        this.total = Number(data?.total ?? this.items.length);
        this.totalPages = Number(
          data?.totalPages ?? Math.max(1, Math.ceil(this.total / this.limit))
        );

        return this.items;
      } catch (e) {
        this.error =
          e?.response?.data?.message || e?.message || 'Erreur de chargement';
        throw e;
      } finally {
        this.loading = false;
      }
    },

    setPage(p) {
      if (p < 1 || p > this.totalPages) return;
      this.page = p;
      return this.fetchAll({ page: this.page, limit: this.limit });
    },
    nextPage() {
      if (this.page < this.totalPages) return this.setPage(this.page + 1);
    },
    prevPage() {
      if (this.page > 1) return this.setPage(this.page - 1);
    },
    setLimit(n) {
      if (!Number.isFinite(n) || n <= 0) return;
      this.limit = n;
      this.page = 1;
      return this.fetchAll({ page: 1, limit: n });
    },
  },
});
