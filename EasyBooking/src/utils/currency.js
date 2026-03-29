export const DEFAULT_CURRENCY = 'CAD';

const ISO_CURRENCY_REGEX = /^[A-Z]{3}$/;

export const COUNTRY_CURRENCY_MAP = Object.freeze({ CA: DEFAULT_CURRENCY });

export function normalizeCountryCode(countryCode) {
  if (typeof countryCode !== 'string') {
    return '';
  }

  const normalized = countryCode.trim().toUpperCase();
  return normalized === 'CA' ? 'CA' : '';
}

export function normalizeCurrencyCode(currencyCode) {
  if (typeof currencyCode !== 'string') {
    return '';
  }

  const normalized = currencyCode.trim().toUpperCase();
  return ISO_CURRENCY_REGEX.test(normalized) ? normalized : '';
}

export function resolveCurrencyCode(currencyCode, fallback = DEFAULT_CURRENCY) {
  return normalizeCurrencyCode(currencyCode) || fallback;
}

export function getCurrencyForCountry() {
  return DEFAULT_CURRENCY;
}

export function getUserCurrency(userLike) {
  return resolveCurrencyCode(userLike?.currency, DEFAULT_CURRENCY);
}

const clampFractionDigits = (value, fallback) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(Math.max(Math.trunc(numeric), 0), 20);
};

export function formatCurrency(amount, options = {}) {
  const {
    currency = DEFAULT_CURRENCY,
    locale = 'en-CA',
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
  } = options;

  const resolvedCurrency = resolveCurrencyCode(currency, DEFAULT_CURRENCY);
  const numericAmount = Number(amount);
  const value = Number.isFinite(numericAmount) ? numericAmount : 0;
  const minDigits = clampFractionDigits(minimumFractionDigits, 0);
  const maxDigits = Math.max(minDigits, clampFractionDigits(maximumFractionDigits, minDigits));

  const buildFormatter = (currencyCode) =>
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: minDigits,
      maximumFractionDigits: maxDigits,
    });

  try {
    return buildFormatter(resolvedCurrency).format(value);
  } catch (_error) {
    if (resolvedCurrency !== DEFAULT_CURRENCY) {
      try {
        return buildFormatter(DEFAULT_CURRENCY).format(value);
      } catch (_secondaryError) {
        // ignore and fallback to manual formatting below
      }
    }

    return `${value.toFixed(maxDigits)} ${resolvedCurrency}`.trim();
  }
}

export default {
  DEFAULT_CURRENCY,
  COUNTRY_CURRENCY_MAP,
  formatCurrency,
  getCurrencyForCountry,
  getUserCurrency,
  normalizeCountryCode,
  normalizeCurrencyCode,
  resolveCurrencyCode,
};
