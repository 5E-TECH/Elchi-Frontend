import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";
import { tokenStorage } from "../../auth/tokenStorage";

/**
 * ────────────────────────────────────────────────────────────────────────────
 *  Per-user sozlamalar (settings) — markaziy data-layer
 * ────────────────────────────────────────────────────────────────────────────
 *  Backend `admins.settings` (jsonb) da saqlanadi. Shakl shu yerda (frontend)
 *  belgilanadi; backend uni "ochiq" (opaque) saqlaydi. Yangi sozlama qo'shganda
 *  shu fayldagi tip + DEFAULT_SETTINGS ni yangilang.
 */

export type ThemeMode = "light" | "dark";
export type Language = "uz" | "ru" | "en";

/** Dashboard widget identifikatorlari (ko'rsatish/yashirish uchun). */
export const DASHBOARD_WIDGET_IDS = [
  "stats",
  "topPerformers",
  "financial",
  "region",
] as const;
export type DashboardWidgetId = (typeof DASHBOARD_WIDGET_IDS)[number];

export interface AppSettings {
  appearance: {
    theme: ThemeMode;
    language: Language;
  };
  dashboard: {
    widgets: Record<DashboardWidgetId, boolean>;
  };
  interface: {
    sidebarOpen: boolean;
  };
}

export interface AppSettingsPatch {
  appearance?: Partial<AppSettings["appearance"]>;
  dashboard?: {
    widgets?: Partial<AppSettings["dashboard"]["widgets"]>;
  };
  interface?: Partial<AppSettings["interface"]>;
}

export const DEFAULT_SETTINGS: AppSettings = {
  appearance: { theme: "dark", language: "uz" },
  dashboard: {
    widgets: {
      stats: true,
      topPerformers: true,
      financial: true,
      region: true,
    },
  },
  interface: { sidebarOpen: true },
};

/** Backend'dan kelgan qisman/eski sozlamani default bilan chuqur birlashtirish. */
export const mergeSettings = (raw: unknown): AppSettings => {
  const s = (raw ?? {}) as Partial<AppSettings>;
  return {
    appearance: {
      theme: s.appearance?.theme ?? DEFAULT_SETTINGS.appearance.theme,
      language: s.appearance?.language ?? DEFAULT_SETTINGS.appearance.language,
    },
    dashboard: {
      widgets: {
        ...DEFAULT_SETTINGS.dashboard.widgets,
        ...(s.dashboard?.widgets ?? {}),
      },
    },
    interface: {
      sidebarOpen:
        s.interface?.sidebarOpen ?? DEFAULT_SETTINGS.interface.sidebarOpen,
    },
  };
};

const applySettingsPatch = (
  current: AppSettings,
  patch: AppSettingsPatch,
): AppSettings => ({
  appearance: { ...current.appearance, ...patch.appearance },
  dashboard: {
    widgets: { ...current.dashboard.widgets, ...patch.dashboard?.widgets },
  },
  interface: { ...current.interface, ...patch.interface },
});

const SETTINGS_KEY = ["app-settings"];

/** Joriy foydalanuvchi sozlamalarini oladi (my-profile.settings dan). */
export const useSettings = () => {
  const enabled = Boolean(tokenStorage.getAccessToken());
  return useQuery<AppSettings>({
    queryKey: SETTINGS_KEY,
    queryFn: async () => {
      const res = await api.get(API_ENDPOINTS.AUTH.MY_PROFILE);
      return mergeSettings(res.data?.data?.settings);
    },
    enabled,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
};

/**
 * Sozlamani yangilash. To'liq AppSettings backendga yuboriladi va cache darhol
 * yangilanadi (optimistik). `patch` — chuqur birlashtiriladigan qisman obyekt.
 */
export const useUpdateSettings = () => {
  const qc = useQueryClient();
  return useMutation({
    scope: { id: "app-settings" },
    mutationFn: async (patch: AppSettingsPatch) => {
      await api.patch(API_ENDPOINTS.AUTH.MY_SETTINGS, { settings: patch });
      return patch;
    },
    onMutate: async (patch: AppSettingsPatch) => {
      await qc.cancelQueries({ queryKey: SETTINGS_KEY });
      const prev = qc.getQueryData<AppSettings>(SETTINGS_KEY);
      qc.setQueryData(
        SETTINGS_KEY,
        applySettingsPatch(prev ?? DEFAULT_SETTINGS, patch),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(SETTINGS_KEY, ctx.prev);
    },
  });
};

/** Joriy sozlamani cache'dan olish (yo'q bo'lsa default). */
export const readSettingsCache = (
  get: (key: unknown[]) => AppSettings | undefined,
): AppSettings => get(SETTINGS_KEY) ?? DEFAULT_SETTINGS;

export { SETTINGS_KEY };
