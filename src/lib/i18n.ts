import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpApi from 'i18next-http-backend'; // To load translations from /locales

i18n
  .use(HttpApi) // Load translations using http (default public/locales)
  .use(LanguageDetector) // Detect user language
  .use(initReactI18next) // Pass the i18n instance to react-i18next.
  .init({
    supportedLngs: ['en', 'zh'],
    fallbackLng: 'en',
    debug: process.env.NODE_ENV === 'development', // Enable debug output in development
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'], // Cache found language in localStorage
    },
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json', // Path to translation files
    },
    react: {
      useSuspense: true, // Use suspense for loading translations
    }
  });

export default i18n;
