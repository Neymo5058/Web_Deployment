<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { usePreferredCurrency } from '@/composables/usePreferredCurrency.js';
import { DEFAULT_CURRENCY } from '@/utils/currency.js';

const props = defineProps({
  events: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
  error: {
    type: String,
    default: '',
  },
});

const emit = defineEmits(['approve', 'reject', 'refresh']);

const { t, locale } = useI18n();
const { preferredCurrency } = usePreferredCurrency();

const searchTerm = ref('');
const statusFilter = ref('pending');
const selectedEventId = ref(null);

const normalizedEvents = computed(() =>
  (props.events ?? []).map((event, index) => ({
    id: event?.id ?? event?._id ?? `event-${index}`,
    title: event?.title ?? '',
    subtitle: event?.subtitle ?? '',
    description: event?.description ?? '',
    organizer:
      event?.organizer ?? event?.organizerName ?? event?.owner ?? event?.createdBy ?? '',
    status: (event?.status ?? 'pending').toString().toLowerCase(),
    submittedAt: event?.submittedAt ?? event?.createdAt ?? null,
    startsAt: event?.startsAt ?? null,
    hour: event?.hour ?? event?.time ?? null,
    place: event?.place ?? {
      name: event?.venueName,
      city: event?.city,
      country: event?.country,
    },
    capacity: Number.isFinite(Number(event?.capacity))
      ? Number(event.capacity)
      : event?.capacity ?? null,
    available: Number.isFinite(Number(event?.available))
      ? Number(event.available)
      : event?.available ?? null,
    price: Number.isFinite(Number(event?.price)) ? Number(event.price) : event?.price ?? null,
    currency: event?.currency ?? preferredCurrency.value ?? DEFAULT_CURRENCY,
    raw: event,
  }))
);

const filteredEvents = computed(() => {
  const term = searchTerm.value.trim().toLowerCase();
  const currentStatus = statusFilter.value;

  const list = normalizedEvents.value.filter((event) => {
    const matchesSearch = term
      ? [event.title, event.organizer, event.subtitle]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(term))
      : true;
    const matchesStatus =
      currentStatus === 'all' ? true : (event.status || 'pending') === currentStatus;
    return matchesSearch && matchesStatus;
  });

  return list.sort((a, b) => {
    const aDate = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
    const bDate = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
    return bDate - aDate;
  });
});

const selectedEvent = computed(() => {
  if (!filteredEvents.value.length) return null;
  return (
    filteredEvents.value.find((event) => event.id === selectedEventId.value) ||
    filteredEvents.value[0]
  );
});

watch(
  filteredEvents,
  (events) => {
    if (!events.length) {
      selectedEventId.value = null;
      return;
    }
    if (!events.some((event) => event.id === selectedEventId.value)) {
      selectedEventId.value = events[0].id;
    }
  },
  { immediate: true }
);

const formatDate = (value) => {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat(locale.value, {
      dateStyle: 'medium',
    }).format(new Date(value));
  } catch (error) {
    return value;
  }
};

const formatTime = (value) => {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat(locale.value, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(
      typeof value === 'string' && value.match(/^\d{2}:\d{2}$/)
        ? new Date(`1970-01-01T${value}:00`)
        : new Date(value)
    );
  } catch (error) {
    return value;
  }
};

