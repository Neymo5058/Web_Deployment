<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { createEvent, updateEvent } from '@/services/eventService.js';

const props = defineProps({
  organizerName: {
    type: String,
    default: '',
  },
  event: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(['created', 'updated', 'error']);

const { t } = useI18n();

const toDateInputValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString().slice(0, 10);
};

const buildFormState = (source = null) => {
  if (!source) {
    return {
      title: '',
      subtitle: '',
      imageUrl: '',
      startsAt: '',
      hour: '',
      placeName: '',
      placeCity: '',
      placeCountry: '',
      organizer: props.organizerName || '',
      price: '',
      capacity: '',
      available: '',
    };
  }

  return {
    title: source.title || '',
    subtitle: source.subtitle || '',
    imageUrl: source.imageUrl || '',
    startsAt: toDateInputValue(source.startsAt),
    hour: source.hour || '',
    placeName: source.place?.name || '',
    placeCity: source.place?.city || '',
    placeCountry: source.place?.country || '',
    organizer: source.organizer || props.organizerName || '',
    price: source.price ?? '',
    capacity: source.capacity ?? '',
    available:
      source.available !== undefined && source.available !== null
        ? source.available
        : '',
  };
};

const form = reactive(buildFormState(props.event));

const fieldErrors = reactive({});
const globalError = ref(null);
const isSubmitting = ref(false);
const imagePreview = ref('');
const imageFileName = ref('');
const imageFileInput = ref(null);
const previousManualImageUrl = ref('');

const isEditing = computed(() => Boolean(props.event?.id));

const applyFormState = (state) => {
  Object.assign(form, state);
};

const clearValidationState = () => {
  Object.keys(fieldErrors).forEach((key) => delete fieldErrors[key]);
  globalError.value = null;
};

const resetFileInput = () => {
  if (imageFileInput.value) {
    imageFileInput.value.value = '';
  }
};

const syncWithSource = (source) => {
  applyFormState(buildFormState(source));
  clearValidationState();
  if (source?.imageUrl) {
    form.imageUrl = source.imageUrl;
    imagePreview.value = source.imageUrl;
    previousManualImageUrl.value = source.imageUrl;
  } else {
    imagePreview.value = '';
    previousManualImageUrl.value = '';
  }
  imageFileName.value = '';
  resetFileInput();
};

watch(
  () => props.organizerName,
  (value) => {
    if (!isEditing.value && value && !form.organizer) {
      form.organizer = value;
    }
  },
  { immediate: true }
);

watch(
  () => props.event,
  (value) => {
    syncWithSource(value);
  },
  { immediate: true }
);

const hasFieldError = (field) => Boolean(fieldErrors[field]);
const fieldErrorMessage = (field) => fieldErrors[field] || '';

const resetForm = () => {
  syncWithSource(isEditing.value ? props.event : null);
};

const requiredFields = computed(() => [
  'title',
  'imageUrl',
  'startsAt',
  'hour',
  'placeName',
  'placeCity',
  'organizer',
  'price',
  'capacity',
]);

const validate = () => {
  Object.keys(fieldErrors).forEach((key) => delete fieldErrors[key]);
  globalError.value = null;

  const missing = requiredFields.value.filter((field) => {
    const value = form[field];
    return (
      value === null || value === undefined || String(value).trim().length === 0
    );
  });

  if (missing.length) {
    missing.forEach((field) => {
      fieldErrors[field] = t('dashboard.organizer.form.validation.required');
    });
    return false;
  }

  return true;
};

const clearImageError = () => {
  if (fieldErrors.imageUrl) {
    delete fieldErrors.imageUrl;
  }
  if (form.imageUrl && !form.imageUrl.startsWith('data:')) {
    imagePreview.value = '';
    imageFileName.value = '';
    previousManualImageUrl.value = form.imageUrl;
    resetFileInput();
  }
};

const handleImageFileChange = (event) => {
  const [file] = event.target.files || [];

  imagePreview.value = '';
  imageFileName.value = '';

  if (!file) {
    return;
  }

  if (!file.type?.startsWith('image/')) {
    fieldErrors.imageUrl = t(
      'dashboard.organizer.form.validation.invalidImage'
    );
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const result = typeof reader.result === 'string' ? reader.result : '';
    if (!result) {
      fieldErrors.imageUrl = t(
        'dashboard.organizer.form.validation.imageReadError'
      );
      return;
    }

    if (!form.imageUrl?.startsWith('data:')) {
      previousManualImageUrl.value = form.imageUrl || '';
    }
    form.imageUrl = result;
    imagePreview.value = result;
    imageFileName.value = file.name;
    clearImageError();
  };

  reader.onerror = () => {
    fieldErrors.imageUrl = t(
      'dashboard.organizer.form.validation.imageReadError'
    );
  };

  reader.readAsDataURL(file);
};

const clearSelectedImage = () => {
  imagePreview.value = '';
  imageFileName.value = '';
  form.imageUrl = previousManualImageUrl.value || '';
  previousManualImageUrl.value = '';
  resetFileInput();
  clearImageError();
};

const handleSubmit = async () => {
  if (!validate()) {
    return;
  }

  isSubmitting.value = true;
  globalError.value = null;

  const payload = {
    title: form.title.trim(),
    subtitle: form.subtitle.trim() || undefined,

    imageUrl: form.imageUrl.trim() || undefined,
    startsAt: form.startsAt,
    hour: form.hour,
    place: {
      name: form.placeName.trim(),
      city: form.placeCity.trim(),
      ...(form.placeCountry && form.placeCountry.trim()
        ? { country: form.placeCountry.trim() }
        : {}),
    },
    organizer: form.organizer.trim(),
    price: Number.isNaN(Number(form.price)) ? form.price : Number(form.price),
    capacity: Number.isNaN(Number(form.capacity))
      ? form.capacity
      : Number(form.capacity),
  };

  if (String(form.available).trim().length > 0) {
    payload.available = Number.isNaN(Number(form.available))
      ? form.available
      : Number(form.available);
  }

  try {
    if (isEditing.value) {
      const { data } = await updateEvent(props.event.id, payload);
      const updatedEvent = data?.event || data;
      emit('updated', updatedEvent);
      syncWithSource(updatedEvent);
    } else {
      const { data } = await createEvent(payload);
      const createdEvent = data?.event || data;
      emit('created', createdEvent);
      syncWithSource(null);
    }
  } catch (error) {
    const responseErrors = error.response?.data?.errors;
    if (Array.isArray(responseErrors)) {
      responseErrors.forEach(({ field, message }) => {
        if (field) {
          fieldErrors[field] = message;
        }
      });
    }
    const fallbackKey = isEditing.value
      ? 'dashboard.organizer.updateError'
      : 'dashboard.organizer.createError';
    globalError.value =
      error.response?.data?.message || error.message || t(fallbackKey);
    emit('error', globalError.value);
  } finally {
    isSubmitting.value = false;
  }
};

const submitLabel = computed(() =>
  isEditing.value
    ? t('dashboard.organizer.form.update')
    : t('dashboard.organizer.form.submit')
);
</script>

<template>
  <form class="event-form" @submit.prevent="handleSubmit">
    <div class="form-grid">
      <label class="form-field">
        <span>{{ t('dashboard.organizer.form.titleLabel') }}</span>
        <input
          v-model="form.title"
          type="text"
          :class="{ 'has-error': hasFieldError('title') }"
          autocomplete="off"
        />
        <small v-if="hasFieldError('title')">{{
          fieldErrorMessage('title')
        }}</small>
      </label>

      <label class="form-field">
        <span>{{ t('dashboard.organizer.form.subtitleLabel') }}</span>
        <input v-model="form.subtitle" type="text" autocomplete="off" />
      </label>

      <label class="form-field">
        <span>{{ t('dashboard.organizer.form.imageUrlLabel') }}</span>
        <input
          v-model="form.imageUrl"
          type="text"
          :class="{ 'has-error': hasFieldError('imageUrl') }"
          autocomplete="off"
          @input="clearImageError"
        />
        <small v-if="hasFieldError('imageUrl')">{{
          fieldErrorMessage('imageUrl')
        }}</small>
      </label>

      <div class="form-field">
        <span>{{ t('dashboard.organizer.form.imageUploadLabel') }}</span>
        <input
          ref="imageFileInput"
          type="file"
          accept="image/*"
          capture="environment"
          :class="{ 'has-error': hasFieldError('imageUrl') }"
          @change="handleImageFileChange"
        />
        <small class="form-hint">{{
          t('dashboard.organizer.form.imageUploadHint')
        }}</small>
        <div v-if="imageFileName" class="upload-summary">
          <span>
            {{
              t('dashboard.organizer.form.imageUploadSelected', {
                file: imageFileName,
              })
            }}
          </span>
          <button
            type="button"
            class="btn btn-tertiary"
            @click="clearSelectedImage"
          >
            {{ t('dashboard.organizer.form.imageUploadClear') }}
          </button>
        </div>
        <img
          v-if="imagePreview"
          :src="imagePreview"
          alt=""
          class="image-preview"
        />
      </div>

      <label class="form-field">
        <span>{{ t('dashboard.organizer.form.startsAtLabel') }}</span>
        <input
          v-model="form.startsAt"
          type="date"
          :class="{ 'has-error': hasFieldError('startsAt') }"
        />
        <small v-if="hasFieldError('startsAt')">
          {{ fieldErrorMessage('startsAt') }}
        </small>
      </label>

      <label class="form-field">
        <span>{{ t('dashboard.organizer.form.hourLabel') }}</span>
        <input
          v-model="form.hour"
          type="time"
          :class="{ 'has-error': hasFieldError('hour') }"
        />
        <small v-if="hasFieldError('hour')">{{
          fieldErrorMessage('hour')
        }}</small>
      </label>

      <label class="form-field">
        <span>{{ t('dashboard.organizer.form.placeNameLabel') }}</span>
        <input
          v-model="form.placeName"
          type="text"
          :class="{
            'has-error':
              hasFieldError('place.name') || hasFieldError('placeName'),
          }"
          autocomplete="off"
        />
        <small v-if="hasFieldError('place.name')">{{
          fieldErrorMessage('place.name')
        }}</small>
        <small v-else-if="hasFieldError('placeName')">{{
          fieldErrorMessage('placeName')
        }}</small>
      </label>

      <label class="form-field">
        <span>{{ t('dashboard.organizer.form.placeCityLabel') }}</span>
        <input
          v-model="form.placeCity"
          type="text"
          :class="{
            'has-error':
              hasFieldError('place.city') || hasFieldError('placeCity'),
          }"
          autocomplete="off"
        />
        <small v-if="hasFieldError('place.city')">{{
          fieldErrorMessage('place.city')
        }}</small>
        <small v-else-if="hasFieldError('placeCity')">{{
          fieldErrorMessage('placeCity')
        }}</small>
      </label>

      <label class="form-field">
        <span>{{ t('dashboard.organizer.form.placeCountryLabel') }}</span>
        <input v-model="form.placeCountry" type="text" autocomplete="off" />
      </label>

      <label class="form-field">
        <span>{{ t('dashboard.organizer.form.organizerLabel') }}</span>
        <input
          v-model="form.organizer"
          type="text"
          :class="{ 'has-error': hasFieldError('organizer') }"
          autocomplete="off"
        />
        <small v-if="hasFieldError('organizer')">{{
          fieldErrorMessage('organizer')
        }}</small>
      </label>

      <label class="form-field">
        <span>{{ t('dashboard.organizer.form.priceLabel') }}</span>
        <input
          v-model="form.price"
          type="number"
          min="0"
          step="0.01"
          :class="{ 'has-error': hasFieldError('price') }"
        />
        <small v-if="hasFieldError('price')">{{
          fieldErrorMessage('price')
        }}</small>
      </label>

      <label class="form-field">
        <span>{{ t('dashboard.organizer.form.capacityLabel') }}</span>
        <input
          v-model="form.capacity"
          type="number"
          min="1"
          step="1"
          :class="{ 'has-error': hasFieldError('capacity') }"
        />
        <small v-if="hasFieldError('capacity')">{{
          fieldErrorMessage('capacity')
        }}</small>
      </label>

      <label class="form-field">
        <span>{{ t('dashboard.organizer.form.availableLabel') }}</span>
        <input v-model="form.available" type="number" min="0" step="1" />
        <small v-if="hasFieldError('available')">{{
          fieldErrorMessage('available')
        }}</small>
      </label>
    </div>

    <p v-if="globalError" class="form-error">{{ globalError }}</p>

    <div class="form-actions">
      <button class="btn btn-secondary" type="button" @click="resetForm">
        {{
          isEditing
            ? t('dashboard.organizer.form.resetEditing')
            : t('dashboard.organizer.form.reset')
        }}
      </button>
      <button class="btn btn-primary" type="submit" :disabled="isSubmitting">
        {{ isSubmitting ? t('common.loading') : submitLabel }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.event-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1.25rem 1rem;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-size: 0.95rem;
}

