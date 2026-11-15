// dizayn-v2: superadmin-ai-assistant-alert-dialog
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  advisorUserName,
  ruleConditionText,
  type AdvisorTranslate,
  type AiAdvisorShiftRow,
} from "../../../../../entities/ai-advisor";
import { formatDateTimeLocalized } from "../../../../../shared/lib/formatDateTime";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../../../shared/lib/formatMoney";
import { AlertFacts, SignedMoney } from "../AlertFacts";
import { EvidenceTable, type EvidenceColumn } from "../EvidenceTable";
import type { RuleBodyProps } from "./types";

const TITLE_LINK = "font-semibold whitespace-nowrap text-text hover:text-action-fg hover:underline";

/** Bir xil odam yopgan smenalar (≥ 2, tizim emas) — «Uchala smenani Sardor Mirzayev yopgan». */
const sameCloser = (rows: readonly AiAdvisorShiftRow[]): string | null => {
  if (rows.length < 2 || rows.some((row) => row.closed_by_system || !row.closed_by)) return null;
  const first = rows[0].closed_by?.id;
  return rows.every((row) => row.closed_by?.id === first) ? advisorUserName(rows[0].closed_by) : null;
};

/**
 * R1 «Smena kamomadi» (maket `superadmin-ai-assistant-alert-dialog`): faktlar — Kassa, «Jami kamomad» (bitta smena —
 * «Kamomad»), Qoida (ochilgan paytdagi chegaralar), «Smenani yopgan»; dalillar (`shifts`) — Smena (havola) · Yopgan
 * (< 1024 yashirin) · Kutilgan · Sanalgan (sanalmagan qism — «karta sanalmagan») · Farq · ›, «Jami»; telefonda kartalar
 * «Kutilgan X · sanalgan Y so'm» va «Jami · 3 smena».
 */
export const ShiftShortageBody = ({ alert }: RuleBodyProps<"R1">) => {
  const { t, i18n } = useTranslation("aiAdvisor");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const tt = t as unknown as AdvisorTranslate;
  const facts = alert.facts;
  const evidence = alert.evidence?.kind === "shifts" ? alert.evidence : null;
  const single = facts.trigger === "single_shortage";
  const money = (value: number, withCurrency = true) => formatMoneyLocalized(value, { language, withCurrency });
  const at = (row: AiAdvisorShiftRow) => formatDateTimeLocalized(row.closed_at, { language });
  const closers = facts.closed_by.map(advisorUserName).filter(Boolean).join(", ");

  const notCounted = (row: AiAdvisorShiftRow) =>
    row.counted_card === null && row.counted_cash !== null
      ? t("alerts.evidence.shifts.cardNotCounted")
      : row.counted_cash === null && row.counted_card !== null
        ? t("alerts.evidence.shifts.cashNotCounted")
        : null;
  const counted = (row: AiAdvisorShiftRow, withCurrency = true) =>
    row.counted_cash === null && row.counted_card === null ? "—" : money(row.counted, withCurrency);

  const shiftCell = (row: AiAdvisorShiftRow) =>
    row.href ? (
      <Link to={row.href} className={TITLE_LINK}>
        {at(row)}
      </Link>
    ) : (
      <span className="font-semibold whitespace-nowrap">{at(row)}</span>
    );

  const table: EvidenceColumn<AiAdvisorShiftRow>[] = [
    { id: "shift", header: t("alerts.evidence.shifts.columns.shift"), cell: shiftCell },
    {
      id: "closedBy",
      header: t("alerts.evidence.shifts.columns.closedBy"),
      hideBelow: "lg",
      cell: (row) => (
        <span className="text-text-muted">
          {row.closed_by_system ? t("alerts.evidence.shifts.system") : advisorUserName(row.closed_by) || "—"}
        </span>
      ),
    },
    { id: "expected", header: t("alerts.evidence.shifts.columns.expected"), align: "end", cell: (row) => money(row.expected) },
    {
      id: "counted",
      header: t("alerts.evidence.shifts.columns.counted"),
      align: "end",
      cell: (row) => {
        const note = notCounted(row);
        return (
          <>
            {counted(row)}
            {note ? <span className="block text-xs font-normal text-text-muted">{note}</span> : null}
          </>
        );
      },
    },
    {
      id: "difference",
      header: t("alerts.evidence.shifts.columns.difference"),
      align: "end",
      cell: (row) => <SignedMoney value={row.difference} />,
      total: evidence ? <SignedMoney value={evidence.totals.difference} /> : null,
    },
  ];

  const asideFor = (rows: readonly AiAdvisorShiftRow[]) => {
    const name = sameCloser(rows);
    if (!name) return null;
    if (rows.length === 2) return t("alerts.evidence.shifts.sameCloser2", { name });
    if (rows.length === 3) return t("alerts.evidence.shifts.sameCloser3", { name });
    return t("alerts.evidence.shifts.sameCloserMany", { name, value: formatNumberLocalized(rows.length, { language }) });
  };
  const aside = evidence && !evidence.truncated ? asideFor(evidence.rows) : null;

  return (
    <>
      <AlertFacts
        facts={[
          { id: "cashbox", label: t("alerts.facts.cashbox"), value: facts.cashbox.name },
          {
            id: "shortage",
            label: t(single ? "alerts.facts.shortage" : "alerts.facts.totalShortage"),
            value: <SignedMoney value={single ? facts.last_difference : facts.total_difference} />,
          },
          { id: "rule", label: t("alerts.facts.rule"), value: ruleConditionText(alert.rule, tt, language) },
          {
            id: "closedBy",
            label: t("alerts.facts.closedBy"),
            value: closers || t("alerts.facts.autoClosed"),
          },
        ]}
      />
      {evidence && evidence.rows.length ? (
        <EvidenceTable
          title={t("alerts.evidence.title", {
            count: evidence.total_rows,
            value: formatNumberLocalized(evidence.total_rows, { language }),
          })}
          aside={aside}
          rows={evidence.rows}
          columns={table}
          getRowKey={(row) => row.shift_id}
          rowHref={(row) => row.href}
          rowLinkLabel={(row) => t("alerts.evidence.shifts.openRow", { at: at(row) })}
          linkColumnLabel={t("alerts.evidence.shifts.columns.open")}
          totalLabel={t("alerts.evidence.total")}
          renderCard={(row) => {
            const note = notCounted(row);
            const sub = t("alerts.evidence.shifts.cardSub", { expected: money(row.expected, false), counted: counted(row) });
            return {
              title: at(row),
              value: <SignedMoney value={row.difference} />,
              sub: note ? `${sub} · ${note}` : sub,
            };
          }}
          totalCard={{
            label: t("alerts.evidence.shifts.totalCard", { shifts: t("alerts.units.shifts", { count: evidence.totals.count }) }),
            value: <SignedMoney value={evidence.totals.difference} />,
          }}
          note={
            evidence.truncated
              ? t("alerts.evidence.truncated", {
                  shown: formatNumberLocalized(evidence.rows.length, { language }),
                  total: formatNumberLocalized(evidence.total_rows, { language }),
                })
              : null
          }
        />
      ) : null}
    </>
  );
};
