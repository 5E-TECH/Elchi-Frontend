import type { BatchDirection, BatchStatus } from "../../../entities/batch";

export const formatBatchMoney = (value: number) => `${value.toLocaleString("uz-UZ")} so'm`;

export const formatBatchCompactMoney = (value: number) => {
  if (Math.abs(value) >= 1_000_000) {
    const amount = value / 1_000_000;
    return `${amount.toLocaleString("uz-UZ", { maximumFractionDigits: 1 })}M so'm`;
  }

  return formatBatchMoney(value);
};

export const formatBatchDisplayId = (value: string | number) => {
  const id = String(value);
  return id.startsWith("B-") ? id : `B-${id}`;
};

export const formatBatchDateTime = (value: string) =>
  new Intl.DateTimeFormat("uz-UZ", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

export const formatBatchPrintDate = (value: string) =>
  new Intl.DateTimeFormat("uz-UZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));

export const batchStatusLabel: Record<BatchStatus, string> = {
  new: "Yangi",
  on_the_way: "Yo'lda",
  received: "Qabul qilindi",
  cancelled: "Bekor qilindi",
};

export const batchDirectionLabel: Record<BatchDirection, string> = {
  forward: "Oldinga",
  return: "Qaytarish",
};

export const batchStatusClass: Record<BatchStatus, string> = {
  new: "border-sky-300/30 bg-sky-500/10 text-sky-600 dark:text-sky-100",
  on_the_way: "border-amber-300/30 bg-amber-500/12 text-amber-700 dark:text-amber-100",
  received: "border-emerald-300/30 bg-emerald-500/12 text-emerald-700 dark:text-emerald-100",
  cancelled: "border-rose-300/30 bg-rose-500/12 text-rose-700 dark:text-rose-100",
};

export const batchStatusOptions = [
  { value: "new", label: batchStatusLabel.new },
  { value: "on_the_way", label: batchStatusLabel.on_the_way },
  { value: "received", label: batchStatusLabel.received },
  { value: "cancelled", label: batchStatusLabel.cancelled },
] as const;

export const batchDirectionOptions = [
  { value: "forward", label: batchDirectionLabel.forward },
  { value: "return", label: batchDirectionLabel.return },
] as const;

export const getBatchQrUrl = (token: string) => {
  const normalizedToken = token.trim();
  return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=0&data=${encodeURIComponent(normalizedToken)}`;
};
