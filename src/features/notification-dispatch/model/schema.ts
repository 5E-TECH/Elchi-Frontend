import * as yup from "yup";
import {
  CAMPAIGN_CHANNELS,
  createAudienceDraft,
  type AudienceDraft,
  type AudienceTarget,
  type CampaignPayload,
} from "../../../entities/notification-campaign";
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_PRIORITIES,
  type NotificationCategory,
  type NotificationPriority,
} from "../../../entities/notification-inbox";

/** Backend DTO chegaralari (notification-service DispatchNotificationDto). */
export const DISPATCH_LIMITS = { title: 255, body: 4096, link: 512, groupKey: 255 } as const;

/**
 * «Kimga» rejimlari (KM-2): Bitta odam · Tanlangan ro'yxat · Auditoriya · Hamma. «Rol» rejimi olindi — rollar va mijozlar
 * endi «Auditoriya» konstruktorida, u doim kampaniya (`POST /notifications/campaigns`, ega KM-S1). Qolgan uchtasi —
 * sinxron `POST /notifications/dispatch`.
 */
export type RecipientMode = "single" | "list" | "audience" | "all";
export const RECIPIENT_MODES: readonly RecipientMode[] = ["single", "list", "audience", "all"];

export type DispatchFormValues = {
  mode: RecipientMode;
  recipient_id: string;
  recipient_ids: string[];
  /** «Auditoriya» konstruktori qoralamasi (kampaniya nishoni). */
  audience: AudienceDraft;
  realtime: boolean;
  telegram: boolean;
  /** SMS — pullik; faqat telefoni bor qabul qiluvchilarga (chegara serverda). */
  sms: boolean;
  /** Web push — bildirishnomani yoqqan qurilmalarga. */
  push: boolean;
  /**
   * Telegram nishoni (ixtiyoriy, TgYRqaTk): market tanlansa — o'sha marketning ulangan guruhiga;
   * tanlanmasa — har bir qabul qiluvchining SHAXSIY Telegram chatiga (ulanmaganlar `skipped`,
   * ilova ichidagi xabar baribir yetadi).
   */
  telegram_market_id: string;
  title: string;
  body: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  link: string;
  group_key: string;
};

