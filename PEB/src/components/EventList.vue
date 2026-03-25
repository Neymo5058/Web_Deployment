<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/services/apiClient.js';
import Spinner from './Spinner.vue';
import Pagination from '@/components/Pagination.vue';
import SearchBar from '@/components/SearchBar.vue';
import Sort from '@/components/Sort.vue';
import { useAuthStore } from '@/stores/authStore.js';
import { storeToRefs } from 'pinia';
import {
  DEFAULT_CURRENCY,
  formatCurrency,
  getUserCurrency,
  resolveCurrencyCode,
} from '@/utils/currency.js';
import { resolveApiError } from '@/utils/errorHandling.js';
const { t, locale } = useI18n();

const events = ref([]);
const isLoading = ref(false);
const errorMessage = ref('');
// pagination
const page = ref(1);
const limit = ref(6);
const totalPages = ref(1);
// Sort & search
const sortOption = ref('dateAsc');
const searchTerm = ref('');
const lastSearchTerm = ref('');
const authStore = useAuthStore();
const { user, isAuthenticated } = storeToRefs(authStore);
const preferredCurrency = computed(
  () => getUserCurrency(user.value) || DEFAULT_CURRENCY
);
const numberLocale = computed(() =>
  locale.value === 'fr' ? 'fr-CA' : 'en-CA'
);
const dateLocale = computed(() => (locale.value === 'fr' ? 'fr-CA' : 'en-CA'));
const canAccessOrganizerDashboard = computed(() => {
  if (!isAuthenticated.value) {
    return false;
  }

  const role = user.value?.role;
  return role === 'organizer' || role === 'admin';
});

const sortParam = computed(() => {
  switch (sortOption.value) {
    case 'dateAsc':
      return 'startsAt:asc';
    case 'dateDesc':
      return 'startsAt:desc';
    case 'priceAsc':
      return 'price:asc';
    case 'priceDesc':
      return 'price:desc';
    case 'capacityAsc':
      return 'capacity:asc';
    case 'capacityDesc':
      return 'capacity:desc';
    default:
      return 'startsAt:asc';
  }
});

async function fetchEvents() {
  isLoading.value = true;
  errorMessage.value = '';
  try {
    const params = { page: page.value, limit: limit.value };
    if (preferredCurrency.value) {
      params.currency = preferredCurrency.value;
    }
    if (sortParam.value) {
      params.sort = sortParam.value;
    }
    const normalizedSearch = searchTerm.value.trim();
    if (normalizedSearch) {
      params.search = normalizedSearch;
    }

    const { data } = await apiClient.get('/events', { params });

    events.value = Array.isArray(data?.events) ? data.events : [];

    const pagination = data?.pagination ?? {};
    const receivedTotalPages = pagination.totalPages;
    const receivedPage = pagination.page;

    if (typeof receivedTotalPages === 'number') {
      totalPages.value = Math.max(1, receivedTotalPages);
    } else if (typeof data?.totalPages === 'number') {
      totalPages.value = Math.max(1, data.totalPages);
    } else if (typeof data?.total === 'number') {
      totalPages.value = Math.max(1, Math.ceil(data.total / limit.value));
    } else {
      totalPages.value = 1;
    }

    if (typeof receivedPage === 'number' && receivedPage >= 1) {
      page.value = receivedPage;
    }
    lastSearchTerm.value = normalizedSearch;
  } catch (err) {
    const { type, message } = resolveApiError(err);

    if (type === 'timeout') {
      errorMessage.value = t('event.errorTimeout');
    } else if (type === 'message' && message) {
      errorMessage.value = t('event.errorWithMessage', { message });
    } else {
      errorMessage.value = t('event.errorGeneric');
    }
    events.value = [];
  } finally {
    isLoading.value = false;
  }
}

