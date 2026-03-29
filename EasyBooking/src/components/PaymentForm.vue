<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  shallowRef,
  watch,
} from 'vue';
import { loadStripe } from '@stripe/stripe-js';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';

import apiClient from '@/services/apiClient.js';
import { useAuthStore } from '@/stores/authStore.js';
import {
  DEFAULT_CURRENCY,
  formatCurrency,
  getUserCurrency,
  resolveCurrencyCode,
} from '@/utils/currency.js';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const { t, locale } = useI18n();

const isLoadingEvent = ref(false);
const isLoadingIntent = ref(false);
const isSubmitting = ref(false);
const eventRef = ref(null);
const quantity = ref(1);
const errorMessage = ref(null);
const paymentError = ref(null);
const statusMessage = ref(null);
const summary = ref(null);
const clientSecret = ref('');
const publishableKey = ref('');

const contact = reactive({
  fullname: '',
  email: '',
});
const fieldErrors = reactive({ fullname: '', email: '' });

const stripeInstance = shallowRef(null);
const elementsInstance = shallowRef(null);
const paymentElement = shallowRef(null);

let lastIntentRequest = 0;

const authUser = computed(() => authStore.user);

const localeForNumbers = computed(() => (locale.value === 'fr' ? 'fr-CA' : 'en-CA'));
const localeForDates = computed(() => (locale.value === 'fr' ? 'fr-CA' : 'en-CA'));

const formatMessage = (message) => {
  if (!message) return '';
  if (typeof message === 'string') return message;
  if (message.message) return message.message;
  if (message.key) return t(message.key, message.params);
  return '';
};

const makeMessage = (key, params) => ({ key, params });
const makeRawMessage = (message) => ({ message });

const preferredCurrency = computed(
  () => getUserCurrency(authUser.value) || DEFAULT_CURRENCY
);

watch(
  authUser,
  (value) => {
    if (!value) return;
    if (!contact.fullname) {
      contact.fullname = value.fullname || '';
    }
    if (!contact.email) {
      contact.email = value.email || '';
    }
  },
  { immediate: true }
);

const currency = computed(() =>
  resolveCurrencyCode(
    summary.value?.currency ||
      summary.value?.original?.currency ||
      eventRef.value?.pricing?.currency ||
      eventRef.value?.currency ||
      preferredCurrency.value ||
      DEFAULT_CURRENCY,
    DEFAULT_CURRENCY
  )
);

const summaryTotals = computed(() => summary.value ?? null);

