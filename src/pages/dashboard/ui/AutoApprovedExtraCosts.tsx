// dizayn-v2: (maket yo'q) market-dashboard-extra-cost-approvals
import { memo } from "react";
import { Receipt, TimerReset } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useOrders, type ExtraCostApproval, type ExtraCostApprovalsResponse } from "../../../entities/orders";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatMoneyLocalized } from "../../../shared/lib/formatMoney";
import { Badge, Card } from "../../../shared/ui/primitives";

const ACTION_LABEL_KEYS: Record<ExtraCostApproval["action"], string> = {
  sell: "market.extra_cost_sell",
  partly_sell: "market.extra_cost_partly_sell",
  cancel: "market.extra_cost_cancel",
};

const toList = (response: ExtraCostApprovalsResponse | null | undefined): ExtraCostApproval[] =>
  Array.isArray(response?.data) ? response.data.filter((approval) => approval.auto_approved === true) : [];

/**
 * «AVTOMATIK TASDIQLANGAN XARAJATLAR» — market dashboardidagi alohida v2 blok (1tnpaIqd, ega qarori):
 * market muddat ichida javob bermagan qo'shimcha xarajat so'rovi avtomatik tasdiqlanadi
 * (`EXTRA_COST_AUTO_APPROVE_MINUTES`). Ular qo'lda tasdiqlanganlardan ajratilib, alohida filtrda
 * (`GET /orders/extra-cost-approvals?status=approved&auto_approved=true`) ko'rinadi — market e'tiroz
 * bildirishi uchun.
 *
 * Maket yo'q (kartadagi dizayn ziddiyati) — eng yaqini «Qo'shimcha xarajat tasdiqlari» bloki: o'sha
 * qator ko'rinishi, amal tugmalarisiz, «Avtomatik tasdiqlangan» belgisi bilan. Yozuv bo'lmasa,
 * yuklanayotganda yoki xatoda blok chizilmaydi (avtomatik tasdiq o'chiq bo'lsa ro'yxat doim bo'sh).
 */
export const AutoApprovedExtraCosts = memo(() => {
  const { t, i18n } = useTranslation("dashboard");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const { useAutoApprovedExtraCostApprovals } = useOrders();
  const query = useAutoApprovedExtraCostApprovals(true);
  const approvals = toList(query.data);

  if (approvals.length === 0) return null;

  return (
    <Card
      as="section"
      padding="none"
      className="mb-5 overflow-hidden"
      title={
        <span className="inline-flex items-center gap-3">
          <span
            aria-hidden="true"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-sunken text-text-muted"
          >
            <TimerReset size={18} />
          </span>
          {t("market.extra_cost_auto_title")}
        </span>
      }
      actions={
        <span className="text-[13px] text-text-muted">{t("market.extra_cost_auto_count", { count: approvals.length })}</span>
      }
    >
      <p className="m-0 px-5 pt-4 text-[13px] text-text-muted max-md:px-4">{t("market.extra_cost_auto_hint")}</p>
      <ul
        aria-label={t("market.extra_cost_auto_list_label")}
        className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(440px,100%),1fr))] gap-3 p-5 max-md:flex max-md:flex-col max-md:gap-0 max-md:p-0"
      >
        {approvals.map((approval) => {
          const actionLabel = t(ACTION_LABEL_KEYS[approval.action] ?? ACTION_LABEL_KEYS.sell);
          const decidedAt = approval.decided_at ?? approval.updatedAt;
          return (
            <li
              key={approval.id}
              aria-label={t("market.extra_cost_item_label", { action: actionLabel, id: approval.order_id })}
              className="flex min-w-0 flex-col gap-3 rounded-xl bg-sunken p-4 max-md:rounded-none max-md:bg-transparent max-md:not-first:border-t max-md:not-first:border-border"
            >
              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1">
                <span className="col-start-1 row-start-1 flex min-w-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-[.05em] text-text-muted">
                  <Receipt size={16} className="flex-none" aria-hidden="true" />
                  {actionLabel}
                </span>
                <div className="col-start-1 row-start-2 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                  <Link
                    to={`/orders/edit/${approval.order_id}`}
                    className="text-sm font-semibold text-action-fg hover:underline"
                  >
                    №{approval.order_id}
                  </Link>
                  {decidedAt ? (
                    <span className="whitespace-nowrap text-xs text-text-muted">
                      {t("market.extra_cost_auto_decided", {
                        time: formatDateTimeLocalized(decidedAt, { language }),
                      })}
                    </span>
                  ) : null}
                </div>
                <span className="col-start-2 row-span-2 row-start-1 whitespace-nowrap text-base font-bold text-text">
                  {formatMoneyLocalized(approval.amount, { language })}
                </span>
              </div>
              <div>
                <Badge tone="info" icon={TimerReset} data-auto-approved="true">
                  {t("market.extra_cost_auto_badge")}
                </Badge>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
});
AutoApprovedExtraCosts.displayName = "AutoApprovedExtraCosts";