const formatDateTime = (value) => {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat(locale.value, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch (error) {
    return value;
  }
};

const formatPrice = (value, currency) => {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  const numeric = Number(value);
  const amount = Number.isFinite(numeric) ? numeric : value;
  try {
    return new Intl.NumberFormat(locale.value, {
      style: 'currency',
      currency: currency || preferredCurrency.value || DEFAULT_CURRENCY,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch (error) {
    const fallback = preferredCurrency.value || DEFAULT_CURRENCY;
    return `${amount} ${currency || fallback}`;
  }
};

const statusClass = (status) => {
  switch (status) {
    case 'approved':
      return 'status-pill status-pill--approved';
    case 'rejected':
      return 'status-pill status-pill--rejected';
    case 'pending':
    default:
      return 'status-pill status-pill--pending';
  }
};

const statusLabel = (status) => {
  const key = `dashboard.admin.approval.status.${status}`;
  const translation = t(key);
  return translation === key
    ? t('dashboard.admin.approval.status.unknown')
    : translation;
};

const handleApprove = (event) => {
  if (!event) return;
  emit('approve', event.raw ?? event);
};

const handleReject = (event) => {
  if (!event) return;
  emit('reject', event.raw ?? event);
};

const handleRefresh = () => {
  emit('refresh');
};
</script>

<template>
  <section class="approval">
    <header class="approval__header">
      <div>
        <h2 class="approval__title">{{ t('dashboard.admin.approval.title') }}</h2>
        <p class="approval__subtitle">
          {{ t('dashboard.admin.approval.subtitle') }}
        </p>
      </div>
      <button
        type="button"
        class="approval__refresh"
        :disabled="loading"
        @click="handleRefresh"
      >
        {{ t('dashboard.actions.refresh') }}
      </button>
    </header>

    <div class="approval__toolbar">
      <div class="approval__search">
        <label class="sr-only" for="approval-search">
          {{ t('dashboard.admin.approval.searchLabel') }}
        </label>
        <input
          id="approval-search"
          v-model="searchTerm"
          type="search"
          :placeholder="t('dashboard.admin.approval.searchPlaceholder')"
          autocomplete="off"
        />
      </div>
      <label class="approval__filter">
        <span>{{ t('dashboard.admin.approval.filterLabel') }}</span>
        <select v-model="statusFilter">
          <option value="all">{{ t('dashboard.admin.approval.status.all') }}</option>
          <option value="pending">{{ t('dashboard.admin.approval.status.pending') }}</option>
          <option value="approved">{{ t('dashboard.admin.approval.status.approved') }}</option>
          <option value="rejected">{{ t('dashboard.admin.approval.status.rejected') }}</option>
        </select>
      </label>
    </div>

    <div v-if="loading" class="approval__state approval__state--loading">
      {{ t('dashboard.states.loading') }}
    </div>
    <div v-else-if="error" class="approval__state approval__state--error">
      {{ error }}
    </div>
    <div v-else class="approval__content">
      <div class="approval__list">
        <div v-if="!filteredEvents.length" class="approval__empty">
          <p v-if="statusFilter === 'pending' && !searchTerm">
            {{ t('dashboard.admin.approval.emptyPending') }}
          </p>
          <p v-else>
            {{ t('dashboard.admin.approval.emptyGeneric') }}
          </p>
        </div>
        <ul v-else class="approval__items" role="list">
          <li
            v-for="event in filteredEvents"
            :key="event.id"
            :class="['approval__item', { 'approval__item--active': selectedEvent?.id === event.id }]"
          >
            <button
              type="button"
              class="approval__item-button"
              @click="selectedEventId = event.id"
            >
              <div class="approval__item-header">
                <h3 class="approval__item-title">{{ event.title || t('dashboard.admin.approval.untitled') }}</h3>
                <span :class="statusClass(event.status)">
                  {{ statusLabel(event.status) }}
                </span>
              </div>
              <p class="approval__item-meta">
                <span class="approval__item-organizer">
                  {{ event.organizer || t('dashboard.admin.approval.unknownOrganizer') }}
                </span>
                <span class="approval__item-date">
                  {{ t('dashboard.admin.approval.submittedAt', { date: formatDateTime(event.submittedAt) }) }}
                </span>
              </p>
            </button>
          </li>
        </ul>
      </div>

      <aside class="approval__details" v-if="selectedEvent">
        <header class="approval__details-header">
          <h3 class="approval__details-title">
            {{ selectedEvent.title || t('dashboard.admin.approval.untitled') }}
          </h3>
          <span :class="statusClass(selectedEvent.status)">
            {{ statusLabel(selectedEvent.status) }}
          </span>
        </header>

        <p v-if="selectedEvent.subtitle" class="approval__details-subtitle">
          {{ selectedEvent.subtitle }}
        </p>

        <dl class="approval__details-grid">
          <div>
            <dt>{{ t('dashboard.admin.approval.details.organizer') }}</dt>
            <dd>{{ selectedEvent.organizer || t('dashboard.admin.approval.unknownOrganizer') }}</dd>
          </div>
          <div>
            <dt>{{ t('dashboard.admin.approval.details.submitted') }}</dt>
            <dd>{{ formatDateTime(selectedEvent.submittedAt) }}</dd>
          </div>
          <div>
            <dt>{{ t('dashboard.admin.approval.details.date') }}</dt>
            <dd>{{ formatDate(selectedEvent.startsAt) }}</dd>
          </div>
          <div>
            <dt>{{ t('dashboard.admin.approval.details.time') }}</dt>
            <dd>{{ formatTime(selectedEvent.hour || selectedEvent.startsAt) }}</dd>
          </div>
          <div>
            <dt>{{ t('dashboard.admin.approval.details.location') }}</dt>
            <dd>
              {{
                [
                  selectedEvent.place?.name,
                  selectedEvent.place?.city,
                  selectedEvent.place?.country,
                ]
                  .filter(Boolean)
                  .join(', ') || t('dashboard.admin.approval.unknownLocation')
              }}
            </dd>
          </div>
          <div>
            <dt>{{ t('dashboard.admin.approval.details.capacity') }}</dt>
            <dd>
              <template
                v-if="selectedEvent.capacity !== null && selectedEvent.capacity !== undefined"
              >
                {{ selectedEvent.capacity }}
                <span v-if="selectedEvent.available !== null && selectedEvent.available !== undefined">
                  ·
                  {{
                    t('dashboard.admin.approval.details.available', {
                      available: selectedEvent.available,
                    })
                  }}
                </span>
              </template>
              <template v-else>—</template>
            </dd>
          </div>
          <div>
            <dt>{{ t('dashboard.admin.approval.details.price') }}</dt>
            <dd>{{ formatPrice(selectedEvent.price, selectedEvent.currency) }}</dd>
          </div>
        </dl>

        <section v-if="selectedEvent.description" class="approval__details-description">
          <h4>{{ t('dashboard.admin.approval.details.description') }}</h4>
          <p>{{ selectedEvent.description }}</p>
        </section>

        <footer class="approval__details-actions">
          <button type="button" class="btn btn--approve" @click="handleApprove(selectedEvent)">
            {{ t('dashboard.admin.approval.actions.approve') }}
          </button>
          <button type="button" class="btn btn--reject" @click="handleReject(selectedEvent)">
            {{ t('dashboard.admin.approval.actions.reject') }}
          </button>
        </footer>
      </aside>
      <aside v-else class="approval__details approval__details--empty">
        {{ t('dashboard.admin.approval.selectPlaceholder') }}
      </aside>
    </div>
  </section>
</template>

<style scoped>
.approval {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.approval__header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
}

.approval__title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
}

.approval__subtitle {
  margin: 0.35rem 0 0;
  color: #4b5563;
  font-size: 0.95rem;
  line-height: 1.6;
}

.approval__refresh {
  border: 1px solid #2563eb;
  background: #2563eb;
  color: #fff;
  padding: 0.5rem 1rem;
  border-radius: 0.75rem;
  cursor: pointer;
  font-weight: 600;
  transition: background 0.2s ease;
}

.approval__refresh:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.approval__refresh:not(:disabled):hover {
  background: #1d4ed8;
}

.approval__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
}

.approval__search {
  flex: 1 1 240px;
  max-width: 360px;
}

.approval__search input {
  width: 100%;
  padding: 0.55rem 0.75rem;
  border-radius: 0.75rem;
  border: 1px solid #d1d5db;
  font-size: 0.95rem;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.approval__search input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.2);
}

.approval__filter {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  color: #1f2937;
}

.approval__filter select {
  border-radius: 0.75rem;
  border: 1px solid #d1d5db;
  padding: 0.45rem 0.75rem;
  font-size: 0.95rem;
  background-color: #fff;
}

.approval__state {
  padding: 1rem 1.25rem;
  border-radius: 0.75rem;
  font-weight: 500;
}

.approval__state--loading {
  background: #eff6ff;
  color: #1d4ed8;
}

.approval__state--error {
  background: #fee2e2;
  color: #b91c1c;
}

.approval__content {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 1.5rem;
}

@media (max-width: 960px) {
  .approval__content {
    grid-template-columns: 1fr;
  }
}

.approval__list {
  background: #f9fafb;
  border-radius: 1rem;
  border: 1px solid #e5e7eb;
  padding: 1rem;
  min-height: 320px;
}

.approval__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  color: #6b7280;
  font-size: 0.95rem;
}

