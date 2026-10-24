// dizayn-v2: (maket yo'q) superadmin-warehouse-stock-in-dialog
import { useState } from "react";
import { ClipboardList, TriangleAlert } from "lucide-react";
import {
  isUncertainWriteError,
  useIdempotencyKeys,
  useInventory,
  type Warehouse,
} from "../../../../entities/warehouse";
import { getErrorStatus } from "../../../../shared/lib/errorKind";
import { notify } from "../../../../shared/lib/notify";
import { Button, Dialog, Field, TextInput, useConfirm } from "../../../../shared/ui/primitives";
import { useWarehouseText } from "../../model/useWarehouseText";
import { NoteAlert } from "../../ui/NoteAlert";
import { issueLines, itemLines, linesFingerprint } from "../model/scanLines";
import { useScanSession } from "../model/useScanSession";
import { ScanLinesList } from "./ScanLinesList";
import { ScanProductField } from "./ScanProductField";

const REASON_MIN = 3;
const REASON_MAX = 1000;

export type InventoryDialogProps = {
  open: boolean;
  warehouse: Warehouse | null;
  onClose: () => void;
};

/**
 * INVENTARIZATSIYA — haqiqiy sonni kiritib farqni tuzatish (⋯ menyu; faqat superadmin, admin). Maket yo'q — eng
 * yaqini `superadmin-warehouse-stock-in-dialog`: o'sha «Mahsulot» maydoni (USB skaner, kamera, nom), qatorlarda
 * «Hisobda» (hozirgi qoldiq), «Farq» va sanalgan dona (skan +1), «Sabab *» (3+ belgi), izoh «Farq «Tuzatish» bo'lib
 * yoziladi». `POST /warehouses/:id/inventory { lines: [{ product_id, counted }], reason }` + `Idempotency-Key`;
 * band qilingandan kam son — 409.
 */
