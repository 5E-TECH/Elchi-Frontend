import { api, LONG_REQUEST_TIMEOUT_MS } from "../../../../shared/api/api";
import { API_ENDPOINTS } from "../../../../shared/api";
import { getFileNameFromDisposition, saveBlob, XLSX_MIME } from "../../../../shared/lib/exportFile";

/**
 * KASSA HISOBOTI (Excel) — `GET export/cashbox-report.xlsx`, serverda yasaladi (ega tasdiqlagan dizayn, 2026-11-25).
 * Doira — JWT: superadmin / admin — asosiy kassa, menejer — faqat o'z filiali kassasi (bitta jami).
 *
 * Davr: `shiftId` — shu smena (ochilgan … yopilgan); aks holda sana filtri; hech biri yo'q — BUGUN. Ilgari fayl
 * brauzerda (HTML `.xls`) yasalardi va filtr bo'sh bo'lsa kassaning BUTUN tarixi tushardi.
 */
export type CashboxReportParams = {
  shiftId?: string | null;
  /** YYYY-MM-DD */
  fromDate?: string;
  toDate?: string;
};

export const exportMainCashboxReport = async ({ shiftId, fromDate, toDate }: CashboxReportParams): Promise<void> => {
  const params = shiftId
    ? { shift_id: shiftId }
    : { ...(fromDate ? { from_date: fromDate } : {}), ...(toDate ? { to_date: toDate } : {}) };
  const response = await api.get(API_ENDPOINTS.EXPORT.CASHBOX_REPORT_XLSX, {
    params,
    responseType: "blob",
    timeout: LONG_REQUEST_TIMEOUT_MS,
  });
  const blob = response.data instanceof Blob ? response.data : new Blob([response.data], { type: XLSX_MIME });
  const fallback = shiftId ? `kassa-hisobot-smena-${shiftId}.xlsx` : "kassa-hisobot.xlsx";
  saveBlob(blob, getFileNameFromDisposition(response.headers?.["content-disposition"]) ?? fallback);
};
