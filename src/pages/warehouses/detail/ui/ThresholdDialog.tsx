// dizayn-v2: (maket yo'q) superadmin-warehouse-create-dialog
import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { useSetStockThreshold, type WarehouseStockRow } from "../../../../entities/warehouse";
import { notify } from "../../../../shared/lib/notify";
import { Button, Dialog, Field, TextInput } from "../../../../shared/ui/primitives";
import { useWarehouseText } from "../../model/useWarehouseText";

const THRESHOLD_MAX = 100_000;

export type ThresholdDialogProps = {
  warehouseId: string;
  /** Ombor sukuti (`low_stock_default`). */
  defaultThreshold: number;
  row: WarehouseStockRow | null;
  onClose: () => void;
};

/**
 * «KAM QOLDIQ» CHEGARASI — mahsulot bo'yicha (`PATCH /warehouses/:id/stock/:productId { low_stock_threshold }`;
 * `null` — ombor sukuti). Maket yo'q — eng yaqini `superadmin-warehouse-create-dialog` («Kam qoldiq chegarasi *»
 * maydoni): son (dona) + «Ombor sukutiga qaytarish» (o'z chegarasi bo'lsa).
 */
export const ThresholdDialog = ({ warehouseId, defaultThreshold, row, onClose }: ThresholdDialogProps) => {
  const text = useWarehouseText();
  const { t } = text;
  const mutation = useSetStockThreshold();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shownFor, setShownFor] = useState<string | null>(null);
  if (row && shownFor !== row.stockId) {
    setShownFor(row.stockId);
    setValue(String(row.lowStockThreshold ?? row.threshold));
    setError(null);
  }

  const save = async (next: number | null) => {
    if (!row || mutation.isPending) return;
    try {
      const result = await mutation.mutateAsync({ id: warehouseId, productId: row.product.id, value: next });
      notify.success(t("threshold.success"), {
        description: t("threshold.successText", {
          name: row.product.name,
          value: text.pcs(result.effectiveThreshold || (next ?? defaultThreshold)),
        }),
      });
      setShownFor(null);
      onClose();
    } catch (saveError) {
      setError(text.writeError(saveError));
    }
  };

  const submit = () => {
    const number = Number(value);
    if (value === "" || !Number.isInteger(number) || number < 0 || number > THRESHOLD_MAX) {
      setError(t("create.errors.threshold", { max: text.number(THRESHOLD_MAX) }));
      return;
    }
    void save(number);
  };

  const close = () => {
    if (mutation.isPending) return;
    setShownFor(null);
    onClose();
  };

  const busy = mutation.isPending;
  return (
    <Dialog
      open={Boolean(row)}
      onClose={close}
      busy={busy}
      size="sm"
      icon={SlidersHorizontal}
      title={t("threshold.title")}
      description={row?.product.name}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      formProps={{ noValidate: true }}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={busy}>
            {t("actions.cancel")}
          </Button>
          <Button type="submit" loading={busy}>
            {t("actions.save")}
          </Button>
        </>
      }
    >
      <Field
        label={t("threshold.label")}
        required
        error={error ?? undefined}
        hint={t("threshold.hint", { value: text.pcs(defaultThreshold) })}
      >
        <TextInput
          mode="number"
          value={value}
          onValueChange={(next) => {
            setValue(next);
            setError(null);
          }}
          suffix={t("units.pcsWord", { count: Number(value) || 0 })}
          autoComplete="off"
          readOnly={busy}
        />
      </Field>
      {row?.lowStockThreshold !== null && row?.lowStockThreshold !== undefined ? (
        <Button variant="link" size="sm" className="self-start" disabled={busy} onClick={() => void save(null)}>
          {t("threshold.useDefault", { value: text.pcs(defaultThreshold) })}
        </Button>
      ) : null}
    </Dialog>
  );
};
