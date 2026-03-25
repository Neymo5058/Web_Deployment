<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';

import apiClient from '@/services/apiClient.js';
import { useReservationHistory } from '@/composables/useReservationHistory.js';
import { useAuthStore } from '@/stores/authStore.js';
import {
  DEFAULT_CURRENCY,
  formatCurrency,
  getUserCurrency,
  normalizeCurrencyCode,
  resolveCurrencyCode,
} from '@/utils/currency.js';

const route = useRoute();
const router = useRouter();

const authStore = useAuthStore();
const { user } = storeToRefs(authStore);
const preferredCurrency = computed(() => getUserCurrency(user.value));

const eventRef = ref(null);
const isLoadingEvent = ref(false);
const eventError = ref('');

const paymentState = reactive({
  status: 'processing',
  message: '',
  details: null,
});

const isLoadingPayment = ref(false);
const paymentError = ref('');

const { addReservation, loadReservations } = useReservationHistory();
loadReservations();
const hasRecordedReservation = ref(false);

const availabilitySyncState = reactive({
  status: 'idle',
  isSyncing: false,
  message: '',
  error: '',
});

const quantity = computed(() => {
  const raw = Number.parseInt(route.query.qty ?? '1', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 1;
});

const amount = computed(() => {
  const raw = Number.parseFloat(route.query.amount ?? '0');
  return Number.isFinite(raw) ? raw : 0;
});

const currency = computed(() =>
  resolveCurrencyCode(
    normalizeCurrencyCode(route.query.currency) || preferredCurrency.value,
    DEFAULT_CURRENCY
  )
);
const eventId = computed(() => (route.query.eventId ? String(route.query.eventId) : ''));
const paymentIntentId = computed(() =>
  route.query.payment_intent ? String(route.query.payment_intent) : ''
);

let lastEventRequest = 0;

const shouldSyncAvailability = computed(
  () =>
    paymentState.status === 'succeeded' &&
    Boolean(paymentIntentId.value) &&
    Boolean(eventId.value) &&
    quantity.value > 0
);

const currencyFormatter = computed(
  () =>
    (value) =>
      formatCurrency(value, {
        currency: currency.value,
        locale: 'fr-CA',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
);

const formattedTotal = computed(() => currencyFormatter.value(amount.value || 0));

const statusLabel = computed(() => {
  switch (paymentState.status) {
    case 'succeeded':
      return 'Paiement confirmé';
    case 'processing':
      return 'Paiement en cours';
    case 'requires_payment_method':
      return 'Action requise';
    default:
      return 'Statut du paiement';
  }
});

const statusClass = computed(() => {
  switch (paymentState.status) {
    case 'succeeded':
      return 'status-pill status-pill--success';
    case 'processing':
      return 'status-pill status-pill--pending';
    case 'requires_payment_method':
      return 'status-pill status-pill--warning';
    default:
      return 'status-pill status-pill--unknown';
  }
});

async function fetchEvent() {
  if (!eventId.value) return;
  const requestId = ++lastEventRequest;
  isLoadingEvent.value = true;
  eventError.value = '';
  try {
    const { data } = await apiClient.get(
      `/events/${encodeURIComponent(eventId.value)}`,
      {
        params: { currency: preferredCurrency.value },
      }
    );

    if (requestId !== lastEventRequest) {
      return;
    }

    eventRef.value = data?.event ?? null;
    if (!eventRef.value) {
      eventError.value = "Impossible d'afficher l'événement.";
    }
  } catch (error) {
    if (requestId !== lastEventRequest) {
      return;
    }

    const status = error?.response?.status;
    if (status === 404) {
      eventError.value = 'Événement introuvable.';
    } else {
      eventError.value = "Impossible de charger les détails de l'événement.";
    }
  } finally {
    if (requestId === lastEventRequest) {
      isLoadingEvent.value = false;
    }
  }
}

async function fetchPaymentStatus() {
  if (!paymentIntentId.value) {
    paymentState.status = amount.value > 0 ? 'succeeded' : 'processing';
    paymentState.message =
      amount.value > 0
        ? 'Votre paiement a été enregistré. Un reçu vous sera envoyé par courriel.'
        : 'Le paiement est en cours de traitement.';
    return;
  }

  isLoadingPayment.value = true;
  paymentError.value = '';

  try {
    const { data } = await apiClient.get(
      `/payments/intent/${encodeURIComponent(paymentIntentId.value)}`
    );
    paymentState.details = data?.paymentIntent ?? null;
    paymentState.status = data?.paymentIntent?.status || 'processing';

    if (paymentState.status === 'succeeded') {
      paymentState.message =
        'Merci! Votre paiement est confirmé. Vous recevrez un courriel de confirmation sous peu.';
    } else if (paymentState.status === 'processing') {
      paymentState.message =
        'Votre paiement est en cours de vérification. Nous vous enverrons un courriel lorsque ce sera terminé.';
    } else if (paymentState.status === 'requires_payment_method') {
      paymentState.message =
        'Le paiement nécessite une action supplémentaire. Veuillez réessayer avec une autre méthode.';
    } else {
      paymentState.message =
        "Nous n'avons pas pu confirmer le paiement. Si le problème persiste, contactez le support.";
    }
  } catch (error) {
    paymentState.status = 'unknown';
    paymentState.message =
      'Nous ne pouvons pas confirmer l’état du paiement pour le moment. Veuillez réessayer dans quelques instants.';
    paymentError.value = error?.response?.data?.message || error?.message || 'Erreur de paiement';
  } finally {
    isLoadingPayment.value = false;
  }
}

async function syncTicketAvailability(force = false) {
  if (!shouldSyncAvailability.value) return;
  if (availabilitySyncState.isSyncing) return;
  if (!force && ['success', 'skipped'].includes(availabilitySyncState.status)) {
    return;
  }

  availabilitySyncState.isSyncing = true;
  availabilitySyncState.status = 'pending';
  availabilitySyncState.message = '';
  availabilitySyncState.error = '';

  try {
    const { data } = await apiClient.post('/payments/confirm', {
      paymentIntentId: paymentIntentId.value,
      eventId: eventId.value,
    });

    if (data?.event) {
      eventRef.value = data.event;
    }

    if (data?.processed) {
      availabilitySyncState.status = 'success';
      availabilitySyncState.message =
        'Les places restantes de votre événement ont été mises à jour.';
    } else {
      availabilitySyncState.status = 'skipped';
      availabilitySyncState.message =
        data?.message || 'Les billets pour ce paiement ont déjà été déduits.';
    }
  } catch (error) {
    availabilitySyncState.status = 'error';
    availabilitySyncState.error =
      error?.response?.data?.message ||
      error?.message ||
      "Impossible de mettre à jour la disponibilité des billets. Veuillez réessayer.";
  } finally {
    availabilitySyncState.isSyncing = false;
  }
}

function recordReservationIfNeeded() {
  if (hasRecordedReservation.value) return;
  if (paymentState.status !== 'succeeded') return;

  const event = eventRef.value || {};
  const eventIdValue =
    event.id || event._id || eventId.value || paymentState.details?.metadata?.eventId;
  if (!eventIdValue) {
    return;
  }

  addReservation({
    eventId: eventIdValue,
    eventTitle: event.title || paymentState.details?.description || 'Événement',
    startsAt: event.startsAt || null,
    location: event.place
      ? {
          name: event.place.name || '',
          city: event.place.city || '',
          country: event.place.country || '',
        }
      : null,
    quantity: quantity.value,
    totalAmount: amount.value,
    currency: currency.value,
    paymentIntentId: paymentIntentId.value || undefined,
    recordedAt: new Date().toISOString(),
  });

  hasRecordedReservation.value = true;
}

function goToEvents() {
  router.push({ name: 'events' });
}

function manageBooking() {
  if (eventId.value) {
    router.push({ name: 'event-detail', params: { id: eventId.value } });
  } else {
    goToEvents();
  }
}

onMounted(async () => {
  await Promise.all([fetchEvent(), fetchPaymentStatus()]);
});

watch(preferredCurrency, (newCurrency, oldCurrency) => {
  if (newCurrency === oldCurrency) return;
  fetchEvent();
});

watch(
  () => shouldSyncAvailability.value,
  (shouldSync) => {
    if (shouldSync) {
      syncTicketAvailability();
    }
  },
  { immediate: true }
);

watch(
  [
    () => paymentState.status,
    () => eventRef.value,
    () => paymentIntentId.value,
  ],
  () => {
    recordReservationIfNeeded();
  }
);
</script>

<template>
  <section class="success">
    <div class="container">
      <div class="card">
        <header class="hero">
          <ion-icon class="hero__icon" name="checkmark-circle-outline"></ion-icon>
          <h1 class="hero__title">Merci pour votre achat!</h1>
          <p class="hero__subtitle">Vos billets sont presque prêts.</p>
        </header>

        <div class="status-block">
          <span :class="statusClass">{{ statusLabel }}</span>
          <p class="status-message">{{ paymentState.message }}</p>
          <p v-if="paymentError" class="status-error">{{ paymentError }}</p>
          <p
            v-if="availabilitySyncState.message && availabilitySyncState.status !== 'error'"
            class="status-info"
          >
            {{ availabilitySyncState.message }}
          </p>
          <p v-if="availabilitySyncState.status === 'error'" class="status-error">
            {{ availabilitySyncState.error }}
            <button
              class="retry-button"
              type="button"
              @click="syncTicketAvailability(true)"
            >
              Réessayer
            </button>
          </p>
        </div>

        <div class="grid">
          <article class="panel">
            <h2 class="panel__title">Résumé de la commande</h2>
            <dl class="summary">
              <div class="summary__row">
                <dt>Nombre de billets</dt>
                <dd>{{ quantity }}</dd>
              </div>
              <div class="summary__row">
                <dt>Montant total</dt>
                <dd>{{ formattedTotal }}</dd>
              </div>
              <div v-if="paymentState.details?.id" class="summary__row">
                <dt>Identifiant de paiement</dt>
                <dd>{{ paymentState.details.id }}</dd>
              </div>
            </dl>

            <div class="actions">
              <button class="btn" type="button" @click="manageBooking">
                Voir les détails de l'événement
              </button>
              <button class="btn btn--ghost" type="button" @click="goToEvents">
                Explorer d'autres événements
              </button>
            </div>
          </article>

          <article class="panel">
            <h2 class="panel__title">Votre événement</h2>
            <p v-if="isLoadingEvent" class="muted">Chargement…</p>
            <p v-else-if="eventError" class="status-error">{{ eventError }}</p>
            <template v-else-if="eventRef">
              <h3 class="event-title">{{ eventRef.title }}</h3>
              <p class="event-meta">
                {{ new Date(eventRef.startsAt).toLocaleString('fr-CA', {
                  dateStyle: 'full',
                  timeStyle: 'short',
                }) }}
              </p>
              <p v-if="eventRef.place" class="event-meta">
                {{ [eventRef.place.name, eventRef.place.city, eventRef.place.country].filter(Boolean).join(', ') }}
              </p>
            </template>
          </article>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.success {
  background: linear-gradient(135deg, #eef2ff, #f8fafc);
  min-height: 100vh;
  padding: 48px 0 64px;
}

.container {
  width: min(1080px, 92%);
  margin: 0 auto;
}

.card {
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 10px 32px rgba(15, 23, 42, 0.12);
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.hero {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.hero__icon {
  font-size: 4rem;
  color: #22c55e;
}

.hero__title {
  margin: 0;
  font-size: 2rem;
  color: #0f172a;
}

.hero__subtitle {
  margin: 0;
  color: #475569;
}

.status-block {
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.status-message {
  margin: 0;
  color: #1f2937;
}

.status-error {
  color: #dc2626;
  margin: 0;
}

.status-info {
  color: #0369a1;
  margin: 0;
}

.retry-button {
  background: none;
  border: none;
  color: #2563eb;
  font-weight: 600;
  cursor: pointer;
  padding: 0 0 0 0.35rem;
  text-decoration: underline;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.35rem 0.85rem;
  border-radius: 999px;
  font-weight: 600;
  width: fit-content;
  margin: 0 auto;
}

.status-pill--success {
  background: rgba(34, 197, 94, 0.12);
  color: #166534;
}

.status-pill--pending {
  background: rgba(59, 130, 246, 0.12);
  color: #1d4ed8;
}

.status-pill--warning {
  background: rgba(234, 179, 8, 0.18);
  color: #92400e;
}

.status-pill--unknown {
  background: rgba(148, 163, 184, 0.2);
  color: #0f172a;
}

.grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 24px;
}

@media (min-width: 900px) {
  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.panel {
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.panel__title {
  margin: 0;
  font-size: 1.25rem;
  color: #0f172a;
}

.summary {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
}

.summary__row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  color: #475569;
}

.summary__row dt {
  font-weight: 600;
}

.summary__row dd {
  margin: 0;
  font-weight: 600;
  color: #111827;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

@media (min-width: 600px) {
  .actions {
    flex-direction: row;
  }
}

.btn {
  flex: 1;
  padding: 0.85rem 1.1rem;
  border-radius: 12px;
  border: none;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  background: #2563eb;
  color: #fff;
}

.btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 20px rgba(37, 99, 235, 0.2);
}

.btn--ghost {
  background: #f8fafc;
  color: #1e3a8a;
}

.btn--ghost:hover {
  box-shadow: 0 10px 20px rgba(148, 163, 184, 0.25);
}

.event-title {
  margin: 0;
  color: #0f172a;
  font-weight: 700;
}

.event-meta {
  margin: 0;
  color: #475569;
}

.muted {
  color: #94a3b8;
  margin: 0;
}
</style>
