<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';

import apiClient from '@/services/apiClient.js';
import { useAuthStore } from '@/stores/authStore.js';
import {
  DEFAULT_CURRENCY,
  formatCurrency,
  getUserCurrency,
  resolveCurrencyCode,
} from '@/utils/currency.js';

const props = defineProps({
  event: { type: Object, default: null },
  qty: { type: Number, default: null },
  id: { type: String, default: '' },
});

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const { user: authUser } = storeToRefs(authStore);
const { t, locale } = useI18n();

const errorMessageKey = ref('');
const form = ref({ fullname: '', email: '', phone: '' });
const fieldErrors = ref({ fullname: '', email: '', phone: '' });
const isLoading = ref(false);

const TAX_RATE = 0.15;
const SERVICE_FEE = 2.99;

const quantity = ref(1);
const eventRef = ref(props.event);
const id = computed(() => route.params.id ?? props.id ?? '');
const preferredCurrency = computed(() => getUserCurrency(authUser.value));
const numberLocale = computed(() => (locale.value === 'fr' ? 'fr-CA' : 'en-CA'));
const dateLocale = computed(() => (locale.value === 'fr' ? 'fr-CA' : 'en-CA'));
const timeLocale = computed(() => (locale.value === 'fr' ? 'fr-CA' : 'en-CA'));

const currency = computed(() =>
  resolveCurrencyCode(
    eventRef.value?.currency || preferredCurrency.value,
    DEFAULT_CURRENCY
  )
);

const errorMessageText = computed(() =>
  errorMessageKey.value ? t(errorMessageKey.value) : ''
);

let lastEventRequest = 0;

watch(
  authUser,
  (value) => {
    if (!value) return;

    if (!form.value.fullname) {
      form.value.fullname = value.fullname || '';
    }
    if (!form.value.email) {
      form.value.email = value.email || '';
    }
    if (!form.value.phone) {
      form.value.phone = value.phone || '';
    }
  },
  { immediate: true }
);

watch(
  () => props.event,
  (value) => {
    eventRef.value = value;
  }
);

async function fetchEventDetails(eventId) {
  if (!eventId) {
    return;
  }

  const requestId = ++lastEventRequest;
  isLoading.value = true;
  errorMessageKey.value = '';

  try {
    const { data } = await apiClient.get(
      `/events/${encodeURIComponent(eventId)}`,
      {
        params: { currency: preferredCurrency.value },
      }
    );

    if (requestId !== lastEventRequest) {
      return;
    }

    eventRef.value = data?.event ?? null;
    if (!eventRef.value) {
      errorMessageKey.value = 'checkout.errors.eventNotFound';
    }
  } catch (_error) {
    if (requestId !== lastEventRequest) {
      return;
    }

    errorMessageKey.value = 'checkout.errors.eventLoad';
    eventRef.value = null;
  } finally {
    if (requestId === lastEventRequest) {
      isLoading.value = false;
    }
  }
}

watch(
  id,
  (value) => {
    if (!value) {
      eventRef.value = null;
      errorMessageKey.value = 'checkout.errors.eventNotFound';
      return;
    }

    fetchEventDetails(value);
  },
  { immediate: true }
);

watch(preferredCurrency, (newCurrency, oldCurrency) => {
  if (newCurrency === oldCurrency) return;
  if (id.value) {
    fetchEventDetails(id.value);
  }
});

onMounted(() => {
  const qFromQuery = Number(route.query.qty);
  quantity.value =
    Number.isFinite(props.qty ?? qFromQuery) && (props.qty ?? qFromQuery) > 0
      ? Math.round(props.qty ?? qFromQuery)
      : 1;
});

