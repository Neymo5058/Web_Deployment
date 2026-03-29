<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  modelValue: { type: String, default: 'dateAsc' },
});
const emit = defineEmits(['update:modelValue']);
const { t } = useI18n();

const options = computed(() => [
  { value: 'dateAsc', label: t('event.sortOptions.dateAsc') },
  { value: 'dateDesc', label: t('event.sortOptions.dateDesc') },
  { value: 'priceAsc', label: t('event.sortOptions.priceAsc') },
  { value: 'priceDesc', label: t('event.sortOptions.priceDesc') },
  { value: 'capacityAsc', label: t('event.sortOptions.capacityAsc') },
  { value: 'capacityDesc', label: t('event.sortOptions.capacityDesc') },
]);
</script>

<template>
  <div class="sort-row">
    <label for="sort" class="sort-label">{{ t('event.sortLabel') }}</label>
    <select
      id="sort"
      :value="props.modelValue"
      @change="(e) => emit('update:modelValue', e.target.value)"
      class="sort-select"
    >
      <option
        v-for="option in options"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </option>
    </select>
  </div>
</template>

<style scoped>
.sort-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
  width: 100%;
}

.sort-label {
  font-weight: 600;
  color: #1f2937;
}

.sort-select {
  flex: 1;
  padding: 0.6rem 0.75rem;
  border: 1px solid rgba(148, 163, 184, 0.6);
  border-radius: 0.65rem;
  background: #fff;
  font-size: 0.95rem;
}

@media (max-width: 900px) {
  .sort-row {
    flex-direction: column;
    align-items: stretch;
  }

  .sort-select {
    width: 100%;
  }
}
</style>
