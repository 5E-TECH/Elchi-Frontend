// dizayn-v2: (maket yo'q) investor-dashboard-home
import { Pencil } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { InvestorProfitBasis, InvestorShareTerm, InvestorSummary } from "../../../entities/investors";
import { formatDateLocalized } from "../../../shared/lib/formatDateTime";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { Button, Card, DataTable } from "../../../shared/ui/primitives";
import { addDays } from "../../../shared/ui/primitives/date/calendarMath";
import { ShareTermsDialog, StartDateDialog } from "./ShareTermsDialogs";

/**
 * «ULUSH SHARTLARI» (ega 2026-11-28) — superadmin/admin nazorati (`/investor/:id`): joriy ulush, foyda asosi
 * («Sof foyda» — daromad − xarajatlar, «Daromad» — xarajat ayrilmaydi), investorlik sanasi, bugungacha hisoblangan
 * ulush va shartlar tarixi. «Shartni o'zgartirish» / «Ulush belgilash» va «Sanani tuzatish» — `ShareTermsDialogs`.
 * Maket yo'q — eng yaqini: `investor-dashboard-home` kartalari.
 */
export const ShareTermsCard = ({
  investorId,
  terms,
  summary,
}: {
  investorId: string;
  terms: InvestorShareTerm[];
  summary: InvestorSummary | undefined;
}) => {
  const { t, i18n } = useTranslation("investor");
  const language = i18n.language;
  const [dialog, setDialog] = useState<"terms" | "start" | null>(null);
  const current = terms.find((term) => term.effectiveTo === null) ?? null;
  const first = terms[0] ?? null;

  const basisLabel = (basis: InvestorProfitBasis) => (basis === "gross" ? t("terms.basisGross") : t("terms.basisNet"));
  const percent = (value: number) => `${formatNumberLocalized(value, { language, fractionDigits: 2 })} %`;
  const date = (day: string) => formatDateLocalized(day);
  const period = (term: InvestorShareTerm) =>
    term.effectiveTo === null
      ? t("terms.periodOpen", { from: date(term.effectiveFrom) })
      : // `effectiveTo` — eksklyuziv: oxirgi kun bir kun oldin.
        t("terms.periodClosed", { from: date(term.effectiveFrom), to: date(addDays(term.effectiveTo, -1)) });

  const items = current
    ? [
        { key: "share", label: t("terms.current"), value: percent(current.sharePercent) },
        {
          key: "basis",
          label: t("terms.basis"),
          value: basisLabel(current.profitBasis),
          hint: current.profitBasis === "gross" ? t("terms.basisGrossHint") : t("terms.basisNetHint"),
        },
        {
          key: "start",
          label: t("terms.startedAt"),
          value: first ? date(first.effectiveFrom) : "—",
          action: first ? (
            <Button variant="ghost" compact onClick={() => setDialog("start")}>
              {t("terms.fixDate")}
            </Button>
          ) : null,
        },
        {
          key: "accrued",
          label: summary?.accruedThrough
            ? t("terms.accrued", { date: date(summary.accruedThrough) })
            : t("terms.accruedNoDate"),
          value: formatMoneyLocalized(summary?.accruedProfit ?? 0, { language }),
        },
      ]
    : [];

  return (
    <Card
      title={t("terms.title")}
      description={t("terms.description")}
      // Telefonda tugma sarlavha ostida, to'liq enda («Oylik foyda» kartasi bilan bir xil).
      className="max-md:[&>div:first-child>div:last-child]:w-full"
      actions={
        <Button
          variant="secondary"
          compact
          leftIcon={Pencil}
          className="max-md:w-full"
          onClick={() => setDialog("terms")}
        >
          {current ? t("terms.change") : t("terms.set")}
        </Button>
      }
      bodyClassName="flex flex-col gap-4"
    >
      {current ? (
        <dl className="m-0 grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-md:grid-cols-1">
          {items.map((item) => (
            <div key={item.key} className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-xs text-text-muted">{item.label}</dt>
              <dd className="m-0 whitespace-nowrap text-base font-bold text-text">{item.value}</dd>
              {"hint" in item && item.hint ? <dd className="m-0 text-xs text-text-muted">{item.hint}</dd> : null}
              {"action" in item && item.action ? <dd className="m-0 -ml-2 self-start">{item.action}</dd> : null}
            </div>
          ))}
        </dl>
      ) : (
        <p className="m-0 text-sm text-text-muted">{t("terms.none")}</p>
      )}

      {terms.length > 1 ? (
        <DataTable<InvestorShareTerm>
          rows={[...terms].reverse()}
          getRowKey={(row) => row.effectiveFrom}
          label={t("terms.history")}
          cardsLabel={t("terms.history")}
          density="compact"
          className="overflow-hidden rounded-xl border border-border"
          columns={[
            { id: "period", header: t("terms.colPeriod"), cell: (row) => period(row) },
            { id: "share", header: t("terms.colShare"), align: "end", cell: (row) => percent(row.sharePercent) },
            { id: "basis", header: t("terms.colBasis"), cell: (row) => basisLabel(row.profitBasis) },
          ]}
          renderCard={(row) => (
            <div className="flex min-w-0 flex-col gap-0.5 px-4 py-3">
              <span className="font-semibold text-text">{period(row)}</span>
              <span className="text-[13px] text-text-muted">
                {percent(row.sharePercent)} · {basisLabel(row.profitBasis)}
              </span>
            </div>
          )}
        />
      ) : null}

      {dialog === "terms" ? (
        <ShareTermsDialog open investorId={investorId} current={current} onClose={() => setDialog(null)} />
      ) : null}
      {dialog === "start" && first ? (
        <StartDateDialog
          open
          investorId={investorId}
          startedAt={first.effectiveFrom}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </Card>
  );
};
