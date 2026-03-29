export function resolveApiError(error) {
  const responseMessage =
    typeof error?.response?.data?.message === 'string'
      ? error.response.data.message.trim()
      : '';
  const fallbackMessage =
    typeof error?.message === 'string' ? error.message.trim() : '';

  const message = responseMessage || fallbackMessage;
  const normalizedMessage = message.toLowerCase();

  const isTimeout =
    error?.code === 'ECONNABORTED' || normalizedMessage.includes('timeout');

  if (isTimeout) {
    return { type: 'timeout', message: '' };
  }

  if (message) {
    return { type: 'message', message };
  }

  return { type: 'generic', message: '' };
}

export function isTimeoutError(error) {
  return resolveApiError(error).type === 'timeout';
}

export default { resolveApiError, isTimeoutError };
