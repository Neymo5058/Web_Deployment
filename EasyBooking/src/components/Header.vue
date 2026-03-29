<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/stores/authStore.js';

const { locale, t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();
const { isAuthenticated, user } = storeToRefs(authStore);
const route = useRoute();
const isHome = computed(() => route.name === 'Home' || route.path === '/');

const isAdmin = computed(() => user.value?.role === 'admin');

const canAccessOrganizerDashboard = computed(() => {
  const role = user.value?.role;
  return role === 'organizer' || role === 'admin';
});

const toggleLang = () => {
  locale.value = locale.value === 'fr' ? 'en' : 'fr';
  localStorage.setItem('locale', locale.value);
};

const userDisplayName = computed(() => {
  if (!user.value) {
    return '';
  }

  if (user.value.fullname) {
    return user.value.fullname.split(' ')[0];
  }

  return user.value.email;
});

const roleLabel = computed(() => {
  if (!user.value?.role) {
    return '';
  }

  const key = `roles.${user.value.role}`;
  const translated = t(key);
  return translated === key ? user.value.role : translated;
});

const isMenuOpen = ref(false);
const navId = 'primary-navigation';

const closeMenu = () => {
  isMenuOpen.value = false;
};

const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value;
};

const menuToggleLabel = computed(() =>
  isMenuOpen.value ? t('navbar.closeMenu') : t('navbar.openMenu')
);

const logout = async () => {
  closeMenu();
  await authStore.logout();
  router.push('/');
};

const handleEscape = (event) => {
  if (event.key === 'Escape') {
    closeMenu();
  }
};

const handleResize = () => {
  if (window.innerWidth >= 1024) {
    closeMenu();
  }
};

watch(
  () => route.fullPath,
  () => {
    closeMenu();
  }
);

watch(isMenuOpen, (value) => {
  if (typeof document === 'undefined') return;
  document.body.classList.toggle('no-scroll', value);
});

onMounted(() => {
  document.addEventListener('keydown', handleEscape);
  window.addEventListener('resize', handleResize);
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleEscape);
  window.removeEventListener('resize', handleResize);
  if (typeof document !== 'undefined') {
    document.body.classList.remove('no-scroll');
  }
});
</script>

<template>
  <header class="bar">
    <div class="bar__inner">
      <div class="left-group">
        <button
          class="menu-toggle"
          type="button"
          :aria-expanded="isMenuOpen"
          :aria-controls="navId"
          :aria-label="menuToggleLabel"
          @click="toggleMenu"
        >
          <ion-icon
            :name="isMenuOpen ? 'close-outline' : 'menu-outline'"
          ></ion-icon>
        </button>
        <div class="logo">
          <img
            src="@/assets/logo_1.png"
            alt="EasyBooking"
            class="logo__img"
          />
        </div>
        <div class="user-chip" role="status" aria-live="polite">
          <span class="user-name">
            {{ $t('navbar.welcome', { name: userDisplayName }) }}
          </span>
          <span v-if="roleLabel" class="user-role">{{ roleLabel }}</span>
        </div>
      </div>

      <nav
        :id="navId"
        class="right-nav"
        :class="{ 'is-open': isMenuOpen }"
        aria-label="Primary"
      >
        <RouterLink
          v-if="!isAuthenticated && !isHome"
          to="/"
          class="home-btn"
          @click="closeMenu"
        >
          {{ $t('home.home') }}
        </RouterLink>
        <RouterLink
          v-if="isAuthenticated && isAdmin"
          to="/dashboard/admin"
          class="dashboard-btn"
          @click="closeMenu"
        >
          {{ $t('navbar.adminDashboard') }}
        </RouterLink>
        <RouterLink
          v-if="isAuthenticated && canAccessOrganizerDashboard"
          to="/dashboard/organizer"
          class="dashboard-btn"
          @click="closeMenu"
        >
          {{ $t('navbar.organizerDashboard') }}
        </RouterLink>

        <RouterLink
          v-if="isAuthenticated"
          to="/profile"
          class="dashboard-btn"
          @click="closeMenu"
        >
          {{ $t('navbar.profile') }}
        </RouterLink>
        <button
          class="btn-lang"
          type="button"
          :aria-label="$t('common.globe_label')"
          @click="toggleLang"
        >
          <ion-icon class="globe" name="globe-outline"></ion-icon>
          {{ locale.toUpperCase() }}
        </button>
        <template v-if="isAuthenticated">
          <button class="logout-btn" type="button" @click="logout">
            <ion-icon
              class="icon-logout-icon"
              name="log-out-outline"
            ></ion-icon>
            {{ $t('navbar.logout') }}
          </button>
        </template>
      </nav>
    </div>
    <div v-if="isMenuOpen" class="nav-overlay" @click="closeMenu"></div>
  </header>
</template>

