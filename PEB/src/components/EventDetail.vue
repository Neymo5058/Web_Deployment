<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';

import Spinner from '@/components/Spinner.vue';
import apiClient from '@/services/apiClient.js';
import CartSummary from '../components/CartSummary.vue';
import { useCartStore } from '@/stores/cartStore.js';
import { useAuthStore } from '@/stores/authStore.js';
import { storeToRefs } from 'pinia';
import {
  DEFAULT_CURRENCY,
  formatCurrency,
  getUserCurrency,
  resolveCurrencyCode,
} from '@/utils/currency.js';
import BaseBackBtn from './BaseBackBtn.vue';
import { resolveApiError } from '@/utils/errorHandling.js';
const { t, te, locale } = useI18n();
const route = useRoute();
const router = useRouter();
const event = ref(null);
const isLoading = ref(false);
const errorMessage = ref('');
const cart = useCartStore();
let pendingRequestId = null;

const authStore = useAuthStore();
const { user, isAuthenticated } = storeToRefs(authStore);

const preferredCurrency = computed(
  () => getUserCurrency(user.value) || DEFAULT_CURRENCY
);

const formattedDate = computed(() => formatDate(event.value?.startsAt));
const formattedLocation = computed(() => formatLocation(event.value?.place));
const eventPricing = computed(() => {
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

const formattedPrice = computed(() =>
  formatPrice(eventPricing.value.amount, eventPricing.value.currency)
);
const formattedCapacity = computed(() => formatCapacity(event.value?.capacity));
const formattedAvailability = computed(() =>
  formatAvailability(event.value?.available, event.value?.capacity)
);
const eventImageAlt = computed(() => {
  if (!event.value) return '';
  if (event.value.imageAlt) return event.value.imageAlt;
  if (event.value.title)
    return t('event.imageAlt', { title: event.value.title });
  return t('event.imageAltFallback');
});

const normalizedLocale = computed(() =>
  locale.value === 'fr' ? 'fr-FR' : 'en-US'
);

const canEditEvent = computed(() => {
  if (!event.value || !isAuthenticated.value) {
    return false;
  }

  const role = user.value?.role;
  if (role !== 'organizer') {
    return false;
  }

  const normalizeId = (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string' || typeof value === 'number') {
      const normalized = String(value).trim();
      return normalized.length ? normalized : null;
    }
    if (typeof value === 'object') {
      if ('id' in value && value.id) return normalizeId(value.id);
      if ('_id' in value && value._id) return normalizeId(value._id);
    }
    return null;
  };

  const normalizeLabel = (value) => {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    return normalized.length ? normalized : null;
  };

  const userIds = new Set(
    [user.value?.id, user.value?._id, user.value?.userId]
      .map(normalizeId)
      .filter(Boolean)
  );

  const userLabels = new Set(
    [
      user.value?.fullname,
      user.value?.name,
      user.value?.email,
      user.value?.organizerName,
    ]
      .map(normalizeLabel)
      .filter(Boolean)
  );

  const eventCandidateIds = [
    event.value.organizerId,
    event.value.organizerUserId,
    event.value.ownerId,
    event.value.createdById,
    event.value.createdBy,
    event.value.owner?.id,
    event.value.owner?._id,
    event.value.createdBy?.id,
    event.value.createdBy?._id,
  ]
    .map(normalizeId)
    .filter(Boolean);

  if (eventCandidateIds.some((id) => userIds.has(id))) {
    return true;
  }

  const eventCandidateLabels = [
    event.value.organizer,
    event.value.organizerName,
    event.value.organizerEmail,
    event.value.owner,
    event.value.ownerName,
    event.value.owner?.fullname,
    event.value.owner?.email,
    event.value.createdBy,
    event.value.createdByName,
    event.value.createdBy?.fullname,
    event.value.createdBy?.email,
  ]
    .map(normalizeLabel)
    .filter(Boolean);

  return eventCandidateLabels.some((label) => userLabels.has(label));
});

const editEventLink = computed(() => {
  if (!event.value) {
    return { name: 'organizer-dashboard' };
  }

  const identifier = event.value.id || event.value._id;

  if (!identifier) {
    return { name: 'organizer-dashboard' };
  }

  return {
    name: 'organizer-dashboard',
    query: { editEvent: identifier },
  };
});

watch(
  () => route.params.id,
  (id) => {
    if (id) {
      fetchEvent(id);
    } else {
      pendingRequestId = null;
      isLoading.value = false;
      event.value = null;
      errorMessage.value = t('eventDetail.notFound');
    }
  },
  { immediate: true }
);

watch(preferredCurrency, (newCurrency, oldCurrency) => {
  if (newCurrency === oldCurrency) return;
  const id = route.params.id;
  if (id) {
    fetchEvent(id);
  }
});

async function fetchEvent(id) {
  const requestId = String(id);
  pendingRequestId = requestId;
  isLoading.value = true;
  errorMessage.value = '';

  try {
    const { data } = await apiClient.get(`/events/${requestId}`, {
      params: { currency: preferredCurrency.value },
    });

    if (pendingRequestId !== requestId) {
      return;
    }

    const eventData = data?.event;

    if (eventData) {
      event.value = eventData;
    } else {
      event.value = null;
      errorMessage.value = t('eventDetail.notFound');
    }
  } catch (err) {
    if (pendingRequestId !== requestId) {
      return;
    }

    event.value = null;
    const status = err?.response?.status;
    const { type, message } = resolveApiError(err);

    if (status === 404 || status === 400) {
      errorMessage.value = t('eventDetail.notFound');
    } else if (type === 'timeout') {
      errorMessage.value = t('eventDetail.errorTimeout');
    } else if (type === 'message' && message) {
      errorMessage.value = t('eventDetail.errorWithMessage', {
        message,
      });
    } else {
      errorMessage.value = t('eventDetail.error');
    }
  } finally {
    if (pendingRequestId === requestId) {
      isLoading.value = false;
    }
  }
}

function goBack() {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push({ name: 'events' });
  }
}

