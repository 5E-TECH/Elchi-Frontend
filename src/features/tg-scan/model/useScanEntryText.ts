// dizayn-v2: courier-scan-active
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { ScanOrderSummary } from "../api/tgScanApi";
import type { TgScanErrorInfo } from "./scanError";
import type { ScanEntry } from "./useScanAssign";

/** «№10191» — backend raqami `#`/`№` bilan kelsa ham bitta belgi. */
const formatOrderNumber = (value: string) => `№${value.replace(/^[#№]\s*/u, "")}`;

/**
 * Skan qatori matnlari (maket: «№10191 · Lobar Yusupova» / «Sizga biriktirildi · Yunusobod tumani»).
 * Tuman va mijoz ismi `scan-assign` javobidagi `data.order` dan — alohida so'rovsiz (MWYaqprw TC).
 */
export const useScanEntryText = () => {
  const { t } = useTranslation("tgScan");

  const numberOf = useCallback(
    (order: ScanOrderSummary | null) => (order?.order_number ? formatOrderNumber(order.order_number) : t("entry.noNumber")),
    [t],
  );

  const titleOf = useCallback(
    (order: ScanOrderSummary | null) =>
      t("entry.title", { number: numberOf(order), name: order?.customer?.name ?? t("entry.orderNoun") }),
    [numberOf, t],
  );

  /** Tuman (bo'lmasa viloyat) — joy nomi. */
  const placeOf = useCallback((order: ScanOrderSummary | null) => order?.district ?? order?.region ?? null, []);

  const errorText = useCallback(
    (error: TgScanErrorInfo) => {
      if (error.kind === "message") return error.message;
      if (error.kind === "offline") return t("error.offline");
      if (error.kind === "timeout") return t("error.timeout");
      return error.message ?? t("error.unknown");
    },
    [t],
  );

  const statusOf = useCallback((entry: ScanEntry) => t(`entry.${entry.status}`), [t]);

  return { numberOf, titleOf, placeOf, errorText, statusOf };
};
