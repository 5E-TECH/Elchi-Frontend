import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import { useSettings } from "../../entities/settings";
import { useTheme } from "./theme/ThemeContext";
import { changeAppLanguage, normalizeLanguage } from "../../i18n";
import { setSidebar } from "../../widgets/Sidebar/model/sidebarSlice";
import {
  readStoredLanguage,
  readStoredSidebar,
  readStoredTheme,
} from "../../shared/lib/preferencesStorage";

/**
 * SettingsSync — backenddagi per-user sozlamalarni ilova yuklanganda jonli
 * manbalarga (theme, til, sidebar) qo'llaydi. UI render qilmaydi (null).
 * Provayderlar (ThemeProvider, i18n, redux, react-query) ichida joylashishi shart.
 */
const SettingsSync = () => {
  const { data } = useSettings();
  const { theme, setTheme } = useTheme();
  const { i18n } = useTranslation();
  const dispatch = useDispatch();
  const appliedRef = useRef(false);

  useEffect(() => {
    if (!data) return;
    // Faqat birinchi yuklashda jonli manbalarni serverdagi qiymatga moslaymiz
    if (appliedRef.current) return;
    appliedRef.current = true;

    if (!readStoredTheme() && data.appearance.theme !== theme) {
      setTheme(data.appearance.theme);
    }
    const currentLang = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);
    if (!readStoredLanguage() && data.appearance.language !== currentLang) {
      void changeAppLanguage(data.appearance.language);
    }
    if (readStoredSidebar() === null) {
      dispatch(setSidebar(data.interface.sidebarOpen));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  return null;
};

export default SettingsSync;