function formatDate(date) {
  if (!date) return '';

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return '';

  try {
    return new Intl.DateTimeFormat(normalizedLocale.value, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(parsedDate);
  } catch (_error) {
    return parsedDate.toLocaleDateString();
  }
}

function formatLocation(place) {
  if (!place || typeof place !== 'object') return '';

  return [place.name, place.city, place.country].filter(Boolean).join(', ');
}

function formatPrice(price, currency = DEFAULT_CURRENCY) {
  if (typeof price !== 'number') return '';

  const resolved = resolveCurrencyCode(currency, DEFAULT_CURRENCY);

  return formatCurrency(price, {
    currency: resolved,
    locale: normalizedLocale.value,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatCapacity(capacity) {
  if (typeof capacity !== 'number') return '';
  if (capacity <= 0) return t('eventDetail.soldOut');

  try {
    return new Intl.NumberFormat(normalizedLocale.value).format(capacity);
  } catch (_error) {
    return `${capacity}`;
  }
}

function formatAvailability(available, capacity) {
  if (typeof available !== 'number') return '';
  if (available <= 0) return t('eventDetail.soldOut');

  const pluralRules = new Intl.PluralRules(normalizedLocale.value);
  const pluralCategory = pluralRules.select(available);
  const labelBaseKey = 'eventDetail.availabilityLabel';
  const specificLabelKey = `${labelBaseKey}.${pluralCategory}`;

  let availabilityLabel = '';
  if (typeof te === 'function' && te(specificLabelKey)) {
    availabilityLabel = t(specificLabelKey);
  } else if (
    pluralCategory !== 'other' &&
    typeof te === 'function' &&
    te(`${labelBaseKey}.other`)
  ) {
    availabilityLabel = t(`${labelBaseKey}.other`);
  }

  let formattedAvailable = `${available}`;
  let formattedCapacity =
    typeof capacity === 'number' && capacity > 0 ? `${capacity}` : null;

  try {
    const formatter = new Intl.NumberFormat(normalizedLocale.value);
    formattedAvailable = formatter.format(available);

    if (formattedCapacity !== null) {
      formattedCapacity = formatter.format(capacity);
    }
  } catch (_error) {
    formattedAvailable = `${available}`;

    if (formattedCapacity !== null) {
      formattedCapacity = `${capacity}`;
    }
  }

  if (formattedCapacity !== null) {
    return `${formattedAvailable}/${formattedCapacity}${
      availabilityLabel ? ` ${availabilityLabel}` : ''
    }`.trim();
  }

  return `${formattedAvailable}${
    availabilityLabel ? ` ${availabilityLabel}` : ''
  }`.trim();
}

// CART

function addToCart(payload) {
  cart.add(payload);

  if (event.value && event.value.available > 0) {
    event.value.available -= payload.quantity;
  }
}
</script>
<template>
  <section class="event-detail">
    <div class="event-detail__container">
      <BaseBackBtn class="event-detail__back" />

      <Spinner v-if="isLoading" class="event-detail__spinner" />

      <p
        v-else-if="errorMessage"
        class="event-detail__status event-detail__status--error"
      >
        {{ errorMessage }}
      </p>

      <template v-else-if="event">
        <!-- Grille principale -->
        <div class="event-detail__grid">
          <!-- Carte événement (gauche) -->
          <article class="event-detail__card">
            <div class="event-detail__media">
              <img
                v-if="event.imageUrl"
                :src="event.imageUrl"
                :alt="eventImageAlt"
                loading="lazy"
              />
            </div>

            <div class="event-detail__body">
              <h1 class="event-detail__title">{{ event.title }}</h1>
              <p v-if="event.subtitle" class="event-detail__subtitle">
                {{ event.subtitle }}
              </p>
              <div v-if="canEditEvent" class="event-detail__actions">
                <RouterLink :to="editEventLink" class="event-detail__edit-btn">
                  <ion-icon name="create-outline" aria-hidden="true"></ion-icon>
                  <span>{{ t('eventDetail.editEvent') }}</span>
                </RouterLink>
              </div>

              <!-- Faits en 2 colonnes (desktop) -->
              <div class="event-detail__facts">
                <!-- Colonne 1 -->
                <div class="event-detail__facts-col">
                  <div class="event-detail__fact">
                    <h2>{{ t('eventDetail.date') }}</h2>
                    <p>
                      <ion-icon name="calendar-clear-outline"></ion-icon>
                      <span>{{
                        formattedDate || t('eventDetail.unknown')
                      }}</span>
                    </p>
                  </div>

                  <div class="event-detail__fact">
                    <h2>{{ t('eventDetail.time') }}</h2>
                    <p>
                      <ion-icon name="time-outline"></ion-icon>
                      <span>{{ event.hour || t('eventDetail.unknown') }}</span>
                    </p>
                  </div>

                  <div class="event-detail__fact">
                    <h2>{{ t('eventDetail.location') }}</h2>
                    <p>
                      <ion-icon name="location-outline"></ion-icon>
                      <span>{{
                        formattedLocation || t('eventDetail.unknown')
                      }}</span>
                    </p>
                  </div>
                </div>

                <!-- Colonne 2 -->
                <div class="event-detail__facts-col">
                  <div class="event-detail__fact">
                    <h2>{{ t('eventDetail.organizer') }}</h2>
                    <p>
                      <ion-icon name="person-outline"></ion-icon>
                      <span>{{
                        event.organizer || t('eventDetail.unknown')
                      }}</span>
                    </p>
                  </div>

                  <div class="event-detail__fact">
                    <h2>{{ t('eventDetail.price') }}</h2>
                    <p>
                      <ion-icon name="pricetag-outline"></ion-icon>
                      <span>{{
                        formattedPrice || t('eventDetail.unknown')
                      }}</span>
                    </p>
                  </div>

                  <div class="event-detail__fact">
                    <h2>{{ t('eventDetail.available') }}</h2>
                    <p>
                      <ion-icon name="people-outline"></ion-icon>
                      <span>{{
                        formattedAvailability || t('eventDetail.unknown')
                      }}</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </article>

          <!-- Panneau de réservation-->
          <aside class="event-detail__aside">
            <CartSummary
              class="event-detail__summary"
              :event="event"
              :currency="preferredCurrency"
              :quantity="1"
              @reserve="addToCart"
            />
          </aside>
        </div>
      </template>

      <p v-else class="event-detail__status">{{ t('eventDetail.notFound') }}</p>
    </div>
  </section>
</template>

<style scoped>
/* Page */
.event-detail {
  --bg: #f4f6f8;
  --card: #ffffff;
  --text: #111827;
  --muted: #6b7280;
  --ring: rgba(2, 6, 23, 0.08);
  --radius: 16px;

  background: var(--bg);
  min-height: 100vh;
  padding: 28px 0 48px;
}

/* Conteneur */
.event-detail__container {
  width: min(1120px, 92%);
  margin: 0 auto;
}

.event-detail__back {
  margin-bottom: 18px;
}

.event-detail__spinner,
.event-detail__status {
  display: grid;
  place-items: center;
  min-height: 220px;
  color: var(--muted);
}
.event-detail__status--error {
  color: #dc2626;
}

.event-detail__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 28px;
}

.event-detail__card {
  background: var(--card);
  border-radius: var(--radius);
  box-shadow: 0 18px 40px var(--ring);
  overflow: hidden;
}

.event-detail__media {
  position: relative;
  background: #e5e7eb;
  aspect-ratio: 16 / 9;
  max-height: 420px;
}
.event-detail__media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.event-detail__body {
  padding: 0px 24px 24px;
}
.event-detail__title {
  font-size: 1.8rem;
  font-weight: 700;
  color: var(--text);
}
.event-detail__subtitle {
  color: var(--muted);
  font-size: 1.2rem;
}

.event-detail__actions {
  margin: 20px 0 8px;
  display: flex;
  justify-content: flex-end;
}

.event-detail__edit-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1.2rem;
  border-radius: 9999px;
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  color: #ffffff;
  font-weight: 600;
  text-decoration: none;
  box-shadow: 0 12px 30px rgba(37, 99, 235, 0.25);
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.event-detail__edit-btn:hover,
.event-detail__edit-btn:focus-visible {
  transform: translateY(-1px);
  background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
  box-shadow: 0 16px 36px rgba(30, 64, 175, 0.35);
}

.event-detail__edit-btn:focus-visible {
  outline: 3px solid rgba(96, 165, 250, 0.6);
  outline-offset: 3px;
}

.event-detail__edit-btn ion-icon {
  font-size: 1.1rem;
}

@media (max-width: 640px) {
  .event-detail__actions {
    justify-content: center;
  }

  .event-detail__edit-btn {
    width: 100%;
    justify-content: center;
  }
}

.event-detail__facts {
  display: grid;
}
.event-detail__facts-col {
  display: grid;
  gap: 2px;
}
.event-detail__fact {
  display: grid;
  gap: 5px;
}

.event-detail__fact h2 {
  font-size: 1.2rem;
  font-weight: 600;
  color: #374151;
}
.event-detail__fact p {
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: #1f2937;
  font-size: 1.1rem;
}
.event-detail__fact ion-icon {
  font-size: 1.8rem;
  flex: 0 0 auto;
  translate: 0 1px;
  color: #2563eb;
}

.event-detail__aside {
  position: relative;
}
.event-detail__summary {
  display: block;
  position: sticky;
  top: 24px;
}

/* Responsive */
@media (min-width: 960px) {
  .event-detail__grid {
    grid-template-columns: 1.3fr 0.8fr;
    align-items: start;
  }

  .event-detail__facts {
    grid-template-columns: 1fr 1fr;
    gap: 18px 24px;
  }
}
</style>
