import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import apiClient, { setAuthToken } from '@/services/apiClient.js';

const AUTH_TOKEN_KEY = 'auth_token';
const AUTH_USER_KEY = 'auth_user';

const readStoredUser = () => {
  const stored = localStorage.getItem(AUTH_USER_KEY);
  if (!stored) return null;

  try {
    return JSON.parse(stored);
  } catch (_error) {
    localStorage.removeItem(AUTH_USER_KEY);
    return null;
  }
};

const extractError = (error) => {
  if (error.response?.data) {
    return {
      message: error.response.data.message || 'Server error',
      fieldErrors: error.response.data.errors || [],
    };
  }
  if (error.request) {
    return { message: 'No server response', fieldErrors: [] };
  }
  return { message: error.message || 'Unknown error', fieldErrors: [] };
};

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem(AUTH_TOKEN_KEY) || null);
  const user = ref(readStoredUser());
  const isLoading = ref(false);

  if (token.value) setAuthToken(token.value);

  const isAuthenticated = computed(() => Boolean(token.value && user.value));

  const setSession = ({ token: newToken, user: newUser }) => {
    token.value = newToken;
    user.value = newUser;
    localStorage.setItem(AUTH_TOKEN_KEY, newToken);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(newUser));
    setAuthToken(newToken);
  };

  const clearSession = () => {
    token.value = null;
    user.value = null;
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    setAuthToken(null);
  };

  const initialize = () => {
    const storedToken = localStorage.getItem(AUTH_TOKEN_KEY);
    const storedUser = readStoredUser();

    if (storedToken && storedUser) {
      setSession({ token: storedToken, user: storedUser });
    } else {
      clearSession();
    }
  };

  // ✅ Register
  const register = async (payload) => {
    isLoading.value = true;
    try {
      const { data } = await apiClient.post('/auth/signup', payload);
      setSession(data);
      return data.user;
    } catch (error) {
      throw extractError(error);
    } finally {
      isLoading.value = false;
    }
  };

  // ✅ Login
  const login = async (payload) => {
    isLoading.value = true;
    try {
      const { data } = await apiClient.post('/auth/login', payload);
      setSession(data);
      return data.user;
    } catch (error) {
      throw extractError(error);
    } finally {
      isLoading.value = false;
    }
  };

  // ✅ Logout
  const logout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      clearSession();
    }
  };

  // ✅ Update profile
  const updateProfile = async (payload) => {
    isLoading.value = true;
    try {
      const { data } = await apiClient.patch('/auth/me', payload);
      if (data?.user) {
        user.value = data.user;
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
      }
      return data?.user;
    } catch (error) {
      throw extractError(error);
    } finally {
      isLoading.value = false;
    }
  };

  // ✅ Fetch profile
  const fetchProfile = async () => {
    if (!token.value) return null;

    try {
      const { data } = await apiClient.get('/auth/me');
      if (data?.user) {
        user.value = data.user;
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
        return data.user;
      }
      return null;
    } catch (error) {
      if (error.response?.status === 401) clearSession();
      throw extractError(error);
    }
  };

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    register,
    login,
    logout,
    clearSession,
    initialize,
    updateProfile,
    fetchProfile,
  };
});
