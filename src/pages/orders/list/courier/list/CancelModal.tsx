// dizayn-v2: courier-orders-cancel-dialog, courier-orders-action-approval-pending, manager-orders-cancel-dialog
import { memo, useId, useState, type FormEvent } from "react";
import { CircleX, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, Dialog, Field, Select, TextInput, type SelectOption } from "../../../../../shared/ui/primitives";
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
import { OrderCustomerSummary, ProofField } from "./OrderActionParts";
import {
  getDeliveryLabelKey,
  isProofFileTooLarge,
  MAX_PROOF_SIZE_MB,
  toAmount,
  type ActionOrder,
  type OrderActionVariant,
} from "./orderActionModel";
import { useActionDialogSession, useApprovalStateFocus } from "./useActionDialogSession";

/**
 * BUYURTMANI BEKOR QILISH — kuryer, menejer va buyurtma tafsilotida bitta oyna (`Dialog`: telefonda
 * pastki varaqa).
 *
 * Sabab YOPIQ RO'YXATDAN majburiy (GNWDKvmZ): tanlanmaguncha «Bekor qilish»
 * o'chiq; «Boshqa» bo'lsa izoh ham majburiy. Backend ham shuni tekshiradi
 * (sababsiz — 400), lekin operator xatoni bosgandan keyin emas, oldin ko'radi.
 *
 * Maketlar: `courier-orders-cancel-dialog` (`variant="courier"`, sukut) va
 * `manager-orders-cancel-dialog` (`variant="manager"`). Ikkalasidan farqlar:
 *  • «To'langan summa» YO'Q (uguUEhin) — bekor qilingan buyurtmada to'lov bo'lmaydi, backend
 *    `paidAmount > 0` ni 400 bilan rad etadi;
 *  • «Sabab» (yopiq ro'yxat) maketda yo'q — forma maydoni naqshida (`tizim-states-forms`), «To'langan
 *    summa» bo'shatgan joyda, «Qo'shimcha xarajat» yonida.
 */

type Props = {
  order: ActionOrder | null;
  open: boolean;
  onClose: () => void;
  onCancel: (orderId: string, payload: CancelOrderPayload) => void;
  isLoading?: boolean;
  /** Yuborilgan amal market tasdig'iga tushdi — forma o'rniga holat ko'rsatiladi. */
  awaitingApproval?: boolean;
  /** Maket varianti (sukut `courier`; menejer ro'yxati — `manager`). */
  variant?: OrderActionVariant;
};

const REASON_LABEL_KEYS: Record<CancelReason, string> = {
  CUSTOMER_NO_ANSWER: "cancelReasons.CUSTOMER_NO_ANSWER",
  CUSTOMER_REFUSED: "cancelReasons.CUSTOMER_REFUSED",
  WRONG_ADDRESS: "cancelReasons.WRONG_ADDRESS",
  DEFECTIVE_PRODUCT: "cancelReasons.DEFECTIVE_PRODUCT",
  PRICE_DISPUTE: "cancelReasons.PRICE_DISPUTE",
  OTHER: "cancelReasons.OTHER",
};

type CancelDialogProps = Omit<Props, "order"> & { order: ActionOrder; variant: OrderActionVariant };

