// dizayn-v2: market_operator-earnings, market_operator-earnings-no-commission
import { ArrowDownLeft, Banknote, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useMyOperatorBalance, useMyOperatorEarningsTotal, useMyOperatorPayments } from "../../../entities/operator-payment";
import { cx } from "../../../shared/lib/cx";
import { formatDateLocalized } from "../../../shared/lib/formatDateTime";
import { CURRENCY_LABEL, formatNumberLocalized, resolveMoneyLanguage } from "../../../shared/lib/formatMoney";
import { Card, ErrorState, StatCard } from "../../../shared/ui/primitives";

/** «To'lovlar» kartasi bilan AYNI so'rov (kesh bitta): oxirgi to'lov sanasi shu sahifadan. */
export const MY_PAYMENTS_PAGE_SIZE = 10;

/**
 * «HISOB» (maket `market_operator-earnings`; F2qp6FtE / 37vonCdg): Qoldiq · Daromad · To'langan — `GET
 * finance/operators/me/balance`. Desktop/planshet — 3 ta KPI kartasi, telefon — bitta qator + «So'mda · qoldiq =
 * daromad − to'langan». Izohlar: «Sizga to'lanishi kerak» (manfiy — «Ortiqcha to'langan»), «N ta sotilgan
 * buyurtmadan» (`/me/earnings` jami; 0 — «Hali sotuv yo'q»), «Oxirgisi: …» (birinchi bekor qilinmagan to'lov;
 * yo'q — «Hali to'lov yo'q»). Xato — karta ichida `ErrorState` + «Qayta urinish».
 */
export const EarningsSummary = () => {
  const { t, i18n } = useTranslation("myEarnings");
  const language = resolveMoneyLanguage(i18n.resolvedLanguage ?? i18n.language);
  const balance = useMyOperatorBalance();
  const earningsTotal = useMyOperatorEarningsTotal();
  const payments = useMyOperatorPayments({ limit: MY_PAYMENTS_PAGE_SIZE, offset: 0 });

  const data = balance.data;
  const loading = balance.isLoading;
  const number = (value: number) => formatNumberLocalized(Math.round(value), { language });
  const unit = CURRENCY_LABEL[language];
  const lastPaid = payments.data?.items.find((item) => item.status === "active") ?? null;
  const sold = earningsTotal.data;

  const cells = [
    {
      key: "balance",
      label: t("account.balance"),
      value: data?.balance ?? 0,
      hint: (data?.balance ?? 0) < 0 ? t("account.overpaid") : t("account.balanceHint"),
      icon: Wallet,
    },
    {
      key: "earned",
      label: t("account.earned"),
      value: data?.earned ?? 0,
      hint:
        typeof sold === "number"
          ? sold > 0
            ? t("account.earnedHint", { total: formatNumberLocalized(sold, { language }) })
            : t("account.noSales")
          : t("account.earnedHintFallback"),
      icon: Banknote,
    },
    {
      key: "paid",
      label: t("account.paid"),
      value: data?.paid ?? 0,
      hint: lastPaid?.paidAt
        ? t("account.lastPaid", { date: formatDateLocalized(lastPaid.paidAt, { language }) })
        : t("account.noPayments"),
      icon: ArrowDownLeft,
    },
  ] as const;

  return (
    <section aria-labelledby="earnings-account-title" className="flex min-w-0 flex-col gap-3">
      <h2 id="earnings-account-title" className="m-0 text-base leading-6 font-bold text-text">
        {t("account.title")}
      </h2>
      {balance.isError ? (
        <Card>
          <ErrorState error={balance.error} size="card" onRetry={() => void balance.refetch()} retrying={balance.isFetching} />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 max-lg:gap-3 max-md:hidden">
            {cells.map((cell) => (
              <StatCard
                key={cell.key}
                label={cell.label}
                value={number(cell.value)}
                unit={unit}
                hint={cell.hint}
                icon={cell.icon}
                loading={loading}
              />
            ))}
          </div>
          <div className="hidden flex-col rounded-[14px] border border-border bg-surface max-md:flex">
            <dl className="m-0 flex">
              {cells.map((cell, index) => (
                <div
                  key={cell.key}
                  className={cx("flex min-w-0 flex-1 flex-col gap-0.5 px-3.5 py-3", index > 0 && "border-l border-border")}
                >
                  <dt className="truncate text-xs font-semibold text-text-muted">{cell.label}</dt>
                  <dd className="m-0 truncate text-[15px] font-semibold text-text tabular-nums">
                    {loading ? "…" : number(cell.value)}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="m-0 border-t border-border px-3.5 py-2 text-xs text-text-muted">{t("account.phoneNote")}</p>
          </div>
        </>
      )}
    </section>
  );
};
