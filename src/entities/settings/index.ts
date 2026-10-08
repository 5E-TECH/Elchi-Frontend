import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";
import { tokenStorage } from "../../auth/tokenStorage";
import {
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
} from "../notification-inbox/model/types";

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
export type ScannerSoundId = "classic" | "soft" | "digital" | "bell" | "pulse" | "bright";

/** Dashboard widget identifikatorlari (ko'rsatish/yashirish uchun). */
export const DASHBOARD_WIDGET_IDS = [
  "stats",
  "topPerformers",
  "financial",
  "region",
  "performanceChart",
] as const;
export type DashboardWidgetId = (typeof DASHBOARD_WIDGET_IDS)[number];

/**
 * Bildirishnoma kanallari (push bundan tashqari — u `notifications.push` da).
 *
 * ⚠️ PUSH ALOHIDA KALIT EMAS. `notifications.push` allaqachon bor va
 * `PushSync` qurilma obunasini AYNAN shunga qarab yoqadi/o'chiradi. Ikkinchi
 * `channels.push` bayrog'i ochilsa bir ma'lumot ikki joyda saqlanib,
 * ajralib ketardi — shu bois push kanali o'sha kalitning o'zi.
 */
export const NOTIFICATION_CHANNEL_IDS = ["in_app", "realtime", "telegram", "sms"] as const;
export type NotificationChannelId = (typeof NOTIFICATION_CHANNEL_IDS)[number];

/** "HH:mm", Toshkent vaqti (UTC+5). */
export type ClockTime = string;

const CLOCK_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

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
  scanner: {
    sounds: {
      success: ScannerSoundId;
      error: ScannerSoundId;
    };
  };
  notifications: {
    /** Web push (telefon/brauzer) yoqilganmi — davC9QOX. Push KANALI ham shu. */
    push: boolean;
    /** Qaysi kanal orqali olish (push — yuqoridagi `push`). */
    channels: Record<NotificationChannelId, boolean>;
    /**
     * Ovozi o'chirilgan kategoriyalar. `marketing` shu yerda bo'lsa —
     * reklama va aksiyalardan voz kechilgan (opt-out).
     *
     * ⚠️ `critical` ustuvorlikdagi xabarlar bu ro'yxatdan qat'i nazar
     * o'chirilmaydi — ular kategoriya emas, ustuvorlik.
     */
    muted_categories: NotificationCategory[];
    /** Sokin soatlar — Toshkent vaqti. `from > to` bo'lsa tun orqali o'tadi. */
    quiet_hours: {
      enabled: boolean;
      from: ClockTime;
      to: ClockTime;
    };
  };
}

export interface AppSettingsPatch {
  appearance?: Partial<AppSettings["appearance"]>;
  dashboard?: {
    widgets?: Partial<AppSettings["dashboard"]["widgets"]>;
  };
  interface?: Partial<AppSettings["interface"]>;
  scanner?: {
    sounds?: Partial<AppSettings["scanner"]["sounds"]>;
  };
  notifications?: {
    push?: boolean;
    channels?: Partial<AppSettings["notifications"]["channels"]>;
    /**
     * Kategoriya bo'yicha: `true` — ovozini o'chirish, `false` — qaytarish.
     * Butun ro'yxat emas — ketma-ket tez bosishlarda (navbatdagi mutatsiyalar)
     * har biri ENG SO'NGGI holatga qo'llanadi va bir-birini o'chirmaydi.
     */
    mute?: Partial<Record<NotificationCategory, boolean>>;
    quiet_hours?: Partial<AppSettings["notifications"]["quiet_hours"]>;
  };
}

export const DEFAULT_SETTINGS: AppSettings = {
  appearance: { theme: "dark", language: "uz" },
  dashboard: {
    widgets: {
      stats: true,
      topPerformers: true,
      financial: true,
      region: true,
      performanceChart: true,
    },
  },
  interface: { sidebarOpen: true },
  scanner: {
    sounds: {
      success: "classic",
      error: "classic",
    },
  },
  notifications: {
    push: false,
    // Hozirgi xulq saqlanadi: hamma kanal va kategoriya yoqiq.
    channels: { in_app: true, realtime: true, telegram: true, sms: true },
    muted_categories: [],
    quiet_hours: { enabled: false, from: "22:00", to: "08:00" },
  },
};