const CancelDialog = ({
  order,
  open,
  onClose,
  onCancel,
  isLoading = false,
  awaitingApproval = false,
  variant,
}: CancelDialogProps) => {
  const { t } = useTranslation(["orders", "common"]);
  const approvals = usePendingExtraCostApprovals();
  const ids = useId();
  const [reason, setReason] = useState<CancelReason | "">("");
  const [comment, setComment] = useState("");
  const [extraCost, setExtraCost] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [proofError, setProofError] = useState("");
  const approvalCloseRef = useApprovalStateFocus(awaitingApproval);

  const isManager = variant === "manager";
  const extraCostAmount = toAmount(extraCost);
  const pendingApproval = getActivePendingApproval(approvals, order);
  const orderFlags = order as ActionOrder & Record<string, unknown>;
  const proofConditions = Array.isArray(order.market?.expense_proof_conditions)
    ? order.market.expense_proof_conditions
    : [];
  // Bayroq yoki `cancel_any` — avvalgidek; ustiga backend tekshiradigan
  // `cancel_extra_cost` (xarajat yozilganda) va `cancel_zero_total` shartlari.
  const cancelFlagRequired = Boolean(
    orderFlags.cancel_requires_media ??
    orderFlags.cancelRequiresMedia ??
    orderFlags.require_cancel_proof ??
    orderFlags.cancel_proof_required ??
    proofConditions.includes("cancel_any"),
  );
  const cancelRequiresMedia =
    cancelFlagRequired ||
    isProofRequiredByConditions(proofConditions, {
      action: "cancel",
      extraCost: extraCostAmount,
      totalPrice: toKnownAmount(order.total_price),
    });
  // Majburiylik faqat yozilgan xarajatdan kelsa — maketdagi aniq sabab («… qo'shimcha xarajat bilan …»).
  const requiredByExtraCost =
    cancelRequiresMedia &&
    !cancelFlagRequired &&
    !isProofRequiredByConditions(proofConditions, {
      action: "cancel",
      extraCost: 0,
      totalPrice: toKnownAmount(order.total_price),
    });
  const isProofMissing = cancelRequiresMedia && !proof;
  const commentRequired = cancelReasonNeedsComment(reason);
  const reasonReady = isCancelReasonComplete(reason, comment);
  const showExtraNotice = extraCostAmount > 0;

  const reasonOptions: SelectOption<CancelReason>[] = CANCEL_REASONS.map((value) => ({
    value,
    label: t(REASON_LABEL_KEYS[value]),
  }));

  const handleSubmit = (event?: FormEvent) => {
    event?.preventDefault();
    if (isLoading || !reasonReady || reason === "") return;
    if (cancelRequiresMedia && !proof) {
      setProofError(t("mediaProofRequired"));
      return;
    }
    onCancel(order.id, { reason, comment, extraCost: extraCostAmount, ...(proof ? { proof } : {}) });
  };

  const handleProofChange = (file?: File) => {
    setProofError("");
    if (!file) {
      setProof(null);
      return;
    }
    if (isProofFileTooLarge(file)) {
      setProof(null);
      setProofError(t("mediaProofTooLarge", { size: MAX_PROOF_SIZE_MB }));
      return;
    }
    setProof(file);
  };

  const deliveryKey = getDeliveryLabelKey(order.where_deliver);
  const subtitle = [`№${order.id}`, order.market?.name, deliveryKey ? t(deliveryKey) : null].filter(Boolean).join(" · ");
  const id = (suffix: string) => `${ids}-${suffix}`;
  const panelWidth = isManager ? "md:max-w-[520px]" : "md:max-w-[540px]";

  // ── Market tasdig'i kutilmoqda (maket `courier-orders-action-approval-pending`) ──────────────
  if (awaitingApproval) {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        size="md"
        className={isManager ? undefined : "md:max-w-[500px]"}
        title={t("extraCostApprovalPendingTitle")}
        description={subtitle}
        icon={Clock}
        iconTone="warning"
        footer={
          <Button ref={approvalCloseRef} variant="secondary" className="md:min-w-[120px]" onClick={onClose}>
            {t("close", { ns: "common" })}
          </Button>
        }
      >
        <OrderCustomerSummary order={order} variant={variant} />
        <ExtraCostPendingAlert
          amount={pendingApproval?.amount ?? extraCostAmount}
          action={pendingApproval?.action}
          requestedAt={pendingApproval?.requestedAt}
        />
      </Dialog>
    );
  }

  const proofHint = !cancelRequiresMedia
    ? undefined
    : requiredByExtraCost
      ? t("cancelExtraCostProofHint")
      : t("cancelMediaProofRequiredNotice");

  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={isLoading}
      // Ochilganda fokus panelda (sarlavha o'qiladi): telefonda klaviatura o'zi ochilib, varaqani yopmasin.
      initialFocus="panel"
      size="md"
      className={panelWidth}
      title={t("cancelOrder")}
      description={subtitle}
      icon={CircleX}
      iconTone="danger"
      onSubmit={handleSubmit}
      formProps={{ noValidate: true }}
      footer={
        // Bitta o'ram: telefonda sabab o'z qatorida, tugmalar teng enli ikkinchi qatorda.
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 max-md:[&>button]:flex-1">
          {/* Nega «Bekor qilish» o'chiq — tugma yonida (uzun matn tugmaga sig'maydi). */}
          {isProofMissing ? (
            <p
              id={id("block")}
              className="m-0 mr-auto min-w-0 text-[13px] text-text-muted max-md:basis-full max-md:text-center"
            >
              {t("cancelMediaProofRequiredNotice")}
            </p>
          ) : null}
          <Button variant="secondary" disabled={isLoading} onClick={onClose}>
            {t("back", { ns: "common" })}
          </Button>
          <Button
            type="submit"
            variant="danger"
            leftIcon={CircleX}
            loading={isLoading}
            disabled={isProofMissing || !reasonReady}
            aria-describedby={isProofMissing ? id("block") : undefined}
          >
            {t("cancelOrderAction")}
          </Button>
        </div>
      }
    >
      {pendingApproval ? <ExtraCostSentAlert approval={pendingApproval} /> : null}
      <OrderCustomerSummary order={order} variant={variant} />

      <div className="flex min-w-0 flex-col gap-2">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] items-start gap-4">
          <Field label={t("extraCost")}>
            <TextInput
              mode="money"
              value={extraCost}
              onValueChange={setExtraCost}
              placeholder="0"
              aria-describedby={showExtraNotice ? id("extra-note") : undefined}
            />
          </Field>
          {/* Sabab — yopiq ro'yxat, majburiy */}
          <Field label={t("cancelReasonLabel")} labelAs="span" required hint={t("cancelReasonHint")}>
            <Select<CancelReason>
              options={reasonOptions}
              value={reason === "" ? null : reason}
              onChange={(value) => setReason(value ?? "")}
              placeholder={t("cancelReasonPlaceholder")}
              listLabel={t("cancelReasonLabel")}
            />
          </Field>
        </div>
        {showExtraNotice ? <ExtraCostNoticeAlert id={id("extra-note")} /> : null}
      </div>

      <Field
        label={t("note")}
        required={commentRequired}
        error={commentRequired && comment.trim() === "" ? t("cancelReasonOtherHint") : undefined}
      >
        <TextInput
          multiline
          rows={2}
          value={comment}
          onValueChange={setComment}
          placeholder={t("cancelReason")}
        />
      </Field>

      <ProofField
        variant={variant}
        file={proof}
        required={cancelRequiresMedia}
        hint={proofHint}
        error={proofError || undefined}
        onFileChange={handleProofChange}
      />
    </Dialog>
  );
};

const CancelModal = ({ order, open, variant = "courier", ...rest }: Props) => {
  const session = useActionDialogSession(open, order);
  if (!session.order) return null;
  return <CancelDialog key={session.session} {...rest} order={session.order} open={session.open} variant={variant} />;
};

export default memo(CancelModal);