export const InventoryDialog = ({ open, warehouse, onClose }: InventoryDialogProps) => {
  const text = useWarehouseText();
  const { t } = text;
  const confirm = useConfirm();
  const inventory = useInventory();
  const keys = useIdempotencyKeys();
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const warehouseId = warehouse?.id ?? null;

  const session = useScanSession({
    open,
    warehouseId,
    marketId: null,
    camera: {
      id: `warehouse-inventory:${warehouseId ?? ""}`,
      title: t("inventory.title"),
      context: warehouse?.name,
      hint: t("stockIn.cameraHint"),
    },
    messages: {
      added: (name) => t("scan.feedback.counted", { name }),
      notFound: (code) => t("scan.feedback.notFound", { code }),
      unlinked: (code) => t("scan.feedback.notFound", { code }),
      ambiguous: (code) => t("scan.feedback.ambiguous", { code }),
      failed: (code) => t("scan.feedback.failed", { code }),
      tooMany: t("scan.feedback.tooMany"),
    },
  });

  const items = itemLines(session.lines);
  const issues = issueLines(session.lines);
  const changed = items.filter((line) => line.qty !== (line.stock?.onHand ?? 0)).length;

  const resetAll = () => {
    session.reset();
    keys.reset();
    setReason("");
    setReasonError(null);
    setSubmitError(null);
    inventory.reset();
  };

  const close = async () => {
    if (inventory.isPending) return;
    if (items.length > 0) {
      const ok = await confirm({
        tone: "danger",
        title: t("inventory.discardTitle"),
        description: t("inventory.discardText", { count: items.length, value: text.number(items.length) }),
        confirmLabel: t("stockIn.discardConfirm"),
        cancelLabel: t("stockIn.discardCancel"),
      });
      if (!ok) return;
    }
    resetAll();
    onClose();
  };

  const submit = async () => {
    if (!warehouseId || inventory.isPending) return;
    setSubmitError(null);
    const trimmed = reason.trim();
    const reasonInvalid = trimmed.length < REASON_MIN;
    setReasonError(reasonInvalid ? t("inventory.errors.reason", { min: REASON_MIN }) : null);
    if (items.length === 0) {
      setSubmitError(t("inventory.errors.empty"));
      return;
    }
    if (reasonInvalid) return;
    const body = { lines: items.map((line) => ({ product_id: line.key, counted: line.qty })), reason: trimmed };
    const idempotencyKey = keys.take(linesFingerprint(session.lines, { warehouseId, reason: trimmed }));
    try {
      const result = await inventory.mutateAsync({ id: warehouseId, body, idempotencyKey });
      const summary = t("inventory.summary", {
        changed: text.number(result.changed),
        unchanged: text.number(result.unchanged),
      });
      if (result.replayed) notify.info(t("inventory.replayed"), { description: summary });
      else notify.success(t("inventory.success"), { description: summary });
      resetAll();
      onClose();
    } catch (error) {
      if (isUncertainWriteError(error)) {
        setSubmitError(t("stockIn.errors.uncertain"));
        return;
      }
      const status = getErrorStatus(error);
      if (status === 409) keys.reset();
      setSubmitError(
        status === 409 ? t("inventory.errors.conflict") : status === 400 ? t("inventory.errors.invalid") : text.writeError(error),
      );
    }
  };

  const busy = inventory.isPending;

  return (
    <Dialog
      open={open}
      onClose={() => void close()}
      busy={busy}
      size="xl"
      icon={ClipboardList}
      title={t("inventory.title")}
      description={warehouse ? t("inventory.description", { warehouse: warehouse.name }) : undefined}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      formProps={{ noValidate: true }}
      className="md:max-w-[760px]"
      footer={
        <>
          <Button variant="secondary" onClick={() => void close()} disabled={busy}>
            {t("actions.cancel")}
          </Button>
          <Button type="submit" leftIcon={ClipboardList} loading={busy} disabled={items.length === 0}>
            {items.length > 0
              ? t("inventory.submitWithCount", {
                  value: t("stockIn.positions", { count: items.length, value: text.number(items.length) }),
                })
              : t("inventory.submit")}
          </Button>
        </>
      }
    >
      <ScanProductField
        marketId={null}
        pending={session.pending !== null}
        disabled={busy || !warehouseId}
        onCode={(code) => void session.lookup(code)}
        onPick={(product) => {
          const code = product.skuCode ?? product.barcode;
          if (code) void session.lookup(code);
        }}
        onCamera={session.openCamera}
      />

      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="text-sm font-semibold text-text">{t("inventory.listTitle")}</span>
          <span className="text-xs text-text-muted">{t("stockIn.lastFirst")}</span>
        </div>
        {session.lines.length === 0 ? (
          <p className="m-0 rounded-xl bg-sunken px-4 py-3 text-[13px] text-text-muted">{t("inventory.empty")}</p>
        ) : (
          <ScanLinesList
            lines={session.lines}
            variant="inventory"
            marketName={null}
            disabled={busy}
            onQty={(key, qty) => session.dispatch({ type: "qty", key, qty })}
            onRemove={(key) => session.dispatch({ type: "remove", key })}
            onPickCandidate={(line, item) => session.addItem(item, { resolves: line.code })}
            onRetry={(line) => void session.lookup(line.code)}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {issues.length > 0 ? (
          <span className="inline-flex items-center gap-1.5 text-[13px] text-warning-fg">
            <TriangleAlert size={16} aria-hidden="true" className="shrink-0" />
            {t("stockIn.unresolved", { count: issues.length, value: text.number(issues.length) })}
          </span>
        ) : (
          <span />
        )}
        <span className="text-[13px]" aria-live="polite">
          <span className="text-text-muted">{t("inventory.changedLabel")}</span>{" "}
          <span className="font-semibold text-text">
            {t("inventory.changedValue", { changed: text.number(changed), total: text.number(items.length) })}
          </span>
        </span>
      </div>

      <Field label={t("inventory.reason")} required error={reasonError ?? undefined} hint={t("inventory.reasonHint")}>
        <TextInput
          multiline
          rows={2}
          value={reason}
          onValueChange={(value) => {
            setReason(value);
            if (reasonError && value.trim().length >= REASON_MIN) setReasonError(null);
          }}
          placeholder={t("inventory.reasonPlaceholder")}
          maxLength={REASON_MAX}
          readOnly={busy}
          data-scanner-ignore=""
        />
      </Field>

      <NoteAlert title={t("inventory.infoTitle")}>{t("inventory.infoText")}</NoteAlert>

      {submitError ? (
        <p role="alert" className="m-0 text-[13px] font-semibold text-danger-fg">
          {submitError}
        </p>
      ) : null}
    </Dialog>
  );
};
