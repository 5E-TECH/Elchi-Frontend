// dizayn-v2: superadmin-ai-assistant-alert-dialog-market-payout
import { advisorDaysBetween, formatAdvisorDayRelative } from "../../../../../entities/ai-advisor";
import { AlertFacts } from "../AlertFacts";
import { EvidenceTable, type EvidenceColumn } from "../EvidenceTable";
import { useRuleFormat } from "./ruleKit";
import { deriveMarketPayouts, type MarketPayout } from "./ruleData";
import type { RuleBodyProps } from "./types";

/**
 * R4 «Market to'lovi kechikmoqda» (maket `superadmin-ai-assistant-alert-dialog-market-payout`): faktlar — Market,
 * «Berilishi kerak», «Oxirgi to'lov», Qoida; «To'lovlar tarixi · oxirgi N ta» — Sana · Summa · Oraliq (oldingi to'lovdan
 * kunlar; eng eskisi «—»), jami — «… holatida · berilishi kerak» / qarz / «N kun» (to'lovsiz); telefonda kartalar
 * («oldingisidan N kun keyin»). Shartnomada yo'q (v0.4): market shahri, «To'lanmagan buyurtmalar», «Eng eski to'lanmagan
 * sotuv», «To'lagan», «To'lov turi», odatdagi oraliq izohi, har to'lov havolasi.
 */
export const MarketPayoutBody = ({ alert }: RuleBodyProps<"R4">) => {
  const f = useRuleFormat();
  const { t } = f;
  const facts = alert.facts;
  const evidence = alert.evidence?.kind === "market_debt_days" ? alert.evidence : null;
  const payouts = deriveMarketPayouts(evidence);
  const intervalOf = (index: number): number | null =>
    index + 1 < payouts.length ? advisorDaysBetween(payouts[index + 1].day, payouts[index].day) : null;
  const intervals = new Map(payouts.map((payout, index) => [payout.key, intervalOf(index)]));
  const dateOf = (payout: MarketPayout) => (payout.at ? f.at(payout.at) : formatAdvisorDayRelative(payout.day, f.language));
  const asOf = f.at(alert.last_fact_at);

  const columns: EvidenceColumn<MarketPayout>[] = [
    {
      id: "date",
      header: t("alerts.evidence.payouts.columns.date"),
      cell: (payout) => <span className="font-semibold whitespace-nowrap">{dateOf(payout)}</span>,
    },
    {
      id: "amount",
      header: t("alerts.evidence.payouts.columns.amount"),
      align: "end",
      cell: (payout) => f.money(payout.amount),
      total: <span className="font-semibold">{f.money(facts.debt)}</span>,
    },
    {
      id: "interval",
      header: t("alerts.evidence.payouts.columns.interval"),
      align: "end",
      cell: (payout) => {
        const days = intervals.get(payout.key) ?? null;
        return days === null ? <span className="text-text-muted">—</span> : f.days(days);
      },
      total: <span className="font-semibold text-warning-fg">{f.days(facts.days_without_payout)}</span>,
    },
  ];

  return (
    <>
      <AlertFacts
        facts={[
          { id: "market", label: t("alerts.facts.market"), value: facts.market.name },
          { id: "debt", label: t("alerts.facts.debt"), value: f.money(facts.debt) },
          {
            id: "lastPayout",
            label: t("alerts.facts.lastPayout"),
            value: facts.last_payout_at ? f.at(facts.last_payout_at) : t("alerts.facts.noPayout"),
          },
          { id: "rule", label: t("alerts.facts.rule"), value: f.condition(alert) },
        ]}
      />
      {payouts.length ? (
        <EvidenceTable
          title={t("alerts.evidence.payouts.title", { count: payouts.length, value: f.count(payouts.length) })}
          rows={payouts}
          columns={columns}
          getRowKey={(payout) => payout.key}
          totalLabel={
            <>
              {t("alerts.evidence.payouts.asOf", { at: asOf })}{" "}
              <span className="font-normal text-text-muted">· {t("alerts.evidence.payouts.debt")}</span>
            </>
          }
          renderCard={(payout) => {
            const days = intervals.get(payout.key) ?? null;
            return {
              title: dateOf(payout),
              value: <span className="font-semibold">{f.money(payout.amount)}</span>,
              sub: days === null ? undefined : t("alerts.evidence.payouts.intervalCard", { days: f.days(days) }),
            };
          }}
          totalCard={{
            label: t("alerts.evidence.payouts.asOfCard", { at: asOf, days: f.days(facts.days_without_payout) }),
            value: f.money(facts.debt),
          }}
        />
      ) : null}
    </>
  );
};
