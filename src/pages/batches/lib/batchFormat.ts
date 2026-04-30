import { API_ENDPOINTS } from "../../../shared/api";
import { BASE_URL } from "../../../shared/const";
import type { BatchDatePreset, BatchDirection, BatchStatus } from "../../../entities/batch";

export const formatBatchMoney = (value: number) => `${value.toLocaleString("uz-UZ")} so'm`;

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

export const batchDatePresetOptions: Array<{ value: BatchDatePreset; label: string }> = [
  { value: "today", label: "Bugun" },
  { value: "week", label: "Shu hafta" },
  { value: "month", label: "Shu oy" },
  { value: "custom", label: "Maxsus sana" },
];

export const toLocalApiDateTime = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};

export const getBatchDateRange = (preset: BatchDatePreset) => {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (preset === "today") {
    return { from: toLocalApiDateTime(start), to: toLocalApiDateTime(now) };
  }

  if (preset === "week") {
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
    return { from: toLocalApiDateTime(start), to: toLocalApiDateTime(now) };
  }

  if (preset === "month") {
    start.setDate(1);
    return { from: toLocalApiDateTime(start), to: toLocalApiDateTime(now) };
  }

  return {};
};

export const getBatchQrUrl = (token: string) => {
  const base = BASE_URL.replace(/\/+$/, "");
  return `${base}/${API_ENDPOINTS.BATCHES.QR_CODE(token).replace(/^\/+/, "")}`;
};
