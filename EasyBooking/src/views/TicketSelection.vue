<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import BaseBackBtn from '@/components/BaseBackBtn.vue';
import QuantitySelector from '@/components/TicketSelection.vue';
import apiClient from '@/services/apiClient.js';
import { useAuthStore } from '@/stores/authStore.js';
import { storeToRefs } from 'pinia';
import {
  DEFAULT_CURRENCY,
  formatCurrency,
  getUserCurrency,
  resolveCurrencyCode,
} from '@/utils/currency.js';

const props = defineProps({
  id: { type: String, default: '' },
  qty: { type: Number, default: 1 },
});

const router = useRouter();
const { t, locale } = useI18n();
const quantity = ref(normalizeQuantity(props.qty));
const event = ref(null);
const isLoading = ref(false);
const errorMessageKey = ref('');
let lastRequestToken = 0;

const authStore = useAuthStore();
const { user } = storeToRefs(authStore);

const preferredCurrency = computed(() => getUserCurrency(user.value));
const numberLocale = computed(() => (locale.value === 'fr' ? 'fr-CA' : 'en-CA'));
const dateLocale = computed(() => (locale.value === 'fr' ? 'fr-CA' : 'en-CA'));
const timeLocale = computed(() => (locale.value === 'fr' ? 'fr-CA' : 'en-CA'));
const errorMessageText = computed(() =>
  errorMessageKey.value ? t(errorMessageKey.value) : ''
);

const TAX_RATE = 0.15;
const SERVICE_FEE = 2.99;

const maxQuantity = computed(() => {
  const available = Number(event.value?.available);
  if (!Number.isFinite(available)) return Infinity;
  if (available <= 0) return 0;
  return Math.max(1, Math.floor(available));
});

const isSoldOut = computed(() => maxQuantity.value <= 0);

const selectorMax = computed(() =>
  Number.isFinite(maxQuantity.value) ? maxQuantity.value : Infinity
);

const displayPricing = computed(() => {
  const pricing = event.value?.pricing;

  if (pricing && Number.isFinite(pricing.amount)) {
    return {
      amount: Number(pricing.amount),
      currency:
        pricing.currency ||
        pricing.original?.currency ||
        event.value?.currency ||
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
        event.value?.currency ||
        preferredCurrency.value ||
        DEFAULT_CURRENCY,
    };
  }

  return {
    amount: Number(event.value?.price ?? 0),
    currency: event.value?.currency || preferredCurrency.value,
  };
});

const currency = computed(() =>
  resolveCurrencyCode(
    displayPricing.value.currency || preferredCurrency.value || DEFAULT_CURRENCY,
    DEFAULT_CURRENCY
  )
);

const pricePerTicket = computed(() => {
  const price = Number(displayPricing.value.amount);
  return Number.isFinite(price) && price > 0 ? price : 0;
});

const effectiveQuantity = computed(() =>
  isSoldOut.value ? 0 : quantity.value
);

const subtotal = computed(() => pricePerTicket.value * effectiveQuantity.value);
const taxes = computed(() => subtotal.value * TAX_RATE);
const fees = computed(() => (effectiveQuantity.value > 0 ? SERVICE_FEE : 0));
const total = computed(() => subtotal.value + taxes.value + fees.value);

