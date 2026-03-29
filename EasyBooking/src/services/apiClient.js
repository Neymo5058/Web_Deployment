import axios from 'axios';

const DEFAULT_API_HOST =
  import.meta.env.MODE === 'production'
    ? 'http://easybooking-app.online' //  Ton domaine AWS
    : 'http://localhost:5000';

const normalizeBaseUrl = (url) => {
  const trimmed = url?.trim();
  if (!trimmed) return DEFAULT_API_HOST;

  const withoutTrailingSlash = trimmed.replace(/\/$/, '');
  return withoutTrailingSlash.endsWith('/api')
    ? withoutTrailingSlash
    : `${withoutTrailingSlash}/api`;
};

export const API_URL = normalizeBaseUrl(
  import.meta.env.VITE_API_URL || DEFAULT_API_HOST
);

const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

export const setAuthToken = (token) => {
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common['Authorization'];
  }
};

export default apiClient;
