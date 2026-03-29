<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';

import {
  fetchAdminAccess,
  fetchAdminMetrics,
  fetchAdminPendingEvents,
  updateAdminUserRole,
  approveAdminEvent,
  rejectAdminEvent,
} from '@/services/dashboardService.js';
import { useAuthStore } from '@/stores/authStore.js';
import { usePreferredCurrency } from '@/composables/usePreferredCurrency.js';
import { DEFAULT_CURRENCY } from '@/utils/currency.js';

const authStore = useAuthStore();
const { isAuthenticated, user } = storeToRefs(authStore);
const { t, locale } = useI18n();
const { preferredCurrency } = usePreferredCurrency();

const metrics = ref(null);
const access = ref({ summary: null, users: [] });
const pending = ref({ summary: null, events: [] });
const loadingMetrics = ref(false);
const loadingAccess = ref(false);
const loadingPending = ref(false);
const metricsError = ref(null);
const accessError = ref(null);
const pendingError = ref(null);
const message = ref(null);
const editableRoles = reactive({});
const updatingUsers = reactive({});
const approvingEvents = reactive({});
const rejectingEvents = reactive({});
let messageTimeoutId;

const availableRoles = ['user', 'organizer', 'admin'];

const formatNumber = (value) => {
  const number = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat(locale.value).format(number);
};

const formatPercent = (value) => {
  const number = Number.isFinite(value) ? value : 0;
  return `${number.toFixed(1)}%`;
};

