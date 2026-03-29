<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';

import { useAuthStore } from '@/stores/authStore.js';

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();
const { isLoading } = storeToRefs(authStore);

const form = reactive({
  email: '',
  password: '',
});

const fieldErrors = ref({});
const generalError = ref('');

const mapFieldErrors = (errors) => {
  const mapped = {};
  errors?.forEach?.(({ field, message }) => {
    if (field) {
      mapped[field] = message;
    }
  });
  return mapped;
};

const handleSubmit = async () => {
  generalError.value = '';
  fieldErrors.value = {};

  try {
    await authStore.login({
      email: form.email,
      password: form.password,
    });
    router.push('/');
  } catch (error) {
    generalError.value = error.message;
    fieldErrors.value = mapFieldErrors(error.fieldErrors);
  }
};
</script>

<template>
  <div class="auth-container">
    <div class="auth-card">
      <h2>{{ t('login.signin_title') }}</h2>

      <form @submit.prevent="handleSubmit" novalidate>
        <div class="form-group" :class="{ 'has-error': fieldErrors.email }">
          <label for="email">{{ t('login.email_label') }}</label>
          <input
            id="email"
            v-model.trim="form.email"
            type="email"
            :placeholder="t('login.email_placeholder')"
            :aria-label="t('login.email_label')"
            :aria-invalid="fieldErrors.email ? 'true' : 'false'"
            :disabled="isLoading"
            autocomplete="email"
            required
          />
          <p v-if="fieldErrors.email" class="error" role="alert">
            {{ fieldErrors.email }}
          </p>
        </div>

        <div class="form-group" :class="{ 'has-error': fieldErrors.password }">
          <label for="password">{{ t('login.password_label') }}</label>
          <input
            id="password"
            v-model="form.password"
            type="password"
            :placeholder="t('login.password_placeholder')"
            :aria-label="t('login.password_label')"
            :aria-invalid="fieldErrors.password ? 'true' : 'false'"
            :disabled="isLoading"
            autocomplete="current-password"
            required
          />
          <p v-if="fieldErrors.password" class="error" role="alert">
            {{ fieldErrors.password }}
          </p>
        </div>

        <p v-if="generalError" class="error general" role="alert">
          {{ generalError }}
        </p>

        <button type="submit" class="btn" :disabled="isLoading">
          <span v-if="isLoading">{{ t('common.loading') }}</span>
          <span v-else>{{ t('login.cta_signin') }}</span>
        </button>
      </form>

      <p class="signup-text">
        {{ t('login.no_account') }}
        <RouterLink to="/signup">{{ t('login.link_signup') }}</RouterLink>
      </p>
    </div>
  </div>
</template>

<style scoped>
.auth-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: clamp(2rem, 5vw, 3.5rem);
  background: linear-gradient(
      135deg,
      rgba(37, 99, 235, 0.12),
      rgba(20, 184, 166, 0.12)
    ),
    var(--muted-bg);
  color: var(--text-color);
  position: relative;
  isolation: isolate;
  overflow: hidden;
}

.auth-container::before,
.auth-container::after {
  content: '';
  position: absolute;
  border-radius: 999px;
  filter: blur(90px);
  opacity: 0.75;
  pointer-events: none;
}

.auth-container::before {
  inset: -25% auto auto -15%;
  width: clamp(260px, 40vw, 420px);
  height: clamp(260px, 40vw, 420px);
  background: linear-gradient(
    135deg,
    rgba(37, 99, 235, 0.5),
    rgba(168, 85, 247, 0.4)
  );
}

.auth-container::after {
  inset: auto -15% -25% auto;
  width: clamp(220px, 35vw, 380px);
  height: clamp(220px, 35vw, 380px);
  background: linear-gradient(
    135deg,
    rgba(20, 184, 166, 0.45),
    rgba(168, 85, 247, 0.4)
  );
}

.auth-card {
  width: min(420px, 100%);
  padding: clamp(2.2rem, 5vw, 2.8rem);
  border-radius: 1.25rem;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(22px);
  border: 1px solid rgba(148, 163, 184, 0.22);
  box-shadow: 0 32px 60px rgba(15, 23, 42, 0.16);
  text-align: left;
  color: #111827;
  position: relative;
  z-index: 1;
}

.auth-card h2 {
  margin-bottom: 1.6rem;
  font-size: clamp(1.8rem, 1.8vw + 1.3rem, 2.1rem);
  font-weight: 700;
  letter-spacing: -0.01em;
  color: #0f172a;
}

.form-group {
  margin-bottom: 1.15rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

label {
  font-size: 0.95rem;
  font-weight: 600;
  color: rgba(15, 23, 42, 0.85);
}

input {
  width: 100%;
  padding: 0.75rem 0.85rem;
  border: 1px solid rgba(148, 163, 184, 0.4);
  border-radius: 0.65rem;
  font-size: 0.97rem;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease,
    background-color 0.2s ease;
  background: rgba(255, 255, 255, 0.95);
}

input:hover {
  border-color: rgba(37, 99, 235, 0.4);
}

input:focus {
  border-color: rgba(37, 99, 235, 0.55);
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.18);
  background: rgba(255, 255, 255, 1);
}

.btn {
  width: 100%;
  background: linear-gradient(135deg, var(--gradient-1), var(--gradient-2));
  color: white;
  border: none;
  padding: 0.95rem;
  border-radius: 0.75rem;
  font-size: 1.05rem;
  font-weight: 700;
  cursor: pointer;
  margin-top: 0.5rem;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  box-shadow: 0 20px 40px rgba(37, 99, 235, 0.35);
}

.btn[disabled] {
  cursor: not-allowed;
  opacity: 0.65;
  box-shadow: none;
}

.btn:hover:not([disabled]) {
  transform: translateY(-2px);
  box-shadow: 0 24px 48px rgba(37, 99, 235, 0.45);
}

.signup-text {
  margin-top: 1.75rem;
  font-size: 0.95rem;
  color: rgba(71, 85, 105, 0.95);
  text-align: center;
}

.signup-text a {
  color: var(--gradient-1);
  text-decoration: none;
  font-weight: 600;
}

.signup-text a:hover {
  text-decoration: underline;
}

.error {
  font-size: 0.86rem;
  color: #c92a2a;
}

.error.general {
  margin-top: -0.25rem;
  margin-bottom: 0.85rem;
  text-align: center;
}

.has-error input {
  border-color: #c92a2a;
  box-shadow: 0 0 0 4px rgba(201, 42, 42, 0.15);
}

@media (max-width: 480px) {
  .auth-card {
    padding: 2rem;
  }
}
</style>