<style scoped>
.bar {
  position: sticky;
  top: 0;
  z-index: 30;
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
  box-shadow: 0 16px 32px rgba(15, 23, 42, 0.08);
}

.bar__inner {
  width: min(1100px, 92%);
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  min-height: 4.5rem;
}

.left-group {
  display: flex;
  align-items: center;
  gap: 1.2rem;
  flex: 1;
}

.logo__img {
  height: 5rem;
  width: 6rem;
}

.menu-toggle {
  display: none;
  border: none;
  background: rgba(226, 232, 240, 0.5);
  padding: 0.35rem;
  border-radius: 0.75rem;
  cursor: pointer;
  align-items: center;
  justify-content: center;
  color: #1f2937;
  transition: background-color 0.2s ease, box-shadow 0.2s ease,
    transform 0.2s ease;
  box-shadow: 0 10px 18px rgba(15, 23, 42, 0.1);
}

.menu-toggle:hover {
  background: rgba(37, 99, 235, 0.12);
  transform: translateY(-1px);
}

.menu-toggle ion-icon {
  font-size: 1.8rem;
}

.right-nav {
  display: flex;
  align-items: center;
  gap: 1.1rem;
}

.right-nav button,
.right-nav a {
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(255, 255, 255, 0.7);
  padding: 0.55rem 1rem;
  cursor: pointer;
  border-radius: 0.9rem;
  text-decoration: none;
  color: #1f2937;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  transition: background-color 0.2s ease, color 0.2s ease,
    border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
  box-shadow: 0 14px 25px rgba(15, 23, 42, 0.12);
}

.right-nav button:focus-visible,
.right-nav a:focus-visible,
.menu-toggle:focus-visible {
  outline: 3px solid rgba(59, 130, 246, 0.35);
  outline-offset: 2px;
}

.dashboard-btn {
  border-color: rgba(37, 99, 235, 0.45);
  color: #1d4ed8;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.95),
    rgba(219, 234, 254, 0.9)
  );
}

.dashboard-btn:hover {
  background: linear-gradient(135deg, var(--gradient-1), var(--gradient-2));
  color: #fff;
  border-color: transparent;
  transform: translateY(-2px);
  box-shadow: 0 18px 40px rgba(37, 99, 235, 0.35);
}

.btn-lang {
  font-size: 1rem;
}

.btn-lang ion-icon {
  font-size: 1rem;
  color: #2563eb;
}

.user-chip {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.1rem;
  color: #1f2937;
}

.user-name {
  font-weight: 600;
}

.user-role {
  font-size: 0.75rem;
  font-weight: 600;
  background: rgba(37, 99, 235, 0.08);
  padding: 0.2rem 0.6rem;
  border-radius: 0.8rem;
  border: 1px solid rgba(37, 99, 235, 0.12);
}

.right-nav button:hover,
.right-nav a:hover {
  transform: translateY(-2px);
  box-shadow: 0 18px 38px rgba(15, 23, 42, 0.14);
}

.logout-btn {
  border-color: rgba(248, 113, 113, 0.45);
  color: #dc2626;
  background: rgba(248, 113, 113, 0.12);
}

.logout-btn:hover {
  background: #dc2626;
  color: #fff;
  border-color: transparent;
  box-shadow: 0 20px 40px rgba(220, 38, 38, 0.35);
}

.icon-logout-icon {
  font-size: 1.2rem;
}

.nav-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  backdrop-filter: blur(2px);
  z-index: 30;
}

@media (max-width: 1024px) {
  .bar__inner {
    gap: 0.75rem;
  }

  .menu-toggle {
    display: inline-flex;
  }

  .right-nav {
    position: fixed;
    inset: 0 0 0 auto;
    width: min(320px, 80vw);
    height: 100vh;
    background: rgba(255, 255, 255, 0.92);
    box-shadow: -2px 0 16px rgba(15, 23, 42, 0.12);
    flex-direction: column;
    align-items: stretch;
    padding: 5.5rem 1.5rem 2rem;
    transform: translateX(100%);
    visibility: hidden;
    opacity: 0;
    pointer-events: none;
    transition: transform 0.3s ease, opacity 0.3s ease;
    gap: 1rem;
    z-index: 40;
  }

  .right-nav.is-open {
    transform: translateX(0);
    visibility: visible;
    opacity: 1;
    pointer-events: auto;
  }

  .right-nav button,
  .right-nav a {
    width: 100%;
    justify-content: center;
    font-size: 1rem;
  }

  .user-chip {
    display: none;
  }

  .nav-overlay {
    z-index: 20;
  }
}

@media (max-width: 640px) {
  .left-group {
    flex: 1;
    justify-content: flex-start;
  }

  .logo__img {
    height: 2.5rem;
    width: 2.7rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .right-nav,
  .right-nav button,
  .right-nav a,
  .menu-toggle {
    transition: none;
  }
}
</style>
