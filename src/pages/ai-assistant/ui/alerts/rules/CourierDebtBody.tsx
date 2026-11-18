// dizayn-v2: superadmin-ai-assistant-alert-dialog-courier-debt
import { Link } from "react-router-dom";
import {
  advisorDayOf,
  advisorRefName,
  advisorUserName,
  formatAdvisorDayMonth,
  formatAdvisorDayRelative,
  type AiAdvisorEvidenceCourierDays,
} from "../../../../../entities/ai-advisor";
import { AlertFacts } from "../AlertFacts";
import { EvidenceTable, type EvidenceColumn } from "../EvidenceTable";
import { ThresholdMeter } from "../ThresholdMeter";
import { linkOfKind, ruleThreshold, severityTone, TITLE_LINK, useRuleFormat } from "./ruleKit";
import type { RuleBodyProps } from "./types";

type DayRow = AiAdvisorEvidenceCourierDays["rows"][number];

const growthOf = (row: DayRow) => row.closing_balance - row.opening_balance;

/** Oxirgi uzluksiz o'sish (kun sayin qoldiq oshgan) qatorlari boshi; o'sish yo'q — `null`. */
const growthStreakStart = (rows: readonly DayRow[]): number | null => {
  let start = rows.length;
  while (start > 0 && growthOf(rows[start - 1]) > 0) start -= 1;
  return start < rows.length ? start : null;
};

/**
 * R2 «Kuryer qarzi o'smoqda» (maket `superadmin-ai-assistant-alert-dialog-courier-debt`): faktlar — Kuryer
 * («ism · filial»), «Kassadagi summa», «Oxirgi topshirish» («… · 4 kun oldin»), Qoida; bitta shart bajarilgan bo'lsa —
 * «Bajarilgan shart» (maket «Boshqa holatlar»); qoldiq chegaradan oshgan bo'lsa — o'lchagich (jiddiy — qizil), «Ikkala
 * shart bajarildi …» izohi; dalil (`courier_days`) — «Kassa harakati · oxirgi N kun»: Kun · Sotuvlar · Topshirildi
 * (< 1024 yashirin) · O'sish · Qoldiq · ›, o'sish boshlangan kundan beri jami; telefonda kartalar.
 */