const formattedSummary = computed(() => {
  const totals = summaryTotals.value;
  if (!totals) return null;
  return {
    pricePerTicket: formatCurrency(totals.pricePerTicket || 0, {
      currency: currency.value,
      locale: localeForNumbers.value,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
    subtotal: formatCurrency(totals.subtotal || 0, {
      currency: currency.value,
      locale: localeForNumbers.value,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
    taxes: formatCurrency(totals.taxes || 0, {
      currency: currency.value,
      locale: localeForNumbers.value,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
    fees: formatCurrency(totals.fees || 0, {
      currency: currency.value,
      locale: localeForNumbers.value,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
    total: formatCurrency(totals.total || 0, {
      currency: currency.value,
      locale: localeForNumbers.value,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
  };
});

const formattedDate = computed(() => {
  const raw = eventRef.value?.startsAt;
  if (!raw) return '';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat(localeForDates.value, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
});

const locationText = computed(() => {
  const place = eventRef.value?.place;
  if (!place) return '';
  return [place.name, place.city, place.country].filter(Boolean).join(', ');
});

const isStripeReady = computed(() =>
  Boolean(clientSecret.value && elementsInstance.value)
);

function toPositiveInt(value, fallback = 1) {
  const numeric = Number.parseInt(value, 10);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return numeric;
}

async function fetchEvent(eventId) {
  isLoadingEvent.value = true;
  errorMessage.value = null;
  try {
    const { data } = await apiClient.get(
      `/events/${encodeURIComponent(eventId)}`,
      {
        params: { currency: preferredCurrency.value },
      }
    );
    eventRef.value = data?.event ?? null;
    if (!eventRef.value) {
      errorMessage.value = makeMessage('checkout.errors.eventNotFound');
    }
  } catch (error) {
    const status = error?.response?.status;
    if (status === 404) {
      errorMessage.value = makeMessage('checkout.errors.eventNotFound');
    } else {
      errorMessage.value = makeMessage('checkout.errors.eventLoad');
    }
    eventRef.value = null;
  } finally {
    isLoadingEvent.value = false;
  }
}

async function initializeIntent() {
  if (!eventRef.value) return;

  const token = ++lastIntentRequest;
  isLoadingIntent.value = true;
  paymentError.value = null;
  statusMessage.value = null;

  try {
    const { data } = await apiClient.post('/payments/create-intent', {
      eventId: eventRef.value.id,
      quantity: quantity.value,
      currency: preferredCurrency.value,
    });

    if (token !== lastIntentRequest) {
      return;
    }

    summary.value = data?.orderSummary ?? null;
    clientSecret.value = data?.clientSecret ?? '';
    publishableKey.value =
      data?.publishableKey || import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';

    if (!publishableKey.value) {
      throw new Error(t('checkout.errors.missingPublishableKey'));
    }
    if (!clientSecret.value) {
      throw new Error(t('checkout.errors.missingClientSecret'));
    }

    stripeInstance.value = await loadStripe(publishableKey.value);
    if (!stripeInstance.value) {
      throw new Error(t('checkout.errors.stripeInit'));
    }

    if (paymentElement.value) {
      paymentElement.value.unmount();
      paymentElement.value = null;
    }

    elementsInstance.value = stripeInstance.value.elements({
      clientSecret: clientSecret.value,
      appearance: {
        theme: 'stripe',
        variables: {
          colorPrimary: '#2563eb',
        },
      },
    });

    if (token === lastIntentRequest) {
      isLoadingIntent.value = false;
      await nextTick();
      paymentElement.value = elementsInstance.value.create('payment', {
        layout: 'tabs',
      });
      paymentElement.value.mount('#payment-element');
    }
  } catch (error) {
    const message = error?.response?.data?.message || error?.message;
    paymentError.value = message
      ? makeRawMessage(message)
      : makeMessage('checkout.errors.intentInit');
  } finally {
    if (token === lastIntentRequest) {
      isLoadingIntent.value = false;
    }
  }
}

function goBackToInfos() {
  const id = route.params.id ?? route.query.id;
  router.push({
    name: 'customer-infos',
    params: id ? { id } : undefined,
    query: { qty: quantity.value },
  });
}

function validateContact() {
  fieldErrors.fullname = '';
  fieldErrors.email = '';

  let ok = true;

  if (!contact.fullname || !contact.fullname.trim()) {
    fieldErrors.fullname = t('checkout.validation.fullnameRequired');
    ok = false;
  }

  if (!contact.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
    fieldErrors.email = t('checkout.validation.emailInvalid');
    ok = false;
  }

  return ok;
}

async function handleConfirm() {
  if (!isStripeReady.value || !stripeInstance.value) {
    paymentError.value = makeMessage('checkout.errors.paymentUnavailable');
    return;
  }

  if (!validateContact()) return;

  isSubmitting.value = true;
  paymentError.value = null;

  try {
    const totals = summaryTotals.value;
    const totalAmount = Number(totals?.total ?? 0);
    const formattedAmount = Number.isFinite(totalAmount)
      ? totalAmount.toFixed(2)
      : '0.00';

    const successLocation = router.resolve({
      name: 'payment-success',
      query: {
        eventId: eventRef.value?.id,
        qty: quantity.value,
        amount: formattedAmount,
        currency: currency.value,
      },
    });

    const returnUrl = new URL(successLocation.href, window.location.origin);

    const { error, paymentIntent } = await stripeInstance.value.confirmPayment({
      elements: elementsInstance.value,

      confirmParams: {
        payment_method_data: {
          billing_details: {
            name: contact.fullname.trim(),
            email: contact.email.trim(),
          },
        },
        receipt_email: contact.email.trim(),
        return_url: returnUrl.toString(),
      },
      redirect: 'if_required',
    });

    if (error) {
      if (error.type === 'card_error' || error.type === 'validation_error') {
        paymentError.value =
          error.message
            ? makeRawMessage(error.message)
            : makeMessage('checkout.errors.paymentDeclined');
      } else {
        paymentError.value = makeMessage('checkout.errors.paymentUnexpected');
      }
      return;
    }

    if (paymentIntent) {
      router.replace({
        name: 'payment-success',
        query: {
          eventId: eventRef.value?.id,
          qty: quantity.value,
          amount: formattedAmount,
          currency: currency.value,
          payment_intent: paymentIntent.id,
        },
      });
      return;
    }

    statusMessage.value = makeMessage('checkout.payment.status.verification');
  } catch (error) {
    paymentError.value = error?.message
      ? makeRawMessage(error.message)
      : makeMessage('checkout.errors.confirmation');
  } finally {
    isSubmitting.value = false;
  }
}

onMounted(async () => {
  const id = String(route.params.id ?? route.query.id ?? '');
  quantity.value = toPositiveInt(route.query.qty ?? 1, 1);

  if (!id) {
    errorMessage.value = makeMessage('checkout.errors.missingEventId');
    return;
  }

  await fetchEvent(id);
  if (!eventRef.value) return;

  await initializeIntent();
});

watch(
  () => route.query.qty,
  (value) => {
    quantity.value = toPositiveInt(value ?? 1, 1);
    if (eventRef.value) {
      initializeIntent();
    }
  }
);

watch(
  () => route.params.id,
  async (value, oldValue) => {
    if (value && value !== oldValue) {
      await fetchEvent(String(value));
      if (eventRef.value) {
        await initializeIntent();
      }
    }
  }
);

watch(preferredCurrency, async (newCurrency, oldCurrency) => {
  if (newCurrency === oldCurrency) return;
  const id = String(
    route.params.id ?? route.query.id ?? eventRef.value?.id ?? ''
  );
  if (!id) return;
  await fetchEvent(id);
  if (eventRef.value) {
    await initializeIntent();
  }
});

onBeforeUnmount(() => {
  if (paymentElement.value) {
    paymentElement.value.unmount();
    paymentElement.value = null;
  }
  elementsInstance.value = null;
  stripeInstance.value = null;
});

const statusMessageText = computed(() => formatMessage(statusMessage.value));
const paymentErrorText = computed(() => formatMessage(paymentError.value));
const errorMessageText = computed(() => formatMessage(errorMessage.value));
</script>

<template>
  <section class="payment">
    <div class="container">
      <button class="backlink" type="button" @click="goBackToInfos">
        {{ t('checkout.common.back') }}
      </button>

      <div class="grid">
        <article class="card form-card">
          <h2 class="card-title">
            <ion-icon name="lock-closed-outline"></ion-icon>
            {{ t('checkout.payment.secureTitle') }}
          </h2>

          <p v-if="statusMessageText" class="status">{{ statusMessageText }}</p>
          <p v-if="paymentErrorText" class="status status--error">
            {{ paymentErrorText }}
          </p>

          <div v-if="isLoadingEvent" class="status">
            {{ t('checkout.common.loadingEvent') }}
          </div>
          <div v-else-if="errorMessageText" class="status status--error">
            {{ errorMessageText }}
          </div>

          <form
            v-else
            class="stripe-form"
            @submit.prevent="handleConfirm"
            novalidate
          >
            <fieldset class="form-block">
              <legend>{{ t('checkout.payment.contact.legend') }}</legend>
              <div
                class="form-group"
                :class="{ 'has-error': fieldErrors.fullname }"
              >
                <label for="fullname">{{
                  t('checkout.payment.contact.fullnameLabel')
                }}</label>
                <input
                  id="fullname"
                  v-model.trim="contact.fullname"
                  type="text"
                  autocomplete="name"
                  :aria-invalid="!!fieldErrors.fullname"
                  :placeholder="t('checkout.payment.contact.fullnamePlaceholder')"
                />
                <p v-if="fieldErrors.fullname" class="error">
                  {{ fieldErrors.fullname }}
                </p>
              </div>

              <div
                class="form-group"
                :class="{ 'has-error': fieldErrors.email }"
              >
                <label for="email">{{
                  t('checkout.payment.contact.emailLabel')
                }}</label>
                <input
                  id="email"
                  v-model.trim="contact.email"
                  type="email"
                  autocomplete="email"
                  :placeholder="t('checkout.payment.contact.emailPlaceholder')"
                  :aria-invalid="!!fieldErrors.email"
                />
                <p v-if="fieldErrors.email" class="error">
                  {{ fieldErrors.email }}
                </p>
              </div>
            </fieldset>

            <fieldset class="form-block">
              <legend>{{ t('checkout.payment.method.legend') }}</legend>
              <div v-if="isLoadingIntent" class="status">
                {{ t('checkout.common.loadingStripe') }}
              </div>
              <div
                v-else-if="paymentErrorText && !isStripeReady"
                class="status status--error"
              >
                {{ paymentErrorText }}
              </div>
              <div v-else class="payment-element-wrapper">
                <div id="payment-element"></div>
              </div>
            </fieldset>

            <div class="actions">
              <button
                type="button"
                class="btn btn-outline"
                @click="goBackToInfos"
              >
                {{ t('checkout.payment.actions.previous') }}
              </button>
              <button
                type="submit"
                class="btn"
                :disabled="!isStripeReady || isSubmitting"
              >
                <span v-if="isSubmitting">
                  {{ t('checkout.payment.actions.processing') }}
                </span>
                <span v-else>{{ t('checkout.payment.actions.confirm') }}</span>
              </button>
            </div>
          </form>
        </article>

        <aside class="card recap-card">
          <h3 class="recap-title">{{ t('checkout.summary.title') }}</h3>

          <template v-if="eventRef">
            <div class="event-head">
              <h4 class="event-title">{{ eventRef.title }}</h4>
              <p class="event-meta">{{ formattedDate }}</p>
              <p v-if="locationText" class="event-loc">{{ locationText }}</p>
            </div>

            <hr class="sep" />

            <dl class="rows">
              <div class="row">
                <dt>{{ t('checkout.summary.pricePerTicket') }}</dt>
                <dd>{{ formattedSummary?.pricePerTicket }}</dd>
              </div>
              <div class="row">
                <dt>{{ t('checkout.summary.quantity') }}</dt>
                <dd>{{ quantity }}</dd>
              </div>
              <div class="row">
                <dt>{{ t('checkout.summary.taxes') }}</dt>
                <dd>{{ formattedSummary?.taxes }}</dd>
              </div>
              <div class="row">
                <dt>{{ t('checkout.summary.fees') }}</dt>
                <dd>{{ formattedSummary?.fees }}</dd>
              </div>
            </dl>

            <div class="total">
              <span>{{ t('checkout.summary.total') }}</span>
              <strong>{{ formattedSummary?.total }}</strong>
            </div>
          </template>
        </aside>
      </div>
    </div>
  </section>
</template>

<style scoped>
.payment {
  background: #f4f6f8;
  min-height: 100vh;
  padding: 32px 0 48px;
}

.container {
  width: min(1120px, 92%);
  margin: 0 auto;
}

.backlink {
  margin: 0 0 14px 0;
  background: transparent;
  border: none;
  font-size: 1rem;
  cursor: pointer;
  color: #1f2937;
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
  margin: 0 0 12px 0;
  font-size: 1.18rem;
  font-weight: 700;
  color: #1f2937;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status {
  color: #6b7280;
  margin-bottom: 1rem;
}

.status--error {
  color: #c92a2a;
}

.stripe-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-block {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px;
}

legend {
  font-weight: 700;
  padding: 0 8px;
}

.form-group {
  margin-bottom: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

label {
  font-size: 0.95rem;
  font-weight: 600;
  color: #1f2937;
}

input {
  width: 100%;
  padding: 0.65rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 0.95rem;
  background: #f8fafc;
  color: #111827;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

input:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}

.error {
  font-size: 0.85rem;
  color: #c92a2a;
}

.has-error input {
  border-color: #c92a2a;
  box-shadow: 0 0 0 3px rgba(201, 42, 42, 0.1);
}

.payment-element-wrapper {
  background: #f9fafb;
  border-radius: 10px;
  padding: 12px;
  border: 1px solid #e5e7eb;
}

.actions {
  display: flex;
  gap: 16px;
  justify-content: space-between;
  margin-top: 8px;
}

.btn {
  background: #2563eb;
  color: #fff;
  border: none;
  padding: 0.85rem 1.25rem;
  border-radius: 0.6rem;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s ease;
}

.btn:hover {
  background: #1d4ed8;
}

.btn[disabled] {
  background: #93c5fd;
  cursor: not-allowed;
}

.btn-outline {
  background: #fff;
  color: #111827;
  border: 1px solid #111827;
}

.btn-outline:hover {
  background: #f7f7f7;
}

.recap-title {
  margin: 0 0 12px 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: #374151;
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
