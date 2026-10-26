import type { RevenuePoint, RevenueResponse } from "../../../entities/dashboard";

/**
 * «MOLIYAVIY TAHLIL» — «Sof foyda» seriyasi (l9NNdsCH, backend FRONTEND_CHANGELOG 2026-10-24 batch D):
 * `GET analytics/revenue` har bandda `profit`, `summary.totalProfit`, `chart.profitValues` (overview `profit` bilan
 * ayni formula: market tarifi − kuryer ulushi − filial ulushi).
 */

/** `data[]` bo'laklari (`{ period, label, ordersCount, revenue, profit }`). */
export const bucketsOf = (payload: RevenueResponse["data"] | undefined) =>
  Array.isArray(payload?.data) ? (payload.data as Partial<RevenuePoint>[]) : [];

/**
 * Bandlar bo'yicha «Sof foyda» (l9NNdsCH): `chart.profitValues`; u bo'lmasa — `data[].profit` (label bo'yicha).
 * Hech biri yo'q (eski backend) — `null`: grafik bo'sh holatda, daromad «Sof foyda» deb ko'rsatilmaydi.
 */
export const readProfitValues = (payload: RevenueResponse["data"] | undefined): number[] | null => {
  const labels = payload?.chart?.labels ?? [];
  const direct = payload?.chart?.profitValues;
  if (Array.isArray(direct) && direct.length === labels.length) return direct;
  const profitByLabel = new Map(
    bucketsOf(payload)
      .filter((bucket) => typeof bucket?.label === "string" && Number.isFinite(Number(bucket.profit)))
      .map((bucket) => [bucket.label as string, Number(bucket.profit)]),
  );
  if (!labels.length || profitByLabel.size === 0) return null;
  return labels.map((label) => profitByLabel.get(label) ?? 0);
};

/** Davr «Sof foyda»si: `summary.totalProfit`; yo'q bo'lsa — bandlar yig'indisi; umuman yo'q — `null`. */
export const readTotalProfit = (payload: RevenueResponse["data"] | undefined): number | null => {
  const total = payload?.summary?.totalProfit;
  if (typeof total === "number" && Number.isFinite(total)) return total;
  const values = readProfitValues(payload);
  return values ? values.reduce((sum, value) => sum + value, 0) : null;
};
