import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import ar from "./locales/ar.json";
import en from "./locales/en.json";
import fr from "./locales/fr.json";
import es from "./locales/es.json";
import de from "./locales/de.json";
import tr from "./locales/tr.json";
import ur from "./locales/ur.json";
import hi from "./locales/hi.json";
import zh from "./locales/zh.json";
import ja from "./locales/ja.json";
import ko from "./locales/ko.json";
import pt from "./locales/pt.json";
import ru from "./locales/ru.json";
import id from "./locales/id.json";
import fa from "./locales/fa.json";

/** Languages with Right-to-Left direction */
export const RTL_LANGUAGES = ["ar", "ur", "fa", "he"];

export interface LangOption {
  code: string;
  label: string;
  nativeLabel: string;
  flag: string;
  dir: "rtl" | "ltr";
  fontFamily: string;
}

export const LANGUAGES: LangOption[] = [
  { code: "ar", label: "Arabic", nativeLabel: "العربية", flag: "🇸🇦", dir: "rtl", fontFamily: "'Cairo', sans-serif" },
  { code: "en", label: "English", nativeLabel: "English", flag: "🇺🇸", dir: "ltr", fontFamily: "'Outfit', sans-serif" },
  { code: "fr", label: "French", nativeLabel: "Français", flag: "🇫🇷", dir: "ltr", fontFamily: "'Outfit', sans-serif" },
  { code: "es", label: "Spanish", nativeLabel: "Español", flag: "🇪🇸", dir: "ltr", fontFamily: "'Outfit', sans-serif" },
  { code: "de", label: "German", nativeLabel: "Deutsch", flag: "🇩🇪", dir: "ltr", fontFamily: "'Outfit', sans-serif" },
  { code: "tr", label: "Turkish", nativeLabel: "Türkçe", flag: "🇹🇷", dir: "ltr", fontFamily: "'Outfit', sans-serif" },
  { code: "pt", label: "Portuguese", nativeLabel: "Português", flag: "🇧🇷", dir: "ltr", fontFamily: "'Outfit', sans-serif" },
  { code: "ru", label: "Russian", nativeLabel: "Русский", flag: "🇷🇺", dir: "ltr", fontFamily: "'Outfit', sans-serif" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी", flag: "🇮🇳", dir: "ltr", fontFamily: "'Noto Sans Devanagari', sans-serif" },
  { code: "ur", label: "Urdu", nativeLabel: "اردو", flag: "🇵🇰", dir: "rtl", fontFamily: "'Cairo', sans-serif" },
  { code: "fa", label: "Persian", nativeLabel: "فارسی", flag: "🇮🇷", dir: "rtl", fontFamily: "'Cairo', sans-serif" },
  { code: "zh", label: "Chinese", nativeLabel: "中文", flag: "🇨🇳", dir: "ltr", fontFamily: "'Noto Sans SC', sans-serif" },
  { code: "ja", label: "Japanese", nativeLabel: "日本語", flag: "🇯🇵", dir: "ltr", fontFamily: "'Noto Sans JP', sans-serif" },
  { code: "ko", label: "Korean", nativeLabel: "한국어", flag: "🇰🇷", dir: "ltr", fontFamily: "'Noto Sans KR', sans-serif" },
  { code: "id", label: "Indonesian", nativeLabel: "Bahasa", flag: "🇮🇩", dir: "ltr", fontFamily: "'Outfit', sans-serif" },
];

/** Apply language direction and font to the document */
export function applyLanguageSettings(lng: string) {
  const lang = LANGUAGES.find((l) => l.code === lng) || LANGUAGES[0];
  document.documentElement.lang = lng;
  document.documentElement.dir = lang.dir;
  document.documentElement.style.fontFamily = lang.fontFamily;
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ar: { translation: ar },
      en: { translation: en },
      fr: { translation: fr },
      es: { translation: es },
      de: { translation: de },
      tr: { translation: tr },
      ur: { translation: ur },
      hi: { translation: hi },
      zh: { translation: zh },
      ja: { translation: ja },
      ko: { translation: ko },
      pt: { translation: pt },
      ru: { translation: ru },
      id: { translation: id },
      fa: { translation: fa },
    },
    fallbackLng: "ar",
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "ablox_lang",
    },
  });

// Apply settings on init and language change
applyLanguageSettings(i18n.language || "ar");
i18n.on("languageChanged", applyLanguageSettings);

export default i18n;