/** Qayta yuborishda dublikat bo'lmasligi uchun: bir forma — bitta kalit. */
export const createGroupKey = (now = new Date()) => {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `xabar-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
};

export const createDefaultValues = (): DispatchFormValues => ({
  mode: "single",
  recipient_id: "",
  recipient_ids: [],
  audience: createAudienceDraft(),
  realtime: true,
  telegram: false,
  sms: false,
  push: false,
  telegram_market_id: "",
  title: "",
  body: "",
  category: "system",
  priority: "normal",
  link: "",
  group_key: createGroupKey(),
});

type Translate = (key: string, options?: Record<string, unknown>) => string;

export const createDispatchSchema = (t: Translate) =>
  yup.object({
    mode: yup.string<RecipientMode>().oneOf([...RECIPIENT_MODES]).required(),
    recipient_id: yup.string().default("").when("mode", {
      is: "single",
      then: (schema) => schema.required(t("dispatch.errors.recipient")),
    }),
    recipient_ids: yup
      .array(yup.string().required())
      .default([])
      .when("mode", {
        is: "list",
        then: (schema) => schema.min(1, t("dispatch.errors.recipients")),
      }),
    // Konstruktor holati alohida tekshiriladi (`audienceGate`) — xatolar kartaning o'zida.
    audience: yup.mixed<AudienceDraft>().required(),
    realtime: yup.boolean().required(),
    telegram: yup.boolean().required(),
    sms: yup.boolean().required(),
    push: yup.boolean().required(),
    // Market ixtiyoriy: tanlanmasa Telegram shaxsiy chatga ketadi (backend TgYRqaTk).
    telegram_market_id: yup.string().default(""),
    title: yup
      .string()
      .trim()
      .required(t("dispatch.errors.title"))
      .max(DISPATCH_LIMITS.title, t("dispatch.errors.tooLong", { max: DISPATCH_LIMITS.title })),
    body: yup
      .string()
      .default("")
      .max(DISPATCH_LIMITS.body, t("dispatch.errors.tooLong", { max: DISPATCH_LIMITS.body })),
    category: yup.string<NotificationCategory>().oneOf([...NOTIFICATION_CATEGORIES]).required(),
    priority: yup.string<NotificationPriority>().oneOf([...NOTIFICATION_PRIORITIES]).required(),
    link: yup
      .string()
      .default("")
      .trim()
      .max(DISPATCH_LIMITS.link, t("dispatch.errors.tooLong", { max: DISPATCH_LIMITS.link })),
    // Kampaniyada guruh kaliti yo'q (backend `campaign:<id>` ni o'zi qo'yadi) — faqat sinxron yuborishda majburiy.
    group_key: yup
      .string()
      .trim()
      .when("mode", {
        is: "audience",
        then: (schema) => schema.default(""),
        otherwise: (schema) => schema.required(t("dispatch.errors.groupKey")),
      })
      .max(DISPATCH_LIMITS.groupKey, t("dispatch.errors.tooLong", { max: DISPATCH_LIMITS.groupKey })),
  });

export type DispatchPayload = {
  type: string;
  title: string;
  body?: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  link?: string;
  group_key: string;
  /** `in_app` doim bor. */
  channels: Array<"in_app" | "realtime" | "telegram" | "sms" | "push">;
  recipient_id?: string;
  recipient_ids?: string[];
  broadcast?: true;
  /** Faqat market tanlanganda; yo'q bo'lsa backend Telegram'ni shaxsiy chatga yuboradi. */
  telegram?: { market_id: string };
  /**
   * Urinish UUID'si (takror himoyasi) — `buildDispatchPayload` qo'ymaydi, forma yuborish paytida qo'shadi
   * (`model/clientRequestId.ts`).
   */
  client_request_id?: string;
};

export const buildDispatchPayload = (values: DispatchFormValues): DispatchPayload => {
  const channels: DispatchPayload["channels"] = ["in_app"];
  if (values.realtime) channels.push("realtime");
  if (values.telegram) channels.push("telegram");
  if (values.sms) channels.push("sms");
  if (values.push) channels.push("push");

  const body = values.body.trim();
  const link = values.link.trim();
  const target =
    values.mode === "single"
      ? { recipient_id: values.recipient_id }
      : values.mode === "list"
        ? { recipient_ids: values.recipient_ids }
        : { broadcast: true as const };

  return {
    // Backend `type` ni majburiy qiladi (`{domain}.{event}`) — qo'lda yuborilgan xabar.
    type: `${values.category}.manual`,
    title: values.title.trim(),
    ...(body ? { body } : {}),
    category: values.category,
    priority: values.priority,
    ...(link ? { link } : {}),
    group_key: values.group_key.trim(),
    channels,
    ...target,
    ...(values.telegram && values.telegram_market_id ? { telegram: { market_id: values.telegram_market_id } } : {}),
  };
};

/**
 * «Auditoriya» → `POST /notifications/campaigns` tanasi. Kanallar — faqat kampaniyada ruxsat etilganlari (`in_app`
 * doim, «Ochiq ekranga», Push); Telegram va SMS yuborilmaydi (backend 400). Guruh kaliti yo'q. KM-2 da faqat
 * «Darhol» (`scheduled_at` — KM-3).
 */
export const buildCampaignPayload = (values: DispatchFormValues, target: AudienceTarget): CampaignPayload => {
  const channels: CampaignPayload["channels"] = ["in_app"];
  if (values.realtime) channels.push("realtime");
  if (values.push) channels.push("push");
  const body = values.body.trim();
  const link = values.link.trim();
  return {
    ...target,
    type: `${values.category}.manual`,
    category: values.category,
    priority: values.priority,
    title: values.title.trim(),
    ...(body ? { body } : {}),
    ...(link ? { link } : {}),
    channels: channels.filter((channel) => (CAMPAIGN_CHANNELS as readonly string[]).includes(channel)),
  };
};
