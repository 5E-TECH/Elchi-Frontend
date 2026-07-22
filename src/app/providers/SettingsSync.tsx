import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { mergeSettings, useSettings } from "../../entities/settings";
import { useTheme } from "./theme/ThemeContext";
import { changeAppLanguage, normalizeLanguage } from "../../i18n";
import { setSidebar } from "../../widgets/Sidebar/model/sidebarSlice";
import type { RootState } from "../config/store";
import {
  writeStoredScannerErrorSound,
  writeStoredScannerSuccessSound,
} from "../../shared/lib/preferencesStorage";

/**
 * SettingsSync — backenddagi per-user sozlamalarni ilova yuklanganda jonli
 * manbalarga (theme, til, sidebar) qo'llaydi. UI render qilmaydi (null).
 * Provayderlar (ThemeProvider, i18n, redux, react-query) ichida joylashishi shart.
 */
const SettingsSync = () => {
  const { data } = useSettings();
  const profileSettings = useSelector((state: RootState) => state.user.user?.settings);
  const effectiveSettings = data ?? (profileSettings !== undefined ? mergeSettings(profileSettings) : undefined);
  const { theme, setTheme } = useTheme();
  const { i18n } = useTranslation();
  const dispatch = useDispatch();
  useEffect(() => {
    if (!effectiveSettings) return;
    if (effectiveSettings.appearance.theme !== theme) {
      setTheme(effectiveSettings.appearance.theme);
    }
    const currentLang = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);
    if (effectiveSettings.appearance.language !== currentLang) {
      void changeAppLanguage(effectiveSettings.appearance.language);
    }
    dispatch(setSidebar(effectiveSettings.interface.sidebarOpen));
    writeStoredScannerSuccessSound(effectiveSettings.scanner.sounds.success);
    writeStoredScannerErrorSound(effectiveSettings.scanner.sounds.error);
  }, [effectiveSettings, dispatch, i18n.language, i18n.resolvedLanguage, setTheme, theme]);

  return null;
};

export default SettingsSync;
