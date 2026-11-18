import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";
import { HEALTH_READINESS_QUERY_KEY } from "./miscCoverage";

/**
 * TELEGRAM BOT HOLATI (BOT-DIAG) — «Tizim holati»da NOTIFICATION qatori `reported` bo'lganda aniq sabab.
 *
 * `GET /health/notification-bot` va `POST /health/notification-bot/recheck` (api-gateway
 * `NotificationBotHealthController`, faqat SUPERADMIN): javob konvertsiz `{ status, bot, timestamp, rechecked? }`
 * (o'qish — `pages/system-ops/lib/botStatus.ts`, konvertli javobni ham tushunadi).
 *
 * Xato (404/405 — backend hali deploy qilinmagan, 403, 503 — bildirishnoma xizmati javob bermadi) global xabarsiz
 * (`silentError`) va qayta urinishsiz: sahifa umumiy matnni jimgina qoldiradi.
 */
export const NOTIFICATION_BOT_HEALTH_QUERY_KEY = ["misc-cov", "notification-bot-health"] as const;

export const useNotificationBotHealth = ({ enabled }: { enabled: boolean }) =>
  useQuery({
    queryKey: NOTIFICATION_BOT_HEALTH_QUERY_KEY,
    queryFn: () => api.get(API_ENDPOINTS.HEALTH.NOTIFICATION_BOT).then((res) => res.data as unknown),
    enabled,
    retry: false,
    meta: { silentError: true },
  });

/**
 * «Qayta tekshirish»: javob (yangi bot holati) keshga yoziladi va readiness qayta o'qiladi — bot tiklangan bo'lsa
 * NOTIFICATION qatori «Ishlayapti» ga o'tadi. Xatoni chaqiruvchi o'zi ko'rsatadi (`notify.error`).
 */
export const useRecheckNotificationBot = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(API_ENDPOINTS.HEALTH.NOTIFICATION_BOT_RECHECK).then((res) => res.data as unknown),
    onSuccess: (data) => {
      client.setQueryData(NOTIFICATION_BOT_HEALTH_QUERY_KEY, data);
      void client.invalidateQueries({ queryKey: HEALTH_READINESS_QUERY_KEY });
    },
  });
};
