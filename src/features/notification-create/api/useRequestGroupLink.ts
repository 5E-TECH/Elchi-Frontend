import { useMutation } from "@tanstack/react-query";
import { api } from "../../../shared/api/instance";
import { API_ENDPOINTS } from "../../../shared/api";
import type { GroupLinkCode, GroupLinkCodeRequest } from "../model/types";

/** Javob `{ statusCode, message, data: { … } }` yoki to'g'ridan-to'g'ri `{ … }`. */
const unwrap = (value: unknown): GroupLinkCode => {
  const body = value as { data?: unknown } | null;
  const data = (body && typeof body === "object" && body.data && typeof body.data === "object" ? body.data : body) as
    | Partial<GroupLinkCode>
    | null;

  return {
    token: String(data?.token ?? ""),
    purpose: "market_group",
    group_type: data?.group_type === "cancel" ? "cancel" : "create",
    expires_at: String(data?.expires_at ?? ""),
    deep_link: typeof data?.deep_link === "string" && data.deep_link ? data.deep_link : null,
    command: String(data?.command ?? (data?.token ? `/start ${data.token}` : "")),
  };
};

/** Market guruhini ulash uchun bir martalik havola (`POST /telegram/link-code`, `purpose: "market_group"`). */
export const useRequestGroupLink = () =>
  useMutation({
    mutationFn: async (payload: GroupLinkCodeRequest) => {
      const response = await api.post(API_ENDPOINTS.NOTIFICATIONS.TELEGRAM_LINK_CODE, payload);
      return unwrap(response.data);
    },
  });