.approval__items {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.approval__item {
  border-radius: 0.75rem;
  border: 1px solid transparent;
  transition: border-color 0.2s ease, background-color 0.2s ease;
}

.approval__item--active {
  border-color: #2563eb;
  background: #eff6ff;
}

.approval__item-button {
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  cursor: pointer;
}

.approval__item-button:hover {
  background: rgba(37, 99, 235, 0.08);
  border-radius: 0.75rem;
}

.approval__item-header {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  align-items: center;
}

.approval__item-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #111827;
}

.approval__item-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  font-size: 0.85rem;
  color: #6b7280;
}

.approval__details {
  border: 1px solid #e5e7eb;
  border-radius: 1rem;
  padding: 1.25rem;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: 320px;
}

.approval__details--empty {
  justify-content: center;
  align-items: center;
  color: #6b7280;
  text-align: center;
}

.approval__details-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
}

.approval__details-title {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 700;
  color: #111827;
}

.approval__details-subtitle {
  margin: -0.5rem 0 0;
  color: #4b5563;
  font-size: 0.95rem;
}

.approval__details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem 1rem;
  margin: 0;
}

.approval__details-grid dt {
  font-size: 0.8rem;
  text-transform: uppercase;
  font-weight: 600;
  color: #6b7280;
  margin-bottom: 0.25rem;
}

.approval__details-grid dd {
  margin: 0;
  font-size: 0.95rem;
  color: #111827;
}

.approval__details-description h4 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.approval__details-description p {
  margin: 0.5rem 0 0;
  line-height: 1.6;
  color: #374151;
}

.approval__details-actions {
  margin-top: auto;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.btn {
  border-radius: 0.75rem;
  padding: 0.6rem 1.2rem;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.btn:focus-visible {
  outline: 3px solid rgba(37, 99, 235, 0.35);
  outline-offset: 2px;
}

.btn--approve {
  background: #059669;
  color: #fff;
}

.btn--approve:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 16px rgba(5, 150, 105, 0.2);
}

.btn--reject {
  background: #ef4444;
  color: #fff;
}

.btn--reject:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 16px rgba(239, 68, 68, 0.2);
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.3rem 0.6rem;
  border-radius: 999px;
}

.status-pill--pending {
  background: #fef3c7;
  color: #b45309;
}

.status-pill--approved {
  background: #dcfce7;
  color: #15803d;
}

.status-pill--rejected {
  background: #fee2e2;
  color: #b91c1c;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
