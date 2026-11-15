// dizayn-v2: superadmin-ai-assistant-alert-dialog-loss
import type { ReactNode } from "react";
import {
  advisorIsoWeekday,
  formatAdvisorDay,
  formatAdvisorDayMonth,
  formatAdvisorDayRange,
  subjectName,
} from "../../../../../entities/ai-advisor";
import { DeltaChip } from "../../../../../shared/ui/charts";
import { AlertFacts, SignedMoney } from "../AlertFacts";
import { EvidenceTable, type EvidenceColumn } from "../EvidenceTable";
import { lossComparisonDays } from "./ruleData";
import { useRuleFormat, type RuleFormat } from "./ruleKit";
import type { RuleBodyProps } from "./types";

type Metric = "income" | "expense" | "net";
type CompareRow = { id: Metric; label: string; prev: number; cur: number };

const LABEL: Record<Metric, string> = { income: "alerts.facts.income", expense: "alerts.facts.expenses", net: "alerts.facts.net" };

/** «20.10.2026, seshanba» — kun va hafta kuni (kalendar kuni, mintaqasiz). */
const dayWithWeekday = (f: RuleFormat, day: string) => {
  const weekday = advisorIsoWeekday(day);
  return weekday ? `${formatAdvisorDay(day)}, ${f.t(`alerts.weekdays.${weekday}`)}` : formatAdvisorDay(day);
};

/**
 * R6 «Zarar» (maket `superadmin-ai-assistant-alert-dialog-loss`): faktlar — Davr («20.10.2026, seshanba · kun» /
 * «12–18.10.2026 · hafta»), Qamrov, «Pochta foydasi», Xarajatlar, «Sof foyda» (ishorali, qizil), Qoida; kunlik zararda
 * dalil (`profit_days`) oldingi kun qatorini ham bersa — «Oldingi kun bilan solishtirish»: Ko'rsatkich · oldingi kun ·
 * zararli kun · O'zgarish (foiz — `DeltaChip`, sof foyda — so'm); telefonda kartalar. Shartnomada yo'q (v0.4): «Oldingi
 * hafta» (haftalik), «Zararga eng ko'p ta'sir qilgan xarajatlar» (kategoriyalar).
 */
export const LossBody = ({ alert }: RuleBodyProps<"R6">) => {
  const f = useRuleFormat();
  const { t } = f;
  const facts = alert.facts;
  const evidence = alert.evidence?.kind === "profit_days" ? alert.evidence : null;
  const compare = lossComparisonDays(facts, evidence);

  const period =
    facts.period === "day"
      ? t("alerts.facts.periodDay", {
          date: formatAdvisorDay(facts.from),
          weekday: t(`alerts.weekdays.${advisorIsoWeekday(facts.from) ?? 1}`),
        })
      : t("alerts.facts.periodWeek", { range: formatAdvisorDayRange(facts.from, facts.to) });

  const value = (row: CompareRow, which: "prev" | "cur"): ReactNode =>
    row.id === "net" ? <SignedMoney value={row[which]} tone="profit" /> : f.money(row[which]);
  const change = (row: CompareRow): ReactNode => {
    if (row.id === "net") return <SignedMoney value={row.cur - row.prev} tone="plain" />;
    if (row.prev === 0) return <span className="text-text-muted">—</span>;
    return <DeltaChip value={((row.cur - row.prev) / Math.abs(row.prev)) * 100} goodWhen={row.id === "income" ? "up" : "down"} />;
  };

  const rows: CompareRow[] = compare
    ? (["income", "expense", "net"] as const).map((id) => ({
        id,
        label: t(LABEL[id]),
        prev: compare.prev[id],
        cur: compare.cur[id],
      }))
    : [];

  const columns: EvidenceColumn<CompareRow>[] = compare
    ? [
        {
          id: "metric",
          header: t("alerts.evidence.loss.columns.metric"),
          cell: (row) => <span className={row.id === "net" ? "font-semibold" : undefined}>{row.label}</span>,
        },
        { id: "prev", header: formatAdvisorDay(compare.prev.date), align: "end", cell: (row) => value(row, "prev") },
        {
          id: "cur",
          header: formatAdvisorDay(compare.cur.date),
          align: "end",
          cell: (row) => <span className="font-semibold">{value(row, "cur")}</span>,
        },
        { id: "change", header: t("alerts.evidence.loss.columns.change"), align: "end", cell: change },
      ]
    : [];

  return (
    <>
      <AlertFacts
        facts={[
          { id: "period", label: t("alerts.facts.period"), value: period },
          { id: "scope", label: t("alerts.facts.scope"), value: subjectName(alert, t) },
          { id: "income", label: t("alerts.facts.income"), value: f.money(facts.income) },
          { id: "expense", label: t("alerts.facts.expenses"), value: f.money(facts.expense) },
          { id: "net", label: t("alerts.facts.net"), value: <SignedMoney value={facts.net} tone="profit" /> },
          { id: "rule", label: t("alerts.facts.rule"), value: f.condition(alert) },
        ]}
      />
      {compare ? (
        <EvidenceTable
          title={t("alerts.evidence.loss.title")}
          aside={dayWithWeekday(f, compare.prev.date)}
          rows={rows}
          columns={columns}
          getRowKey={(row) => row.id}
          renderCard={(row) => ({
            title: row.label,
            value: <span className="font-semibold">{value(row, "cur")}</span>,
            sub: (
              <span className="flex items-center justify-between gap-2">
                <span className="min-w-0">
                  {t("alerts.evidence.loss.prevCard", {
                    date: formatAdvisorDayMonth(compare.prev.date),
                    value: row.id === "net" ? f.signed(row.prev) : f.money(row.prev),
                  })}
                </span>
                <span className="shrink-0 text-text">{change(row)}</span>
              </span>
            ),
          })}
        />
      ) : null}
    </>
  );
};
