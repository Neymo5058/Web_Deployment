<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  modelValue: { type: Number, default: 1 },
  min: { type: Number, default: 1 },
  max: { type: Number, default: Infinity },
  disabled: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue']);
const { t } = useI18n();

const minValue = computed(() =>
  Number.isFinite(props.min) ? Math.floor(props.min) : 1
);
const maxValue = computed(() =>
  Number.isFinite(props.max) ? Math.floor(props.max) : Infinity
);
const inputMin = computed(() =>
  Number.isFinite(props.min) ? minValue.value : 1
);
const inputMax = computed(() =>
  Number.isFinite(props.max) ? maxValue.value : null
);

function clamp(n) {
  return Math.max(minValue.value, Math.min(maxValue.value, n));
}

function set(n) {
  const numeric = Number(n);
  const fallback = Number.isFinite(props.min) ? props.min : minValue.value;
  const value = Number.isFinite(numeric) ? Math.round(numeric) : fallback;
  emit('update:modelValue', clamp(value));
}

function inc() {
  if (!props.disabled && props.modelValue < maxValue.value) {
    set(props.modelValue + 1);
  }
}

function dec() {
  if (!props.disabled && props.modelValue > minValue.value) {
    set(props.modelValue - 1);
  }
}

function onInput(e) {
  set(e.target.value);
}

const decreaseLabel = computed(() => t('checkout.quantity.decrease'));
const increaseLabel = computed(() => t('checkout.quantity.increase'));
</script>

<template>
  <div
    class="quantity-selector"
    :class="{ 'quantity-selector--disabled': disabled }"
  >
    <button
      type="button"
      class="quantity-selector__btn"
      :disabled="disabled || modelValue <= minValue"
      :aria-label="decreaseLabel"
      @click="dec"
    >
      −
    </button>

    <input
      class="quantity-selector__value"
      type="number"
      :value="modelValue"
      :min="inputMin"
      :max="inputMax"
      :disabled="disabled"
      inputmode="numeric"
      @input="onInput"
      @blur="onInput"
    />

    <button
      type="button"
      class="quantity-selector__btn"
      :disabled="disabled || modelValue >= maxValue"
      :aria-label="increaseLabel"
      @click="inc"
    >
      +
    </button>
  </div>
</template>

<style scoped>
.quantity-selector {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  padding: 22px 28px;
  background: #ffffff;
  border-radius: 14px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
}

.quantity-selector--disabled {
  opacity: 0.6;
}

.quantity-selector__btn {
  width: 52px;
  height: 48px;
  border-radius: 12px;
  border: 1px solid #d1d5db;
  background: linear-gradient(180deg, #ffffff 0%, #f3f4f6 100%);
  font-size: 28px;
  font-weight: 600;
  color: #111827;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, transform 0.1s ease;
}

.quantity-selector__btn:hover:not(:disabled) {
  background: #e5e7eb;
  border-color: #9ca3af;
}

.quantity-selector__btn:active:not(:disabled) {
  transform: translateY(1px);
}

.quantity-selector__btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.quantity-selector__value {
  width: 72px;
  height: 48px;
  border-radius: 12px;
  border: 1px solid #d1d5db;
  background: #ffffff;
  text-align: center;
  font-size: 20px;
  font-weight: 600;
  color: #111827;
  padding: 0 10px;
}

.quantity-selector__value::-webkit-outer-spin-button,
.quantity-selector__value::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.quantity-selector__value[type='number'] {
  -moz-appearance: textfield;
}

.quantity-selector__btn:focus-visible,
.quantity-selector__value:focus-visible {
  outline: 3px solid rgba(59, 130, 246, 0.4);
  outline-offset: 2px;
}
</style>
