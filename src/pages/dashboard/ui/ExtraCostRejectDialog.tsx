// dizayn-v2: (maket yo'q) courier-orders-cancel-dialog
import { useState, type FormEvent } from "react";
import { CircleX } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ExtraCostApproval } from "../../../entities/orders";
import { extraCostOrderNumber } from "../../../entities/orders/extraCostApprovalView";
import {
  EXTRA_COST_REJECT_REASONS,
  type ExtraCostRejectReason,
} from "../../../entities/orders/extraCostDecision";
import { formatMoneyLocalized } from "../../../shared/lib/formatMoney";
import { Button, Dialog, Field, Select, TextInput, type SelectOption } from "../../../shared/ui/primitives";

/** Backend `ExtraCostApprovalDecisionDto.comment` — `@MaxLength(500)`. */
const COMMENT_MAX = 500;

export type ExtraCostRejectPayload = { reason: ExtraCostRejectReason; comment?: string };

type Props = {
  approval: ExtraCostApproval;
  /** So'rov ko'rinishidagi amal nomi («Sotishdagi qo'shimcha xarajat»). */
  actionLabel: string;
  open: boolean;
  pending: boolean;
  onClose: () => void;
  /** Yopilish harakati tugagach (holatni tozalash uchun). */
  onExited?: () => void;
  onSubmit: (payload: ExtraCostRejectPayload) => void;
};

/**
 * QO'SHIMCHA XARAJATNI RAD ETISH — sabab YOPIQ ro'yxatdan (DuST9k8j: `TOO_EXPENSIVE | NOT_AGREED |
 * NO_PROOF | DUPLICATE`, boshqasi → 400), izoh ixtiyoriy.
 *
 * Maket yo'q: `market-dashboard-extra-cost-approvals` da «Rad etish» to'g'ridan-to'g'ri tugma. Sabab
 * ro'yxati karta talabi (backend yopiq ro'yxat) — oyna eng yaqin namunadan: `courier-orders-cancel-dialog`
 * (sabab `Select` + «Izoh», telefonda pastki varaqa).
 */
export const ExtraCostRejectDialog = ({ approval, actionLabel, open, pending, onClose, onExited, onSubmit }: Props) => {
  const { t, i18n } = useTranslation("dashboard");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const [reason, setReason] = useState<ExtraCostRejectReason | null>(null);
  const [comment, setComment] = useState("");

  const reasonLabel = t("market.extra_cost_reject_reason");
  const options: SelectOption<ExtraCostRejectReason>[] = EXTRA_COST_REJECT_REASONS.map((value) => ({
    value,
    label: t(`market.extra_cost_reject_reasons.${value}`),
  }));

  const handleSubmit = (event?: FormEvent) => {
    event?.preventDefault();
    if (pending || !reason) return;
    const note = comment.trim();
    onSubmit({ reason, ...(note ? { comment: note } : {}) });
  };

  const description = [
    `№${extraCostOrderNumber(approval)}`,
    formatMoneyLocalized(approval.amount, { language }),
    actionLabel,
  ].join(" · ");

  return (
    <Dialog
      open={open}
      onClose={onClose}
      onExited={onExited}
      busy={pending}
      size="sm"
      title={t("market.extra_cost_reject_title")}
      description={description}
      icon={CircleX}
      iconTone="danger"
      onSubmit={handleSubmit}
      formProps={{ noValidate: true }}
      footer={
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 max-md:[&>button]:flex-1">
          <Button variant="secondary" disabled={pending} onClick={onClose}>
            {t("common:cancel")}
          </Button>
          <Button
            type="submit"
            variant="danger"
            leftIcon={CircleX}
            loading={pending}
            loadingText={t("market.extra_cost_rejecting")}
            disabled={!reason}
          >
            {t("market.extra_cost_reject")}
          </Button>
        </div>
      }
    >
      <Field label={reasonLabel} labelAs="span" required>
        <Select<ExtraCostRejectReason>
          options={options}
          value={reason}
          onChange={(value) => setReason(value)}
          placeholder={t("market.extra_cost_reject_reason_placeholder")}
          listLabel={reasonLabel}
        />
      </Field>
      <Field label={t("market.extra_cost_reject_comment")} optional>
        <TextInput
          multiline
          rows={2}
          maxLength={COMMENT_MAX}
          value={comment}
          onValueChange={setComment}
          placeholder={t("market.extra_cost_reject_comment_placeholder")}
        />
      </Field>
      <p className="m-0 text-[13px] text-text-muted">{t("market.extra_cost_reject_note")}</p>
    </Dialog>
  );
};
