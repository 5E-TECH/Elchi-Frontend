// dizayn-v2: market-dashboard-extra-cost-approvals
import { memo, useId } from "react";
import { ArrowRight, CircleCheck, CircleX, Clock, Receipt } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { ExtraCostApproval } from "../../../entities/orders";
import { getUserRoleLabelKey } from "../../../entities/user/lib/role";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { Button, Card, ErrorState, Skeleton } from "../../../shared/ui/primitives";
import { useIsPhone } from "../../../shared/ui/primitives/date/useIsPhone";

export type ExtraCostApprovalsCardProps = {
  approvals: readonly ExtraCostApproval[];
  loading: boolean;
  /** So'rov xatosi — karta jim yo'qolmaydi, ichida xato va «Qayta urinish» (PINtZcLj). */
  error: boolean;
  errorObject?: unknown;
  onRetry: () => void;
  approvingId: string;
  rejectingId: string;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
};

const ACTION_LABEL: Record<ExtraCostApproval["action"], string> = {
  sell: "market.extra_cost_sell",
  partly_sell: "market.extra_cost_partly_sell",
  cancel: "market.extra_cost_cancel",
};

// fix3b M3: tasdiq AYNAN shu amalni bajaradi — market nimani tasdiqlayotganini aniq ko'radi.
const APPROVE_CONSEQUENCE: Record<ExtraCostApproval["action"], string> = {
  sell: "market.extra_cost_on_approve_sell",
  partly_sell: "market.extra_cost_on_approve_partly_sell",
  cancel: "market.extra_cost_on_approve_cancel",
};

/**
 * «Qo'shimcha xarajat tasdiqlari» — market dashboardi (maket `market-dashboard-extra-cost-approvals`):
 * sariq sarlavha («N ta so'rov kutilmoqda»), har so'rov — amal, buyurtma raqami va vaqti, so'ralgan summa,
 * «Tasdiqlansa — …», so'rovchi va isbotlar soni, «Tasdiqlash / Rad etish». Desktopda kartochkalar to'ri,
 * telefonda chiziq bilan ajratilgan ro'yxat. Kutilayotgan so'rov yo'q — karta chizilmaydi; xato — ichida
 * `ErrorState` (jim `null` emas). So'rovchi ismi backend javobida yo'q — `#id · rol`.
 */
