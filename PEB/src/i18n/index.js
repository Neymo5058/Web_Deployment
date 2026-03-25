import { createI18n } from 'vue-i18n';
import en from './en.json';
import fr from './fr.json';

const savedLocale = typeof window !== 'undefined' ? localStorage.getItem('locale') || 'en' : 'en';

const i18n = createI18n({
  legacy: false,
  locale: savedLocale,
  fallbackLocale: 'en',
  messages: {
    en,
    fr,
  },
});

export default i18n;