const formatAmount = (value) =>
  formatCurrency(value, {
    currency: currency.value,
    locale: numberLocale.value,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formattedPricePerTicket = computed(() => formatAmount(pricePerTicket.value));
const formattedTaxes = computed(() => formatAmount(taxes.value));
const formattedFees = computed(() => formatAmount(fees.value));
const formattedTotal = computed(() => formatAmount(total.value));

const formattedDate = computed(() => {
  const raw = event.value?.startsAt;
  if (!raw) return '';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';

  try {
    return new Intl.DateTimeFormat(dateLocale.value, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(parsed);
  } catch (_error) {
    return parsed.toLocaleDateString(dateLocale.value);
  }
});

const formattedTime = computed(() => {
  if (event.value?.hour) return event.value.hour;
  const raw = event.value?.startsAt;
  if (!raw) return '';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';

  try {
    return new Intl.DateTimeFormat(timeLocale.value, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(parsed);
  } catch (_error) {
    return parsed.toLocaleTimeString(timeLocale.value, {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
});

const formattedLocation = computed(() => {
  const place = event.value?.place;
  if (!place || typeof place !== 'object') return '';
  return [place.name, place.city, place.country].filter(Boolean).join(', ');
});

watch(
  () => props.qty,
  (value) => {
    quantity.value = normalizeQuantity(value);
    syncQuantityWithAvailability();
  }
);

watch(
  () => props.id,
  (value) => {
    if (value) {
      fetchEvent(value);
    } else {
      event.value = null;
      errorMessageKey.value = 'checkout.errors.eventNotFound';
    }
  },
  { immediate: true }
);

watch(
  () => event.value?.available,
  () => {
    syncQuantityWithAvailability();
  }
);

watch(event, () => {
  syncQuantityWithAvailability();
});

watch(preferredCurrency, (newCurrency, oldCurrency) => {
  if (newCurrency === oldCurrency) return;
  if (props.id) {
    fetchEvent(props.id);
  }
});

function syncQuantityWithAvailability() {
  if (!event.value) {
    quantity.value = 1;
    return;
  }

  if (Number.isFinite(maxQuantity.value) && maxQuantity.value > 0) {
    quantity.value = Math.min(Math.max(1, quantity.value), maxQuantity.value);
  } else if (isSoldOut.value) {
    quantity.value = 1;
  }
}

function normalizeQuantity(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 1) return 1;
  return Math.round(numeric);
}

async function fetchEvent(id) {
  const token = ++lastRequestToken;
  isLoading.value = true;
  errorMessageKey.value = '';

  try {
    const { data } = await apiClient.get(`/events/${encodeURIComponent(id)}`, {
      params: { currency: preferredCurrency.value },
    });
    if (token !== lastRequestToken) return;

    const eventData = data?.event;
    if (eventData) {
      event.value = eventData;
      syncQuantityWithAvailability();
    } else {
      event.value = null;
      errorMessageKey.value = 'checkout.errors.eventNotFound';
    }
  } catch (error) {
    if (token !== lastRequestToken) return;

    event.value = null;
    const status = error?.response?.status;
    if (status === 404) {
      errorMessageKey.value = 'checkout.errors.eventNotFound';
    } else {
      errorMessageKey.value = 'checkout.errors.eventLoad';
    }
  } finally {
    if (token === lastRequestToken) {
      isLoading.value = false;
    }
  }
}

function goToNextStep() {
  const id = event.value?._id ?? event.value?.id ?? props.id;
  const qty = effectiveQuantity.value || quantity.value || 1;

  router.push({
    name: 'customer-infos',
    params: { id },
    query: { qty },
  });
}
</script>

<template>
  <section class="ticket-page">
    <div class="ticket-page__container">
      <BaseBackBtn class="ticket-page__back" />

      <div class="ticket-page__grid">
        <article class="ticket-card">
          <header class="ticket-card__header">
            <h1 class="ticket-card__title">{{ t('checkout.ticket.title') }}</h1>
            <p class="ticket-card__subtitle">{{ t('checkout.ticket.quantityLabel') }}</p>
          </header>

          <div class="ticket-card__selector">
            <QuantitySelector
              v-model="quantity"
              :min="1"
              :max="selectorMax"
              :disabled="isSoldOut || !event"
            />
            <p v-if="isSoldOut" class="ticket-card__sold-out">
              {{ t('checkout.ticket.soldOut') }}
            </p>
          </div>

          <button
            type="button"
            class="ticket-card__cta"
            :disabled="!event || isSoldOut"
            @click="goToNextStep"
          >
            {{ t('checkout.ticket.cta') }}
          </button>
        </article>

        <aside class="summary-card">
          <h2 class="summary-card__title">{{ t('checkout.summary.title') }}</h2>

          <div v-if="isLoading" class="summary-card__status">
            {{ t('checkout.common.loading') }}
          </div>
          <div
            v-else-if="errorMessageText"
            class="summary-card__status summary-card__status--error"
          >
            {{ errorMessageText }}
          </div>

          <template v-else-if="event">
            <div class="summary-card__event">
              <h3 class="summary-card__event-title">{{ event.title }}</h3>
              <p class="summary-card__event-meta">
                <span>{{ formattedDate }}</span>
                <span v-if="formattedTime">{{ formattedTime }}</span>
              </p>
              <p v-if="formattedLocation" class="summary-card__event-location">
                {{ formattedLocation }}
              </p>
            </div>

            <dl class="summary-card__list">
              <div class="summary-card__row">
                <dt>{{ t('checkout.summary.pricePerTicket') }}</dt>
                <dd>{{ formattedPricePerTicket }}</dd>
              </div>
              <div class="summary-card__row">
                <dt>{{ t('checkout.summary.quantity') }}</dt>
                <dd>{{ effectiveQuantity }}</dd>
              </div>
              <div class="summary-card__row">
                <dt>{{ t('checkout.summary.taxes') }}</dt>
                <dd>{{ formattedTaxes }}</dd>
              </div>
              <div class="summary-card__row">
                <dt>{{ t('checkout.summary.fees') }}</dt>
                <dd>{{ formattedFees }}</dd>
              </div>
            </dl>

            <div class="summary-card__total">
              <span>{{ t('checkout.summary.total') }}</span>
              <strong>{{ formattedTotal }}</strong>
            </div>
          </template>
        </aside>
      </div>
    </div>
  </section>
</template>

<style scoped>
.ticket-page {
  --bg: #f4f6f8;
  --card: #ffffff;
  --text: #0f172a;
  --muted: #6b7280;
  --accent: #356ae6;
  --accent-hover: #2750c5;
  --danger: #dc2626;
  --radius: 20px;

  min-height: 100vh;
  background: var(--bg);
  padding: 48px 0 64px;
}

.ticket-page__container {
  width: min(1120px, 92%);
  margin: 0 auto;
}

.ticket-page__back {
  margin-bottom: 28px;
}

.ticket-page__grid {
  display: grid;
  gap: 32px;
  grid-template-columns: minmax(0, 1fr);
}

.ticket-card,
.summary-card {
  background: var(--card);
  border-radius: var(--radius);
  box-shadow: 0 30px 80px rgba(15, 23, 42, 0.08);
}

.ticket-card {
  padding: 38px 44px;
  display: flex;
  flex-direction: column;
  gap: 36px;
}

.ticket-card__header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ticket-card__title {
  margin: 0;
  font-size: 1.8rem;
  color: var(--text);
}

.ticket-card__subtitle {
  margin: 0;
  color: var(--muted);
  font-weight: 500;
}

.ticket-card__selector {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ticket-card__sold-out {
  margin: 0;
  color: var(--danger);
  font-weight: 600;
}

.ticket-card__cta {
  align-self: flex-end;
  padding: 16px 34px;
  border-radius: 12px;
  border: none;
  font-size: 1rem;
  font-weight: 600;
  color: #ffffff;
  background: var(--accent);
  cursor: pointer;
  transition: background 0.2s ease, transform 0.1s ease;
}

.ticket-card__cta:hover:not(:disabled) {
  background: var(--accent-hover);
}

.ticket-card__cta:active:not(:disabled) {
  transform: translateY(1px);
}

.ticket-card__cta:disabled {
  background: #cbd5f5;
  cursor: not-allowed;
}

.summary-card {
  padding: 36px 40px;
  display: flex;
  flex-direction: column;
  gap: 26px;
}

.summary-card__title {
  margin: 0;
  font-size: 1.4rem;
  color: var(--text);
}

.summary-card__status {
  display: grid;
  place-items: center;
  min-height: 140px;
  color: var(--muted);
  font-weight: 500;
}

.summary-card__status--error {
  color: var(--danger);
}

.summary-card__event {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.summary-card__event-title {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--text);
}

.summary-card__event-meta {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  color: var(--muted);
}

.summary-card__event-location {
  margin: 0;
  color: var(--muted);
}

.summary-card__list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin: 0;
}

.summary-card__row {
  display: flex;
  justify-content: space-between;
  color: var(--muted);
  font-weight: 500;
}

.summary-card__row dd {
  margin: 0;
  color: var(--text);
  font-weight: 600;
}

.summary-card__row dt {
  margin: 0;
}

.summary-card__total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 1.1rem;
  color: var(--text);
}

.summary-card__total strong {
  font-size: 1.4rem;
}

@media (min-width: 960px) {
  .ticket-page__grid {
    grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
  }
}

@media (max-width: 720px) {
  .ticket-card {
    padding: 28px;
  }

  .summary-card {
    padding: 28px;
  }
}
</style>
