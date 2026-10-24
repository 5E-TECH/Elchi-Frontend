// dizayn-v2: superadmin-warehouse-stock-in-dialog, admin-warehouse-stock-in-dialog
import { useMemo, useState } from "react";
import { PackagePlus, Store, TriangleAlert, Warehouse as WarehouseIcon } from "lucide-react";
import {
  isUncertainWriteError,
  useIdempotencyKeys,
  useStockIn,
  useWarehouseList,
  type Warehouse,
} from "../../../../entities/warehouse";
import { useMarketLookup } from "../../../../entities/markets/lookup";
import { getErrorStatus } from "../../../../shared/lib/errorKind";
import { notify } from "../../../../shared/lib/notify";
import {
  Button,
  Dialog,
  Field,
  Select,
  TextInput,
  useConfirm,
  type SelectOption,
} from "../../../../shared/ui/primitives";
import { useWarehouseText } from "../../model/useWarehouseText";
import { NoteAlert } from "../../ui/NoteAlert";
import { useDebouncedValue } from "../model/useDebouncedValue";
import { issueLines, itemLines, linesFingerprint, totalQty } from "../model/scanLines";
import { useScanSession } from "../model/useScanSession";
import { LinkBarcodeDialog } from "./LinkBarcodeDialog";
import { ScanLinesList } from "./ScanLinesList";
import { ScanProductField } from "./ScanProductField";

const NOTE_MAX = 1000;

export type StockInDialogProps = {
  open: boolean;
  /** Joriy ombor (sukut tanlov). */
  warehouse: Warehouse | null;
  onClose: () => void;
};

/**
 * OMBORGA MAHSULOT QO'SHISH — KIRIM (maket `superadmin-warehouse-stock-in-dialog` = admin; ega qarori 3 — admin
 * to'g'ridan qo'shadi, filial tasdig'i yo'q).
 *
 * «Ombor *» (sukut — joriy), «Market» (ixtiyoriy — kod qidiruvi va bog'lash shu market mahsulotlari bilan), «Mahsulot
 * *» (USB skaner, kamera — `ELC-P` QR, yoki nom bo'yicha qidiruv), «Skanerlangan mahsulotlar» (oxirgi skan yuqorida;
 * qayta skan +1), «N ta skan hal qilinmagan — qo'shilmaydi» va «Jami: N pozitsiya · N dona», «Izoh», «Darhol
 * qoldiqqa qo'shiladi» izohi; «Qoldiqqa qo'shish — N dona».
 *
 * `POST /warehouses/:id/stock-in { lines: [{ product_id, qty }], note? }` + `Idempotency-Key` (tarkib barmoq iziga
 * bog'langan: javobsiz urinishni qayta yuborish ikki marta qo'shmaydi — `replayed`). Natijasi noma'lum xatoda oyna
 * ochiq qoladi va ogohlantiriladi (qoldiq qayta o'qiladi).
 */
