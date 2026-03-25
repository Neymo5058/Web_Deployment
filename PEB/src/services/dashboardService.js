import apiClient from './apiClient.js';

export const fetchAdminMetrics = (params = {}) =>
  apiClient.get('/admin/metrics', { params });

export const fetchAdminAccess = (params = {}) =>
  apiClient.get('/admin/access', { params });

export const updateAdminUserRole = (userId, role) =>
  apiClient.patch(`/admin/access/${userId}/role`, { role });

export const fetchAdminPendingEvents = (params = {}) =>
  apiClient.get('/admin/events/pending', { params });

export const approveAdminEvent = (eventId) =>
  apiClient.patch(`/admin/events/${encodeURIComponent(eventId)}/approve`);

export const rejectAdminEvent = (eventId) =>
  apiClient.patch(`/admin/events/${encodeURIComponent(eventId)}/reject`);

export const fetchOrganizerMetrics = (params = {}) =>
  apiClient.get('/organizer/metrics', { params });

export default {
  fetchAdminMetrics,
  fetchAdminAccess,
  updateAdminUserRole,
  fetchAdminPendingEvents,
  approveAdminEvent,
  rejectAdminEvent,
  fetchOrganizerMetrics,
};
