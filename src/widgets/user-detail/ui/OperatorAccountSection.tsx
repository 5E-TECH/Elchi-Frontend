// dizayn-v2: (maket yo'q) market_operator-earnings, superadmin-users-detail
import { ArrowDownLeft, Banknote, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  useOperatorAccountBalance,
  useOperatorAccountEarnings,
  useOperatorAccountPayments,
} from "../../../entities/operator-payment";
import { cx } from "../../../shared/lib/cx";
import { formatDateLocalized } from "../../../shared/lib/formatDateTime";
import { CURRENCY_LABEL, formatNumberLocalized, resolveMoneyLanguage } from "../../../shared/lib/formatMoney";
import { Card, ErrorState, StatCard } from "../../../shared/ui/primitives";
import { OperatorAccountEarningsCard, OperatorAccountPaymentsCard, OPERATOR_ACCOUNT_PAGE_SIZE } from "./OperatorAccountTables";

type Props = {
  /** Market operatori foydalanuvchi id'si (`finance/operators/:operator_id/*`). */
  operatorId: string;
  /** Operator marketi (`GET /users/:id` → `market.name`, x6IO746K); yo'q bo'lsa — umumiy matn. */
  marketName?: string | null;
};

/** Birinchi sahifa — «To'lovlar» / «Daromadlar» kartalari bilan AYNI kalit (kesh bitta, so'rov takrorlanmaydi). */
const FIRST_PAGE = { limit: OPERATOR_ACCOUNT_PAGE_SIZE, offset: 0 } as const;

/**
 * «HISOB» — Ishlab topdi · To'landi · Qoldiq (`GET finance/operators/:operator_id/balance`). Desktop/planshet — 3 ta
 * KPI kartasi, telefon — bitta qator + «So'mda · qoldiq = ishlab topdi − to'landi» (maket `market_operator-earnings`
 * «Hisob»; yorliqlar, tartib va «Ortiqcha to'langan» — market «Operatorlar → To'lovlar» bilan bir xil).
 * Izohlar: «N ta sotilgan buyurtmadan» (`/earnings` jami; 0 — «Hali sotuv yo'q»), «Oxirgisi: …» (birinchi bekor
 * qilinmagan to'lov; yo'q — «Hali to'lov yo'q»), manfiy qoldiq — «Ortiqcha to'langan».
 */
const OperatorAccountSummary = ({ operatorId, description }: { operatorId: string; description: string }) => {
  const { t, i18n } = useTranslation("users");
  const language = resolveMoneyLanguage(i18n.resolvedLanguage ?? i18n.language);
  const balance = useOperatorAccountBalance(operatorId);
  const payments = useOperatorAccountPayments(operatorId, FIRST_PAGE);
  const earnings = useOperatorAccountEarnings(operatorId, FIRST_PAGE);

  const data = balance.data;
  const loading = balance.isLoading;
  const number = (value: number) => formatNumberLocalized(Math.round(value), { language });
  const unit = CURRENCY_LABEL[language];
  const lastPaid = payments.data?.items.find((item) => item.status === "active") ?? null;
  const sold = earnings.data?.total;
  const balanceValue = data?.balance ?? 0;

  const cells = [
    {
      key: "earned",
      label: t("operatorAccount.earned"),
      value: data?.earned ?? 0,
      hint:
        typeof sold === "number"
          ? sold > 0
            ? t("operatorAccount.earnedHint", { total: formatNumberLocalized(sold, { language }) })
            : t("operatorAccount.noSales")
          : t("operatorAccount.earnedHintFallback"),
      icon: Banknote,
    },
    {
      key: "paid",
      label: t("operatorAccount.paid"),
      value: data?.paid ?? 0,
      hint: lastPaid?.paidAt
        ? t("operatorAccount.lastPaid", { date: formatDateLocalized(lastPaid.paidAt, { language }) })
        : payments.data
          ? t("operatorAccount.noPayments")
          : t("operatorAccount.paidHint"),
      icon: ArrowDownLeft,
    },
    {
      key: "balance",
      label: t("operatorAccount.balance"),
      value: balanceValue,
      hint: balanceValue < 0 ? t("operatorAccount.overpaid") : t("operatorAccount.balanceHint"),
      icon: Wallet,
    },
  ] as const;

  return (
    <section aria-labelledby="operator-account-title" className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 id="operator-account-title" className="m-0 text-base leading-6 font-bold text-text">
          {t("operatorAccount.title")}
        </h2>
        <p className="m-0 text-[13px] text-text-muted">{description}</p>
      </div>
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
            <p className="m-0 border-t border-border px-3.5 py-2 text-xs text-text-muted">
              {balanceValue < 0 && !loading ? `${t("operatorAccount.overpaid")} · ` : ""}
              {t("operatorAccount.phoneNote")}
            </p>
          </div>
        </>
      )}
    </section>
  );
};

/**
 * OPERATOR HISOBI — `/all-users/:id` (va `/new-orders/userDetail/:id`) market operatori tafsilotida, faqat superadmin
 * va admin uchun (B1te60bD, ega 2026-11-18: «Ko'rish sahifasi kerak»). FAQAT O'QISH: market o'z operatoriga O'ZI
 * to'laydi va yozadi, Elchi kassasiga ta'sir qilmaydi (F2qp6FtE) — bu yerda hech qanday yozish amali yo'q.
 *
 * Bo'limlar: «Hisob» (KPI) → «To'lovlar» (sana, summa, kim yozdi — market yoki eski Elchi yozuvi, holat — bekor
 * qilingani sabab bilan, izoh; `DataTable` + `Pagination`, telefonda kartalar) → «Daromadlar» (har sotilgan buyurtma
 * komissiyasi). Har blok o'z yuklanishi va xatosi bilan.
 *
 * Maket yo'q — eng yaqini: `market_operator-earnings` («Hisob», «To'lovlar», «Daromadlar»), `superadmin-users-detail`.
 */
export const OperatorAccountSection = ({ operatorId, marketName }: Props) => {
  const { t } = useTranslation("users");
  const market = marketName?.trim();
  const description = market
    ? t("operatorAccount.descriptionMarket", { market })
    : t("operatorAccount.description");

  return (
    <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
      <OperatorAccountSummary operatorId={operatorId} description={description} />
      <OperatorAccountPaymentsCard operatorId={operatorId} />
      <OperatorAccountEarningsCard operatorId={operatorId} />
    </div>
  );
};
