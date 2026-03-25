import apiClient from './apiClient.js';

export const createEvent = (payload) => apiClient.post('/events', payload);

export const updateEvent = (id, payload) =>
  apiClient.put(`/events/${encodeURIComponent(id)}`, payload);

export const decrementEventAvailability = (id, quantity) =>
  apiClient.patch(`/events/${encodeURIComponent(id)}/decrement`, {
    ticketsSold: quantity,
  });

export default {
  createEvent,
  updateEvent,
  decrementEventAvailability,
};
