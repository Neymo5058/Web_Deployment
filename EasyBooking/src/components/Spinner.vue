<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<template>
  <div class="spinner-wrap">
    <div class="spinner" :aria-label="t('common.loadingAria')" />
  </div>
</template>
<style scoped>
.spinner-wrap {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 80px;
}

.spinner {
  width: 42px;
  height: 42px;
  border: 4px solid transparent;
  border-top-color: #ef4444;
  border-right-color: #3b82f6;
  border-bottom-color: #10b981;
  border-left-color: #f59e0b;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
