<script setup>
import { onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  modelValue: { type: String, default: '' },
  debounce: { type: Number, default: 300 },
});

const emit = defineEmits(['update:modelValue', 'search']);

const search = ref(props.modelValue ?? '');
const { t } = useI18n();

let debounceTimer;

const scheduleSearchEmit = (value) => {
  clearTimeout(debounceTimer);
  const delay = Number.isFinite(props.debounce) ? props.debounce : 300;
  debounceTimer = setTimeout(() => {
    emit('search', value);
  }, Math.max(0, delay));
};

const handleInput = (event) => {
  const value = event?.target?.value ?? '';
  search.value = value;
  emit('update:modelValue', value);
  scheduleSearchEmit(value);
};

watch(
  () => props.modelValue,
  (newValue) => {
    const normalized = newValue ?? '';
    if (normalized !== search.value) {
      search.value = normalized;
      scheduleSearchEmit(normalized);
    }
  }
);

onBeforeUnmount(() => {
  clearTimeout(debounceTimer);
});
</script>

<template>
  <div class="search-bar">
    <div class="search-bar__icon" aria-hidden="true">
      <ion-icon name="search-outline"></ion-icon>
    </div>
    <input
      :value="search"
      @input="handleInput"
      type="search"
      :placeholder="t('event.searchPlaceholder')"
      class="search-bar__input"
      :aria-label="t('event.searchAriaLabel')"
      autocomplete="off"
      spellcheck="false"
    />
  </div>
</template>

<style scoped>
.search-bar {
  display: flex;
  align-items: stretch;
  width: 100%;
  max-width: 420px;
  border-radius: 999px;
  overflow: hidden;
  background: #fff;
  border: 1px solid rgba(148, 163, 184, 0.3);
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
  min-height: 44px;
}

.search-bar__icon {
  background: #3b82f6;
  padding: 0 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.search-bar__input {
  flex: 1;
  border: none;
  padding: 0 16px;
  font-size: 0.95rem;
  outline: none;
  background: transparent;
}
.search-bar__icon ion-icon {
  font-size: 18px;
  color: white;
}

.search-bar__input:focus {
  box-shadow: inset 0 0 0 1px rgba(59, 130, 246, 0.5);
}

@media (min-width: 900px) {
  .search-bar {
    max-width: 360px;
  }
}
</style>
