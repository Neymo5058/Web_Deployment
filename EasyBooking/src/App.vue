<template>
  <Header />
  <router-view />
</template>

<script setup>
import { onMounted } from 'vue';

import Header from '@/components/Header.vue';
import { useAuthStore } from '@/stores/authStore.js';

const authStore = useAuthStore();

onMounted(() => {
  authStore.initialize();
});
</script>

<style></style>
