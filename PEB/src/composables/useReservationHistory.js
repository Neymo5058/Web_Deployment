import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';

import { useAuthStore } from '@/stores/authStore.js';

const STORAGE_KEY = 'reservation_history';
const MAX_RECORDS = 50;

const reservationsRef = ref([]);
let activeStorageKey = null;

function isBrowser() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function resolveUserStorageKey(user) {
  if (!user || typeof user !== 'object') {
    return null;
  }

  if (user.id) {
    return String(user.id);
  }

  if (user._id) {
    return String(user._id);
  }

  if (user.email) {
    return String(user.email).toLowerCase();
  }

  return null;
}

function readStoragePayload() {
  if (!isBrowser()) {
    return {};
  }

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      localStorage.removeItem(STORAGE_KEY);
      return {};
    }

    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_error) {
    localStorage.removeItem(STORAGE_KEY);
    return {};
  }
}

function readStoredReservationsForKey(storageKey) {
  if (!storageKey) {
    return [];
  }

  const payload = readStoragePayload();
  const stored = payload?.[storageKey];

  return Array.isArray(stored)
    ? stored.filter((item) => item && typeof item === 'object')
    : [];
}

function writeStoragePayload(payload) {
  if (!isBrowser()) {
    return;
  }

  const entries = Object.entries(payload || {}).filter(
    ([, value]) => Array.isArray(value) && value.length > 0
  );

  if (entries.length === 0) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }

  const sanitized = entries.reduce((acc, [key, value]) => {
    acc[key] = value;
    return acc;
  }, {});

  localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
}

function persistReservations(list, storageKey) {
  if (!Array.isArray(list) || !storageKey) {
    return;
  }

  const normalized = list
    .filter((item) => item && typeof item === 'object')
    .slice(0, MAX_RECORDS);

  if (isBrowser()) {
    const payload = readStoragePayload();

    if (normalized.length > 0) {
      payload[storageKey] = normalized;
    } else {
      delete payload[storageKey];
    }

    writeStoragePayload(payload);
  }

  activeStorageKey = storageKey;
  reservationsRef.value = normalized;
}

function normalizeRecord(record) {
  if (!record || typeof record !== 'object') {
    return null;
  }

  const eventId = record.eventId ? String(record.eventId) : null;
  if (!eventId) {
    return null;
  }

  const paymentIntentId = record.paymentIntentId
    ? String(record.paymentIntentId)
    : null;

  const idParts = [eventId];
  if (paymentIntentId) {
    idParts.push(paymentIntentId);
  }

  const id = record.id || idParts.join(':') || String(Date.now());

  const quantity = Number.parseInt(record.quantity, 10);
  const totalAmount = Number.parseFloat(record.totalAmount);

  return {
    id,
    eventId,
    eventTitle: record.eventTitle ? String(record.eventTitle) : 'Événement',
    startsAt: record.startsAt || null,
    location: record.location || null,
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    totalAmount: Number.isFinite(totalAmount) ? totalAmount : 0,
    currency: record.currency ? String(record.currency).toUpperCase() : 'CAD',
    paymentIntentId,
    recordedAt: record.recordedAt || new Date().toISOString(),
  };
}

export function useReservationHistory() {
  const authStore = useAuthStore();
  const { user } = storeToRefs(authStore);

  const userStorageKey = computed(() => resolveUserStorageKey(user.value));

  const reservations = computed(() => reservationsRef.value);

  function loadReservations(targetKey = userStorageKey.value) {
    activeStorageKey = targetKey || null;

    if (!activeStorageKey) {
      reservationsRef.value = [];
      return reservationsRef.value;
    }

    reservationsRef.value = readStoredReservationsForKey(activeStorageKey);
    return reservationsRef.value;
  }

  function addReservation(record, targetKey = userStorageKey.value) {
    const storageKey = targetKey || activeStorageKey;
    const normalized = normalizeRecord(record);
    if (!normalized || !storageKey) {
      return;
    }

    if (storageKey !== activeStorageKey) {
      loadReservations(storageKey);
    }

    const withoutDuplicate = reservationsRef.value.filter((existing) => {
      if (!existing) return false;
      if (existing.id === normalized.id) return false;
      if (normalized.paymentIntentId) {
        return (
          existing.paymentIntentId !== normalized.paymentIntentId ||
          existing.eventId !== normalized.eventId
        );
      }
      return existing.eventId !== normalized.eventId;
    });

    persistReservations([normalized, ...withoutDuplicate], storageKey);
  }

  function clearReservations(targetKey = userStorageKey.value) {
    const storageKey = targetKey || activeStorageKey;

    if (!storageKey) {
      reservationsRef.value = [];
      return;
    }

    persistReservations([], storageKey);
  }

  watch(
    userStorageKey,
    (nextKey, previousKey) => {
      if (nextKey === previousKey) {
        return;
      }

      if (!nextKey) {
        activeStorageKey = null;
        reservationsRef.value = [];
        return;
      }

      loadReservations(nextKey);
    },
    { immediate: false }
  );

  return {
    reservations,
    addReservation,
    clearReservations,
    loadReservations,
  };
}

