// dizayn-v2: superadmin-payments-shift-report
import { Check, Crown, Send, Store, Truck, Unlink, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type {
  ShiftReport,
  ShiftReportDelivery,
  ShiftReportRecipientKind,
} from "../../../entities/payments";
import { formatTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { Badge, Card, TONE_FG, type Tone } from "../../../shared/ui/primitives";

/**
 * «HISOBOT KIMLARGA YUBORILDI» (maket `superadmin-payments-shift-report`, gWI4gYkw) — `GET finance/shift/:id/report`
 * → `deliveries[]` (faqat superadmin). Oxirgi raund qabul qiluvchi turi bo'yicha guruhlanadi (superadmin · kuryerlar ·
 * marketlar), har kanal (Telegram — DM va market guruhi birga, tizim) uchun «yuborildi / jami»; yuborilmaganlar sababi
 * bilan («Telegram ulanmagan»). `skipped` qatorlar (kanal sozlamada o'chiq) hisobga kirmaydi.
 */

const KIND_ORDER: ShiftReportRecipientKind[] = ["superadmin", "courier", "market"];
const KIND_ICON: Record<ShiftReportRecipientKind, LucideIcon> = { superadmin: Crown, courier: Truck, market: Store };
const FAILED_SHOWN = 3;

type ChannelKey = "telegram" | "in_app";
const channelKey = (row: ShiftReportDelivery): ChannelKey => (row.channel === "in_app" ? "in_app" : "telegram");

type ChannelStat = { channel: ChannelKey; sent: number; failed: number; queued: number; total: number };

/** Kanal holati: hammasi yuborildi — success, xato bor — warning, kutilmoqda — neutral. */
const channelTone = (stat: ChannelStat): Tone =>
  stat.failed > 0 ? "warning" : stat.sent === stat.total ? "success" : "neutral";

const latestRound = (deliveries: ShiftReportDelivery[]) =>
  deliveries.reduce((max, row) => Math.max(max, row.round), 0);

const ReportDeliveries = ({ report, className }: { report: ShiftReport; className?: string }) => {
  const { t, i18n } = useTranslation("payments");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const num = (value: number) => formatNumberLocalized(value, { language });

  const round = latestRound(report.deliveries);
  const rows = report.deliveries.filter((row) => row.round === round);
  const recipients = new Set(rows.map((row) => `${row.recipient_kind}:${row.recipient_id}`)).size;
  const lastAt = rows
    .map((row) => row.sent_at ?? row.created_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  const format = report.report?.file_format === "xlsx" ? "Excel" : "PDF";

  const description = rows.length
    ? [
        lastAt ? formatTimeLocalized(lastAt) : null,
        t("shiftCheck.report.deliveries.recipients", { count: recipients, value: num(recipients) }),
        round > 1 ? t("shiftCheck.report.deliveries.round", { round }) : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : undefined;

  const emptyText = () => {
    if (report.shift.status === "open") return t("shiftCheck.report.deliveries.empty.open");
    const status = report.report?.status;
    if (status === "pending" || status === "processing") return t("shiftCheck.report.deliveries.empty.pending");
    if (status === "skipped") return t("shiftCheck.report.deliveries.empty.skipped");
    if (status === "failed") return t("shiftCheck.report.deliveries.empty.failed");
    return t("shiftCheck.report.deliveries.empty.none");
  };

  const groups = KIND_ORDER.map((kind) => {
    const items = rows.filter((row) => row.recipient_kind === kind);
    const people = new Map(items.map((row) => [row.recipient_id, row.recipient_name]));
    const stats = (["telegram", "in_app"] as const)
      .map((channel): ChannelStat => {
        const counted = items.filter((row) => channelKey(row) === channel && row.status !== "skipped");
        return {
          channel,
          sent: counted.filter((row) => row.status === "sent").length,
          failed: counted.filter((row) => row.status === "failed").length,
          queued: counted.filter((row) => row.status === "queued").length,
          total: counted.length,
        };
      })
      .filter((stat) => stat.total > 0);
    const failed = items.filter((row) => row.status === "failed");
    return { kind, items, people, stats, failed };
  }).filter((group) => group.items.length > 0);

  const subtitle = (group: (typeof groups)[number]) => {
    if (group.kind !== "superadmin") return t(`shiftCheck.report.deliveries.hint.${group.kind}`);
    const names = [...group.people.values()].filter(Boolean).join(", ");
    const hint = t("shiftCheck.report.deliveries.hint.superadmin", { format });
    return names ? `${names} · ${hint}` : hint;
  };

  return (
    <Card
      padding="none"
      className={className}
      title={t("shiftCheck.report.deliveries.title")}
      description={description}
      divided
    >
      {groups.length ? (
        <ul className="m-0 flex list-none flex-col p-0" aria-label={t("shiftCheck.report.deliveries.title")}>
          {groups.map((group) => {
            const Icon = KIND_ICON[group.kind];
            return (
              <li
                key={group.kind}
                data-testid={`shift-delivery-${group.kind}`}
                className="flex items-start gap-3 border-b border-border px-5 py-3 last:border-b-0 max-md:px-4"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-sunken text-text-muted">
                  <Icon aria-hidden="true" size={18} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm font-semibold text-text">
                      {group.kind === "superadmin"
                        ? t("shiftCheck.report.deliveries.kind.superadmin")
                        : t(`shiftCheck.report.deliveries.kind.${group.kind}`, {
                            count: group.people.size,
                            value: num(group.people.size),
                          })}
                    </span>
                    <span className="text-xs text-text-muted">{subtitle(group)}</span>
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    {group.stats.map((stat) => {
                      const tone = channelTone(stat);
                      const label = t(`shiftCheck.report.deliveries.channel.${stat.channel}`);
                      return (
                        <Badge
                          key={stat.channel}
                          tone={tone}
                          dot={tone !== "success"}
                          icon={tone === "success" ? Check : undefined}
                        >
                          {stat.total > 1 || stat.sent !== stat.total
                            ? `${label} ${num(stat.sent)} / ${num(stat.total)}`
                            : label}
                          {stat.queued > 0 && stat.failed === 0 ? ` · ${t("shiftCheck.report.deliveries.queued")}` : ""}
                        </Badge>
                      );
                    })}
                  </span>
                  {group.failed.slice(0, FAILED_SHOWN).map((row) => (
                    <p key={`${row.recipient_id}-${row.channel}`} className="m-0 flex items-start gap-1.5 text-xs text-text-muted">
                      <Unlink aria-hidden="true" size={14} className={`mt-px shrink-0 ${TONE_FG.warning}`} />
                      <span>
                        {t("shiftCheck.report.deliveries.failedLine", {
                          name: row.recipient_name ?? `#${row.recipient_id}`,
                          channel: t(`shiftCheck.report.deliveries.channel.${channelKey(row)}`),
                          reason: row.failed_reason ?? t("shiftCheck.report.deliveries.failedUnknown"),
                        })}
                      </span>
                    </p>
                  ))}
                  {group.failed.length > FAILED_SHOWN ? (
                    <span className="text-xs text-text-muted">
                      {t("shiftCheck.report.deliveries.failedMore", { count: group.failed.length - FAILED_SHOWN })}
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="m-0 flex items-start gap-2 px-5 py-4 text-[13px] text-text-muted max-md:px-4">
          <Send aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
          {emptyText()}
        </p>
      )}
    </Card>
  );
};

export default ReportDeliveries;
