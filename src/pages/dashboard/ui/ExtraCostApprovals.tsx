// dizayn-v2: market-dashboard-extra-cost-approvals
import { memo, useId, useState, type ReactNode } from "react";
import { ArrowRight, CircleCheck, CircleX, Clock, Lock, Receipt, TimerReset } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import type { RootState } from "../../../app/config/store";
import { useOrders, type ExtraCostApproval, type ExtraCostApprovalsResponse } from "../../../entities/orders";
import { extraCostOrderNumber, extraCostRequesterName } from "../../../entities/orders/extraCostApprovalView";
import { canDecideExtraCost, isExtraCostAlreadyDecidedError } from "../../../entities/orders/extraCostDecision";
import { getActionErrorMessage } from "../../../shared/lib/actionError";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatMoneyLocalized } from "../../../shared/lib/formatMoney";
import { notify } from "../../../shared/lib/notify";
import {
  Button,
  Card,
  ErrorState,
  QueryBoundary,
  Skeleton,
  SKELETON_DELAY_MS,
  useConfirm,
  useDelayedFlag,
} from "../../../shared/ui/primitives";
import { ExtraCostRejectDialog, type ExtraCostRejectPayload } from "./ExtraCostRejectDialog";

/**
 * «QO'SHIMCHA XARAJAT TASDIQLARI» — market dashboardidagi v2 blok (maket
 * `market-dashboard-extra-cost-approvals`). Sahifa oralig'i — `MarketDashboardPage` ning `gap` i (o'z `margin` i yo'q).
 *
 * Kuryer/menejer sotish yoki bekor qilishda qo'shimcha xarajat yozsa, amal market tasdig'iga tushadi
 * (DuST9k8j, 1tnpaIqd). Market egasi shu yerda tasdiqlaydi (pul amali — `useConfirm`) yoki sabab
 * bilan rad etadi. Xuddi shu so'rov egasining Telegram'iga ham (✅/❌) boradi: ro'yxat 30 s da va
 * oynaga qaytilganda yangilanadi, boshqa joyda hal qilingan so'rovga qaror — «allaqachon hal
 * qilingan» (xato emas) va ro'yxat yangilanadi.
 *
 * Holatlar: kutilayotgan so'rov yo'q — blok umuman chizilmaydi (maket `market-dashboard-home`);
 * yuklanish — 400 ms dan keyin skelet; xato — karta ichida `ErrorState` + «Qayta urinish».
 * `market_operator` (qaror huquqi yo'q) ro'yxatni faqat ko'radi.
 *
 * Raqam — `order_number` («№EL-100076», yorliqdagi; havola ichki `order_id` bo'yicha), so'rovchi — ismi va roli
 * («Jasur Tursunov · Kuryer», 0Ngp09FG). Eski javobda yoki ism olinmasa zaxira: `№order_id`, `#user_id · rol`.
 * Maketdan farq: «Rad etish» sabab oynasini ochadi (`ExtraCostRejectDialog`).
 */

const ACTION_LABEL_KEYS: Record<ExtraCostApproval["action"], string> = {
  sell: "market.extra_cost_sell",
  partly_sell: "market.extra_cost_partly_sell",
  cancel: "market.extra_cost_cancel",
};

const CONSEQUENCE_KEYS: Record<ExtraCostApproval["action"], string> = {
  sell: "market.extra_cost_on_approve_sell",
  partly_sell: "market.extra_cost_on_approve_partly_sell",
  cancel: "market.extra_cost_on_approve_cancel",
};

const toList = (response: ExtraCostApprovalsResponse | null | undefined): ExtraCostApproval[] =>
  Array.isArray(response?.data) ? response.data : [];

/** Telefonda tugma md o'lchamida (maket: 2 ustunli katak, 44 px). */
const PHONE_BUTTON = "max-md:h-10 max-md:rounded-[10px] max-md:px-4 max-md:text-sm";

type CardShellProps = {
  title: string;
  count?: string;
  hint?: string | null;
  children: ReactNode;
};