function onChangePage(newPage) {
  if (newPage === page.value || newPage < 1 || newPage > totalPages.value)
    return;
  page.value = newPage;
  fetchEvents().then(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

onMounted(fetchEvents);

watch(sortOption, () => {
  page.value = 1;
  fetchEvents();
});

watch(preferredCurrency, () => {
  page.value = 1;
  fetchEvents();
});

const toDateValue = (value) => {
  const date = new Date(value);
  const timestamp = date.getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const extractPricing = (event) => {
  if (!event || typeof event !== 'object') {
    return { amount: 0, currency: preferredCurrency.value };
  }

  const pricing = event.pricing;

  if (pricing && Number.isFinite(pricing.amount)) {
    return {
      amount: Number(pricing.amount),
      currency:
        pricing.currency ||
        pricing.original?.currency ||
        event.currency ||
        preferredCurrency.value ||
        DEFAULT_CURRENCY,
    };
  }

  if (pricing?.original && Number.isFinite(pricing.original.amount)) {
    return {
      amount: Number(pricing.original.amount),
      currency:
        pricing.original.currency ||
        pricing.currency ||
        event.currency ||
        preferredCurrency.value ||
        DEFAULT_CURRENCY,
    };
  }

  return {
    amount: Number(event.price) || 0,
    currency: event.currency || preferredCurrency.value || DEFAULT_CURRENCY,
  };
};

const sortedEvents = computed(() => {
  const list = [...events.value];
  switch (sortOption.value) {
    case 'dateAsc':
      return list.sort(
        (a, b) => toDateValue(a?.startsAt) - toDateValue(b?.startsAt)
      );
    case 'dateDesc':
      return list.sort(
        (a, b) => toDateValue(b?.startsAt) - toDateValue(a?.startsAt)
      );
    case 'priceAsc':
      return list.sort(
        (a, b) => extractPricing(a).amount - extractPricing(b).amount
      );
    case 'priceDesc':
      return list.sort(
        (a, b) => extractPricing(b).amount - extractPricing(a).amount
      );
    case 'capacityAsc':
      return list.sort((a, b) => (a?.capacity ?? 0) - (b?.capacity ?? 0));
    case 'capacityDesc':
      return list.sort((a, b) => (b?.capacity ?? 0) - (a?.capacity ?? 0));
    default:
      return list;
  }
});

const hasEvents = computed(() => sortedEvents.value.length > 0);

const onSearch = (value) => {
  const normalized = (value ?? '').trim();
  if (value !== searchTerm.value) {
    searchTerm.value = value ?? '';
  }
  if (normalized === lastSearchTerm.value && page.value === 1) {
    return;
  }
  page.value = 1;
  fetchEvents();
};

const eventLink = (event) => {
  if (!event) return '/events';

  const identifier = event.slug || event.id || event._id;
  return identifier ? `/events/${identifier}` : '/events';
};

const imageForEvent = (event) => event?.imageUrl;

const imageAltForEvent = (event) => {
  if (event?.imageAlt) return event.imageAlt;
  if (event?.title) return t('event.imageAlt', { title: event.title });
  return t('event.imageAltFallback');
};

const formatDate = (date) => {
  if (!date) return '';

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return '';

  return parsedDate.toLocaleDateString(dateLocale.value, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const formatPlace = (event) => {
  const place = event?.place;
  if (!place || typeof place !== 'object') return '';

  return [place.name, place.city].filter(Boolean).join(', ');
};

const formatCapacity = (event) => {
  const available =
    typeof event?.available === 'number' ? event.available : null;
  const capacity = typeof event?.capacity === 'number' ? event.capacity : null;

  if (available !== null && capacity !== null) {
    if (available <= 0) return t('event.soldOut');
    const variant = available === 1 ? 'one' : 'other';
    return t(`event.availableOfCapacity.${variant}`, {
      available,
      capacity,
    });
  }

  const value = available ?? capacity;
  if (typeof value !== 'number') return '';
  if (value <= 0) return t('event.soldOut');

  const variant = value === 1 ? 'one' : 'other';
  return t(`event.availableSimple.${variant}`, { count: value });
};

const formatPrice = (event) => {
  const pricing = extractPricing(event);
  const price = Number(pricing.amount);

  if (!Number.isFinite(price)) return '';

  const currencyCode = resolveCurrencyCode(
    pricing.currency || preferredCurrency.value || DEFAULT_CURRENCY,
    DEFAULT_CURRENCY
  );

  return formatCurrency(price, {
    currency: currencyCode,
    locale: numberLocale.value,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};
</script>

<template>
  <section class="events-section">
    <div class="events-container">
      <div class="events-header">
        <h1 class="events-title">{{ t('event.popularSectionTitle') }}</h1>
        <RouterLink
          v-if="canAccessOrganizerDashboard"
          :to="{ name: 'organizer-dashboard' }"
          class="events-dashboard-btn"
        >
          {{ t('event.viewOrganizerDashboard') }}
        </RouterLink>
      </div>
      <div class="filters-bar">
        <SearchBar v-model="searchTerm" @search="onSearch" />
        <Sort v-model="sortOption" />
      </div>
      <Spinner v-if="isLoading" />
      <p v-else-if="errorMessage" class="events-status events-status--error">
        {{ errorMessage }}
      </p>
      <p v-else-if="!hasEvents" class="events-status">
        {{ t('event.none') }}
      </p>

      <div v-else class="events-grid">
        <router-link
          v-for="eventItem in sortedEvents"
          :key="eventItem.id || eventItem._id"
          class="event-card"
          :to="eventLink(eventItem)"
        >
          <img
            class="event-img"
            :src="imageForEvent(eventItem)"
            :alt="imageAltForEvent(eventItem)"
            loading="lazy"
          />
          <div class="event-details">
            <h2 class="event-title">
              <strong>{{ eventItem.title }}</strong>
            </h2>
            <p v-if="eventItem.subtitle" class="event-subtitle">
              {{ eventItem.subtitle }}
            </p>

            <div class="event-meta">
              <p v-if="eventItem.startsAt || eventItem.hour">
                <ion-icon name="calendar-clear-outline"></ion-icon>
                {{ formatDate(eventItem.startsAt)
                }}<template v-if="eventItem.hour">
                  – {{ eventItem.hour }}</template
                >
              </p>
              <p v-if="formatPlace(eventItem)">
                <ion-icon name="location-outline"></ion-icon>
                {{ formatPlace(eventItem) }}
              </p>
              <p v-if="formatCapacity(eventItem)">
                <ion-icon name="people-outline"></ion-icon>
                {{ formatCapacity(eventItem) }}
              </p>
            </div>

            <p v-if="formatPrice(eventItem)" class="event-price">
              {{ t('event.priceFrom') }} {{ formatPrice(eventItem) }}
            </p>
          </div>
        </router-link>
      </div>
    </div>
    <Pagination
      v-if="totalPages > 1"
      :current-page="page"
      :total-pages="totalPages"
      @change-page="onChangePage"
    />
  </section>
</template>

<style scoped>
.events-section {
  background: linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%);
  padding: clamp(2rem, 5vw, 3.5rem) 0;
}

.events-container {
  width: min(1100px, 92%);
  margin: 0 auto;
}

.events-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.events-title {
  margin: 0;
  font-size: clamp(1.75rem, 2.5vw, 2.25rem);
  font-weight: 700;
  color: #1f2937;
}

.events-dashboard-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 1.25rem;
  border-radius: 9999px;
  background: #1d4ed8;
  color: #fff;
  font-weight: 600;
  text-decoration: none;
  transition: background-color 0.2s ease, transform 0.2s ease,
    box-shadow 0.2s ease;
  box-shadow: 0 10px 24px rgba(29, 78, 216, 0.25);
}

.events-dashboard-btn:hover,
.events-dashboard-btn:focus-visible {
  background: #1e40af;
  transform: translateY(-1px);
}

.events-dashboard-btn:focus-visible {
  outline: 3px solid rgba(59, 130, 246, 0.5);
  outline-offset: 2px;
}

.events-status {
  text-align: center;
  color: #495057;
  font-size: 1rem;
}

.events-status--error {
  color: #c92a2a;
}

.events-grid {
  display: grid;
  gap: 1.5rem;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
}

.event-card {
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 15px 35px rgba(15, 23, 42, 0.08);
  text-align: left;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  color: inherit;
  text-decoration: none;
}

.event-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.12);
  transform: scale(1.05);
}

.event-img {
  width: 100%;
  aspect-ratio: 16 / 10;
  object-fit: cover;
  border-top-left-radius: 18px;
  border-top-right-radius: 18px;
}

.event-details {
  padding: 1.25rem 1.4rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.event-title {
  font-size: 1.2rem;
  font-weight: 600;
  margin: 0;
  color: #111827;
}

.event-subtitle {
  font-size: 0.95rem;
  color: #4b5563;
  margin: 0;
}
.event-meta ion-icon {
  color: #1d4ed8;
  font-size: 1.2rem;
  flex-shrink: 0;
  translate: 0 1px;
}

.event-meta {
  display: grid;
  gap: 0.35rem;
  color: #475569;
  font-size: 0.92rem;
}

.event-meta p {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.event-price {
  margin-top: auto;
  font-weight: 700;
  color: #1d4ed8;
  font-size: 1rem;
}

.filters-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}

.filters-bar > * {
  flex: 1;
  max-width: none;
}

@media (min-width: 900px) {
  .filters-bar > * {
    max-width: 360px;
  }
}

@media (max-width: 900px) {
  .filters-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .events-header {
    flex-direction: column;
    align-items: stretch;
    text-align: center;
  }

  .events-dashboard-btn {
    width: 100%;
  }
}

@media (max-width: 640px) {
  .events-grid {
    grid-template-columns: 1fr;
  }

  .events-title {
    font-size: 1.6rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .events-dashboard-btn,
  .event-card {
    transition: none;
  }
}
</style>
