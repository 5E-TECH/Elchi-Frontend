import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { BatchDetail } from "../../../entities/batch";
import {
  formatBatchMoney,
  formatBatchPrintDate,
} from "../lib/batchFormat";
import BatchQrCode from "./BatchQrCode";

interface BatchPrintSheetProps {
  batch: BatchDetail;
}

const BatchPrintSheet = ({ batch }: BatchPrintSheetProps) => {
  const { t } = useTranslation("batches");
  const branchLabel = `${batch.from_branch.code ?? batch.from_branch.id} (${batch.from_branch.name})`;
  const regionLabel = batch.to_branch.region ?? batch.to_branch.name;

  return (
    <div className="batch-print-root">
      <section className="batch-print-page">
        <div className="batch-print-meta">
          <div>
            <span>{t("print.branch")}</span>
            <strong>{branchLabel}</strong>
          </div>
          <div>
            <span>{t("print.region")}</span>
            <strong>{regionLabel}</strong>
          </div>
          <div>
            <span>{t("print.orders")}</span>
            <strong>{t("detail.orderCount", { count: batch.orders_count })}</strong>
          </div>
          <div>
            <span>{t("print.total")}</span>
            <strong>{formatBatchMoney(batch.total_price)}</strong>
          </div>
          <div>
            <span>{t("print.date")}</span>
            <strong>{formatBatchPrintDate(batch.created_at)}</strong>
          </div>
        </div>

        <div className="batch-print-qr">
          <BatchQrCode
            token={batch.token}
            fallbackLabel={batch.id}
            alt={`QR ${batch.id}`}
            fallbackClassName="batch-print-qr-fallback"
          />
        </div>
      </section>
    </div>
  );
};

export default memo(BatchPrintSheet);
