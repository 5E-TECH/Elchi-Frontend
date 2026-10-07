import * as yup from "yup";
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_PRIORITIES,
  type NotificationCategory,
  type NotificationPriority,
} from "../../../entities/notification-inbox";

/** Backend DTO chegaralari (notification-service DispatchNotificationDto). */
export const DISPATCH_LIMITS = { title: 255, body: 4096, link: 512, groupKey: 255 } as const;

export type RecipientMode = "single" | "roles" | "list" | "all";

/**
 * Rol bo'yicha yuborish mumkin bo'lgan rollar. `customer` ro'yxatda turadi,
 * lekin O'CHIQ: backend foydalanuvchi qidiruvi mijozlarni chiqarmaydi —
 * `roles: ['customer']` 0 ta qabul qiluvchi va 400 qaytaradi.
 */
export const DISPATCH_ROLES = ["admin", "manager", "registrator", "courier", "market", "operator"] as const;
export const DISABLED_DISPATCH_ROLES = ["customer"] as const;

/**
 * "Hamma" (broadcast) yetadigan rollar — taxminiy son shular yig'indisi.
 * Backend superadmin va mijozlarni broadcast'ga qo'shmaydi.
 */
export const BROADCAST_ROLES = [
  ...DISPATCH_ROLES,
  "market_operator",
  "branch",
  "investor",
] as const;

export type DispatchFormValues = {
  mode: RecipientMode;
  recipient_id: string;
  recipient_ids: string[];
  roles: string[];
  realtime: boolean;
  telegram: boolean;
  /** SMS — pullik; faqat telefoni bor qabul qiluvchilarga (chegara serverda). */
  sms: boolean;
  /** Web push — bildirishnomani yoqqan qurilmalarga. */
  push: boolean;
  /** Telegram kanali faqat market guruhiga yetkaziladi — market shart. */
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
  roles: [],
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
    mode: yup.string<RecipientMode>().oneOf(["single", "roles", "list", "all"]).required(),
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
    roles: yup
      .array(yup.string().required())
      .default([])
      .when("mode", {
        is: "roles",
        then: (schema) => schema.min(1, t("dispatch.errors.roles")),
      }),
    realtime: yup.boolean().required(),
    telegram: yup.boolean().required(),
    sms: yup.boolean().required(),
    push: yup.boolean().required(),
    telegram_market_id: yup.string().default("").when("telegram", {
      is: true,
      then: (schema) => schema.required(t("dispatch.errors.telegramMarket")),
    }),
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
    group_key: yup
      .string()
      .trim()
      .required(t("dispatch.errors.groupKey"))
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
  roles?: string[];
  broadcast?: true;
  telegram?: { market_id: string };
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
        : values.mode === "roles"
          ? { roles: values.roles }
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
