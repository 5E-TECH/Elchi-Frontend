// dizayn-v2: market-dashboard-extra-cost-approvals
import { Check, Clock, ReceiptText, ShieldCheck, X } from "lucide-react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { ExtraCostApproval } from "../../../entities/orders";
import { getUserRoleLabelKey } from "../../../entities/user/lib/role";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { Button, Card, SkeletonLines } from "../../../shared/ui/primitives";

export interface ExtraCostApprovalsCardProps {
  approvals: ExtraCostApproval[];
  loading: boolean;
  error: boolean;
  approvingId: string;
  rejectingId: string;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

/** Buyurtma raqami API'da yo'q (`order_id` — ichki id): qisqa ko'rinish, oxirgi 6 belgi (§6). */
const shortOrderId = (orderId: string) => (orderId.length > 6 ? orderId.slice(-6) : orderId);

/**
 * «QO'SHIMCHA XARAJAT TASDIQLARI» (market, faqat kutilayotganlar bo'lsa): har so'rov — amal, buyurtma,
 * vaqt, so'ralgan summa, tasdiq oqibati, so'rovchi (rol), isbotlar; «Tasdiqlash» / «Rad etish».
 * Saqlanadigan xulq: yuborilayotgan so'rovda ikkala tugma o'chiq, «Tasdiqlanmoqda»; xato — `notify` (sahifada).
 * Xato yoki bo'sh — panel ko'rinmaydi (hozirgidek). Tasdiq oynasi yo'q (ega savoli 6 sukuti).
 */
const ExtraCostApprovalsCard = ({
  approvals,
  loading,
  error,
  approvingId,
  rejectingId,
  onApprove,
  onReject,
}: ExtraCostApprovalsCardProps) => {
  const { t, i18n } = useTranslation("dashboard");
  const { t: tUsers } = useTranslation("users");
  const language = i18n.language;

  if (loading) {
    return (
      <Card divided={false} aria-busy="true" title={t("market.extra_cost_approvals")}>
        <SkeletonLines lines={4} />
      </Card>
    );
  }
  if (error || approvals.length === 0) return null;

  const actionLabel = (action: ExtraCostApproval["action"]) =>
    action === "cancel"
      ? t("market.extra_cost_cancel")
      : action === "partly_sell"
        ? t("market.extra_cost_partly_sell")
        : t("market.extra_cost_sell");
  // fix3b M3: tasdiq AYNAN shu amalni bajaradi — market nimani tasdiqlayotganini aniq ko'rsin.
  const approveConsequence = (action: ExtraCostApproval["action"]) =>
    action === "cancel"
      ? t("market.extra_cost_on_approve_cancel")
      : action === "partly_sell"
        ? t("market.extra_cost_on_approve_partly_sell")
        : t("market.extra_cost_on_approve_sell");

  return (
    <Card as="section" padding="none" aria-labelledby="extra-cost-title" className="overflow-hidden">
      <div className="flex min-w-0 flex-wrap items-center gap-3 border-b border-border bg-warning-soft px-5 py-4 max-md:px-4">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-surface text-warning-fg">
          <Clock size={20} aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id="extra-cost-title" className="text-base font-bold text-text">
            {t("market.extra_cost_approvals")}
          </h2>
          <p className="text-[13px] font-semibold text-warning-fg">
            {t("market.extra_cost_approvals_count", { count: approvals.length })}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(440px,100%),1fr))] gap-3 p-5 max-md:p-4">
        {approvals.map((approval) => {
          const isApproving = approvingId === approval.id;
          const isRejecting = rejectingId === approval.id;
          const busy = isApproving || isRejecting;
          const proofs = approval.proof_file_keys?.length ?? 0;
          const title = actionLabel(approval.action);
          const orderNo = shortOrderId(String(approval.order_id ?? ""));
          return (
            <article
              key={approval.id}
              aria-label={t("v2Market.approval.aria", { action: title, order: orderNo })}
              className="flex min-w-0 flex-col gap-3 rounded-xl bg-sunken p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[.04em] text-text-muted">
                    <ReceiptText size={16} aria-hidden="true" />
                    {title}
                  </span>
                  <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="text-sm font-semibold text-text">{t("v2Market.approval.order", { id: orderNo })}</span>
                    {approval.createdAt ? (
                      <span className="whitespace-nowrap text-xs text-text-muted">{formatDateTimeLocalized(approval.createdAt)}</span>
                    ) : null}
                  </span>
                </div>
                <div className="flex flex-none flex-col items-end gap-0.5">
                  <span className="whitespace-nowrap text-base font-bold text-text">
                    {formatMoneyLocalized(approval.amount, { language })}
                  </span>
                  <span className="text-xs text-text-muted">{t("v2Market.approval.requested")}</span>
                </div>
              </div>
              <div
                data-testid={`approval-consequence-${approval.id}`}
                className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2 text-[13px] font-semibold text-text"
              >
                <ShieldCheck size={16} aria-hidden="true" className="shrink-0 text-text-muted" />
                {approveConsequence(approval.action)}
              </div>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <dl className="m-0 grid min-w-0 grid-cols-[auto_auto] gap-x-2.5 gap-y-0.5 text-[13px]">
                  <dt className="text-text-muted">{t("market.extra_cost_requester")}</dt>
                  <dd className="m-0 text-text">
                    {approval.requested_by_role ? tUsers(getUserRoleLabelKey(approval.requested_by_role)) : "—"}
                  </dd>
                  <dt className="text-text-muted">{t("market.extra_cost_proofs")}</dt>
                  <dd className="m-0 font-semibold text-text">
                    {proofs > 0
                      ? t("v2Charts.countTa", { value: formatNumberLocalized(proofs, { language }) })
                      : t("v2Market.approval.noProofs")}
                  </dd>
                </dl>
                <div className="flex flex-wrap gap-2 max-md:w-full max-md:[&>*]:flex-1">
                  <Button
                    variant="success"
                    size="sm"
                    leftIcon={Check}
                    disabled={busy}
                    onClick={() => onApprove(approval.id)}
                  >
                    {isApproving ? t("market.extra_cost_approving") : t("market.extra_cost_approve")}
                  </Button>
                  <Button
                    variant="danger-soft"
                    size="sm"
                    leftIcon={X}
                    disabled={busy}
                    onClick={() => onReject(approval.id)}
                  >
                    {isRejecting ? t("market.extra_cost_rejecting") : t("market.extra_cost_reject")}
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </Card>
  );
};

export default memo(ExtraCostApprovalsCard);
