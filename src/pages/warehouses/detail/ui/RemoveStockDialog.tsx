// dizayn-v2: (maket yo'q) superadmin-warehouse-detail — qoldiq qatoridan «Ombordan o'chirish»
import { useState } from "react";
import { Trash2 } from "lucide-react";
import {
  isWarehouseStockReservedError,
  useRemoveWarehouseStock,
  type WarehouseStockRow,
} from "../../../../entities/warehouse";
import { notify } from "../../../../shared/lib/notify";
import { Button, Dialog, Field, TextInput } from "../../../../shared/ui/primitives";
import { useWarehouseText } from "../../model/useWarehouseText";
import { NoteAlert } from "../../ui/NoteAlert";

const REASON_MAX = 1000;

export type RemoveStockDialogProps = {
  warehouseId: string;
  row: WarehouseStockRow | null;
  onClose: () => void;
};

/**
 * MAHSULOTNI OMBORDAN O'CHIRISH (2026-11-13, ega: «Ombordagi qaysidir mahsulotni o'chirish imkoni bo'lishi kerak
 * qoldiq 0 bo'lishi shart emas») — `DELETE /warehouses/:id/stock/:productId { reason? }`.
 *
 * Qoldiq bo'lsa — «N dona ombordan chiqariladi, jurnalda qoladi»; band dona bo'lsa — ogohlantirish va tugma o'chiq
 * (backend ham 409 `WAREHOUSE_STOCK_RESERVED` beradi). Sabab ixtiyoriy — jurnal izohiga yoziladi. Maket yo'q —
 * `ThresholdDialog` kabi kichik oyna, tasdiqlash tugmasi qizil (aniq fe'l bilan).
 */
export const RemoveStockDialog = ({ warehouseId, row, onClose }: RemoveStockDialogProps) => {
  const text = useWarehouseText();
  const { t } = text;
  const mutation = useRemoveWarehouseStock();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shownFor, setShownFor] = useState<string | null>(null);
  if (row && shownFor !== row.stockId) {
    setShownFor(row.stockId);
    setReason("");
    setError(null);
  }

  const busy = mutation.isPending;
  const reserved = row?.reserved ?? 0;
  const blocked = reserved > 0;

  const close = () => {
    if (busy) return;
    setShownFor(null);
    onClose();
  };

  const submit = async () => {
    if (!row || busy || blocked) return;
    try {
      const result = await mutation.mutateAsync({
        id: warehouseId,
        productId: row.product.id,
        reason: reason.trim() || undefined,
      });
      notify.success(t("removeStock.success"), {
        description:
          result.writtenOff > 0
            ? t("removeStock.successText", { name: row.product.name, pcs: text.pcs(result.writtenOff) })
            : t("removeStock.successTextEmpty", { name: row.product.name }),
      });
      setShownFor(null);
      onClose();
    } catch (removeError) {
      setError(isWarehouseStockReservedError(removeError) ? t("removeStock.reservedError") : text.writeError(removeError));
    }
  };

  return (
    <Dialog
      open={Boolean(row)}
      onClose={close}
      busy={busy}
      size="sm"
      icon={Trash2}
      iconTone="danger"
      title={t("removeStock.title")}
      description={row ? t("removeStock.body", { name: row.product.name }) : undefined}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      formProps={{ noValidate: true }}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={busy}>
            {t("actions.cancel")}
          </Button>
          <Button type="submit" variant="danger" loading={busy} disabled={blocked}>
            {t("removeStock.submit")}
          </Button>
        </>
      }
    >
      {row ? (
        blocked ? (
          <NoteAlert tone="warning" title={t("removeStock.reservedTitle")}>
            {t("removeStock.reserved", { pcs: text.pcs(reserved) })}
          </NoteAlert>
        ) : (
          <p className="m-0 text-sm text-text">
            {row.onHand > 0 ? t("removeStock.writeOff", { pcs: text.pcs(row.onHand) }) : t("removeStock.empty")}
          </p>
        )
      ) : null}
      {!blocked ? (
        <Field label={t("removeStock.reason")} error={error ?? undefined}>
          <TextInput
            multiline
            rows={2}
            value={reason}
            onValueChange={(value) => {
              setReason(value);
              setError(null);
            }}
            placeholder={t("removeStock.reasonPlaceholder")}
            maxLength={REASON_MAX}
            readOnly={busy}
          />
        </Field>
      ) : error ? (
        <p role="alert" className="m-0 text-[13px] text-danger-fg">
          {error}
        </p>
      ) : null}
    </Dialog>
  );
};
