import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import Backend from 'i18next-http-backend';

const savedLang = localStorage.getItem('watchnexus_language') || 'en';

i18n
  .use(Backend)
  .use(initReactI18next)
  .init({
    lng: savedLang,
    fallbackLng: 'en',
    debug: process.env.NODE_ENV === 'development',
    backend: {
      loadPath: '/locales/{{lng}}.json',
    },
    interpolation: {
      escapeValue: false,
    },
  });

export const changeLanguage = async (lang) => {
  await i18n.changeLanguage(lang);
  localStorage.setItem('watchnexus_language', lang);
  document.documentElement.lang = lang;
};

export default i18n;