const ExtraCostApprovalsCard = ({
  approvals,
  loading,
  error,
  errorObject,
  onRetry,
  approvingId,
  rejectingId,
  onApprove,
  onReject,
}: ExtraCostApprovalsCardProps) => {
  const { t, i18n } = useTranslation(["dashboard", "users"]);
  const language = i18n.language;
  const titleId = useId();
  const isPhone = useIsPhone();

  if (!loading && !error && approvals.length === 0) return null;

  const roleLabel = (role: string | null | undefined) => {
    if (!role) return null;
    const key = getUserRoleLabelKey(role);
    return key === "roleUnknown" ? role : t(key, { ns: "users" });
  };

  return (
    <Card padding="none" aria-labelledby={titleId} data-testid="extra-cost-approvals"
      // Eski (v1) sahifadagi bloklar oralig'i — `mb-5`.
      className="mb-5 overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-warning-soft px-5 py-4">
        <span className="inline-flex size-10 flex-none items-center justify-center rounded-[10px] bg-surface text-warning-fg">
          <Clock size={20} aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id={titleId} className="text-base font-bold text-text">
            {t("market.extra_cost_approvals")}
          </h2>
          {!loading && !error ? (
            <p className="text-[13px] font-semibold text-warning-fg">
              {t("market.extra_cost_approvals_count", { count: approvals.length })}
            </p>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div aria-hidden="true" className="grid gap-3 p-5 md:grid-cols-2 max-md:p-4">
          <Skeleton shape="block" height={168} />
          <Skeleton shape="block" height={168} className="max-md:hidden" />
        </div>
      ) : error ? (
        <ErrorState error={errorObject} size="card" onRetry={onRetry} />
      ) : (
        <ul
          aria-label={t("market.extra_cost_list")}
          className="m-0 grid list-none gap-3 p-5 [grid-template-columns:repeat(auto-fit,minmax(min(440px,100%),1fr))] max-md:flex max-md:flex-col max-md:gap-0 max-md:p-0"
        >
          {approvals.map((approval) => {
            const isApproving = approvingId === approval.id;
            const isRejecting = rejectingId === approval.id;
            const busy = isApproving || isRejecting;
            const action = t(ACTION_LABEL[approval.action] ?? ACTION_LABEL.sell);
            const role = roleLabel(approval.requested_by_role);
            const proofs = approval.proof_file_keys?.length ?? 0;

            return (
              <li
                key={approval.id}
                aria-label={t("market.extra_cost_item", { action, id: approval.order_id })}
                className="flex flex-col gap-3 rounded-xl bg-sunken p-4 max-md:rounded-none max-md:border-t max-md:border-border max-md:bg-transparent max-md:first:border-t-0"
              >
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 max-md:gap-y-3">
                  <span className="col-start-1 row-start-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[.05em] text-text-muted max-md:col-span-2">
                    <Receipt size={16} aria-hidden="true" className="flex-none" />
                    {action}
                  </span>
                  <span className="col-start-1 row-start-2 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 max-md:flex-col max-md:items-start max-md:gap-0.5">
                    <Link
                      to={`/orders/edit/${approval.order_id}`}
                      className="text-sm font-semibold text-action-fg hover:text-action-hover max-md:-my-3 max-md:flex max-md:min-h-11 max-md:items-center"
                    >
                      №{approval.order_id}
                    </Link>
                    {approval.createdAt ? (
                      <span className="whitespace-nowrap text-xs text-text-muted">
                        {formatDateTimeLocalized(approval.createdAt, { language })}
                      </span>
                    ) : null}
                  </span>
                  <span className="col-start-2 row-span-2 row-start-1 flex flex-col items-end gap-0.5 max-md:row-span-1 max-md:row-start-2">
                    <span className="whitespace-nowrap text-base font-bold text-text">
                      {formatMoneyLocalized(approval.amount, { language })}
                    </span>
                    <span className="text-xs text-text-muted">{t("market.extra_cost_amount")}</span>
                  </span>
                </div>

                <div className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2 max-md:bg-sunken max-md:py-2.5">
                  <ArrowRight size={16} aria-hidden="true" className="flex-none text-text-muted" />
                  <span data-testid={`approval-consequence-${approval.id}`} className="text-[13px] font-semibold text-text">
                    {t(APPROVE_CONSEQUENCE[approval.action] ?? APPROVE_CONSEQUENCE.sell)}
                  </span>
                </div>

                <div className="flex flex-wrap items-end justify-between gap-3 max-md:flex-col max-md:items-stretch">
                  <dl className="m-0 grid min-w-0 grid-cols-[auto_auto] gap-x-2.5 gap-y-0.5 text-[13px] max-md:grid-cols-[auto_minmax(0,1fr)] max-md:gap-x-3 max-md:gap-y-1">
                    <dt className="text-text-muted">{t("market.extra_cost_requester")}</dt>
                    <dd className="m-0">
                      <span className="font-semibold text-text">#{approval.requested_by_user_id}</span>
                      {role ? <span className="text-text-muted"> · {role}</span> : null}
                    </dd>
                    <dt className="text-text-muted">{t("market.extra_cost_proofs")}</dt>
                    <dd className="m-0 font-semibold text-text">
                      {proofs > 0
                        ? t("market.extra_cost_proofs_count", { value: formatNumberLocalized(proofs, { language }) })
                        : t("market.extra_cost_no_proofs")}
                    </dd>
                  </dl>
                  <div className="flex flex-wrap gap-2 max-md:grid max-md:grid-cols-2">
                    {/* Telefonda maketdagidek oddiy o'lcham (`.el-btn`), desktopda `sm`. Yuklanayotgan tugma `disabled`
                        emas (fokus unda qoladi) — faqat ikkinchisi. */}
                    <Button
                      variant="success"
                      size={isPhone ? "md" : "sm"}
                      leftIcon={CircleCheck}
                      disabled={busy && !isApproving}
                      loading={isApproving}
                      onClick={() => onApprove(approval.id)}
                    >
                      {isApproving ? t("market.extra_cost_approving") : t("market.extra_cost_approve")}
                    </Button>
                    <Button
                      variant="danger-soft"
                      size={isPhone ? "md" : "sm"}
                      leftIcon={CircleX}
                      disabled={busy && !isRejecting}
                      loading={isRejecting}
                      onClick={() => onReject(approval.id)}
                    >
                      {isRejecting ? t("market.extra_cost_rejecting") : t("market.extra_cost_reject")}
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
};

export default memo(ExtraCostApprovalsCard);
