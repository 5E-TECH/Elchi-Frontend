import { memo, useState } from "react";
import type { BatchDetail } from "../../../entities/batch";
import {
  formatBatchMoney,
  formatBatchPrintDate,
  getBatchQrUrl,
} from "../lib/batchFormat";

interface BatchPrintSheetProps {
  batch: BatchDetail;
}

const BatchPrintSheet = ({ batch }: BatchPrintSheetProps) => {
  const [qrFailed, setQrFailed] = useState(false);
  const branchLabel = `${batch.from_branch.code ?? batch.from_branch.id} (${batch.from_branch.name})`;
  const regionLabel = batch.to_branch.region ?? batch.to_branch.name;

  return (
    <div className="batch-print-root">
      <section className="batch-print-page">
        <div className="batch-print-meta">
          <div>
            <span>FILIAL:</span>
            <strong>{branchLabel}</strong>
          </div>
          <div>
            <span>VILOYAT:</span>
            <strong>{regionLabel}</strong>
          </div>
          <div>
            <span>ORDER:</span>
            <strong>{batch.orders_count} ta</strong>
          </div>
          <div>
            <span>JAMI:</span>
            <strong>{formatBatchMoney(batch.total_price)}</strong>
          </div>
          <div>
            <span>SANA:</span>
            <strong>{formatBatchPrintDate(batch.created_at)}</strong>
          </div>
        </div>

        <div className="batch-print-qr">
          {!qrFailed && batch.token ? (
            <img
              src={getBatchQrUrl(batch.token)}
              alt={`QR ${batch.id}`}
              onError={() => setQrFailed(true)}
            />
          ) : (
            <div className="batch-print-qr-fallback">
              <span>QR KOD</span>
              <small>{batch.id}</small>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default memo(BatchPrintSheet);
