<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import COUNTRY_OPTIONS from '@/constants/countries.js';
import BaseBackBtn from '@/components/BaseBackBtn.vue';
import { useReservationHistory } from '@/composables/useReservationHistory.js';
import { useAuthStore } from '@/stores/authStore';

const router = useRouter();
const authStore = useAuthStore();

const form = reactive({
  fullname: '',
  email: '',
  phone: '',
  country: '',
  newsletter: false,
  bio: '',
});

const fieldErrors = reactive({
  fullname: '',
  phone: '',
  country: '',
  bio: '',
});

const successMessage = ref('');
const errorMessage = ref('');
const isSubmitting = ref(false);
const isLoadingProfile = ref(false);
const activeTab = ref('info');

const user = computed(() => authStore.user);
const isAuthenticated = computed(() => authStore.isAuthenticated);

const countryOptions = COUNTRY_OPTIONS;

const {
  reservations,
  loadReservations,
  clearReservations,
} = useReservationHistory();

loadReservations();

const reservationHistory = computed(() => {
  const list = Array.isArray(reservations.value) ? reservations.value : [];
  return [...list].sort((a, b) => {
    const dateA = new Date(a.startsAt || a.recordedAt || 0).getTime();
    const dateB = new Date(b.startsAt || b.recordedAt || 0).getTime();
    return dateB - dateA;
  });
});

const hasReservations = computed(() => reservationHistory.value.length > 0);

const formatReservationDate = (value) => {
  if (!value) {
    return 'Date à confirmer';
  }

  try {
    return new Date(value).toLocaleString('fr-CA', {
      dateStyle: 'full',
      timeStyle: 'short',
    });
  } catch (_error) {
    return value;
  }
};

const formatReservationLocation = (location) => {
  if (!location || typeof location !== 'object') {
    return '';
  }
  return [location.name, location.city, location.country].filter(Boolean).join(', ');
};

const formatReservationAmount = (amount, currency) => {
  const numeric = Number.parseFloat(amount);
  if (!Number.isFinite(numeric)) {
    return '—';
  }

  const currencyCode = (currency || 'CAD').toUpperCase();
  try {
    return new Intl.NumberFormat('fr-CA', {
      style: 'currency',
      currency: currencyCode,
    }).format(numeric);
  } catch (_error) {
    return `${numeric.toFixed(2)} ${currencyCode}`;
  }
};

const handleClearHistory = () => {
  clearReservations();
};

function syncForm() {
  if (!user.value) return;
  form.fullname = user.value.fullname || '';
  form.email = user.value.email || '';
  form.phone = user.value.phone || '';
  form.country = (user.value.country || '').toUpperCase();
  form.newsletter = Boolean(user.value.preferences?.newsletter);
  form.bio = user.value.bio || '';
}

watch(user, () => {
  if (user.value) {
    syncForm();
  }
});

function validateForm() {
  fieldErrors.fullname = '';
  fieldErrors.phone = '';
  fieldErrors.country = '';
  fieldErrors.bio = '';
  errorMessage.value = '';

  let ok = true;

  if (!form.fullname.trim()) {
    fieldErrors.fullname = 'Votre nom est requis.';
    ok = false;
  }

  if (form.phone && !/^[- +()\d]{6,20}$/.test(form.phone.trim())) {
    fieldErrors.phone = 'Numéro de téléphone invalide.';
    ok = false;
  }

  if (!form.country) {
    fieldErrors.country = 'Votre pays est requis.';
    ok = false;
  }

  if (form.bio && form.bio.length > 280) {
    fieldErrors.bio = 'La biographie est limitée à 280 caractères.';
    ok = false;
  }

  return ok;
}

async function handleSubmit() {
  if (!validateForm()) return;

  isSubmitting.value = true;
  successMessage.value = '';
  errorMessage.value = '';

  try {
    await authStore.updateProfile({
      fullname: form.fullname.trim(),
      phone: form.phone.trim() || null,
      bio: form.bio.trim() || null,
      country: form.country ? form.country.toUpperCase() : null,
      preferences: {
        newsletter: form.newsletter,
      },
    });
    successMessage.value = 'Profil mis à jour avec succès!';
  } catch (error) {
    errorMessage.value =
      error?.message || 'Impossible de mettre à jour le profil.';
    if (error?.fieldErrors) {
      error.fieldErrors.forEach(({ field, message }) => {
        if (fieldErrors[field] !== undefined) {
          fieldErrors[field] = message;
        }
      });
    }
  } finally {
    isSubmitting.value = false;
  }
}

onMounted(async () => {
  if (!isAuthenticated.value) {
    router.replace({ path: '/signin', query: { redirect: '/profile' } });
    return;
  }

  isLoadingProfile.value = true;
  try {
    await authStore.fetchProfile();
    syncForm();
  } catch (error) {
    errorMessage.value =
      error?.message || 'Impossible de charger votre profil.';
  } finally {
    isLoadingProfile.value = false;
  }
});
</script>

