import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../../../../shared/api/api";
import { API_ENDPOINTS } from "../../../../shared/api";
import { isFinalPasswordSmsStatus, readPasswordSmsState } from "../model/passwordSms";

/** Holatni so'rash oralig'i (changelog: «bir necha soniyada bir so'rash; `delivered` / `failed` — to'xtatish»). */
export const PASSWORD_SMS_POLL_MS = 4_000;
/** Provayder hisobot bermasa (`sent` da qolsa) — shuncha so'rovdan keyin to'xtaydi (~2 daqiqa). */
export const PASSWORD_SMS_POLL_LIMIT = 30;

export const passwordSmsStatusKey = (userId: string) => ["users", userId, "password-sms-status"] as const;

/**
 * `GET /users/:id/password/sms-status` — natija oynasidagi «SMS yuborildi / Yetkazildi» qadamlari. `enabled` — huquq
 * bor (`canManagePasswordSms`) va holat hali yakuniy emas; har `PASSWORD_SMS_POLL_MS` da, yakuniy holatda yoki
 * `PASSWORD_SMS_POLL_LIMIT` so'rovdan keyin to'xtaydi. Xato global xabar bermaydi (oyna yaratishdagi holatni
 * ko'rsatib turadi).
 */
export const usePasswordSmsStatus = (userId: string | null, enabled: boolean) =>
  useQuery({
    queryKey: passwordSmsStatusKey(userId ?? ""),
    queryFn: () =>
      api.get(API_ENDPOINTS.USERS.PASSWORD_SMS_STATUS(userId ?? "")).then((res) => readPasswordSmsState(res.data)),
    enabled: enabled && Boolean(userId),
    refetchInterval: (query) => {
      const status = query.state.data?.passwordSms?.status;
      if (isFinalPasswordSmsStatus(status)) return false;
      if (query.state.dataUpdateCount >= PASSWORD_SMS_POLL_LIMIT) return false;
      if (query.state.status === "error") return false;
      return PASSWORD_SMS_POLL_MS;
    },
    retry: false,
    staleTime: 0,
    gcTime: 0,
    meta: { silentError: true },
  });

/** `POST /users/:id/password/resend-sms` — YANGI vaqtinchalik parol + SMS (429 — chaqiruvchi `readResendLimit`). */
export const useResendPasswordSms = () =>
  useMutation({
    mutationFn: (userId: string) =>
      api.post(API_ENDPOINTS.USERS.PASSWORD_RESEND_SMS(userId)).then((res) => readPasswordSmsState(res.data)),
  });
