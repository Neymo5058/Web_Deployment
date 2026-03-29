<script setup>
const props = defineProps({
  currentPage: Number,
  totalPages: Number,
});

const emit = defineEmits(['change-page']);

const paginate = (page) => {
  if (page >= 1 && page <= props.totalPages) {
    emit('change-page', page);
  }
};
</script>

<template>
  <div class="pagination">
    <button :disabled="currentPage === 1" @click="paginate(currentPage - 1)">
      ‹
    </button>

    <button
      v-for="p in totalPages"
      :key="p"
      @click="paginate(p)"
      :class="{ active: currentPage === p }"
    >
      {{ p }}
    </button>

    <button
      :disabled="currentPage === totalPages"
      @click="paginate(currentPage + 1)"
    >
      ›
    </button>
  </div>
</template>

<style scoped>
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 2.5rem auto 0;
  padding: 0.6rem 1rem;
  background: rgba(241, 243, 245, 0.85);
  border-radius: 12px;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
  width: min(640px, 92%);
}

.pagination button {
  min-width: 38px;
  height: 38px;
  border: none;
  border-radius: 8px;
  background: #e9ecef;
  color: #334155;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.25s ease;
}

.pagination button:hover:not(:disabled) {
  background: #4dabf7;
  color: #fff;
  transform: translateY(-2px);
}

.pagination button.active {
  background: #1c7ed6;
  color: #fff;
  font-weight: 600;
  box-shadow: 0 2px 6px rgba(28, 126, 214, 0.35);
}

.pagination button:disabled {
  background: #dee2e6;
  color: #94a3b8;
  cursor: not-allowed;
  box-shadow: none;
}

@media (max-width: 600px) {
  .pagination {
    gap: 0.3rem;
    padding: 0.75rem 0.9rem;
  }

  .pagination button {
    min-width: 34px;
    height: 34px;
    font-size: 0.85rem;
  }
}
</style>