<template>
  <section class="profile">
    <div class="profile__container">
      <aside class="profile__sidebar">
        <BaseBackBtn />
        <h1 class="profile__heading">Profil utilisateur</h1>
        <nav class="profile-nav" aria-label="Sections du profil">
          <button
            class="profile-nav__item"
            type="button"
            :class="{ 'is-active': activeTab === 'info' }"
            @click="activeTab = 'info'"
          >
            <span>Infos personnelles</span>
          </button>
          <button
            class="profile-nav__item"
            type="button"
            :class="{ 'is-active': activeTab === 'history' }"
            @click="activeTab = 'history'"
          >
            <span>Historique de réservations</span>
          </button>
        </nav>
      </aside>

      <div class="profile__content">
        <div v-if="activeTab === 'info'" class="profile-card">
          <header class="profile-card__header">
            <div>
              <h2>Infos personnelles</h2>
              <p>Gérez vos coordonnées et gardez votre profil à jour.</p>
            </div>
          </header>

          <div v-if="isLoadingProfile" class="profile-card__loading">
            Chargement du profil…
          </div>

          <form v-else class="profile-form" @submit.prevent="handleSubmit">
            <div v-if="successMessage" class="alert alert--success">
              {{ successMessage }}
            </div>
            <div v-if="errorMessage" class="alert alert--error">
              {{ errorMessage }}
            </div>

            <div class="profile-form__grid">
              <div
                class="form-group"
                :class="{ 'has-error': fieldErrors.fullname }"
              >
                <label for="fullname">Nom</label>
                <input
                  id="fullname"
                  v-model.trim="form.fullname"
                  type="text"
                  autocomplete="name"
                  placeholder="John Doe"
                  :aria-invalid="!!fieldErrors.fullname"
                />
                <p v-if="fieldErrors.fullname" class="error">
                  {{ fieldErrors.fullname }}
                </p>
              </div>

              <div class="form-group">
                <label for="email">E-mail</label>
                <input
                  id="email"
                  v-model="form.email"
                  type="email"
                  autocomplete="email"
                  disabled
                />
              </div>

              <div
                class="form-group"
                :class="{ 'has-error': fieldErrors.phone }"
              >
                <label for="phone">Téléphone</label>
                <input
                  id="phone"
                  v-model.trim="form.phone"
                  type="tel"
                  autocomplete="tel"
                  placeholder="514-123-4567"
                  :aria-invalid="!!fieldErrors.phone"
                />
                <p v-if="fieldErrors.phone" class="error">
                  {{ fieldErrors.phone }}
                </p>
              </div>

              <div
                class="form-group"
                :class="{ 'has-error': fieldErrors.country }"
              >
                <label for="country">Pays</label>
                <select
                  id="country"
                  v-model="form.country"
                  :aria-invalid="!!fieldErrors.country"
                >
                  <option value="">Choisissez votre pays</option>
                  <option
                    v-for="option in countryOptions"
                    :key="option.code"
                    :value="option.code"
                  >
                    {{ option.name }}
                  </option>
                </select>
                <p v-if="fieldErrors.country" class="error">
                  {{ fieldErrors.country }}
                </p>
              </div>
            </div>

            <div class="profile-form__actions">
              <button type="submit" class="btn" :disabled="isSubmitting">
                <span v-if="isSubmitting">Enregistrement…</span>
                <span v-else>Enregistrer</span>
              </button>
            </div>
          </form>
        </div>

        <div v-else class="profile-card">
          <header class="profile-card__header">
            <div>
              <h2>Historique des réservations</h2>
              <p>
                Retrouvez ici vos achats récents et les détails de vos billets.
              </p>
            </div>
          </header>

          <div v-if="!hasReservations" class="profile-history__empty">
            <p>Aucune réservation enregistrée pour le moment.</p>
            <button class="btn" type="button" @click="router.push({ name: 'events' })">
              Explorer les événements
            </button>
          </div>

          <div v-else class="profile-history">
            <div class="history-table-wrapper" role="region" aria-live="polite">
              <table class="reservation-table">
                <thead>
                  <tr>
                    <th scope="col">Événement</th>
                    <th scope="col">Date</th>
                    <th scope="col">Lieu</th>
                    <th scope="col">Billets</th>
                    <th scope="col">Montant</th>
                    <th scope="col">Réservé le</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="reservation in reservationHistory" :key="reservation.id">
                    <th scope="row">
                      <span class="reservation-title">{{ reservation.eventTitle }}</span>
                    </th>
                    <td>{{ formatReservationDate(reservation.startsAt) }}</td>
                    <td>
                      <span class="reservation-location">
                        {{ formatReservationLocation(reservation.location) || '—' }}
                      </span>
                    </td>
                    <td>{{ reservation.quantity }}</td>
                    <td>
                      {{ formatReservationAmount(reservation.totalAmount, reservation.currency) }}
                    </td>
                    <td>
                      {{ formatReservationDate(reservation.recordedAt) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="history-actions">
              <button class="btn btn--ghost" type="button" @click="handleClearHistory">
                Effacer l'historique
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.event-detail__back {
  font-size: 1rem;
}
.profile {
  min-height: 100vh;
  background: #f3f4f6;
  padding: 48px clamp(24px, 4vw, 64px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.profile__container {
  width: min(1100px, 100%);
  display: grid;
  gap: 32px;
  align-items: start;
}

@media (min-width: 960px) {
  .profile__container {
    grid-template-columns: 280px 1fr;
  }
}

.profile__sidebar {
  background: #ffffff;
  border-radius: 20px;
  padding: 28px;
  box-shadow: 0 12px 30px rgba(148, 163, 184, 0.18);
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.profile__heading {
  font-size: 1.5rem;
  margin: 0;
  color: #0f172a;
}

.profile-nav {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.profile-nav__item {
  width: 100%;
  border: none;
  border-radius: 14px;
  background: #f8fafc;
  color: #475569;
  font-weight: 600;
  padding: 0.85rem 1.15rem;
  text-align: left;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

.profile-nav__item span {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.profile-nav__item.is-active {
  background: linear-gradient(135deg, #2563eb, #3b82f6);
  color: #ffffff;
  box-shadow: 0 10px 20px rgba(37, 99, 235, 0.3);
}

.profile-nav__item:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.profile__content {
  width: 100%;
}

.profile-card {
  background: #ffffff;
  border-radius: 24px;
  padding: clamp(28px, 4vw, 40px);
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.12);
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.profile-card__header h2 {
  margin: 0 0 4px;
  font-size: 1.5rem;
  color: #0f172a;
}

.profile-card__header p {
  margin: 0;
  color: #64748b;
}

.profile-card__loading {
  color: #475569;
}

.profile-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.profile-form__grid {
  display: grid;
  gap: 20px;
}

@media (min-width: 680px) {
  .profile-form__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

label {
  font-weight: 600;
  color: #0f172a;
}

input,
select {
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 0.85rem 1rem;
  font-size: 1rem;
  background: #f8fafc;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

input:focus,
select:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
  outline: none;
}

.alert {
  padding: 0.75rem 1rem;
  border-radius: 12px;
  font-weight: 600;
}

.alert--success {
  background: rgba(34, 197, 94, 0.12);
  color: #166534;
}

.alert--error {
  background: rgba(239, 68, 68, 0.12);
  color: #b91c1c;
}

.error {
  color: #b91c1c;
  font-size: 0.85rem;
  margin: 0;
}

.has-error input,
.has-error select {
  border-color: #f87171;
  box-shadow: 0 0 0 3px rgba(248, 113, 113, 0.12);
}

.profile-form__actions {
  display: flex;
  justify-content: flex-end;
}

.btn {
  background: linear-gradient(135deg, #2563eb, #3b82f6);
  color: #ffffff;
  padding: 0.95rem 2.4rem;
  border-radius: 999px;
  border: none;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 14px 30px rgba(37, 99, 235, 0.35);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 18px 40px rgba(37, 99, 235, 0.45);
}

.btn[disabled] {
  background: #93c5fd;
  box-shadow: none;
  cursor: not-allowed;
}
.btn--ghost {
  background: transparent;
  color: #2563eb;
  box-shadow: none;
  border: 1px solid rgba(37, 99, 235, 0.25);
}
.btn--ghost:hover {
  background: rgba(37, 99, 235, 0.08);
}
.back-btn {
  font-size: 1rem;
}

.profile-history__empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
  padding: 32px;
  background: rgba(148, 163, 184, 0.1);
  border-radius: 16px;
  color: #475569;
}

.profile-history {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.history-table-wrapper {
  width: 100%;
  overflow-x: auto;
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.25);
}

.reservation-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 640px;
}

.reservation-table thead {
  background: rgba(37, 99, 235, 0.08);
}

.reservation-table th,
.reservation-table td {
  padding: 14px 18px;
  text-align: left;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  color: #1f2937;
}

.reservation-table th {
  font-size: 0.95rem;
  color: #0f172a;
  font-weight: 600;
}

.reservation-title {
  display: block;
  font-weight: 600;
  color: #0f172a;
}

.reservation-location {
  color: #475569;
}

.history-actions {
  display: flex;
  justify-content: flex-end;
}
</style>
