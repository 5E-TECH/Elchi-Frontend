import type { BatchDirection, BatchStatus } from "../../../entities/batch";
import i18n from "../../../i18n";

const resolveLocale = () => {
  const language = i18n.resolvedLanguage ?? i18n.language;
  if (language?.startsWith("ru")) return "ru-RU";
  if (language?.startsWith("en")) return "en-US";
  return "uz-UZ";
};

export const formatBatchMoney = (value: number) =>
  `${value.toLocaleString(resolveLocale())} ${i18n.t("orders:currency")}`;

export const formatBatchCompactMoney = (value: number) => {
  if (Math.abs(value) >= 1_000_000) {
    const amount = value / 1_000_000;
    return `${amount.toLocaleString(resolveLocale(), { maximumFractionDigits: 1 })}M ${i18n.t("orders:currency")}`;
  }

  return formatBatchMoney(value);
};

export const formatBatchDisplayId = (value: string | number) => {
  const id = String(value);
  return id.startsWith("B-") ? id : `B-${id}`;
};

export const formatBatchDateTime = (value: string) =>
  new Intl.DateTimeFormat(resolveLocale(), {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

export const formatBatchPrintDate = (value: string) =>
  new Intl.DateTimeFormat(resolveLocale(), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));

export const batchStatusLabel: Record<BatchStatus, string> = {
  get new() { return i18n.t("batches:status.new"); },
  get on_the_way() { return i18n.t("batches:status.onTheWay"); },
  get received() { return i18n.t("batches:status.received"); },
  get cancelled() { return i18n.t("batches:status.cancelled"); },
};

export const batchDirectionLabel: Record<BatchDirection, string> = {
  get forward() { return i18n.t("batches:direction.forward"); },
  get return() { return i18n.t("batches:direction.return"); },
};

export const batchStatusClass: Record<BatchStatus, string> = {
  new: "border-sky-300/30 bg-sky-500/10 text-sky-600 dark:text-sky-100",
  on_the_way: "border-amber-300/30 bg-amber-500/12 text-amber-700 dark:text-amber-100",
  received: "border-emerald-300/30 bg-emerald-500/12 text-emerald-700 dark:text-emerald-100",
  cancelled: "border-rose-300/30 bg-rose-500/12 text-rose-700 dark:text-rose-100",
};

export const batchStatusOptions = [
  { value: "new", get label() { return batchStatusLabel.new; } },
  { value: "on_the_way", get label() { return batchStatusLabel.on_the_way; } },
  { value: "received", get label() { return batchStatusLabel.received; } },
  { value: "cancelled", get label() { return batchStatusLabel.cancelled; } },
] as const;

export const batchDirectionOptions = [
  { value: "forward", get label() { return batchDirectionLabel.forward; } },
  { value: "return", get label() { return batchDirectionLabel.return; } },
] as const;

export const getBatchQrUrl = (token: string) => {
  const normalizedToken = token.trim();
  return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=0&data=${encodeURIComponent(normalizedToken)}`;
};