.form-field--full {
  grid-column: 1 / -1;
}

.form-field span {
  font-weight: 600;
  color: #1f2937;
}

.form-field input,
.form-field textarea {
  border: 1px solid #d1d5db;
  border-radius: 0.75rem;
  padding: 0.65rem 0.85rem;
  font-size: 0.95rem;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.form-field input:focus,
.form-field textarea:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.form-field input.has-error,
.form-field textarea.has-error {
  border-color: #ef4444;
}

.form-field small:not(.form-hint) {
  color: #ef4444;
  font-size: 0.8rem;
}

.form-hint {
  color: #6b7280;
}

.upload-summary {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  font-size: 0.9rem;
  color: #1f2937;
}

.image-preview {
  margin-top: 0.5rem;
  max-height: 160px;
  border-radius: 0.75rem;
  object-fit: cover;
  box-shadow: 0 6px 20px rgba(15, 23, 42, 0.12);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.6rem 1.4rem;
  border-radius: 0.75rem;
  border: 1px solid transparent;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}

.btn-primary {
  background: #2563eb;
  color: #fff;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: #fff;
  color: #1f2937;
  border-color: #d1d5db;
}

.btn-secondary:hover {
  border-color: #9ca3af;
}

.btn-tertiary {
  background: transparent;
  color: #2563eb;
  padding: 0.4rem 0.8rem;
}

.btn-tertiary:hover {
  background: rgba(37, 99, 235, 0.1);
}

.form-error {
  color: #ef4444;
  font-weight: 600;
}
</style>
