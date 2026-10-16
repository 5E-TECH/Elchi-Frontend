import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../app/providers/theme/ThemeContext";
import { useUpdateSettings, type Language, type ThemeMode } from "../../../entities/settings";
import { changeAppLanguage, normalizeLanguage } from "../../../i18n";

/**
 * Profil menyusidagi «Mavzu» va «Til» (taxta `tizim-states-navigation`: «Profil, sozlamalar, mavzu, til va
 * chiqish — profil menyusida»). Sozlamalar sahifasi bilan BIR XIL qoida (`pages/settings` → `onTheme` /
 * `onLanguage`): darhol qo'llanadi va serverdagi sozlamaga yoziladi. Serverga yozilmasa `SettingsSync`
 * keyingi kirishda (va har render'da) eski qiymatni qaytarib qo'yardi.
 */

/** Til nomlari o'z tilida (Sozlamalar sahifasidagi ro'yxat bilan bir xil). */
export const LANGUAGE_OPTIONS: readonly { value: Language; label: string }[] = [
  { value: "uz", label: "O'zbekcha" },
  { value: "ru", label: "Русский" },
  { value: "en", label: "English" },
];

export const useAppearance = () => {
  const { theme, setTheme } = useTheme();
  const { i18n } = useTranslation();
  const update = useUpdateSettings();
  const language = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language) as Language;

  const changeTheme = useCallback(
    (next: ThemeMode) => {
      if (next === theme) return;
      setTheme(next);
      // `themeChosen` — aniq tanlov belgisi (entities/settings → mergeSettings).
      update.mutate({ appearance: { theme: next, themeChosen: true } });
    },
    [setTheme, theme, update],
  );

  const changeLanguage = useCallback(
    (next: Language) => {
      if (next === language) return;
      void changeAppLanguage(next);
      update.mutate({ appearance: { language: next } });
    },
    [language, update],
  );

  return { theme, language, changeTheme, changeLanguage };
};