export const CourierDebtBody = ({ alert }: RuleBodyProps<"R2">) => {
  const f = useRuleFormat();
  const { t } = f;
  const facts = alert.facts;
  const evidence = alert.evidence?.kind === "courier_days" ? alert.evidence : null;
  const branch = facts.branch ?? alert.branch;
  const balanceLimit = ruleThreshold(alert, "R2", "balance_uzs");
  const growthDays = ruleThreshold(alert, "R2", "growth_days");
  const handoverDays = ruleThreshold(alert, "R2", "no_handover_days");
  const cashboxHref = linkOfKind(alert, "courier_cashbox")?.href ?? null;

  const met =
    facts.trigger === "growth" && growthDays !== null && balanceLimit !== null
      ? t("alerts.courier.growth", { growth: f.days(growthDays), balance: f.money(balanceLimit) })
      : facts.trigger === "no_handover" && handoverDays !== null
        ? t("alerts.courier.noHandover", { daysOver: f.daysOver(handoverDays) })
        : null;

  const overLimit = balanceLimit !== null && facts.balance > balanceLimit;
  const caption =
    balanceLimit === null
      ? null
      : facts.trigger === "both"
        ? `${t("alerts.meter.caption", { threshold: f.money(balanceLimit) })}. ${t("alerts.courier.both", {
            growth: f.days(facts.growth_days),
            days: f.days(facts.days_without_handover ?? 0),
          })}`
        : t("alerts.meter.caption", { threshold: f.money(balanceLimit) });

  // Bugungi qator — oxirgi aniqlash vaqti bilan («Bugun, 14:00»), qolganlari — kun («Kecha», «21.10.2026»).
  const lastFactDay = advisorDayOf(alert.last_fact_at);
  const today = advisorDayOf(new Date());
  const dayLabel = (row: DayRow) =>
    row.date === today && lastFactDay === today ? f.at(alert.last_fact_at) : formatAdvisorDayRelative(row.date, f.language);

  const rows = evidence?.rows ?? [];
  const streak = growthStreakStart(rows);
  const since = streak === null ? [] : rows.slice(streak);
  const sum = (pick: (row: DayRow) => number) => since.reduce((total, row) => total + pick(row), 0);
  const sinceLabel = streak === null ? null : t("alerts.evidence.courierDays.since", { date: formatAdvisorDayMonth(rows[streak].date) });
  const lastClosing = rows.length ? rows[rows.length - 1].closing_balance : 0;

  const columns: EvidenceColumn<DayRow>[] = [
    {
      id: "day",
      header: t("alerts.evidence.courierDays.columns.day"),
      cell: (row) =>
        cashboxHref ? (
          <Link to={cashboxHref} className={TITLE_LINK}>
            {dayLabel(row)}
          </Link>
        ) : (
          <span className="font-semibold whitespace-nowrap">{dayLabel(row)}</span>
        ),
    },
    {
      id: "income",
      header: t("alerts.evidence.courierDays.columns.income"),
      align: "end",
      cell: (row) => f.money(row.income),
      total: f.money(sum((row) => row.income)),
    },
    {
      id: "handedOver",
      header: t("alerts.evidence.courierDays.columns.handedOver"),
      align: "end",
      hideBelow: "lg",
      cell: (row) => <span className={row.handed_over === 0 ? "text-text-muted" : undefined}>{f.money(row.handed_over)}</span>,
      total: f.money(sum((row) => row.handed_over)),
    },
    {
      id: "growth",
      header: t("alerts.evidence.courierDays.columns.growth"),
      align: "end",
      cell: (row) => f.signed(growthOf(row)),
      total: f.signed(sum(growthOf)),
    },
    {
      id: "closing",
      header: t("alerts.evidence.courierDays.columns.closing"),
      align: "end",
      cell: (row) => <span className="font-semibold">{f.money(row.closing_balance)}</span>,
      total: <span className="font-semibold">{f.money(lastClosing)}</span>,
    },
  ];

  return (
    <>
      <AlertFacts
        facts={[
          {
            id: "courier",
            label: t("alerts.facts.courier"),
            value: branch ? `${advisorUserName(facts.courier)} · ${advisorRefName(branch)}` : advisorUserName(facts.courier),
          },
          { id: "balance", label: t("alerts.facts.courierBalance"), value: f.money(facts.balance) },
          {
            id: "lastHandover",
            label: t("alerts.facts.lastHandover"),
            value: facts.last_handover_at ? (
              <>
                <span className="whitespace-nowrap">{f.at(facts.last_handover_at)}</span>
                {facts.days_without_handover !== null
                  ? ` · ${t("alerts.facts.ago", { value: f.days(facts.days_without_handover) })}`
                  : null}
              </>
            ) : (
              t("alerts.facts.neverHanded")
            ),
          },
          { id: "rule", label: t("alerts.facts.rule"), value: f.condition(alert) },
          met ? { id: "met", label: t("alerts.facts.metCondition"), value: met } : null,
        ]}
      />
      {overLimit && balanceLimit !== null ? (
        <ThresholdMeter
          title={t("alerts.meter.over", { amount: f.money(facts.balance - balanceLimit) })}
          compare={`${f.bare(facts.balance)} / ${f.money(balanceLimit)}`}
          value={facts.balance}
          threshold={balanceLimit}
          tone={severityTone(alert)}
          ariaLabel={t("alerts.meter.label", {
            what: t("alerts.facts.courierBalance"),
            value: f.money(facts.balance),
            threshold: f.money(balanceLimit),
          })}
          caption={caption}
        />
      ) : null}
      {evidence && rows.length ? (
        <EvidenceTable
          title={t("alerts.evidence.courierDays.title", { days: f.days(rows.length) })}
          aside={t("alerts.evidence.courierDays.aside")}
          rows={rows}
          columns={columns}
          getRowKey={(row) => row.date}
          rowHref={cashboxHref ? () => cashboxHref : undefined}
          rowLinkLabel={(row) => t("alerts.evidence.courierDays.openRow", { day: dayLabel(row) })}
          linkColumnLabel={t("alerts.evidence.courierDays.columns.open")}
          totalLabel={sinceLabel ? <span className="whitespace-nowrap">{sinceLabel}</span> : undefined}
          renderCard={(row) => ({
            title: dayLabel(row),
            value: <span className="font-semibold">{f.money(row.closing_balance)}</span>,
            sub:
              row.handed_over > 0
                ? t("alerts.evidence.courierDays.cardHanded", { income: f.bare(row.income), handed: f.money(row.handed_over) })
                : t("alerts.evidence.courierDays.cardGrowth", { income: f.bare(row.income), growth: f.signed(growthOf(row)) }),
          })}
          totalCard={
            sinceLabel && streak !== null
              ? {
                  label: t("alerts.evidence.courierDays.sinceCard", {
                    date: formatAdvisorDayMonth(rows[streak].date),
                    days: f.days(since.length),
                  }),
                  value: f.money(lastClosing),
                }
              : undefined
          }
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
