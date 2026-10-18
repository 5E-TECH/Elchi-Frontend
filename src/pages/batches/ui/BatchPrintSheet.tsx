// dizayn-v2: superadmin-batches-detail, admin-batches-detail, manager-batches-detail-send, manager-batches-detail-readonly, manager-returns-batch-detail
import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { BatchDetail } from "../../../entities/batch";
import { formatDateLocalized } from "../../../shared/lib/formatDateTime";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { formatBatchDisplayId } from "../lib/batchFormat";
import BatchQrCode from "./BatchQrCode";

interface BatchPrintSheetProps {
  batch: BatchDetail;
  /** Filial nomi (tafsilot javobida bo'lmasa `GET branches/:id` dan). */
  fromName?: string | null;
  /** Viloyat (bo'lmasa qabul qiluvchi filial nomi — v1 dagidek). */
  regionName?: string | null;
}

/**
 * Yorliq ustuni: `index.css` dagi 34 mm «BUYURTMALAR:» (16 pt) ga sig'maydi — chop etish uslubidan ustun turishi uchun
 * inline (rang emas, faqat o'lcham).
 */
const PRINT_ROW = { gridTemplateColumns: "46mm 1fr" } as const;

/**
 * A5 CHOP ETISH VARAG'I (maket «Chop etish varag'i»: 148 × 210 mm, qalin ramka): Filial (kod + nom), Viloyat,
 * Buyurtmalar, Jami, Sana va katta QR. Ekranda ko'rinmaydi — faqat «Chop etish» (`window.print()`) bosilganda,
 * `index.css` dagi `@media print` qoidalari (`.batch-print-*`) bilan chiqadi.
 */

const BatchPrintSheet = ({ batch, fromName, regionName }: BatchPrintSheetProps) => {
  const { t, i18n } = useTranslation("batches");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const branchName = fromName ?? batch.from_branch.name;
  const branchLabel = `${batch.from_branch.code ?? batch.from_branch.id} (${branchName})`;
  const region = regionName ?? batch.to_branch.region ?? batch.to_branch.name;
  const displayId = formatBatchDisplayId(batch.id);

  return (
    <div className="batch-print-root">
      <section className="batch-print-page">
        <div className="batch-print-meta">
          <div style={PRINT_ROW}>
            <span>{t("print.branch")}</span>
            <strong>{branchLabel}</strong>
          </div>
          <div style={PRINT_ROW}>
            <span>{t("print.region")}</span>
            <strong>{region}</strong>
          </div>
          <div style={PRINT_ROW}>
            <span>{t("print.orders")}</span>
            <strong>{t("qty", { value: formatNumberLocalized(batch.orders_count, { language }) })}</strong>
          </div>
          <div style={PRINT_ROW}>
            <span>{t("print.total")}</span>
            <strong>{formatMoneyLocalized(batch.total_price, { language })}</strong>
          </div>
          <div style={PRINT_ROW}>
            <span>{t("print.date")}</span>
            <strong>{formatDateLocalized(batch.created_at, { language })}</strong>
          </div>
        </div>

        <div className="batch-print-qr">
          <BatchQrCode
            token={batch.token}
            fallbackLabel={displayId}
            alt={t("detail.qrImage", { id: displayId })}
            fallbackClassName="batch-print-qr-fallback"
          />
        </div>
      </section>
    </div>
  );
};

export default memo(BatchPrintSheet);
