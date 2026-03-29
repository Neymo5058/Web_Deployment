<script setup>
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';

import { useAuthStore } from '@/stores/authStore.js';

const { t } = useI18n();
const authStore = useAuthStore();
const { isAuthenticated } = storeToRefs(authStore);

const featureCards = [
  {
    icon: 'search-outline',
    iconClass: 'magnifying-glass',
    titleKey: 'home.feature_search',
    descriptionKey: 'home.feature_search_desc',
  },
  {
    icon: 'ticket-outline',
    iconClass: 'ticket',
    titleKey: 'home.feature_booking',
    descriptionKey: 'home.feature_booking_desc',
  },
  {
    icon: 'lock-closed-outline',
    iconClass: 'lock',
    titleKey: 'home.feature_payment',
    descriptionKey: 'home.feature_payment_desc',
  },
];
</script>

<template>
  <section class="home-hero">
    <div class="hero-inner container">
      <h1 class="hero-title">
        {{ t('home.title') }}
      </h1>

      <div class="hero-ctas">
        <template v-if="!isAuthenticated">
          <router-link class="btn btn-primary" to="/signup">
            {{ t('navbar.signup') }}
          </router-link>
          <router-link class="btn btn-ghost" to="/signin">
            {{ t('navbar.signin') }}
          </router-link>
        </template>
        <template v-else>
          <router-link class="btn btn-primary" :to="{ name: 'events' }">
            {{ t('home.cta_events') }}
          </router-link>
        </template>
      </div>
    </div>
  </section>

  <section class="feature-wrap">
    <div class="container">
      <header class="feature-head">
        <h2 class="feature-title">
          {{ t('home.subtitle') }}
        </h2>
      </header>

      <div class="grid-home">
        <div v-for="card in featureCards" :key="card.titleKey" class="card">
          <ion-icon :class="card.iconClass" :name="card.icon" />
          <h5>{{ t(card.titleKey) }}</h5>
          <p>{{ t(card.descriptionKey) }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* HERO SECTION */
.home-hero {
  --hero-img: url('/img/background1.jpg');
  position: relative;
  min-height: 92vh;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: left;
  padding: clamp(5rem, 12vw, 8rem) 0;
  overflow: hidden;
  isolation: isolate;
  background: radial-gradient(
      circle at 15% 20%,
      rgba(37, 99, 235, 0.28),
      transparent 55%
    ),
    radial-gradient(
      circle at 80% 10%,
      rgba(168, 85, 247, 0.22),
      transparent 60%
    ),
    linear-gradient(120deg, rgba(15, 23, 42, 0.9), rgba(2, 6, 23, 0.95)),
    var(--hero-img) center/cover no-repeat;
  color: #f8fafc;
}

.hero-inner {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: clamp(1.75rem, 4vw, 2.75rem);
  max-width: 60ch;
}

.home-hero::before,
.home-hero::after {
  content: '';
  position: absolute;
  border-radius: 999px;
  filter: blur(80px);
  opacity: 0.65;
}

.home-hero::before {
  inset: auto -10% -20% auto;
  width: clamp(280px, 35vw, 420px);
  height: clamp(280px, 35vw, 420px);
  background: linear-gradient(
    140deg,
    rgba(37, 99, 235, 0.6),
    rgba(20, 184, 166, 0.55)
  );
}

.home-hero::after {
  inset: -25% auto auto -15%;
  width: clamp(240px, 32vw, 380px);
  height: clamp(240px, 32vw, 380px);
  background: linear-gradient(
    135deg,
    rgba(168, 85, 247, 0.55),
    rgba(14, 116, 144, 0.45)
  );
}

.hero-title {
  color: #f8fafc;
  line-height: 1.05;
  letter-spacing: -0.03em;
  font-size: clamp(2.4rem, 4vw + 1.2rem, 4.9rem);
  max-width: 18ch;
  margin: 0;
  text-shadow: 0 20px 40px rgba(15, 23, 42, 0.35);
}

.hero-ctas {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 3rem;
  padding: 0 1.8rem;
  border-radius: 999px;
  border: 1px solid transparent;
  font-weight: 600;
  transition: transform 0.15s ease, opacity 0.15s ease, background 0.25s ease,
    color 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
  text-decoration: none;
  letter-spacing: 0.01em;
  box-shadow: 0 18px 35px rgba(15, 23, 42, 0.2);
}

.btn:active {
  transform: translateY(1px);
}

.btn-primary {
  background: linear-gradient(135deg, var(--gradient-1), var(--gradient-2));
  color: #fff;
  box-shadow: 0 18px 40px rgba(37, 99, 235, 0.45);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 22px 44px rgba(37, 99, 235, 0.55);
}

.btn-ghost {
  background: rgba(15, 23, 42, 0.4);
  color: #f8fafc;
  border-color: rgba(248, 250, 252, 0.45);
  backdrop-filter: blur(8px);
}

.btn-ghost:hover {
  border-color: rgba(255, 255, 255, 0.75);
  transform: translateY(-2px);
  background: rgba(15, 23, 42, 0.55);
}

.feature-wrap {
  position: relative;
  background: linear-gradient(160deg, #0b1120 0%, #020617 70%);
  padding: clamp(3.5rem, 6vw, 6.5rem) 0;
  color: #fff;
  overflow: hidden;
}

.feature-head {
  margin-bottom: clamp(1.75rem, 4vw, 3rem);
  text-align: left;
}

.feature-title {
  font-size: clamp(1.7rem, 2.4vw + 1rem, 2.6rem);
  line-height: 1.3;
  color: #e8edff;
  letter-spacing: -0.015em;
  margin: 0;
}

.grid-home {
  display: grid;
  gap: clamp(1.25rem, 3vw, 2rem);
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}

.card {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 20px;
  padding: clamp(1.6rem, 3vw, 2rem);
  text-align: left;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease,
    background 0.2s ease;
  backdrop-filter: blur(18px);
  box-shadow: 0 24px 45px rgba(15, 23, 42, 0.45);
}

.card:hover {
  transform: translateY(-6px);
  border-color: rgba(148, 163, 184, 0.55);
  box-shadow: 0 30px 60px rgba(15, 23, 42, 0.55);
  background: rgba(15, 23, 42, 0.78);
}

.card h5 {
  margin: 1rem 0 0.5rem;
  color: #f8fafc;
  font-size: 1.15rem;
}

.card p {
  color: rgba(226, 232, 240, 0.9);
  line-height: 1.65;
}

ion-icon {
  font-size: 2.6rem;
}

.magnifying-glass {
  color: #60a5fa;
}

.ticket {
  color: #fbbf24;
}

.lock {
  color: #34d399;
}

@media (max-width: 1024px) {
  .hero-inner {
    align-items: center;
    text-align: center;
    max-width: 100%;
  }

  .hero-ctas {
    justify-content: center;
  }
}

@media (max-width: 640px) {
  .hero-title {
    font-size: clamp(2rem, 9vw, 3.4rem);
  }

  .btn {
    width: 100%;
  }

  .feature-head {
    text-align: center;
  }
}

@media (max-width: 480px) {
  .home-hero {
    min-height: 80vh;
  }

  .feature-wrap {
    padding-block: 2.5rem;
  }
}

.feature-wrap::before {
  content: '';
  position: absolute;
  inset: -40% auto auto -20%;
  width: clamp(240px, 40vw, 420px);
  height: clamp(240px, 40vw, 420px);
  background: radial-gradient(circle, rgba(37, 99, 235, 0.55), transparent 60%);
  filter: blur(70px);
  opacity: 0.7;
  pointer-events: none;
}

.feature-wrap::after {
  content: '';
  position: absolute;
  inset: auto -15% -40% auto;
  width: clamp(220px, 38vw, 380px);
  height: clamp(220px, 38vw, 380px);
  background: radial-gradient(
    circle,
    rgba(168, 85, 247, 0.45),
    transparent 65%
  );
  filter: blur(70px);
  opacity: 0.65;
  pointer-events: none;
}
</style>
