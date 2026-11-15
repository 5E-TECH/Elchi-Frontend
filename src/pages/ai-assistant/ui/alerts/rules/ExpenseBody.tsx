// dizayn-v2: superadmin-ai-assistant-alert-dialog-expense
import { Link } from "react-router-dom";
import { advisorUserName, type AiAdvisorEvidenceExpenseStats } from "../../../../../entities/ai-advisor";
import { cx } from "../../../../../shared/lib/cx";
import { AlertFacts } from "../AlertFacts";
import { EvidenceTable, type EvidenceColumn } from "../EvidenceTable";
import { ThresholdMeter } from "../ThresholdMeter";
import { ruleThreshold, severityTone, TITLE_LINK, useRuleFormat } from "./ruleKit";
import type { RuleBodyProps } from "./types";

type ExpenseRow = AiAdvisorEvidenceExpenseStats["rows"][number];

/**
 * R3 «G'ayrioddiy xarajat» (maket `superadmin-ai-assistant-alert-dialog-expense`): faktlar — Xarajat, Kategoriya,
 * Kassa, Kiritgan («ism · vaqt»), «30 kunlik mediana» («… · 11 ta xarajat»), «Mediana og'ishi»; o'lchagich «Odatdagidan
 * 3,4 barobar» (xarajat / mediana, tik chiziq — `mediana + k × MAD`); dalil (`expense_stats`) — «Shu kategoriyadagi
 * oxirgi N xarajat» + «kategoriya · filial» (`scope: category` — «butun tizim»): Sana (havola, «Shu xarajat») ·
 * Kiritgan (< 1024 yashirin) · Summa · ›, jami — 30 kunlik mediana. Shartnomada yo'q (v0.4): «Izoh» ustuni.
 */
export const ExpenseBody = ({ alert }: RuleBodyProps<"R3">) => {
  const f = useRuleFormat();
  const { t } = f;
  const facts = alert.facts;
  const evidence = alert.evidence?.kind === "expense_stats" ? alert.evidence : null;
  const stats = evidence?.stats ?? null;
  const windowDays = stats?.window_days ?? facts.window_days;
  const sampleSize = stats?.sample_size ?? facts.sample_size;
  const median = stats?.median ?? facts.median;
  const threshold = stats?.threshold ?? facts.threshold;
  const multiplier = stats?.multiplier ?? ruleThreshold(alert, "R3", "mad_multiplier");
  const scope = stats?.scope ?? facts.scope;
  const place = scope === "category" ? t("alerts.subline.system") : facts.branch?.name || alert.branch?.name || facts.cashbox.name;
  const createdBy = advisorUserName(facts.created_by);
  const medianLabel = t("alerts.facts.median", { count: windowDays });

  const dateCell = (row: ExpenseRow) => {
    const at = f.at(row.created_at);
    return (
      <>
        {row.href ? (
          <Link to={row.href} className={TITLE_LINK}>
            {at}
          </Link>
        ) : (
          <span className="font-semibold whitespace-nowrap">{at}</span>
        )}
        {row.is_trigger ? <span className="block text-[13px] text-text-muted">{t("alerts.evidence.expense.trigger")}</span> : null}
      </>
    );
  };

  const columns: EvidenceColumn<ExpenseRow>[] = [
    { id: "date", header: t("alerts.evidence.expense.columns.date"), cell: dateCell },
    {
      id: "createdBy",
      header: t("alerts.evidence.expense.columns.createdBy"),
      hideBelow: "lg",
      cell: (row) => <span className="whitespace-nowrap text-text-muted">{advisorUserName(row.created_by) || "—"}</span>,
      total: <span className="font-normal text-text-muted">{t("alerts.units.expenses", { count: sampleSize })}</span>,
    },
    {
      id: "amount",
      header: t("alerts.evidence.expense.columns.amount"),
      align: "end",
      cell: (row) => <span className={cx(row.is_trigger && "font-semibold")}>{f.money(row.amount)}</span>,
      total: <span className="font-semibold">{f.money(median)}</span>,
    },
  ];

  const rows = evidence?.rows ?? [];

  return (
    <>
      <AlertFacts
        facts={[
          { id: "expense", label: t("alerts.facts.expense"), value: f.money(facts.amount) },
          { id: "category", label: t("alerts.facts.category"), value: facts.category.name },
          { id: "cashbox", label: t("alerts.facts.cashbox"), value: facts.cashbox.name },
          {
            id: "createdBy",
            label: t("alerts.facts.createdBy"),
            value: (
              <>
                {createdBy ? `${createdBy} · ` : null}
                <span className="whitespace-nowrap">{f.at(facts.created_at)}</span>
              </>
            ),
          },
          {
            id: "median",
            label: medianLabel,
            value: `${f.money(median)} · ${t("alerts.units.expenses", { count: sampleSize })}`,
          },
          { id: "mad", label: t("alerts.facts.mad"), value: f.money(stats?.mad ?? facts.mad) },
        ]}
      />
      <ThresholdMeter
        title={t("alerts.meter.ratio", { ratio: f.ratio(facts.ratio_to_median) })}
        compare={`${f.bare(facts.amount)} / ${f.money(median)}`}
        value={facts.amount}
        threshold={threshold}
        tone={severityTone(alert)}
        ariaLabel={t("alerts.meter.label", {
          what: t("alerts.facts.expense"),
          value: f.money(facts.amount),
          threshold: f.money(threshold),
        })}
        caption={t("alerts.meter.captionExpense", {
          multiplier: f.ratio(multiplier ?? 0),
          threshold: f.money(threshold),
        })}
      />
      {evidence && rows.length ? (
        <EvidenceTable
          title={t("alerts.evidence.expense.title", { count: rows.length, value: f.count(rows.length) })}
          aside={t("alerts.evidence.expense.aside", { category: facts.category.name, place })}
          rows={rows}
          columns={columns}
          getRowKey={(row) => row.history_id}
          rowHref={(row) => row.href}
          rowLinkLabel={(row) => t("alerts.evidence.expense.openRow", { at: f.at(row.created_at) })}
          linkColumnLabel={t("alerts.evidence.expense.columns.open")}
          totalLabel={medianLabel}
          renderCard={(row) => {
            const name = advisorUserName(row.created_by);
            const trigger = row.is_trigger ? t("alerts.evidence.expense.trigger") : null;
            return {
              title: f.at(row.created_at),
              value: <span className="font-semibold">{f.money(row.amount)}</span>,
              sub: [trigger, name].filter(Boolean).join(" · ") || undefined,
            };
          }}
          totalCard={{ label: `${medianLabel} · ${f.items(sampleSize)}`, value: f.money(median) }}
          note={
            evidence.truncated
              ? t("alerts.evidence.truncated", { shown: f.count(rows.length), total: f.count(evidence.total_rows) })
              : null
          }
        />
      ) : null}
    </>
  );
};