const readBool = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback;

const readClock = (value: unknown, fallback: ClockTime): ClockTime =>
  typeof value === "string" && CLOCK_TIME.test(value) ? value : fallback;

/** Faqat ma'lum kategoriyalar, takrorsiz, katalog tartibida. */
const readCategories = (value: unknown): NotificationCategory[] => {
  if (!Array.isArray(value)) return [...DEFAULT_SETTINGS.notifications.muted_categories];
  return NOTIFICATION_CATEGORIES.filter((category) => value.includes(category));
};

const applyMute = (
  current: NotificationCategory[],
  mute: Partial<Record<NotificationCategory, boolean>> | undefined,
): NotificationCategory[] => {
  if (!mute) return current;
  const next = new Set(current);
  for (const [category, muted] of Object.entries(mute)) {
    if (muted) next.add(category as NotificationCategory);
    else next.delete(category as NotificationCategory);
  }
  return readCategories([...next]);
};

const mergeNotifications = (raw: unknown): AppSettings["notifications"] => {
  const n = (raw ?? {}) as Partial<Record<keyof AppSettings["notifications"], unknown>>;
  const d = DEFAULT_SETTINGS.notifications;
  const channels = (n.channels ?? {}) as Partial<Record<NotificationChannelId, unknown>>;
  const quiet = (n.quiet_hours ?? {}) as Partial<Record<"enabled" | "from" | "to", unknown>>;
  return {
    push: readBool(n.push, d.push),
    channels: {
      in_app: readBool(channels.in_app, d.channels.in_app),
      realtime: readBool(channels.realtime, d.channels.realtime),
      telegram: readBool(channels.telegram, d.channels.telegram),
      sms: readBool(channels.sms, d.channels.sms),
    },
    muted_categories: readCategories(n.muted_categories),
    quiet_hours: {
      enabled: readBool(quiet.enabled, d.quiet_hours.enabled),
      from: readClock(quiet.from, d.quiet_hours.from),
      to: readClock(quiet.to, d.quiet_hours.to),
    },
  };
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
    scanner: {
      sounds: {
        success:
          s.scanner?.sounds?.success ?? DEFAULT_SETTINGS.scanner.sounds.success,
        error: s.scanner?.sounds?.error ?? DEFAULT_SETTINGS.scanner.sounds.error,
      },
    },
    // ⚠️ mergeSettings OQ RO'YXAT: shu yerda sanalmagan kalit jimgina tashlanadi.
    notifications: mergeNotifications(s.notifications),
  };
};

export const applySettingsPatch = (
  current: AppSettings,
  patch: AppSettingsPatch,
): AppSettings => ({
  appearance: { ...current.appearance, ...patch.appearance },
  dashboard: {
    widgets: { ...current.dashboard.widgets, ...patch.dashboard?.widgets },
  },
  interface: { ...current.interface, ...patch.interface },
  scanner: {
    sounds: { ...current.scanner.sounds, ...patch.scanner?.sounds },
  },
  notifications: {
    push: patch.notifications?.push ?? current.notifications.push,
    channels: { ...current.notifications.channels, ...patch.notifications?.channels },
    muted_categories: applyMute(current.notifications.muted_categories, patch.notifications?.mute),
    quiet_hours: { ...current.notifications.quiet_hours, ...patch.notifications?.quiet_hours },
  },
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
      const current = qc.getQueryData<AppSettings>(SETTINGS_KEY) ?? DEFAULT_SETTINGS;
      const next = applySettingsPatch(current, patch);
      await api.patch(API_ENDPOINTS.AUTH.MY_SETTINGS, { settings: next });
      return next;
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
