// dizayn-v2: courier-orders-cancel-dialog, manager-orders-cancel-dialog
import { memo, useEffect, useId, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, CircleCheck, CircleX, ImagePlus, LoaderCircle, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Order } from "./ordertable/pendingOrderTable";
import { useFocusTrap } from "../../../../../shared/lib/useFocusTrap";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../../../shared/lib/formatMoney";
import {
  getActivePendingApproval,
  usePendingExtraCostApprovals,
} from "../../../../../entities/orders/extraCostApproval";
import {
  ExtraCostNoticeAlert,
  ExtraCostPendingAlert,
  ExtraCostSentAlert,
} from "../../../../../entities/orders/ui/ExtraCostApprovalAlerts";
import {
  isProofRequiredByConditions,
  toKnownAmount,
} from "../../../../../entities/orders/proofRequirement";
import {
  CANCEL_REASONS,
  cancelReasonNeedsComment,
  isCancelReasonComplete,
  type CancelOrderPayload,
  type CancelReason,
} from "../../../../../entities/orders/cancelReason";

/**
 * BUYURTMANI BEKOR QILISH — kuryer, menejer va buyurtma tafsilotida bitta oyna.
 *
 * Sabab YOPIQ RO'YXATDAN majburiy (GNWDKvmZ): tanlanmaguncha «Bekor qilish»
 * o'chiq; «Boshqa» bo'lsa izoh ham majburiy. Backend ham shuni tekshiradi
 * (sababsiz — 400), lekin operator xatoni bosgandan keyin emas, oldin ko'radi.
 *
 * Maket: `courier-orders-cancel-dialog`. Sabab maydoni maketda yo'q — forma
 * maydoni naqshida (`tizim-states-forms`). Telefonda pastki varaqa.
 */

type Props = {
  order: Order | null;
  open: boolean;
  onClose: () => void;
  onCancel: (orderId: string, payload: CancelOrderPayload) => void;
  isLoading?: boolean;
  /** Yuborilgan amal market tasdig'iga tushdi — forma o'rniga holat ko'rsatiladi. */
  awaitingApproval?: boolean;
};

const MAX_PROOF_SIZE_MB = 10;
const MAX_PROOF_SIZE_BYTES = MAX_PROOF_SIZE_MB * 1024 * 1024;

const REASON_LABEL_KEYS: Record<CancelReason, string> = {
  CUSTOMER_NO_ANSWER: "cancelReasons.CUSTOMER_NO_ANSWER",
  CUSTOMER_REFUSED: "cancelReasons.CUSTOMER_REFUSED",
  WRONG_ADDRESS: "cancelReasons.WRONG_ADDRESS",
  DEFECTIVE_PRODUCT: "cancelReasons.DEFECTIVE_PRODUCT",
  PRICE_DISPUTE: "cancelReasons.PRICE_DISPUTE",
  OTHER: "cancelReasons.OTHER",
};

// CODE-MAP retseptlari (BTN, INPUT).
const BTN =
  "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] border px-4 text-sm font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action disabled:cursor-not-allowed disabled:opacity-45 max-md:min-h-11";
const BTN_SECONDARY = `${BTN} border-border-strong bg-surface text-text hover:bg-sunken`;
// To'liq `bg-danger` tungi mavzuda AA dan past (CODE-MAP 0.4) — `danger-soft`.
const BTN_DANGER = `${BTN} border-transparent bg-danger-soft text-danger-fg hover:bg-danger hover:text-on-solid`;
const INPUT =
  "h-10 w-full rounded-[10px] border border-border-strong bg-input px-3 text-base text-text placeholder:text-text-subtle hover:border-text-subtle focus:border-action focus:outline-none focus:ring-3 focus:ring-focus disabled:cursor-not-allowed disabled:bg-sunken disabled:text-text-subtle aria-[invalid=true]:border-danger max-md:min-h-11 md:text-sm";
const LABEL = "text-[13px] font-semibold text-text";

