import { api, LONG_REQUEST_TIMEOUT_MS } from "../../../../shared/api/api";
import { API_ENDPOINTS } from "../../../../shared/api";
import { getFileNameFromDisposition, saveBlob, XLSX_MIME } from "../../../../shared/lib/exportFile";
import type { Tone } from "../../../../shared/ui/primitives";
import { OLD_MAILS_EXPORT_MAX_ROWS } from "../../model/oldMailsModel";

/**
 * ESKI POCHTALAR / PAKETLAR (Excel) — `POST export/old-mails.xlsx`: qatorlar (server yoki mijoz filtri bilan yig'ilgan)
 * yuboriladi, server tasdiqlangan dizaynda .xlsx qaytaradi (2026-11-25; ilgari brauzerda HTML `.xls`). Yorliqlar —
 * panel tilida.
 */
export type OldMailExportRow = {
  id: string;
  region: string;
  courier: string;
  status: string;
  statusTone?: Tone | null;
  orders: number;
  amount: number;
  createdAt: string;
};

export type OldMailsExportLabels = {
  generatedAt: string;
  no: string;
  mailId: string;
  region: string;
  courier: string;
  status: string;
  orders: string;
  amount: string;
  date: string;
  totalMails: string;
  totalOrders: string;
  totalAmount: string;
  currency: string;
  summaryTitle: string;
  byStatus: string;
  byRegion: string;
  byCourier: string;
  mails: string;
  share: string;
  total: string;
  others: string;
  unassigned: string;
  mailsUnit: string;
  ordersUnit: string;
  cappedNote: string;
};

export type OldMailsExportInput = {
  title: string;
  /** Qo'llangan filtrlar («Viloyat: Buxoro · Holati: …»). */
  subtitle?: string;
  /** Ro'yxat chegarada to'xtagan — faylda DIQQAT eslatmasi. */
  capped: boolean;
  /** Paketlar rejimi — kuryer ustuni yo'q. */
  hideCourier: boolean;
  rows: readonly OldMailExportRow[];
  labels: OldMailsExportLabels;
};

const clip = (value: unknown, max: number) => String(value ?? "").slice(0, max);
const whole = (value: number) => Math.min(1_000_000, Math.max(0, Math.round(Number(value) || 0)));
const money = (value: number) => Math.round((Number(value) || 0) * 100) / 100;

/** Server shartnomasi: snake_case, matn uzunligi va son chegaralari (DTO bilan bir xil). */
export const toOldMailsPayload = ({ title, subtitle, capped, hideCourier, rows, labels }: OldMailsExportInput) => ({
  title: clip(title, 120),
  ...(subtitle ? { subtitle: clip(subtitle, 300) } : {}),
  capped: capped || rows.length > OLD_MAILS_EXPORT_MAX_ROWS,
  hide_courier: hideCourier,
  labels: {
    generated_at: clip(labels.generatedAt, 80),
    no: clip(labels.no, 80),
    mail_id: clip(labels.mailId, 80),
    region: clip(labels.region, 80),
    courier: clip(labels.courier, 80),
    status: clip(labels.status, 80),
    orders: clip(labels.orders, 80),
    amount: clip(labels.amount, 80),
    date: clip(labels.date, 80),
    total_mails: clip(labels.totalMails, 80),
    total_orders: clip(labels.totalOrders, 80),
    total_amount: clip(labels.totalAmount, 80),
    currency: clip(labels.currency, 20),
    summary_title: clip(labels.summaryTitle, 120),
    by_status: clip(labels.byStatus, 80),
    by_region: clip(labels.byRegion, 80),
    by_courier: clip(labels.byCourier, 80),
    mails: clip(labels.mails, 80),
    share: clip(labels.share, 80),
    total: clip(labels.total, 20),
    others: clip(labels.others, 80),
    unassigned: clip(labels.unassigned, 80),
    mails_unit: clip(labels.mailsUnit, 20),
    orders_unit: clip(labels.ordersUnit, 20),
    capped_note: clip(labels.cappedNote, 300),
  },
  rows: rows.slice(0, OLD_MAILS_EXPORT_MAX_ROWS).map((row) => ({
    id: clip(row.id, 40),
    region: clip(row.region, 120),
    courier: row.courier ? clip(row.courier, 120) : null,
    status: clip(row.status, 60),
    ...(row.statusTone ? { status_tone: row.statusTone } : {}),
    orders: whole(row.orders),
    amount: money(row.amount),
    created_at: clip(row.createdAt, 40),
  })),
});

export const exportOldMailsToExcel = async (input: OldMailsExportInput): Promise<void> => {
  const response = await api.post(API_ENDPOINTS.EXPORT.OLD_MAILS_XLSX, toOldMailsPayload(input), {
    responseType: "blob",
    timeout: LONG_REQUEST_TIMEOUT_MS,
  });
  const blob = response.data instanceof Blob ? response.data : new Blob([response.data], { type: XLSX_MIME });
  saveBlob(blob, getFileNameFromDisposition(response.headers?.["content-disposition"]) ?? "old-mails.xlsx");
};