/** Karta: ogohlantirish fonidagi sarlavha (ikonka, son) + tana (`.el-card` + `.el-card-head`). */
const ApprovalsCard = ({ title, count, hint, children }: CardShellProps) => {
  const titleId = useId();
  return (
    <Card padding="none" aria-labelledby={titleId} className="overflow-hidden">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-warning-soft px-5 py-4">
        <div className="flex min-w-0 flex-[1_1_auto] items-center gap-3">
          <span className="inline-flex size-10 flex-none items-center justify-center rounded-[10px] bg-surface text-warning-fg">
            <Clock size={20} aria-hidden="true" />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 id={titleId} className="text-base font-bold text-text">
              {title}
            </h2>
            {count ? <p className="text-[13px] font-semibold text-warning-fg">{count}</p> : null}
          </div>
        </div>
        {hint ? (
          <p className="flex items-center gap-1.5 text-[13px] text-text-muted">
            <Lock size={16} className="flex-none" aria-hidden="true" />
            {hint}
          </p>
        ) : null}
      </div>
      {children}
    </Card>
  );
};

/** Skelet — faqat 400 ms dan keyin (tez javobda va bo'sh ro'yxatda joy egallamaydi, sakrash yo'q). */
const ApprovalsSkeleton = ({ title }: { title: string }) => {
  const visible = useDelayedFlag(true, SKELETON_DELAY_MS);
  if (!visible) return null;
  return (
    <ApprovalsCard title={title}>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(440px,100%),1fr))] gap-3 p-5 max-md:p-4">
        <Skeleton shape="block" height={168} className="rounded-xl" />
        <Skeleton shape="block" height={168} className="rounded-xl max-md:hidden" />
      </div>
    </ApprovalsCard>
  );
};

type RowProps = {
  approval: ExtraCostApproval;
  canDecide: boolean;
  approving: boolean;
  rejecting: boolean;
  onApprove: (approval: ExtraCostApproval) => void;
  onReject: (approval: ExtraCostApproval) => void;
};

