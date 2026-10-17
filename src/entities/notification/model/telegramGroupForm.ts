import * as yup from "yup";
import type { Notification } from "./types";

/** Telegram guruhi formasi (`POST /notifications`, `PATCH /notifications/:id` — `CreateTelegramMarketRequestDto`). */
export type TelegramGroupFormValues = {
  market_id: string;
  group_id: string;
  group_type: Notification["group_type"];
};

export const EMPTY_TELEGRAM_GROUP: TelegramGroupFormValues = {
  market_id: "",
  group_id: "",
  group_type: "create",
};

type Translate = (key: string) => string;

/** Validatsiya — xabarlar `notificationGroups:form.errors.*` dan (uz/ru/en). */
export const createTelegramGroupSchema = (t: Translate) =>
  yup.object({
    market_id: yup
      .string()
      .matches(/^\d+$/, t("form.errors.market"))
      .required(t("form.errors.market")),
    group_id: yup.string().trim().required(t("form.errors.groupId")),
    group_type: yup
      .string<Notification["group_type"]>()
      .oneOf(["cancel", "create"], t("form.errors.type"))
      .required(t("form.errors.type")),
  });

export type TelegramMarketOption = { id: string; name: string; phone?: string };

/**
 * `GET /markets` javobi turli konvertlarda keladi (`data`, `data.items`, `items`, massiv) —
 * hammasidan `{ id, name, phone }` ro'yxati.
 */
export const toTelegramMarketOptions = (value: unknown): TelegramMarketOption[] => {
  if (!value) return [];
  const record = value as Record<string, unknown>;
  const data = record.data as unknown;
  const dataRecord =
    typeof data === "object" && data !== null ? (data as Record<string, unknown>) : null;
  const list = (
    Array.isArray(value)
      ? value
      : Array.isArray(data)
        ? data
        : Array.isArray(record.items)
          ? record.items
          : Array.isArray(dataRecord?.items)
            ? dataRecord.items
            : []
  ) as Array<{ id?: string | number; name?: string; username?: string; phone_number?: string }>;

  return list
    .filter((market) => market.id !== undefined && market.id !== null && String(market.id) !== "")
    .map((market) => ({
      id: String(market.id),
      name: market.name ?? market.username ?? `#${market.id}`,
      phone: market.phone_number ?? undefined,
    }));
};
