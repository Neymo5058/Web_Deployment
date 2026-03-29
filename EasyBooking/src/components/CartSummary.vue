<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import {
  DEFAULT_CURRENCY,
  formatCurrency,
  resolveCurrencyCode,
} from '@/utils/currency.js';

const props = defineProps({
  event: { type: Object, required: true },
  currency: { type: String, default: DEFAULT_CURRENCY },
  quantity: { type: Number, default: 1 },
  onReserve: { type: Function, default: null },
});

const { t, locale } = useI18n();

const reserveTo = computed(() => ({
  name: 'event-tickets',
  params: { id: props.event?._id ?? props.event?.id },
  query: { qty: Number(props.quantity ?? 1) },
}));

const canReserve = computed(
  () => Number(props.event?.available ?? 0) >= Number(props.quantity ?? 1)
);

const emit = defineEmits(['reserve']);

const displayPricing = computed(() => {
  const pricing = props.event?.pricing;

  if (pricing && Number.isFinite(pricing.amount)) {
    return {
      amount: Number(pricing.amount),
      currency: pricing.currency || pricing.original?.currency || props.currency,
    };
  }

  if (pricing?.original && Number.isFinite(pricing.original.amount)) {
    return {
      amount: Number(pricing.original.amount),
      currency:
        pricing.original.currency ||
        pricing.currency ||
        props.currency,
    };
  }

  return {
    amount: Number(props.event?.price ?? 0),
    currency: props.event?.currency || props.currency,
  };
});

const numberLocale = computed(() => (locale.value === 'fr' ? 'fr-CA' : 'en-CA'));
const dateLocale = computed(() => (locale.value === 'fr' ? 'fr-CA' : 'en-CA'));

const priceFormatted = computed(() => {
  const pricing = displayPricing.value;
  const amount = Number(pricing.amount) || 0;
  const currency = resolveCurrencyCode(pricing.currency || props.currency, DEFAULT_CURRENCY);

  return formatCurrency(amount, {
    currency,
    locale: numberLocale.value,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
});

const dateFormatted = computed(() => {
  const d = props.event?.startsAt ? new Date(props.event.startsAt) : null;
  if (!d || isNaN(d)) return '';
  return d.toLocaleDateString(dateLocale.value, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: '2-digit',
  });
});

function handleReserve() {
  const payload = {
    id: props.event?._id ?? props.event?.id,
    title: props.event?.title,
    price: Number(props.event?.price ?? 0),
    quantity: Number(props.quantity ?? 1),
  };

  if (props.onReserve) props.onReserve(payload);
  emit('reserve', payload);
}
</script>

<template>
  <aside class="card">
    <h3 class="title">{{ t('eventDetail.summaryTitle') }}</h3>

    <div class="price-line">
      <span class="price">{{ priceFormatted }}</span>
    </div>
    <div class="rows-and-btn">
      <div class="rows">
      <div class="row">
        <span class="label">{{ t('eventDetail.date') }}:</span>
        <span class="value">{{ dateFormatted }}</span>
      </div>
      <div class="row">
        <span class="label">{{ t('eventDetail.time') }}:</span>
        <span class="value">{{ event?.hour }}</span>
      </div>
      <div class="row">
        <span class="label">{{ t('eventDetail.available') }}:</span>
        <span class="value">{{
          event?.available?.toLocaleString?.() ?? event?.available
        }}</span>
      </div>
    </div>
      <RouterLink v-if="canReserve" :to="reserveTo" class="btn">
        {{ t('eventDetail.reserveNow') }}
      </RouterLink>
    </div>
  </aside>
</template>

<style scoped>
.card {
  background: #ffffff;
  border: 1px solid #e6e6ea;
  border-radius: 12px;
  padding: 18px;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.08);
}

.title {
  margin: 0 0 12px 0;
  font-size: 1.4rem;
  font-weight: 600;
  color: #2b2f36;
}

.price-line {
  display: flex;
  align-items: baseline;
  justify-content: flex-start;
}

.price {
  font-size: 1.4rem;
  font-weight: 600;
  color: #2b2f36;
}

.qty {
  color: #6b7280;
  font-weight: 600;
}

.rows {
  margin-top: 8px;
}

.row {
  display: grid;
  grid-template-columns: 1fr auto;
  padding: 8px 0;
  border-bottom: 1px solid transparent;
}

.label {
  color: #6b7280;
  font-size: 1.2rem;
}

.value {
  color: #2b2f36;
  font-size: 1rem;
  font-weight: 600;
}

.rows-and-btn {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.btn {
  padding: 12px 14px;
  border: none;
  border-radius: 8px;
  background: #356ae6;
  color: white;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.08);
  transition: background 0.15s ease, transform 0.03s ease;
  text-decoration: none;
  display: flex;
  align-items: center;
  justify-content: center;
}
.btn:hover {
  background: #2f5bcc;
}
.btn:active {
  transform: translateY(1px);
}
</style>
