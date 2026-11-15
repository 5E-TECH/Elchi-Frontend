// dizayn-v2: superadmin-ai-assistant-alert-dialog-hq-transfer
import { Link } from "react-router-dom";
import type { AiAdvisorEvidenceBranchTransfers } from "../../../../../entities/ai-advisor";
import { AlertFacts } from "../AlertFacts";
import { EvidenceTable, type EvidenceColumn } from "../EvidenceTable";
import { ThresholdMeter } from "../ThresholdMeter";
import { ruleThreshold, severityTone, TITLE_LINK, useRuleFormat } from "./ruleKit";
import type { RuleBodyProps } from "./types";

type Transfer = AiAdvisorEvidenceBranchTransfers["transfers"][number];

/**
 * R5 «HQ'ga o'tkazma kechikmoqda» (maket `superadmin-ai-assistant-alert-dialog-hq-transfer`): faktlar — Filial,
 * «Filial kassasida», «Oxirgi o'tkazma», Qoida; o'lchagich (qoldiq / chegara, diqqat — sariq); «HQ'ga oxirgi
 * o'tkazmalar · N ta» (`transfers`) — Sana (havola) · Summa · ›, jami — «… holatida · N kun o'tkazmasiz» / qoldiq;
 * telefonda kartalar. Shartnomada yo'q (v0.4): Menejer, «Tarkibi» (naqd / o'tkazma), «Qabul qilgan», «To'lov turi»,
 * «o'rtacha har N kunda».
 */
export const HqTransferBody = ({ alert }: RuleBodyProps<"R5">) => {
  const f = useRuleFormat();
  const { t } = f;
  const facts = alert.facts;
  const evidence = alert.evidence?.kind === "branch_transfers" ? alert.evidence : null;
  const limit = ruleThreshold(alert, "R5", "balance_uzs");
  const transfers = [...(evidence?.transfers ?? [])].sort((a, b) => (a.at === b.at ? 0 : a.at < b.at ? 1 : -1));
  const asOf = t("alerts.evidence.transfers.asOf", { at: f.at(alert.last_fact_at), days: f.days(facts.days_without_transfer) });
  // Maket: «21.10.2026, 10:30 holatida» + xira «4 kun o'tkazmasiz» («4 kun» — ogohlantirish rangida; R4 «Jami» bilan bir xil).
  const asOfLabel = (
    <>
      {t("alerts.evidence.transfers.asOfAt", { at: f.at(alert.last_fact_at) })}{" "}
      <span className="font-normal text-text-muted">
        · <span className="font-semibold text-warning-fg">{f.days(facts.days_without_transfer)}</span>{" "}
        {t("alerts.evidence.transfers.idle")}
      </span>
    </>
  );

  const columns: EvidenceColumn<Transfer>[] = [
    {
      id: "date",
      header: t("alerts.evidence.transfers.columns.date"),
      cell: (row) =>
        row.href ? (
          <Link to={row.href} className={TITLE_LINK}>
            {f.at(row.at)}
          </Link>
        ) : (
          <span className="font-semibold whitespace-nowrap">{f.at(row.at)}</span>
        ),
    },
    {
      id: "amount",
      header: t("alerts.evidence.transfers.columns.amount"),
      align: "end",
      cell: (row) => f.money(row.amount),
      total: <span className="font-semibold">{f.money(facts.balance)}</span>,
    },
  ];

  return (
    <>
      <AlertFacts
        facts={[
          { id: "branch", label: t("alerts.facts.branch"), value: facts.branch.name },
          { id: "balance", label: t("alerts.facts.branchBalance"), value: f.money(facts.balance) },
          {
            id: "lastTransfer",
            label: t("alerts.facts.lastTransfer"),
            value: facts.last_transfer_at ? f.at(facts.last_transfer_at) : t("alerts.facts.noTransfer"),
          },
          { id: "rule", label: t("alerts.facts.rule"), value: f.condition(alert) },
        ]}
      />
      {limit !== null && facts.balance > limit ? (
        <ThresholdMeter
          title={t("alerts.meter.over", { amount: f.money(facts.balance - limit) })}
          compare={`${f.bare(facts.balance)} / ${f.money(limit)}`}
          value={facts.balance}
          threshold={limit}
          tone={severityTone(alert)}
          ariaLabel={t("alerts.meter.label", {
            what: t("alerts.facts.branchBalance"),
            value: f.money(facts.balance),
            threshold: f.money(limit),
          })}
          caption={t("alerts.meter.caption", { threshold: f.money(limit) })}
        />
      ) : null}
      {evidence && transfers.length ? (
        <EvidenceTable
          title={t("alerts.evidence.transfers.title", { count: transfers.length, value: f.count(transfers.length) })}
          rows={transfers}
          columns={columns}
          getRowKey={(row) => row.history_id}
          rowHref={(row) => row.href}
          rowLinkLabel={(row) => t("alerts.evidence.transfers.openRow", { at: f.at(row.at) })}
          linkColumnLabel={t("alerts.evidence.transfers.columns.open")}
          totalLabel={asOfLabel}
          renderCard={(row) => ({
            title: f.at(row.at),
            value: <span className="font-semibold">{f.money(row.amount)}</span>,
          })}
          totalCard={{ label: asOf, value: f.money(facts.balance) }}
          note={
            evidence.truncated
              ? t("alerts.evidence.truncated", {
                  shown: f.count(transfers.length),
                  total: f.count(evidence.total_rows),
                })
              : null
          }
        />
      ) : null}
    </>
  );
};
