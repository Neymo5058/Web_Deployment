<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

const props = defineProps({
  label: { type: String, default: '' },
  fallback: { type: [String, Object], default: () => ({ name: 'events' }) },
});

const { t } = useI18n();

const router = useRouter();

function goBack() {
  router.push(props.fallback);
}

const labelText = computed(() => props.label || t('eventDetail.back'));
</script>

<template>
  <button type="button" class="back-btn" @click="goBack">
    <ion-icon name="arrow-back-outline"></ion-icon>
    <span class="label">{{ labelText }}</span>
  </button>
</template>

<style scoped>
.back-btn {
  background: none;
  border: none;
  color: #1f2937;
  font-weight: 600;
  font-size: 16px;
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  cursor: pointer;
  padding: 0;
  font-size: 1.2rem;
}
.back-btn:hover,
.back-btn:focus {
  text-decoration: underline;
  outline: none;
}
.icon {
  width: 22px;
  height: 22px;
}
</style>