export const StockInDialog = ({ open, warehouse, onClose }: StockInDialogProps) => {
  const text = useWarehouseText();
  const { t } = text;
  const confirm = useConfirm();
  const stockIn = useStockIn();
  const keys = useIdempotencyKeys();
  const [warehouseId, setWarehouseId] = useState<string | null>(warehouse?.id ?? null);
  const [marketId, setMarketId] = useState<string | null>(null);
  const [marketName, setMarketName] = useState<string | null>(null);
  const [marketSearch, setMarketSearch] = useState("");
  const [note, setNote] = useState("");
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Ochilganda joriy ombor tanlanadi (sahifa boshqa omborga o'tgan bo'lsa ham).
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  if (open && warehouse && openedFor !== warehouse.id) {
    setOpenedFor(warehouse.id);
    setWarehouseId(warehouse.id);
  }

  const warehousesQuery = useWarehouseList({ limit: 100 }, { enabled: open });
  const warehouseOptions = useMemo<SelectOption[]>(() => {
    const list = warehousesQuery.data?.items ?? (warehouse ? [warehouse] : []);
    return list.map((item) => ({
      value: item.id,
      label: item.name,
      icon: WarehouseIcon,
      description: item.status === "PAUSED" ? t("status.paused") : undefined,
    }));
  }, [t, warehouse, warehousesQuery.data]);
  const selectedWarehouse =
    warehousesQuery.data?.items.find((item) => item.id === warehouseId) ?? (warehouse?.id === warehouseId ? warehouse : null);

  const debouncedMarketSearch = useDebouncedValue(marketSearch, 300);
  const marketsQuery = useMarketLookup(debouncedMarketSearch, open);
  const marketOptions = useMemo<SelectOption[]>(() => {
    const items = marketsQuery.data?.items ?? [];
    const options = items.map((market) => ({ value: market.id, label: market.name, icon: Store, searchText: market.phone }));
    if (marketId && marketName && !options.some((option) => option.value === marketId)) {
      options.unshift({ value: marketId, label: marketName, icon: Store, searchText: undefined });
    }
    return options;
  }, [marketId, marketName, marketsQuery.data]);

  const session = useScanSession({
    open,
    warehouseId,
    marketId,
    camera: {
      id: `warehouse-stock-in:${warehouseId ?? ""}`,
      title: t("stockIn.title"),
      context: selectedWarehouse?.name,
      hint: t("stockIn.cameraHint"),
    },
    messages: {
      added: (name) => t("scan.feedback.added", { name }),
      notFound: (code) => t("scan.feedback.notFound", { code }),
      unlinked: (code) => t("scan.feedback.unlinked", { code }),
      ambiguous: (code) => t("scan.feedback.ambiguous", { code }),
      failed: (code) => t("scan.feedback.failed", { code }),
      tooMany: t("scan.feedback.tooMany"),
    },
  });

  const items = itemLines(session.lines);
  const issues = issueLines(session.lines);
  const qtyTotal = totalQty(session.lines);
  const invalidQty = items.some((line) => line.qty < 1);

  const resetAll = () => {
    session.reset();
    keys.reset();
    setNote("");
    setMarketId(null);
    setMarketName(null);
    setMarketSearch("");
    setSubmitError(null);
    setLinkCode(null);
    setOpenedFor(null);
    stockIn.reset();
  };

  const close = async () => {
    if (stockIn.isPending) return;
    if (items.length > 0) {
      const ok = await confirm({
        tone: "danger",
        title: t("stockIn.discardTitle"),
        description: t("stockIn.discardText", { count: items.length, value: text.number(items.length) }),
        confirmLabel: t("stockIn.discardConfirm"),
        cancelLabel: t("stockIn.discardCancel"),
      });
      if (!ok) return;
    }
    resetAll();
    onClose();
  };

  const changeWarehouse = async (next: string | null) => {
    if (!next || next === warehouseId) return;
    if (session.lines.length > 0) {
      const ok = await confirm({
        title: t("stockIn.changeWarehouseTitle"),
        description: t("stockIn.changeWarehouseText"),
        confirmLabel: t("stockIn.changeWarehouseConfirm"),
      });
      if (!ok) return;
      session.reset();
      keys.reset();
    }
    setWarehouseId(next);
  };

  const submit = async () => {
    if (!warehouseId || stockIn.isPending) return;
    setSubmitError(null);
    if (items.length === 0) {
      setSubmitError(t("stockIn.errors.empty"));
      return;
    }
    if (invalidQty) {
      setSubmitError(t("stockIn.errors.qty"));
      return;
    }
    const trimmedNote = note.trim();
    const body = {
      lines: items.map((line) => ({ product_id: line.key, qty: line.qty })),
      ...(trimmedNote ? { note: trimmedNote } : {}),
    };
    const idempotencyKey = keys.take(linesFingerprint(session.lines, { warehouseId, note: trimmedNote }));
    try {
      const result = await stockIn.mutateAsync({ id: warehouseId, body, idempotencyKey });
      const summary = t("stockIn.summaryValue", {
        positions: t("stockIn.positions", { count: result.positions, value: text.number(result.positions) }),
        pcs: text.pcs(result.totalQty),
      });
      if (result.replayed) notify.info(t("stockIn.replayed"), { description: summary });
      else notify.success(t("stockIn.success"), { description: `${summary} — ${result.warehouseName || selectedWarehouse?.name || ""}` });
      resetAll();
      onClose();
    } catch (error) {
      if (isUncertainWriteError(error)) {
        setSubmitError(t("stockIn.errors.uncertain"));
        return;
      }
      const status = getErrorStatus(error);
      if (status === 409) keys.reset();
      setSubmitError(status === 400 ? t("stockIn.errors.unresolved") : status === 409 ? t("stockIn.errors.conflict") : text.writeError(error));
    }
  };

  const busy = stockIn.isPending;
  const warehouseName = selectedWarehouse?.name ?? warehouse?.name ?? "";

  return (
    <>
      <Dialog
        open={open}
        onClose={() => void close()}
        busy={busy}
        size="xl"
        icon={PackagePlus}
        title={t("stockIn.title")}
        description={t("stockIn.description")}
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
            <Button type="submit" leftIcon={PackagePlus} loading={busy} disabled={items.length === 0}>
              {qtyTotal > 0 ? t("stockIn.submitWithQty", { value: text.pcs(qtyTotal) }) : t("stockIn.submit")}
            </Button>
          </>
        }
      >
        <div className="flex flex-wrap items-start gap-4">
          <Field label={t("stockIn.warehouse")} required labelAs="span" className="min-w-0 flex-[1_1_240px]">
            <Select
              options={warehouseOptions}
              value={warehouseId}
              onChange={(next) => void changeWarehouse(next)}
              icon={WarehouseIcon}
              loading={warehousesQuery.isLoading}
              disabled={busy}
            />
          </Field>
          <Field label={t("stockIn.market")} labelAs="span" hint={t("stockIn.marketHint")} className="min-w-0 flex-[1_1_240px]">
            <Select
              options={marketOptions}
              value={marketId}
              onChange={(next, option) => {
                setMarketId(next);
                setMarketName(option?.label ?? null);
              }}
              searchable
              filter={false}
              onSearchChange={setMarketSearch}
              clearable
              icon={Store}
              placeholder={t("stockIn.marketPlaceholder")}
              loading={marketsQuery.isFetching}
              disabled={busy}
            />
          </Field>
        </div>

        <ScanProductField
          marketId={marketId}
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
            <span className="text-sm font-semibold text-text">{t("stockIn.listTitle")}</span>
            <span className="text-xs text-text-muted">{t("stockIn.lastFirst")}</span>
          </div>
          {session.lines.length === 0 ? (
            <p className="m-0 rounded-xl bg-sunken px-4 py-3 text-[13px] text-text-muted">{t("stockIn.empty")}</p>
          ) : (
            <ScanLinesList
              lines={session.lines}
              variant="stockIn"
              marketName={marketName}
              disabled={busy}
              onQty={(key, qty) => session.dispatch({ type: "qty", key, qty })}
              onRemove={(key) => session.dispatch({ type: "remove", key })}
              onLink={(line) => setLinkCode(line.code)}
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
            <span className="text-text-muted">{t("stockIn.total")}</span>{" "}
            <span className="font-semibold text-text">
              {t("stockIn.summaryValue", {
                positions: t("stockIn.positions", { count: items.length, value: text.number(items.length) }),
                pcs: text.pcs(qtyTotal),
              })}
            </span>
          </span>
        </div>

        <Field label={t("stockIn.note")} optional>
          <TextInput
            multiline
            rows={2}
            value={note}
            onValueChange={setNote}
            placeholder={t("stockIn.notePlaceholder")}
            maxLength={NOTE_MAX}
            readOnly={busy}
            data-scanner-ignore=""
          />
        </Field>

        <NoteAlert title={t("stockIn.infoTitle")}>{t("stockIn.infoText", { warehouse: warehouseName })}</NoteAlert>

        {submitError ? (
          <p role="alert" className="m-0 text-[13px] font-semibold text-danger-fg">
            {submitError}
          </p>
        ) : null}
      </Dialog>

      <LinkBarcodeDialog
        code={linkCode}
        marketId={marketId}
        marketName={marketName}
        onClose={() => setLinkCode(null)}
        onLinked={(code) => {
          setLinkCode(null);
          // Kod endi mahsulotda — qayta qidiriladi: muammo qatori o'rniga mahsulot qatori («Kod bog'landi»).
          void session.lookup(code, { badge: "linked" });
        }}
      />
    </>
  );
};