const formatCurrency = (value, currency = preferredCurrency.value || DEFAULT_CURRENCY) => {
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

const formatDateTime = (value) => {
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

const formatEventSchedule = (event) => {
  if (!event) return '—';
  const dateValue = event.startsAt ? formatDateTime(event.startsAt) : null;
  if (dateValue && event.hour) {
    return `${dateValue} – ${event.hour}`;
  }
  return dateValue || event.hour || '—';
};

const isAdmin = computed(() => user.value?.role === 'admin');
const isLoading = computed(
  () => loadingMetrics.value || loadingAccess.value || loadingPending.value
);
const error = computed(() => metricsError.value || accessError.value);
const roleDistributionEntries = computed(() => {
  const distribution = metrics.value?.roleDistribution || {};
  return Object.entries(distribution).map(([role, count]) => ({
    role,
    count,
  }));
});

const metricsCards = computed(() => {
  const summary = metrics.value?.summary || {};
  return [
    {
      key: 'totalUsers',
      label: t('dashboard.metrics.totalUsers'),
      value: formatNumber(summary.totalUsers ?? 0),
      hint: t('dashboard.metrics.activeOrganizersShort', {
        count: formatNumber(summary.activeOrganizers ?? 0),
      }),
    },
    {
      key: 'totalEvents',
      label: t('dashboard.metrics.totalEvents'),
      value: formatNumber(summary.totalEvents ?? 0),
      hint: t('dashboard.metrics.upcomingEventsShort', {
        count: formatNumber(summary.upcomingEvents ?? 0),
      }),
    },
    {
      key: 'ticketsSold',
      label: t('dashboard.metrics.ticketsSold'),
      value: formatNumber(summary.ticketsSold ?? 0),
      hint: t('dashboard.metrics.occupancyRateShort', {
        value: formatPercent(summary.occupancyRate ?? 0),
      }),
    },
    {
      key: 'revenue',
      label: t('dashboard.metrics.revenue'),
      value: formatCurrency(summary.revenueGenerated ?? 0),
      hint: t('dashboard.metrics.potentialRevenueShort', {
        value: formatCurrency(summary.potentialRevenue ?? 0),
      }),
    },
  ];
});

const accessLastUpdated = computed(() =>
  access.value?.summary?.lastUpdated
    ? formatDateTime(access.value.summary.lastUpdated)
    : null
);

const pendingEvents = computed(() => pending.value?.events || []);

const pendingLastUpdated = computed(() => {
  const value = pending.value?.summary?.lastUpdated;
  return value ? formatDateTime(value) : null;
});

const pendingCount = computed(
  () => Number(pending.value?.summary?.totalPending ?? 0)
);

const showMessage = (type, text) => {
  message.value = { type, text };
  if (messageTimeoutId) {
    clearTimeout(messageTimeoutId);
  }
  messageTimeoutId = setTimeout(() => {
    message.value = null;
  }, 4000);
};

onBeforeUnmount(() => {
  if (messageTimeoutId) {
    clearTimeout(messageTimeoutId);
  }
});

const resetEditableRoles = (usersList) => {
  Object.keys(editableRoles).forEach((key) => delete editableRoles[key]);
  (usersList || []).forEach((item) => {
    editableRoles[item.id] = item.role;
  });
};

const loadMetrics = async () => {
  loadingMetrics.value = true;
  metricsError.value = null;
  try {
    const { data } = await fetchAdminMetrics({
      currency: preferredCurrency.value,
    });
    metrics.value = data;
  } catch (err) {
    metricsError.value = err.response?.data?.message || err.message || 'Error';
  } finally {
    loadingMetrics.value = false;
  }
};

const loadAccess = async () => {
  loadingAccess.value = true;
  accessError.value = null;
  try {
    const { data } = await fetchAdminAccess({
      currency: preferredCurrency.value,
    });
    access.value = data;
    resetEditableRoles(data.users || []);
  } catch (err) {
    accessError.value = err.response?.data?.message || err.message || 'Error';
  } finally {
    loadingAccess.value = false;
  }
};

const loadPendingEvents = async () => {
  loadingPending.value = true;
  pendingError.value = null;
  try {
    const { data } = await fetchAdminPendingEvents({
      currency: preferredCurrency.value,
    });
    pending.value = data;
  } catch (err) {
    pendingError.value = err.response?.data?.message || err.message || 'Error';
    pending.value = { summary: null, events: [] };
  } finally {
    loadingPending.value = false;
  }
};

const loadDashboard = async () => {
  if (!isAuthenticated.value || !isAdmin.value) {
    metrics.value = null;
    access.value = { summary: null, users: [] };
    pending.value = { summary: null, events: [] };
    pendingError.value = null;
    return;
  }
  await Promise.all([loadMetrics(), loadAccess(), loadPendingEvents()]);
};

const handleRoleChange = async (userEntry) => {
  const newRole = editableRoles[userEntry.id];
  if (!newRole || newRole === userEntry.role) {
    return;
  }

  updatingUsers[userEntry.id] = true;

  try {
    await updateAdminUserRole(userEntry.id, newRole);
    showMessage('success', t('dashboard.admin.roleUpdateSuccess'));
    await loadAccess();
  } catch (err) {
    editableRoles[userEntry.id] = userEntry.role;
    const messageText =
      err.response?.data?.message || t('dashboard.admin.roleUpdateError');
    showMessage('error', messageText);
  } finally {
    delete updatingUsers[userEntry.id];
  }
};

const handleApproveEvent = async (eventId) => {
  if (!eventId) return;

  approvingEvents[eventId] = true;
  try {
    await approveAdminEvent(eventId);
    showMessage('success', t('dashboard.admin.eventApproveSuccess'));
    await Promise.all([loadPendingEvents(), loadMetrics()]);
  } catch (err) {
    if (err.response?.status === 409) {
      showMessage('info', t('dashboard.admin.eventApproveAlready'));
    } else {
      const messageText =
        err.response?.data?.message || t('dashboard.admin.eventApproveError');
      showMessage('error', messageText);
    }
  } finally {
    delete approvingEvents[eventId];
  }
};

const handleRejectEvent = async (eventId) => {
  if (!eventId) return;

  rejectingEvents[eventId] = true;
  try {
    await rejectAdminEvent(eventId);
    showMessage('success', t('dashboard.admin.eventRejectSuccess'));
    await Promise.all([loadPendingEvents(), loadMetrics()]);
  } catch (err) {
    if (err.response?.status === 409) {
      showMessage('info', t('dashboard.admin.eventRejectAlready'));
    } else {
      const messageText =
        err.response?.data?.message || t('dashboard.admin.eventRejectError');
      showMessage('error', messageText);
    }
  } finally {
    delete rejectingEvents[eventId];
  }
};

const refresh = async () => {
  await loadDashboard();
};

onMounted(() => {
  if (isAuthenticated.value && isAdmin.value) {
    loadDashboard();
  }
});

watch([isAuthenticated, isAdmin], ([auth, admin]) => {
  if (auth && admin) {
    loadDashboard();
  } else {
    metrics.value = null;
    access.value = { summary: null, users: [] };
    pending.value = { summary: null, events: [] };
    pendingError.value = null;
  }
});

watch(preferredCurrency, (newCurrency, oldCurrency) => {
  if (newCurrency === oldCurrency) return;
  if (!isAuthenticated.value || !isAdmin.value) return;
  loadDashboard();
});
</script>

<template>
  <section class="dashboard">
    <header class="dashboard__header">
      <div>
        <h1 class="dashboard__title">{{ t('dashboard.admin.title') }}</h1>
        <p class="dashboard__subtitle">{{ t('dashboard.admin.subtitle') }}</p>
      </div>
      <div class="dashboard__actions">
        <RouterLink class="dashboard__link" to="/events">
          {{ t('dashboard.actions.backToEvents') }}
        </RouterLink>
        <button
          type="button"
          class="dashboard__refresh"
          :disabled="isLoading"
          @click="refresh"
        >
          {{ t('dashboard.actions.refresh') }}
        </button>
      </div>
    </header>

    <div v-if="!isAuthenticated" class="state state--info">
      {{ t('dashboard.admin.authRequired') }}
    </div>
    <div v-else-if="!isAdmin" class="state state--error">
      {{ t('dashboard.admin.forbidden') }}
    </div>
    <div v-else>
      <div v-if="isLoading" class="state state--loading">
        {{ t('dashboard.states.loading') }}
      </div>
      <div v-else-if="error" class="state state--error">
        {{ error }}
      </div>
      <div v-else class="dashboard__content">
        <div v-if="message" :class="['alert', `alert--${message.type}`]">
          {{ message.text }}
        </div>

        <section class="panel">
          <header class="panel__header">
            <h2 class="panel__title">{{ t('dashboard.admin.metricsTitle') }}</h2>
            <span class="panel__updated" v-if="metrics?.summary?.lastUpdated">
              {{
                t('dashboard.common.updatedAt', {
                  date: formatDateTime(metrics.summary.lastUpdated),
                })
              }}
            </span>
          </header>
          <div class="metrics-grid">
            <article v-for="card in metricsCards" :key="card.key" class="metric-card">
              <div class="metric-card__value">{{ card.value }}</div>
              <div class="metric-card__label">{{ card.label }}</div>
              <div class="metric-card__hint">{{ card.hint }}</div>
            </article>
          </div>
          <div class="role-distribution" v-if="roleDistributionEntries.length">
            <h3 class="role-distribution__title">
              {{ t('dashboard.admin.roleDistributionTitle') }}
            </h3>
            <ul class="role-distribution__list">
              <li
                v-for="entry in roleDistributionEntries"
                :key="entry.role"
                class="role-distribution__item"
              >
                <span class="role-distribution__role">{{ t(`roles.${entry.role}`) }}</span>
                <span class="role-distribution__value">
                  {{ formatNumber(entry.count) }}
                </span>
              </li>
            </ul>
          </div>
        </section>

        <section class="panel">
          <header class="panel__header">
            <div>
              <h2 class="panel__title">{{ t('dashboard.admin.pendingTitle') }}</h2>
              <p class="panel__subtitle">
                {{
                  t('dashboard.admin.pendingSubtitle', {
                    count: formatNumber(pendingCount),
                  })
                }}
              </p>
            </div>
            <span class="panel__updated" v-if="pendingLastUpdated">
              {{ t('dashboard.common.updatedAt', { date: pendingLastUpdated }) }}
            </span>
          </header>

          <div v-if="pendingError" class="state state--error">{{ pendingError }}</div>
          <div v-else-if="loadingPending" class="state state--loading">
            {{ t('dashboard.states.loading') }}
          </div>
          <div v-else-if="!pendingEvents.length" class="state state--info">
            {{ t('dashboard.admin.approval.emptyPending') }}
          </div>
          <div v-else class="table-wrapper">
            <table class="users-table">
              <thead>
                <tr>
                  <th>{{ t('dashboard.admin.pendingColumns.event') }}</th>
                  <th>{{ t('dashboard.admin.pendingColumns.organizer') }}</th>
                  <th>{{ t('dashboard.admin.pendingColumns.date') }}</th>
                  <th>{{ t('dashboard.admin.pendingColumns.submittedAt') }}</th>
                  <th>{{ t('dashboard.admin.pendingColumns.actions') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in pendingEvents" :key="item.id">
                  <td>{{ item.title }}</td>
                  <td>{{ item.organizer }}</td>
                  <td>{{ formatEventSchedule(item) }}</td>
                  <td>{{ formatDateTime(item.createdAt) }}</td>
                  <td>
                    <div class="pending-actions">
                      <button
                        type="button"
                        class="pending-approve-btn"
                        :disabled="Boolean(approvingEvents[item.id] || rejectingEvents[item.id])"
                        @click="handleApproveEvent(item.id)"
                      >
                        <span v-if="approvingEvents[item.id]">
                          {{ t('dashboard.admin.approval.actions.approving') }}
                        </span>
                        <span v-else>
                          {{ t('dashboard.admin.approval.actions.approve') }}
                        </span>
                      </button>
                      <button
                        type="button"
                        class="pending-reject-btn"
                        :disabled="Boolean(approvingEvents[item.id] || rejectingEvents[item.id])"
                        @click="handleRejectEvent(item.id)"
                      >
                        <span v-if="rejectingEvents[item.id]">
                          {{ t('dashboard.admin.approval.actions.rejecting') }}
                        </span>
                        <span v-else>
                          {{ t('dashboard.admin.approval.actions.reject') }}
                        </span>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="panel">
          <header class="panel__header">
            <div>
              <h2 class="panel__title">{{ t('dashboard.admin.accessTitle') }}</h2>
              <p class="panel__subtitle">
                {{ t('dashboard.admin.accessSubtitle') }}
              </p>
            </div>
            <span class="panel__updated" v-if="accessLastUpdated">
              {{ t('dashboard.common.updatedAt', { date: accessLastUpdated }) }}
            </span>
          </header>
          <div v-if="!access?.users?.length" class="state state--info">
            {{ t('dashboard.admin.noUsers') }}
          </div>
          <div v-else class="table-wrapper">
            <table class="users-table">
              <thead>
                <tr>
                  <th>{{ t('dashboard.admin.userColumns.name') }}</th>
                  <th>{{ t('dashboard.admin.userColumns.email') }}</th>
                  <th>{{ t('dashboard.admin.userColumns.role') }}</th>
                  <th>{{ t('dashboard.admin.userColumns.createdAt') }}</th>
                  <th>{{ t('dashboard.admin.userColumns.actions') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in access.users" :key="item.id">
                  <td>{{ item.fullname }}</td>
                  <td>{{ item.email }}</td>
                  <td>
                    <span class="role-chip">{{ t(`roles.${item.role}`) }}</span>
                  </td>
                  <td>{{ formatDateTime(item.createdAt) }}</td>
                  <td>
                    <div class="role-editor">
                      <label class="sr-only" :for="`role-${item.id}`">
                        {{ t('dashboard.admin.userColumns.role') }}
                      </label>
                      <select
                        :id="`role-${item.id}`"
                        v-model="editableRoles[item.id]"
                        :disabled="Boolean(updatingUsers[item.id])"
                        @change="handleRoleChange(item)"
                      >
                        <option v-for="role in availableRoles" :key="role" :value="role">
                          {{ t(`roles.${role}`) }}
                        </option>
                      </select>
                    </div>
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

.role-distribution {
  margin-top: 2rem;
}

.role-distribution__title {
  margin: 0 0 0.75rem;
  font-size: 1.1rem;
}

.role-distribution__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.role-distribution__item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.8rem;
  border-radius: 0.75rem;
  border: 1px solid #e5e7eb;
  background: #f9fafb;
}

.role-distribution__role {
  font-weight: 600;
  color: #1f2937;
}

.role-distribution__value {
  color: #2563eb;
  font-weight: 600;
}

.table-wrapper {
  overflow-x: auto;
}

.users-table {
  width: 100%;
  border-collapse: collapse;
}

.users-table th,
.users-table td {
  text-align: left;
  padding: 0.75rem;
  border-bottom: 1px solid #e5e7eb;
}

.users-table thead th {
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #6b7280;
}

.role-chip {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  background: #eff6ff;
  color: #2563eb;
  font-weight: 600;
  font-size: 0.85rem;
}

.role-editor select {
  border: 1px solid #d1d5db;
  border-radius: 0.6rem;
  padding: 0.35rem 0.6rem;
  font-size: 0.95rem;
}

.pending-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.pending-approve-btn {
  border: 1px solid #16a34a;
  background: #16a34a;
  color: #fff;
  padding: 0.45rem 1rem;
  border-radius: 9999px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease;
}

.pending-approve-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.pending-approve-btn:not(:disabled):hover {
  background: #15803d;
  transform: translateY(-1px);
}

.pending-reject-btn {
  border: 1px solid #dc2626;
  background: #dc2626;
  color: #fff;
  padding: 0.45rem 1rem;
  border-radius: 9999px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease;
}

.pending-reject-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.pending-reject-btn:not(:disabled):hover {
  background: #b91c1c;
  transform: translateY(-1px);
}

.alert {
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  margin-bottom: 1rem;
  font-weight: 600;
}

.alert--success {
  background: #dcfce7;
  color: #166534;
}

.alert--error {
  background: #fee2e2;
  color: #b91c1c;
}

.alert--info {
  background: #e0f2fe;
  color: #0c4a6e;
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

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

@media (max-width: 768px) {
  .dashboard__header {
    flex-direction: column;
    align-items: flex-start;
  }

  .panel {
    padding: 1.25rem;
  }
}
</style>