const ApprovalRow = ({ approval, canDecide, approving, rejecting, onApprove, onReject }: RowProps) => {
  const { t, i18n } = useTranslation("dashboard");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const actionLabel = t(ACTION_LABEL_KEYS[approval.action] ?? ACTION_LABEL_KEYS.sell);
  const proofCount = approval.proof_file_keys?.length ?? 0;
  const role = approval.requested_by_role ? String(approval.requested_by_role).toLowerCase() : "";
  const orderNumber = extraCostOrderNumber(approval);
  const requesterName = extraCostRequesterName(approval);
  const busy = approving || rejecting;

  return (
    <li
      aria-label={t("market.extra_cost_item_label", { action: actionLabel, id: orderNumber })}
      className="flex min-w-0 flex-col gap-3 rounded-xl bg-sunken p-4 max-md:rounded-none max-md:bg-transparent max-md:not-first:border-t max-md:not-first:border-border"
    >
      {/* Desktop: chapda amal + №/vaqt, o'ngda summa. Telefon: amal alohida qatorda, ostida №/vaqt + summa. */}
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 max-md:gap-y-3">
        <span className="col-start-1 row-start-1 flex min-w-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-[.05em] text-text-muted max-md:col-span-2">
          <Receipt size={16} className="flex-none" aria-hidden="true" />
          {actionLabel}
        </span>
        <div className="col-start-1 row-start-2 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 max-md:flex-col max-md:items-start max-md:gap-0.5">
          <Link
            to={`/orders/edit/${approval.order_id}`}
            className="text-sm font-semibold text-action-fg hover:underline max-md:-my-3 max-md:flex max-md:min-h-11 max-md:items-center"
          >
            №{orderNumber}
          </Link>
          {approval.createdAt ? (
            <span className="whitespace-nowrap text-xs text-text-muted">
              {formatDateTimeLocalized(approval.createdAt, { language })}
            </span>
          ) : null}
          {approval.auto_approve_at ? (
            // 1tnpaIqd (ega qarori): muddat o'tsa so'rov avtomatik tasdiqlanadi — market buni ko'rsin.
            <span
              data-testid={`approval-deadline-${approval.id}`}
              className="flex items-center gap-1 text-xs font-semibold text-warning-fg"
            >
              <TimerReset size={14} className="flex-none" aria-hidden="true" />
              {t("market.extra_cost_auto_at", { time: formatDateTimeLocalized(approval.auto_approve_at, { language }) })}
            </span>
          ) : null}
        </div>
        <div className="col-start-2 row-span-2 row-start-1 flex flex-none flex-col items-end gap-0.5 max-md:row-span-1 max-md:row-start-2">
          <span className="whitespace-nowrap text-base font-bold text-text">
            {formatMoneyLocalized(approval.amount, { language })}
          </span>
          <span className="text-xs text-text-muted">{t("market.extra_cost_requested_amount")}</span>
        </div>
      </div>

      <div
        data-testid={`approval-consequence-${approval.id}`}
        className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2 max-md:bg-sunken max-md:py-2.5"
      >
        <ArrowRight size={16} className="flex-none text-text-muted" aria-hidden="true" />
        <span className="text-[13px] font-semibold text-text">
          {t(CONSEQUENCE_KEYS[approval.action] ?? CONSEQUENCE_KEYS.sell)}
        </span>
      </div>

      <div className="flex min-w-0 flex-wrap items-end justify-between gap-3 max-md:flex-col max-md:items-stretch">
        <dl className="m-0 grid min-w-0 grid-cols-[auto_auto] gap-x-2.5 gap-y-0.5 text-[13px] max-md:grid-cols-[auto_minmax(0,1fr)] max-md:gap-x-3 max-md:gap-y-1">
          <dt className="text-text-muted">{t("market.extra_cost_requester")}</dt>
          <dd className="m-0">
            <span className="font-semibold text-text">{requesterName ?? `#${approval.requested_by_user_id}`}</span>
            {role ? (
              <span className="text-text-muted"> · {t(`market.extra_cost_role.${role}`, { defaultValue: role })}</span>
            ) : null}
          </dd>
          <dt className="text-text-muted">{t("market.extra_cost_proofs")}</dt>
          <dd className="m-0 font-semibold text-text">
            {proofCount > 0
              ? t("market.extra_cost_proofs_count", { count: proofCount })
              : t("market.extra_cost_proofs_none")}
          </dd>
        </dl>
        {canDecide ? (
          <div className="flex flex-wrap gap-2 max-md:grid max-md:grid-cols-2">
            <Button
              variant="success"
              size="sm"
              leftIcon={CircleCheck}
              loading={approving}
              loadingText={t("market.extra_cost_approving")}
              disabled={busy && !approving}
              className={PHONE_BUTTON}
              onClick={() => onApprove(approval)}
            >
              {t("market.extra_cost_approve")}
            </Button>
            <Button
              variant="danger-soft"
              size="sm"
              leftIcon={CircleX}
              loading={rejecting}
              loadingText={t("market.extra_cost_rejecting")}
              disabled={busy && !rejecting}
              className={PHONE_BUTTON}
              onClick={() => onReject(approval)}
            >
              {t("market.extra_cost_reject")}
            </Button>
          </div>
        ) : null}
      </div>
    </li>
  );
};

