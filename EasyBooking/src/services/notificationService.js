import apiClient from './apiClient.js';

export const acknowledgeNotification = (notificationId) =>
  apiClient.post(
    `/organizer/notifications/${encodeURIComponent(notificationId)}/acknowledge`
  );

export default {
  acknowledgeNotification,
};
