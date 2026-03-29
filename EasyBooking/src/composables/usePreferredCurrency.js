import { computed } from 'vue';
import { storeToRefs } from 'pinia';

import { useAuthStore } from '@/stores/authStore.js';
import { DEFAULT_CURRENCY, getUserCurrency } from '@/utils/currency.js';

export function usePreferredCurrency() {
  const authStore = useAuthStore();
  const { user } = storeToRefs(authStore);

  const preferredCurrency = computed(() => {
    const resolved = getUserCurrency(user.value);
    return resolved || DEFAULT_CURRENCY;
  });

  return {
    preferredCurrency,
  };
}

export default usePreferredCurrency;