const initials = (name?: string | null) =>
  (name ?? "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "—";

const CancelModal = ({ order, open, onClose, onCancel, isLoading, awaitingApproval }: Props) => {
  const { t, i18n } = useTranslation(["orders", "common"]);
  const approvals = usePendingExtraCostApprovals();
  const ids = useId();
  const [reason, setReason] = useState<CancelReason | "">("");
  const [comment, setComment] = useState("");
  const [extraCost, setExtraCost] = useState(0);
  const [proof, setProof] = useState<File | null>(null);
  const [proofError, setProofError] = useState("");
  const panelRef = useFocusTrap<HTMLDivElement>(open && Boolean(order), { onEscape: onClose, inertAppRoot: true });

  useEffect(() => {
    if (open) {
      setReason("");
      setComment("");
      setExtraCost(0);
      setProof(null);
      setProofError("");
    }
  }, [open]);

  if (!open || !order || typeof document === "undefined") return null;

  const language = i18n.language;
  const pendingApproval = getActivePendingApproval(approvals, order);
  const orderFlags = order as Order & Record<string, unknown>;
  const proofConditions = Array.isArray(order.market?.expense_proof_conditions)
    ? order.market.expense_proof_conditions
    : [];
  // Bayroq yoki `cancel_any` — avvalgidek; ustiga backend tekshiradigan
  // `cancel_extra_cost` (xarajat yozilganda) va `cancel_zero_total` shartlari.
  const cancelRequiresMedia =
    Boolean(
      orderFlags.cancel_requires_media ??
      orderFlags.cancelRequiresMedia ??
      orderFlags.require_cancel_proof ??
      orderFlags.cancel_proof_required ??
      proofConditions.includes("cancel_any"),
    ) ||
    isProofRequiredByConditions(proofConditions, {
      action: "cancel",
      extraCost: Number(extraCost) || 0,
      totalPrice: toKnownAmount(order.total_price),
    });
  const isProofMissing = cancelRequiresMedia && !proof;
  const commentRequired = cancelReasonNeedsComment(reason);
  const reasonReady = isCancelReasonComplete(reason, comment);

  const handleSubmit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!reasonReady || reason === "") return;
    if (cancelRequiresMedia && !proof) {
      setProofError(t("mediaProofRequired"));
      return;
    }
    onCancel(order.id, { reason, comment, extraCost, ...(proof ? { proof } : {}) });
  };

  const handleProofChange = (file?: File) => {
    setProofError("");
    if (!file) {
      setProof(null);
      return;
    }
    if (file.size > MAX_PROOF_SIZE_BYTES) {
      setProof(null);
      setProofError(t("mediaProofTooLarge", { size: MAX_PROOF_SIZE_MB }));
      return;
    }
    setProof(file);
  };

  const deliverLabel =
    order.where_deliver === "address" ? t("deliveryToHome") : order.where_deliver === "center" ? t("deliveryToCenter") : "";
  const subtitle = [`№${order.id}`, order.market?.name, deliverLabel].filter(Boolean).join(" · ");
  const id = (suffix: string) => `${ids}-${suffix}`;

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-overlay p-6 max-md:items-end max-md:p-0">
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id("title")}
        aria-describedby={id("desc")}
        tabIndex={-1}
        className="relative flex max-h-[calc(100dvh-48px)] w-full max-w-[540px] flex-col gap-4 rounded-[20px] border border-border bg-raised p-6 shadow-xl outline-none max-md:max-h-[92dvh] max-md:max-w-full max-md:rounded-b-none max-md:px-4 max-md:pb-6 max-md:pt-3"
      >
        <span aria-hidden="true" className="mx-auto -mb-1 h-1 w-10 flex-none rounded-full bg-border-strong md:hidden" />

        {/* Sarlavha */}
        <div className="flex items-center gap-3">
          <span className="inline-flex size-10 flex-none items-center justify-center rounded-full bg-danger-soft text-danger-fg">
            <CircleX className="size-5" aria-hidden="true" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h2 id={id("title")} className="text-lg font-semibold text-text">
              {t("cancelOrder")}
            </h2>
            <p id={id("desc")} className="truncate text-[13px] text-text-muted">
              {subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close", { ns: "common" })}
            className="-mr-2 -mt-1 inline-flex size-8 flex-none items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-sunken hover:text-text focus-visible:outline-2 focus-visible:outline-action max-md:size-11"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        {/* Tana */}
        <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 pb-0.5">
          {awaitingApproval ? (
            <ExtraCostPendingAlert amount={pendingApproval?.amount ?? extraCost} action={pendingApproval?.action} />
          ) : (
            <>
              {pendingApproval ? <ExtraCostSentAlert approval={pendingApproval} /> : null}

              <div role="group" aria-label={t("customer")} className="flex items-center gap-3 rounded-xl bg-sunken px-4 py-3 text-sm">
                <span className="inline-flex size-10 flex-none items-center justify-center rounded-full bg-brand text-[13px] font-bold text-surface">
                  {initials(order.customer?.name)}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate font-semibold text-text">{order.customer?.name ?? "—"}</span>
                  <span className="flex flex-wrap gap-x-3 text-[13px] text-text-muted">
                    {order.customer?.phone_number ? (
                      <span className="whitespace-nowrap">{order.customer.phone_number}</span>
                    ) : null}
                    {order.district?.name ? <span className="whitespace-nowrap">{order.district.name}</span> : null}
                  </span>
                </div>
                <div className="flex flex-none flex-col gap-0.5 text-right">
                  <span className="text-xs text-text-muted">{t("sumLabel")}</span>
                  <span className="whitespace-nowrap font-semibold text-text">
                    {formatMoneyLocalized(order.total_price, { language })}
                  </span>
                </div>
              </div>

              <form id={id("form")} noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
                {/*
                  «To'langan summa» YO'Q (uguUEhin): bekor qilingan buyurtmada
                  to'lov bo'lmaydi — backend `paidAmount > 0` ni 400 bilan rad etadi.
                */}
                <div className="flex flex-col gap-2">
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <label className={LABEL} htmlFor={id("extra")}>
                      {t("extraCost")}
                    </label>
                    <input
                      id={id("extra")}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={extraCost}
                      onChange={(e) => setExtraCost(Number(e.target.value))}
                      aria-describedby={extraCost > 0 ? id("extra-note") : undefined}
                      className={INPUT}
                      placeholder="0"
                    />
                  </div>
                  {extraCost > 0 ? <ExtraCostNoticeAlert id={id("extra-note")} /> : null}
                </div>

                {/* Sabab — yopiq ro'yxat, majburiy */}
                <div className="flex min-w-0 flex-col gap-1.5">
                  <label className={LABEL} htmlFor={id("reason")}>
                    {t("cancelReasonLabel")} <span className="text-danger-fg">*</span>
                  </label>
                  <div className="relative">
                    <select
                      id={id("reason")}
                      value={reason}
                      required
                      aria-required="true"
                      aria-describedby={id("reason-hint")}
                      onChange={(e) => setReason(e.target.value as CancelReason | "")}
                      className={`${INPUT} cursor-pointer appearance-none pr-10 ${reason === "" ? "text-text-subtle" : ""}`}
                    >
                      <option value="" disabled>
                        {t("cancelReasonPlaceholder")}
                      </option>
                      {CANCEL_REASONS.map((value) => (
                        <option key={value} value={value} className="text-text">
                          {t(REASON_LABEL_KEYS[value])}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-text-subtle"
                      aria-hidden="true"
                    />
                  </div>
                  <span id={id("reason-hint")} className="text-xs text-text-muted">
                    {t("cancelReasonHint")}
                  </span>
                </div>

                <div className="flex min-w-0 flex-col gap-1.5">
                  <label className={LABEL} htmlFor={id("note")}>
                    {t("note")} {commentRequired ? <span className="text-danger-fg">*</span> : null}
                  </label>
                  <textarea
                    id={id("note")}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={2}
                    required={commentRequired}
                    aria-required={commentRequired || undefined}
                    aria-invalid={commentRequired && comment.trim() === "" ? true : undefined}
                    aria-describedby={commentRequired ? id("note-hint") : undefined}
                    className={`${INPUT} h-auto min-h-[72px] resize-y py-2.5`}
                    placeholder={t("cancelReason")}
                  />
                  {commentRequired ? (
                    <span id={id("note-hint")} className="text-xs font-semibold text-danger-fg">
                      {t("cancelReasonOtherHint")}
                    </span>
                  ) : null}
                </div>

                <div className="flex min-w-0 flex-col gap-1.5">
                  <span id={id("proof-label")} className={LABEL}>
                    {t("mediaProof")} {cancelRequiresMedia ? <span className="text-danger-fg">*</span> : null}
                  </span>
                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border border-dashed bg-sunken p-3 focus-within:outline-2 focus-within:outline-action ${
                      proofError ? "border-danger" : "border-border-strong"
                    }`}
                  >
                    <span
                      className={`inline-flex size-8 flex-none items-center justify-center rounded-full ${
                        proof ? "bg-success-soft text-success-fg" : "bg-surface text-text-muted"
                      }`}
                    >
                      {proof ? (
                        <CircleCheck className="size-4" aria-hidden="true" />
                      ) : (
                        <ImagePlus className="size-4" aria-hidden="true" />
                      )}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-sm font-semibold text-text">{proof ? proof.name : t("mediaProofUpload")}</span>
                      <span className="text-xs text-text-muted">
                        {proof
                          ? `${formatNumberLocalized(proof.size / (1024 * 1024), { language, fractionDigits: 1 })} MB · ${t("mediaProofHint", { size: MAX_PROOF_SIZE_MB })}`
                          : t("mediaProofHint", { size: MAX_PROOF_SIZE_MB })}
                      </span>
                    </span>
                    {proof ? (
                      <span aria-hidden="true" className={`${BTN_SECONDARY} h-8 px-3 text-[13px] max-md:min-h-11`}>
                        {t("mediaProofReplace")}
                      </span>
                    ) : null}
                    <input
                      type="file"
                      accept="image/*,video/*"
                      className="sr-only"
                      aria-labelledby={id("proof-label")}
                      aria-describedby={cancelRequiresMedia || proofError ? id("proof-hint") : undefined}
                      aria-required={cancelRequiresMedia || undefined}
                      onChange={(event) => handleProofChange(event.target.files?.[0])}
                    />
                  </label>
                  {proofError ? (
                    <span id={id("proof-hint")} className="text-xs font-semibold text-danger-fg">
                      {proofError}
                    </span>
                  ) : cancelRequiresMedia ? (
                    <span id={id("proof-hint")} className="text-xs text-text-muted">
                      {t("cancelMediaProofRequiredNotice")}
                    </span>
                  ) : null}
                </div>
              </form>
            </>
          )}
        </div>

        {/* Pastki qism */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4 max-md:[&>button]:flex-1">
          {/* Nega «Bekor qilish» o'chiq — tugma yonida (uzun matn tugmaga sig'maydi). */}
          {!awaitingApproval && isProofMissing ? (
            <p className="mr-auto min-w-0 text-[13px] text-text-muted max-md:w-full">{t("cancelMediaProofRequiredNotice")}</p>
          ) : null}
          <button type="button" onClick={onClose} className={BTN_SECONDARY}>
            {awaitingApproval ? t("close", { ns: "common" }) : t("back", { ns: "common" })}
          </button>
          {awaitingApproval ? null : (
            <button
              type="submit"
              form={id("form")}
              disabled={isLoading || isProofMissing || !reasonReady}
              aria-busy={isLoading || undefined}
              className={BTN_DANGER}
            >
              {isLoading ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <CircleX className="size-4" aria-hidden="true" />
              )}
              {t("cancelOrderAction")}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default memo(CancelModal);
