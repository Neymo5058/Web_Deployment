<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';

import { fetchOrganizerMetrics } from '@/services/dashboardService.js';
import { acknowledgeNotification as acknowledgeOrganizerNotification } from '@/services/notificationService.js';
import OrganizerEventForm from '@/components/OrganizerEventForm.vue';
import { useAuthStore } from '@/stores/authStore.js';
import { DEFAULT_CURRENCY, getUserCurrency } from '@/utils/currency.js';

const authStore = useAuthStore();
const { isAuthenticated, user } = storeToRefs(authStore);
const { t, locale } = useI18n();

const metrics = ref(null);
const loading = ref(false);
const error = ref(null);
const dashboardAlert = ref(null);
const notificationAlert = ref(null);
const activeNotificationId = ref(null);
const acknowledgingNotification = ref(false);

const isOrganizer = computed(() => {
  const role = user.value?.role;
  return role === 'organizer' || role === 'admin';
});

const preferredCurrency = computed(() => getUserCurrency(user.value));

const formatNumber = (value) => {
  const number = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat(locale.value).format(number);
};

const formatPercent = (value) => {
  const number = Number.isFinite(value) ? value : 0;
  return `${number.toFixed(1)}%`;
};

const formatCurrency = (
  value,
  currency = preferredCurrency.value || DEFAULT_CURRENCY
) => {
  const amount = Number.isFinite(value) ? value : 0;
  try {
    return new Intl.NumberFormat(locale.value, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch (_error) {
    const fallback = preferredCurrency.value || DEFAULT_CURRENCY;
    return `${amount.toFixed(0)} ${currency || fallback}`;
  }
};

const resolveAmount = (entry, fallbackCurrency = preferredCurrency.value) => {
  const fallback = fallbackCurrency || DEFAULT_CURRENCY;

  if (Number.isFinite(entry)) {
    return { amount: Number(entry), currency: fallback };
  }

  if (!entry || typeof entry !== 'object') {
    const amount = Number(entry) || 0;
    return { amount, currency: fallback };
  }

  if (Number.isFinite(entry.amount)) {
    return {
      amount: Number(entry.amount),
      currency: entry.currency || entry.original?.currency || fallback,
    };
  }

  if (entry.original && Number.isFinite(entry.original.amount)) {
    return {
      amount: Number(entry.original.amount),
      currency: entry.original.currency || fallback,
    };
  }

  const amount = Number(entry) || 0;
  return { amount, currency: fallback };
};

const formatBreakdown = (entry, fallbackCurrency = preferredCurrency.value) => {
  const { amount, currency } = resolveAmount(entry, fallbackCurrency);
  return formatCurrency(amount, currency);
};

const formatDate = (value) => {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat(locale.value, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch (_error) {
    return value;
  }
};

const organizerName = computed(() => {
  return (
    metrics.value?.organizer?.fullname ||
    user.value?.fullname ||
    metrics.value?.organizer?.email ||
    user.value?.email ||
    ''
  );
});

const organizerEmail = computed(() => {
  return metrics.value?.organizer?.email || user.value?.email || '';
});

const organizerSubtitle = computed(() => {
  const name = organizerName.value?.trim();
  const email = organizerEmail.value?.trim();

  if (name && email) {
    return t('dashboard.organizer.subtitleWithEmail', { name, email });
  }

  if (name || email) {
    return name || email;
  }

  return t('dashboard.organizer.subtitleFallback');
});

const summaryFinancials = computed(
  () => metrics.value?.summary?.financials || {}
);

const summaryCards = computed(() => {
  const summary = metrics.value?.summary || {};
  const financials = summaryFinancials.value;

  const revenueValue = financials.revenueGenerated
    ? formatBreakdown(financials.revenueGenerated)
    : formatCurrency(summary.revenueGenerated ?? 0, preferredCurrency.value);

  const averageTicket = financials.averageTicketPrice
    ? formatBreakdown(financials.averageTicketPrice)
    : formatCurrency(summary.averageTicketPrice ?? 0, preferredCurrency.value);

  return [
    {
      key: 'totalEvents',
      label: t('dashboard.metrics.totalEvents'),
      value: formatNumber(summary.totalEvents ?? 0),
      hint: t('dashboard.metrics.upcomingEventsShort', {
        count: formatNumber(summary.upcomingEvents ?? 0),
      }),
    },
    {
      key: 'tickets',
      label: t('dashboard.metrics.ticketsSold'),
      value: formatNumber(summary.totalTicketsSold ?? 0),
      hint: t('dashboard.metrics.occupancyRateShort', {
        value: formatPercent(summary.occupancyRate ?? 0),
      }),
    },
    {
      key: 'revenue',
      label: t('dashboard.metrics.revenue'),
      value: revenueValue,
      hint: t('dashboard.metrics.averageTicketPriceShort', {
        value: averageTicket,
      }),
    },
  ];
});

const upcomingEvents = computed(() => metrics.value?.upcomingEvents || []);
const topEvents = computed(() => metrics.value?.topPerformers || []);
const events = computed(() => metrics.value?.events || []);

const selectedEventId = ref(null);
const editingEvent = computed(() => {
  if (!selectedEventId.value) {
    return null;
  }

  return (
    events.value.find((event) => event.id === selectedEventId.value) || null
  );
});

watch(events, (currentEvents) => {
  if (!selectedEventId.value) {
    return;
  }

  const exists = currentEvents.some(
    (event) => event.id === selectedEventId.value
  );
  if (!exists) {
    selectedEventId.value = null;
  }
});
const lastUpdated = computed(() =>
  metrics.value?.summary?.lastUpdated
    ? formatDate(metrics.value.summary.lastUpdated)
    : null
);

const selectUnreadNotification = (organizer) => {
  const notifications = Array.isArray(organizer?.notifications)
    ? organizer.notifications
    : [];
  const unread = notifications.find((entry) => !entry?.readAt);

  if (!unread) {
    activeNotificationId.value = null;
    notificationAlert.value = null;
    return;
  }

  const notificationId = unread.id || unread._id?.toString?.() || null;
  activeNotificationId.value = notificationId;

  if (unread.type === 'event-rejected') {
    const title = unread?.metadata?.eventTitle || unread.message || '';
    notificationAlert.value = {
      type: 'error',
      text: t('dashboard.organizer.notifications.eventRejected', { title }),
    };
    return;
  }

  notificationAlert.value = {
    type: 'info',
    text: unread.message || t('dashboard.organizer.notifications.generic'),
  };
};

const markLocalNotificationAsRead = (notificationId) => {
  if (!metrics.value?.organizer?.notifications || !notificationId) {
    return;
  }

  const list = metrics.value.organizer.notifications;
  const index = list.findIndex((entry) => {
    if (!entry) return false;
    if (entry.id && entry.id === notificationId) return true;
    if (entry._id && entry._id.toString() === notificationId) return true;
    return false;
  });

  if (index !== -1) {
    list[index] = {
      ...list[index],
      readAt: new Date().toISOString(),
    };
  }
};

const clearDashboardAlert = () => {
  dashboardAlert.value = null;
};

const handleEventCreated = async (createdEvent) => {
  dashboardAlert.value = {
    type: 'success',
    text: t('dashboard.organizer.createSuccess', {
      title: createdEvent?.title || '',
    }),
  };
  await loadMetrics();
};

const handleEventError = (message) => {
  const fallback = selectedEventId.value
    ? t('dashboard.organizer.updateError')
    : t('dashboard.organizer.createError');
  dashboardAlert.value = {
    type: 'error',
    text: message || fallback,
  };
};

const handleEventUpdated = async (updatedEvent) => {
  dashboardAlert.value = {
    type: 'success',
    text: t('dashboard.organizer.updateSuccess', {
      title: updatedEvent?.title || '',
    }),
  };
  selectedEventId.value = null;
  await loadMetrics();
};

const startEditing = (event) => {
  if (!event?.id) {
    return;
  }

  dashboardAlert.value = null;
  selectedEventId.value = event.id;
};

const cancelEditing = () => {
  selectedEventId.value = null;
};

const loadMetrics = async () => {
  if (!isAuthenticated.value || !isOrganizer.value) {
    metrics.value = null;
    notificationAlert.value = null;
    activeNotificationId.value = null;
    return;
  }

  loading.value = true;
  error.value = null;
  try {
    const { data } = await fetchOrganizerMetrics({
      currency: preferredCurrency.value,
    });
    metrics.value = data;
    selectUnreadNotification(data?.organizer);
  } catch (err) {
    error.value = err.response?.data?.message || err.message || 'Error';
  } finally {
    loading.value = false;
  }
};

const acknowledgeNotification = async () => {
  if (!activeNotificationId.value) {
    notificationAlert.value = null;
    return;
  }

  if (acknowledgingNotification.value) {
    return;
  }

  acknowledgingNotification.value = true;
  try {
    await acknowledgeOrganizerNotification(activeNotificationId.value);
    markLocalNotificationAsRead(activeNotificationId.value);
    notificationAlert.value = null;
    activeNotificationId.value = null;
  } catch (err) {
    const fallback = t('dashboard.organizer.notifications.dismissError');
    dashboardAlert.value = {
      type: 'error',
      text: err.response?.data?.message || fallback,
    };
  } finally {
    acknowledgingNotification.value = false;
  }
};

const refresh = async () => {
  await loadMetrics();
};

onMounted(() => {
  if (isAuthenticated.value && isOrganizer.value) {
    loadMetrics();
  }
});

watch([isAuthenticated, isOrganizer], ([auth, organizer]) => {
  if (auth && organizer) {
    loadMetrics();
  } else {
    metrics.value = null;
    notificationAlert.value = null;
    activeNotificationId.value = null;
  }
});

watch(preferredCurrency, () => {
  if (isAuthenticated.value && isOrganizer.value) {
    loadMetrics();
  }
});

watch(
  () => metrics.value?.organizer,
  (organizer) => {
    if (organizer) {
      selectUnreadNotification(organizer);
    }
  },
  { deep: true }
);
</script>

<template>
  <section class="dashboard">
    <header class="dashboard__header">
      <div>
        <h1 class="dashboard__title">{{ t('dashboard.organizer.title') }}</h1>
        <p class="dashboard__subtitle">{{ organizerSubtitle }}</p>
      </div>
      <div class="dashboard__actions">
        <RouterLink class="dashboard__link" to="/events">
          {{ t('dashboard.actions.backToEvents') }}
        </RouterLink>
        <button
          type="button"
          class="dashboard__refresh"
          :disabled="loading"
          @click="refresh"
        >
          {{ t('dashboard.actions.refresh') }}
        </button>
      </div>
    </header>

    <div
      v-if="notificationAlert"
      :class="['alert', `alert--${notificationAlert.type}`]"
    >
      <span>{{ notificationAlert.text }}</span>
      <button
        type="button"
        class="alert__close"
        :disabled="acknowledgingNotification"
        @click="acknowledgeNotification"
      >
        ×
      </button>
    </div>

    <div
      v-if="dashboardAlert"
      :class="['alert', `alert--${dashboardAlert.type}`]"
    >
      <span>{{ dashboardAlert.text }}</span>
      <button type="button" class="alert__close" @click="clearDashboardAlert">
        ×
      </button>
    </div>

    <div v-if="!isAuthenticated" class="state state--info">
      {{ t('dashboard.organizer.authRequired') }}
    </div>
    <div v-else-if="!isOrganizer" class="state state--error">
      {{ t('dashboard.organizer.forbidden') }}
    </div>
    <div v-else>
      <div v-if="loading" class="state state--loading">
        {{ t('dashboard.states.loading') }}
      </div>
      <div v-else-if="error" class="state state--error">{{ error }}</div>
      <div v-else class="dashboard__content">
        <section class="panel">
          <header class="panel__header">
            <div>
              <h2 class="panel__title">
                {{ t('dashboard.organizer.createTitle') }}
              </h2>
              <p class="panel__subtitle">
                {{ t('dashboard.organizer.createSubtitle') }}
              </p>
            </div>
          </header>
          <OrganizerEventForm
            :organizer-name="organizerName"
            @created="handleEventCreated"
            @error="handleEventError"
          />
        </section>

        <section class="panel">
          <header class="panel__header">
            <div>
              <h2 class="panel__title">
                {{ t('dashboard.organizer.manageTitle') }}
              </h2>
              <p class="panel__subtitle">
                {{ t('dashboard.organizer.manageSubtitle') }}
              </p>
            </div>
          </header>
          <div v-if="!events.length" class="state state--info">
            {{ t('dashboard.organizer.noEvents') }}
          </div>
          <ul v-else class="event-list event-list--manage">
            <li
              v-for="event in events"
              :key="event.id"
              :class="[
                'event-item',
                'event-item--manage',
                { 'event-item--active': editingEvent?.id === event.id },
              ]"
            >
              <div class="event-item__main">
                <h3 class="event-item__title">{{ event.title }}</h3>
                <p class="event-item__meta">{{ formatDate(event.startsAt) }}</p>
              </div>
              <div class="event-item__manage-actions">
                <div class="event-item__stats">
                  <span class="event-item__badge">
                    {{
                      t('dashboard.organizer.eventTicketsSold', {
                        sold: formatNumber(event.sold),
                      })
                    }}
                  </span>
                  <span
                    :class="[
                      'event-item__badge',
                      'event-item__badge--status',
                      event.isApproved
                        ? 'event-item__badge--status-approved'
                        : 'event-item__badge--status-pending',
                    ]"
                  >
                    {{
                      event.isApproved
                        ? t('dashboard.organizer.eventStatus.approved')
                        : t('dashboard.organizer.eventStatus.pending')
                    }}
                  </span>
                  <span class="event-item__badge event-item__badge--accent">
                    {{ formatPercent(event.occupancy) }}
                  </span>
                </div>
                <button
                  type="button"
                  class="event-item__edit"
                  @click="startEditing(event)"
                >
                  {{ t('dashboard.organizer.editAction') }}
                </button>
              </div>
            </li>
          </ul>
          <div v-if="editingEvent" class="edit-form">
            <header class="edit-form__header">
              <h3 class="edit-form__title">
                {{
                  t('dashboard.organizer.editingTitle', {
                    title:
                      editingEvent.title ||
                      t('dashboard.organizer.untitledEvent'),
                  })
                }}
              </h3>
              <button
                type="button"
                class="edit-form__cancel"
                @click="cancelEditing"
              >
                {{ t('dashboard.organizer.cancelEdit') }}
              </button>
            </header>
            <OrganizerEventForm
              :key="editingEvent.id"
              :event="editingEvent"
              :organizer-name="organizerName"
              @updated="handleEventUpdated"
              @error="handleEventError"
            />
          </div>
        </section>

        <section class="panel">
          <header class="panel__header">
            <h2 class="panel__title">
              {{ t('dashboard.organizer.metricsTitle') }}
            </h2>
            <span class="panel__updated" v-if="lastUpdated">
              {{ t('dashboard.common.updatedAt', { date: lastUpdated }) }}
            </span>
          </header>
          <div class="metrics-grid">
            <article
              v-for="card in summaryCards"
              :key="card.key"
              class="metric-card"
            >
              <div class="metric-card__value">{{ card.value }}</div>
              <div class="metric-card__label">{{ card.label }}</div>
              <div class="metric-card__hint">{{ card.hint }}</div>
            </article>
          </div>
        </section>

        <section class="panel">
          <header class="panel__header">
            <div>
              <h2 class="panel__title">
                {{ t('dashboard.organizer.upcomingTitle') }}
              </h2>
              <p class="panel__subtitle">
                {{ t('dashboard.organizer.upcomingSubtitle') }}
              </p>
            </div>
          </header>
          <div v-if="!upcomingEvents.length" class="state state--info">
            {{ t('dashboard.organizer.noUpcoming') }}
          </div>
          <ul v-else class="event-list">
            <li
              v-for="event in upcomingEvents"
              :key="event.id"
              class="event-item"
            >
              <div class="event-item__main">
                <h3 class="event-item__title">{{ event.title }}</h3>
                <p class="event-item__meta">{{ formatDate(event.startsAt) }}</p>
              </div>
              <div class="event-item__stats">
                <span class="event-item__badge">
                  {{
                    t('dashboard.organizer.eventTicketsSold', {
                      sold: formatNumber(event.sold),
                    })
                  }}
                </span>
                <span
                  :class="[
                    'event-item__badge',
                    'event-item__badge--status',
                    event.isApproved
                      ? 'event-item__badge--status-approved'
                      : 'event-item__badge--status-pending',
                  ]"
                >
                  {{
                    event.isApproved
                      ? t('dashboard.organizer.eventStatus.approved')
                      : t('dashboard.organizer.eventStatus.pending')
                  }}
                </span>
                <span class="event-item__badge event-item__badge--accent">
                  {{ formatPercent(event.occupancy) }}
                </span>
              </div>
            </li>
          </ul>
        </section>

        <section class="panel">
          <header class="panel__header">
            <div>
              <h2 class="panel__title">
                {{ t('dashboard.organizer.performanceTitle') }}
              </h2>
              <p class="panel__subtitle">
                {{ t('dashboard.organizer.performanceSubtitle') }}
              </p>
            </div>
          </header>
          <div v-if="!topEvents.length" class="state state--info">
            {{ t('dashboard.organizer.noPerformance') }}
          </div>
          <div v-else class="table-wrapper">
            <table class="events-table">
              <thead>
                <tr>
                  <th>
                    {{ t('dashboard.organizer.performanceColumns.event') }}
                  </th>
                  <th>
                    {{ t('dashboard.organizer.performanceColumns.date') }}
                  </th>
                  <th>
                    {{ t('dashboard.organizer.performanceColumns.sold') }}
                  </th>
                  <th>
                    {{ t('dashboard.organizer.performanceColumns.occupancy') }}
                  </th>
                  <th>
                    {{ t('dashboard.organizer.performanceColumns.revenue') }}
                  </th>
                  <th>
                    {{ t('dashboard.organizer.performanceColumns.potential') }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="event in topEvents" :key="event.id">
                  <td>{{ event.title }}</td>
                  <td>{{ formatDate(event.startsAt) }}</td>
                  <td>{{ formatNumber(event.sold) }}</td>
                  <td>{{ formatPercent(event.occupancy) }}</td>
                  <td>
                    {{
                      formatBreakdown(event.financials?.revenue, event.currency)
                    }}
                  </td>
                  <td>
                    {{
                      formatBreakdown(
                        event.financials?.potentialRevenue,
                        event.currency
                      )
                    }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  </section>
</template>

<style scoped>
.dashboard {
  padding: 2rem 3vw 4rem;
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.dashboard__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.dashboard__actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.dashboard__title {
  font-size: 2rem;
  font-weight: 700;
  margin: 0;
}

.dashboard__subtitle {
  margin: 0.5rem 0 0;
  color: #4b5563;
  font-size: 1rem;
  line-height: 1.6;
  font-weight: 400;
  max-width: 560px;
}

.dashboard__link {
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: #1f2937;
  padding: 0.6rem 1.2rem;
  border-radius: 0.75rem;
  font-weight: 600;
  text-decoration: none;
  transition: background 0.2s ease, color 0.2s ease;
}

.dashboard__link:hover {
  background: #f3f4f6;
  color: #111827;
}

.dashboard__refresh {
  border: 1px solid #2563eb;
  background: #2563eb;
  color: #fff;
  padding: 0.6rem 1.2rem;
  border-radius: 0.75rem;
  cursor: pointer;
  font-weight: 600;
  transition: background 0.2s ease;
}

.dashboard__refresh:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.dashboard__refresh:not(:disabled):hover {
  background: #1d4ed8;
}

.dashboard__content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.alert {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  border-radius: 0.75rem;
  padding: 0.85rem 1.1rem;
  font-weight: 600;
}

.alert--success {
  background: #ecfdf5;
  color: #047857;
  border: 1px solid #34d399;
}

.alert--error {
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #f87171;
}

.alert__close {
  background: transparent;
  border: none;
  color: inherit;
  font-size: 1.25rem;
  cursor: pointer;
  line-height: 1;
}

.panel {
  background: #fff;
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
}

.panel__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.panel__title {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 700;
}

.panel__subtitle {
  margin: 0.25rem 0 0;
  color: #6b7280;
  font-size: 0.95rem;
}

.panel__updated {
  font-size: 0.85rem;
  color: #6b7280;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1.25rem;
}

.metric-card {
  padding: 1.2rem;
  border-radius: 0.9rem;
  border: 1px solid #e5e7eb;
  background: linear-gradient(180deg, #f8fafc 0%, #fff 100%);
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.metric-card__value {
  font-size: 1.6rem;
  font-weight: 700;
  color: #111827;
}

.metric-card__label {
  font-size: 0.95rem;
  color: #4b5563;
}

.metric-card__hint {
  font-size: 0.85rem;
  color: #2563eb;
  font-weight: 600;
}

.event-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.event-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border-radius: 0.9rem;
  border: 1px solid #e5e7eb;
  background: #f9fafb;
}

.event-item__main {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.event-item__title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.event-item__meta {
  margin: 0;
  color: #6b7280;
  font-size: 0.9rem;
}

.event-item__stats {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.event-item__badge {
  background: #fff;
  border: 1px solid #d1d5db;
  border-radius: 999px;
  padding: 0.35rem 0.75rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: #1f2937;
}

.event-item__badge--status {
  border-style: dashed;
}

.event-item__badge--status-approved {
  background: #dcfce7;
  border-color: #bbf7d0;
  color: #15803d;
}

.event-item__badge--status-pending {
  background: #fef3c7;
  border-color: #fde68a;
  color: #b45309;
}

.event-item__badge--accent {
  background: #eff6ff;
  color: #2563eb;
  border-color: #bfdbfe;
}

.event-list--manage .event-item {
  background: #fff;
}

.event-item--manage {
  border: 1px solid #e5e7eb;
  background: #fff;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.event-item--active {
  border-color: #2563eb;
  background: #eff6ff;
}

.event-item__manage-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 1rem;
  flex-wrap: wrap;
}

.event-item__edit {
  border: 1px solid #2563eb;
  background: #2563eb;
  color: #fff;
  border-radius: 999px;
  padding: 0.45rem 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.event-item__edit:hover {
  background: #1d4ed8;
  border-color: #1d4ed8;
}

.edit-form {
  margin-top: 1.75rem;
  padding-top: 1.75rem;
  border-top: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.edit-form__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.edit-form__title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
}

.edit-form__cancel {
  border: 1px solid #d1d5db;
  background: #fff;
  color: #1f2937;
  border-radius: 999px;
  padding: 0.45rem 1.2rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.edit-form__cancel:hover {
  border-color: #9ca3af;
  background: #f3f4f6;
}

.table-wrapper {
  overflow-x: auto;
}

.events-table {
  width: 100%;
  border-collapse: separate;
}

.events-table th,
.events-table td {
  text-align: left;
  padding: 0.75rem;
  border-bottom: 1px solid #e5e7eb;
  white-space: nowrap;
  font-size: 1rem;
}

.events-table thead th {
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #6b7280;
}

.state {
  padding: 1.2rem;
  border-radius: 0.9rem;
  font-weight: 600;
  text-align: center;
}

.state--loading {
  background: #eff6ff;
  color: #1d4ed8;
}

.state--error {
  background: #fee2e2;
  color: #b91c1c;
}

.state--info {
  background: #f3f4f6;
  color: #374151;
}

@media (max-width: 768px) {
  .dashboard__header {
    flex-direction: column;
    align-items: flex-start;
  }

  .panel {
    padding: 1.25rem;
  }

  .event-item {
    flex-direction: column;
    align-items: flex-start;
  }

  .event-item__stats {
    width: 100%;
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .event-item__manage-actions {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
