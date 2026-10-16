import type { Tone } from "../../../../shared/ui/primitives";

/**
 * Pochta holati → badge (4YZcTTDQ). Ton va so'z maketlardan
 * (`superadmin-mails-today` / `-old` / `-detail-refused`): yangi — info,
 * jo'natilgan — warning, qabul qilingan — success, rad etilgan — danger,
 * qaytarilgan — neutral. Noma'lum holat — `null` (badge chizilmaydi).
 */
export type PostStatusBadge = { tone: Tone; labelKey: string };

const POST_STATUS_BADGES: Record<string, PostStatusBadge> = {
  new: { tone: "info", labelKey: "statusNew" },
  sent: { tone: "warning", labelKey: "statusSent" },
  received: { tone: "success", labelKey: "statusReceived" },
  canceled: { tone: "danger", labelKey: "statusRejected" },
  cancelled: { tone: "danger", labelKey: "statusRejected" },
  canceled_received: { tone: "neutral", labelKey: "statusReturned" },
  cancelled_received: { tone: "neutral", labelKey: "statusReturned" },
};

export const getPostStatusBadge = (status: string | null | undefined): PostStatusBadge | null => {
  const key = String(status ?? "").trim().toLowerCase().replaceAll(" ", "_");
  return POST_STATUS_BADGES[key] ?? null;
};