export const ExtraCostApprovals = memo(() => {
  const { t } = useTranslation("dashboard");
  const role = useSelector((state: RootState) => state.role.role);
  const canDecide = canDecideExtraCost(role);
  const confirm = useConfirm();
  const { useExtraCostApprovals, approveExtraCostApproval, rejectExtraCostApproval } = useOrders();
  const query = useExtraCostApprovals("pending", true);
  // Yopilish harakati davomida mazmun qolsin — so'rov `open: false` bilan saqlanadi.
  const [reject, setReject] = useState<{ approval: ExtraCostApproval; open: boolean } | null>(null);

  const title = t("market.extra_cost_approvals");
  const actionLabel = (approval: ExtraCostApproval) => t(ACTION_LABEL_KEYS[approval.action] ?? ACTION_LABEL_KEYS.sell);

  /** `true` — so'rov boshqa joyda hal qilingan (ro'yxat yangilandi), oyna yopilsin. */
  const handleDecisionError = (error: unknown) => {
    if (isExtraCostAlreadyDecidedError(error)) {
      void query.refetch();
      notify.info(t("market.extra_cost_already_decided"), {
        description: t("market.extra_cost_already_decided_hint"),
      });
      return true;
    }
    const description = getActionErrorMessage(error, t("market.extra_cost_action_error"));
    if (description) notify.error(t("common:error"), { description });
    return false;
  };

  const handleApprove = async (approval: ExtraCostApproval) => {
    const ok = await confirm({
      tone: "success",
      title: t("market.extra_cost_confirm_title"),
      description: t("market.extra_cost_confirm_description", { id: extraCostOrderNumber(approval) }),
      amount: { value: approval.amount, label: t("market.extra_cost_requested_amount") },
      consequences: [{ text: t(CONSEQUENCE_KEYS[approval.action] ?? CONSEQUENCE_KEYS.sell), tone: "warning" }],
      confirmLabel: t("market.extra_cost_approve"),
      confirmIcon: CircleCheck,
    });
    if (!ok) return;
    approveExtraCostApproval.mutate(
      { id: approval.id },
      {
        onSuccess: () =>
          notify.success(t("market.extra_cost_approved"), { description: `№${extraCostOrderNumber(approval)}` }),
        onError: handleDecisionError,
      },
    );
  };

  const handleReject = (approval: ExtraCostApproval, payload: ExtraCostRejectPayload) => {
    rejectExtraCostApproval.mutate(
      { id: approval.id, ...payload },
      {
        onSuccess: () => {
          setReject((current) => (current ? { ...current, open: false } : current));
          notify.success(t("market.extra_cost_rejected"), { description: `№${extraCostOrderNumber(approval)}` });
        },
        onError: (error) => {
          if (handleDecisionError(error)) setReject((current) => (current ? { ...current, open: false } : current));
        },
      },
    );
  };

  const approvingId = approveExtraCostApproval.isPending ? String(approveExtraCostApproval.variables?.id ?? "") : "";
  const rejectingId = rejectExtraCostApproval.isPending ? String(rejectExtraCostApproval.variables?.id ?? "") : "";

  return (
    <>
      <QueryBoundary
        query={query}
        isEmpty={(response) => toList(response).length === 0}
        // Kutilayotgan so'rov yo'q — blok yo'q (maket `market-dashboard-home`).
        empty={false}
        loading={<ApprovalsSkeleton title={title} />}
        error={(error, retry) => (
          <ApprovalsCard title={title}>
            <ErrorState error={error} size="card" onRetry={retry} />
          </ApprovalsCard>
        )}
      >
        {(response) => {
          const approvals = toList(response);
          return (
            <ApprovalsCard
              title={title}
              count={t("market.extra_cost_approvals_count", { count: approvals.length })}
              hint={canDecide ? null : t("market.extra_cost_owner_only")}
            >
              <ul
                aria-label={t("market.extra_cost_list_label")}
                className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(440px,100%),1fr))] gap-3 p-5 max-md:flex max-md:flex-col max-md:gap-0 max-md:p-0"
              >
                {approvals.map((approval) => (
                  <ApprovalRow
                    key={approval.id}
                    approval={approval}
                    canDecide={canDecide}
                    approving={approvingId === approval.id}
                    rejecting={rejectingId === approval.id}
                    onApprove={handleApprove}
                    onReject={(item) => setReject({ approval: item, open: true })}
                  />
                ))}
              </ul>
            </ApprovalsCard>
          );
        }}
      </QueryBoundary>
      {reject ? (
        <ExtraCostRejectDialog
          key={reject.approval.id}
          approval={reject.approval}
          actionLabel={actionLabel(reject.approval)}
          open={reject.open}
          pending={rejectExtraCostApproval.isPending}
          onClose={() => setReject((current) => (current ? { ...current, open: false } : current))}
          onExited={() => setReject((current) => (current?.open ? current : null))}
          onSubmit={(payload) => handleReject(reject.approval, payload)}
        />
      ) : null}
    </>
  );
});
ExtraCostApprovals.displayName = "ExtraCostApprovals";