const money = (value) =>
  formatCurrency(value, {
    currency: currency.value,
    locale: numberLocale.value,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const pricePerTicket = computed(() => Number(eventRef.value?.price) || 0);
const subtotal = computed(() => pricePerTicket.value * quantity.value);
const taxes = computed(() => subtotal.value * TAX_RATE);
const fees = computed(() => (quantity.value > 0 ? SERVICE_FEE : 0));
const total = computed(() => subtotal.value + taxes.value + fees.value);

const formattedDate = computed(() => {
  const raw = eventRef.value?.startsAt;
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(dateLocale.value, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
});

const formattedTime = computed(() => {
  if (eventRef.value?.hour) return eventRef.value.hour;
  const raw = eventRef.value?.startsAt;
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(timeLocale.value, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
});

const locationText = computed(() => {
  const p = eventRef.value?.place;
  if (!p) return '';
  return [p.name, p.city, p.country].filter(Boolean).join(', ');
});

function validate() {
  fieldErrors.value = { fullname: '', email: '', phone: '' };
  let ok = true;

  if (!form.value.fullname.trim()) {
    fieldErrors.value.fullname = t('checkout.validation.fullnameRequired');
    ok = false;
  }
  if (!form.value.email.trim()) {
    fieldErrors.value.email = t('checkout.validation.emailRequired');
    ok = false;
  } else if (!/^\S+@\S+\.\S+$/.test(form.value.email)) {
    fieldErrors.value.email = t('checkout.validation.emailInvalid');
    ok = false;
  }

  return ok;
}

function goPrev() {
  const eventId = eventRef.value?._id ?? eventRef.value?.id ?? id.value;
  router.push({
    name: 'event-tickets',
    params: { id: eventId },
    query: { qty: quantity.value },
  });
}

function handleSubmit() {
  if (!validate()) return;

  router.push({
    name: 'payment',
    query: { id: id.value, qty: quantity.value },
  });
}
</script>

<template>
  <section class="checkout">
    <div class="container">
      <div class="grid">
        <article class="card form-card">
          <h2 class="card-title">{{ t('checkout.customer.title') }}</h2>

          <form @submit.prevent="handleSubmit" novalidate>
            <div
              class="form-group"
              :class="{ 'has-error': fieldErrors.fullname }"
            >
              <label for="fullname">{{ t('checkout.customer.fullnameLabel') }}</label>
              <input
                id="fullname"
                v-model.trim="form.fullname"
                type="text"
                :placeholder="t('checkout.customer.fullnamePlaceholder')"
                :aria-invalid="fieldErrors.fullname ? 'true' : 'false'"
                :disabled="isLoading"
                autocomplete="name"
                required
              />
              <p v-if="fieldErrors.fullname" class="error" role="alert">
                {{ fieldErrors.fullname }}
              </p>
            </div>

            <div class="form-group" :class="{ 'has-error': fieldErrors.email }">
              <label for="email">{{ t('checkout.customer.emailLabel') }}</label>
              <input
                id="email"
                v-model.trim="form.email"
                type="email"
                :placeholder="t('checkout.customer.emailPlaceholder')"
                autocomplete="email"
                :aria-invalid="fieldErrors.email ? 'true' : 'false'"
                :disabled="isLoading"
                required
              />
              <p v-if="fieldErrors.email" class="error" role="alert">
                {{ fieldErrors.email }}
              </p>
            </div>

            <div class="form-group" :class="{ 'has-error': fieldErrors.phone }">
              <label for="phone">{{ t('checkout.customer.phoneLabel') }}</label>
              <input
                id="phone"
                v-model.trim="form.phone"
                type="tel"
                :placeholder="t('checkout.customer.phonePlaceholder')"
                inputmode="tel"
                :aria-invalid="fieldErrors.phone ? 'true' : 'false'"
                :disabled="isLoading"
              />
              <p v-if="fieldErrors.phone" class="error" role="alert">
                {{ fieldErrors.phone }}
              </p>
            </div>

            <div class="actions">
              <button type="button" class="btn btn-outline" @click="goPrev">
                {{ t('checkout.customer.actions.previous') }}
              </button>
              <button type="submit" class="btn" :disabled="isLoading">
                {{ t('checkout.customer.actions.next') }}
              </button>
            </div>
          </form>
        </article>

        <aside class="card recap-card">
          <h3 class="recap-title">{{ t('checkout.summary.title') }}</h3>

          <div v-if="isLoading" class="summary-card__status">
            {{ t('checkout.common.loading') }}
          </div>
          <div
            v-else-if="errorMessageText"
            class="summary-card__status summary-card__status--error"
          >
            {{ errorMessageText }}
          </div>

          <template v-else-if="eventRef">
            <div class="event-head">
              <h4 class="event-title">{{ eventRef.title }}</h4>
              <p class="event-meta">
                <span>{{ formattedDate }}</span>
                <span v-if="formattedTime"> - {{ formattedTime }}</span>
              </p>
              <p v-if="locationText" class="event-loc">{{ locationText }}</p>
            </div>

            <hr class="sep" />

            <dl class="rows">
              <div class="row">
                <dt>{{ t('checkout.summary.pricePerTicket') }}</dt>
                <dd>{{ money(pricePerTicket) }}</dd>
              </div>
              <div class="row">
                <dt>{{ t('checkout.summary.quantity') }}</dt>
                <dd>{{ quantity }}</dd>
              </div>
              <div class="row">
                <dt>{{ t('checkout.summary.taxes') }}</dt>
                <dd>{{ money(taxes) }}</dd>
              </div>
              <div class="row">
                <dt>{{ t('checkout.summary.fees') }}</dt>
                <dd>{{ money(fees) }}</dd>
              </div>
            </dl>

            <div class="total">
              <span>{{ t('checkout.summary.total') }}</span>
              <strong>{{ money(total) }}</strong>
            </div>
          </template>
        </aside>
      </div>
    </div>
  </section>
</template>

<style scoped>
.checkout {
  background: #f4f6f8;
  min-height: 100vh;
  padding: 32px 0 48px;
}
.container {
  width: min(1120px, 92%);
  margin: 0 auto;
}

.grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 28px;
}
@media (min-width: 960px) {
  .grid {
    grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
  }
}

.card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0px 4px 16px rgba(0, 0, 0, 0.08);
}
.form-card {
  padding: 24px;
}
.recap-card {
  padding: 24px;
}

.card-title {
  margin: 0 0 16px 0;
  font-size: 1.35rem;
  font-weight: 700;
  color: #212529;
}

/* Form */
.form-group {
  margin-bottom: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
label {
  font-size: 0.95rem;
  font-weight: 600;
  color: #212529;
}
input {
  width: 100%;
  padding: 0.65rem 0.75rem;
  border: 1px solid #dcdcdc;
  border-radius: 0.5rem;
  font-size: 0.95rem;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  background-color: #fff;
}
input:focus {
  border-color: #2979ff;
  box-shadow: 0 0 0 3px rgba(41, 121, 255, 0.15);
  box-shadow: 0 0 0 3px var(--primary-shadow);
}

.actions {
  display: flex;
  gap: 16px;
  justify-content: space-between;
  margin-top: 18px;
}

.btn {
  background: #2979ff;
  color: #fff;
  border: none;
  padding: 0.85rem 1.25rem;
  border-radius: 0.6rem;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s ease;
}

.btn:hover:not(:disabled) {
  background: #1565c0;
}

.btn[disabled] {
  background: #94b3ff;
  cursor: not-allowed;
}

.btn-outline {
  background: #fff;
  color: #111827;
  border: 1px solid #111827;
}

.btn-outline:hover:not(:disabled) {
  background: #f7f7f7;
}

.error {
  font-size: 0.85rem;
  color: #c92a2a;
}

.has-error input {
  border-color: #c92a2a;
  box-shadow: 0 0 0 3px rgba(201, 42, 42, 0.1);
}

.recap-title {
  margin: 0 0 12px 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: #374151;
}

.summary-card__status {
  color: #6b7280;
  font-size: 0.95rem;
}

.summary-card__status--error {
  color: #c92a2a;
}

.event-head {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.event-title {
  margin: 0;
  font-weight: 700;
  color: #111827;
}

.event-meta,
.event-loc {
  margin: 0;
  color: #6b7280;
  font-size: 0.95rem;
}

.sep {
  border: none;
  border-top: 1px solid #e5e7eb;
  margin: 16px 0;
}

.rows {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.row {
  display: flex;
  justify-content: space-between;
  color: #6b7280;
  font-weight: 500;
}

.row dt,
.row dd {
  margin: 0;
}

.row dd {
  color: #111827;
  font-weight: 600;
}

.total {
  margin-top: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #111827;
  font-size: 1.05rem;
}

.total strong {
  font-size: 1.35rem;
}
</style>
