/// <reference path="../vite-env.d.ts" />
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '@/locales/en.json'
import zhCN from '@/locales/zh-CN.json'
import {
  getDefaultAppLanguage,
  LANGUAGE_STORAGE_KEY,
  parseAppLanguage,
  type AppLanguage,
} from '@shared/locale'

function readStoredLanguage(): AppLanguage {
  try {
    return parseAppLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY)) ?? getDefaultAppLanguage()
  } catch {
    return getDefaultAppLanguage()
  }
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    'zh-CN': { translation: zhCN },
  },
  lng: readStoredLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

function syncDocumentLang(lng: string) {
  document.documentElement.lang = lng === 'zh-CN' ? 'zh-CN' : 'en'
}

syncDocumentLang(i18n.language)

function notifyMainProcessLanguage(lng: string): void {
  const code: AppLanguage = lng === 'zh-CN' || lng.startsWith('zh') ? 'zh-CN' : 'en'
  window.appLocale?.notifyLanguageChanged(code)
}

i18n.on('languageChanged', (lng) => {
  syncDocumentLang(lng)
  notifyMainProcessLanguage(lng)
})

notifyMainProcessLanguage(i18n.language)

export function setAppLanguage(lng: AppLanguage): void {
  void i18n.changeLanguage(lng)
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lng)
  } catch {
    /* ignore */
  }
}

export default i18n
