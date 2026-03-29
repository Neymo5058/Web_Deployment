const SUPPORTED_LANGUAGES = ['en', 'fr'];
const DEFAULT_LANGUAGE = process.env.DEFAULT_LOCALE || 'en';

export const i18nMiddleware = (req, _res, next) => {
  const headerLanguage = req.headers['accept-language'];
  const queryLanguage = req.query.lang;

  const preferredLanguage = [queryLanguage, headerLanguage]
    .filter(Boolean)
    .map((value) => value.split(',')[0].trim().toLowerCase())
    .find((value) => SUPPORTED_LANGUAGES.includes(value));

  req.locale = preferredLanguage || DEFAULT_LANGUAGE;

  next();
};

export default i18nMiddleware;
