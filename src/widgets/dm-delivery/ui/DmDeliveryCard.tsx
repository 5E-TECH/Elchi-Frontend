// dizayn-v2: (maket yo'q) superadmin-notifications-sms-report
import { CircleCheck, CircleX, Send } from "lucide-react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { formatDateLocalized } from "../../../shared/lib/formatDateTime";
import { formatNumberLocalized, formatPercentLocalized } from "../../../shared/lib/formatMoney";
import { ChartNote, Gauge } from "../../../shared/ui/charts";
import { Card, EmptyState, ErrorState, SkeletonLines } from "../../../shared/ui/primitives";
import { useDmDelivery, type DmDeliveryReport } from "../api/dmDelivery";

/** Ma'lum `skipped_reasons` kalitlari (backend `telegram_reason`); qolgani — «Boshqa sabab». */
const KNOWN_REASONS = ["no_telegram_id", "bot_blocked", "not_private_chat"] as const;

export type DmDeliveryCardProps = {
  /** Faqat superadmin — boshqa rolga karta ham, so'rov ham yo'q. */
  enabled: boolean;
  /** Bosh sahifa davri (`YYYY-MM-DD`); bo'sh — backend sukuti, oxirgi 30 kun. */
  from?: string;
  to?: string;
};

/**
 * «01.10.2026 – 26.10.2026»: tanlangan davr (Toshkent kunlari) — bo'lmasa javobdagi haqiqiy chegara (sukut 30 kun;
 * `to` kirmaydi — oxirgi kun undan oldingi lahza).
 */
const periodText = (report: DmDeliveryReport | undefined, from: string, to: string): string | null => {
  if (from && to) return `${formatDateLocalized(from)} – ${formatDateLocalized(to)}`;
  if (!report?.from || !report.to) return null;
  const end = Date.parse(report.to);
  if (!Number.isFinite(end)) return null;
  return `${formatDateLocalized(report.from)} – ${formatDateLocalized(new Date(end - 1))}`;
};

/**
 * «KVITANSIYA YETKAZILISHI» (2crjWf7v, «Yetkazish metrikasi: kvitansiya yuborilgan/yetgan nisbati dashboardda
 * ko'rinadi») — superadmin bosh sahifasida, `GET /telegram/dm-delivery` (sukut turi — to'lov kvitansiyasi).
 * Maket yo'q — eng yaqini `superadmin-notifications-sms-report` «Yetkazilish» o'lchagichi (ega qarori kutilmoqda):
 * spidometr — `delivery_ratio` (yuborilganlardan yetgani), ostida «Yetdi» / «Xato»; yonida «Qamrov» — `reach_ratio`
 * (hamma qabul qiluvchidan, «yozildi ≠ yetadi»), navbatdagilar va «Yuborilmadi» sabablari. Nisbat `null` —
 * «ma'lumot yo'q» (0% emas).
 */
const DmDeliveryCard = ({ enabled, from = "", to = "" }: DmDeliveryCardProps) => {
  const { t, i18n } = useTranslation("dashboard");
  const language = i18n.language;
  const query = useDmDelivery(from && to ? { from, to } : {}, enabled);
  if (!enabled) return null;

  const report = query.data;
  const countTa = (value: number) =>
    t("v2Charts.countTa", { value: formatNumberLocalized(value, { language }) });
  const percent = (ratio: number) => formatPercentLocalized(ratio * 100, { language });
  const period = periodText(report, from, to);
  const description = period
    ? t("dmDelivery.description", { period })
    : t("dmDelivery.descriptionDefault");

  const body = () => {
    if (query.isLoading) return <SkeletonLines lines={6} />;
    if (query.isError || !report) {
      return (
        <ErrorState
          error={query.error}
          title={t("dmDelivery.loadError")}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      );
    }
    const { totals, skippedReasons } = report;
    if (totals.total === 0) {
      return (
        <EmptyState
          size="chart"
          icon={Send}
          title={t("dmDelivery.emptyTitle")}
          description={t("dmDelivery.emptyHint")}
        />
      );
    }

    const reasonParts = [
      ...KNOWN_REASONS.filter((key) => skippedReasons[key]).map((key) =>
        t("dmDelivery.reasonCount", { reason: t(`dmDelivery.reasons.${key}`), value: countTa(skippedReasons[key]) }),
      ),
      ...(() => {
        const other = Object.entries(skippedReasons)
          .filter(([key]) => !(KNOWN_REASONS as readonly string[]).includes(key))
          .reduce((sum, [, value]) => sum + value, 0);
        return other > 0
          ? [t("dmDelivery.reasonCount", { reason: t("dmDelivery.reasons.other"), value: countTa(other) })]
          : [];
      })(),
    ];

    const rows: Array<{ key: string; label: string; value: string; hint?: string }> = [
      {
        key: "reach",
        label: t("dmDelivery.reach"),
        value: totals.reachRatio == null ? "—" : percent(totals.reachRatio),
        hint: t("dmDelivery.reachHint", {
          sent: formatNumberLocalized(totals.sent, { language }),
          total: formatNumberLocalized(totals.total, { language }),
        }),
      },
      ...(totals.pending > 0
        ? [{ key: "pending", label: t("dmDelivery.pending"), value: countTa(totals.pending), hint: t("dmDelivery.pendingHint") }]
        : []),
      {
        key: "skipped",
        label: t("dmDelivery.skipped"),
        value: countTa(totals.skipped),
        hint: reasonParts.length ? reasonParts.join(" · ") : t("dmDelivery.skippedHint"),
      },
      ...(totals.noProvider > 0
        ? [{ key: "noProvider", label: t("dmDelivery.noProvider"), value: countTa(totals.noProvider) }]
        : []),
    ];

    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-6 max-md:gap-4">
          <div className="flex min-w-0 flex-[1_1_312px] justify-center">
            {totals.deliveryRatio == null ? (
              <EmptyState
                size="chart"
                icon={Send}
                title={t("dmDelivery.noAttemptsTitle")}
                description={t("dmDelivery.noAttemptsHint")}
              />
            ) : (
              <Gauge
                value={totals.deliveryRatio * 100}
                label={t("dmDelivery.gaugeLabel")}
                ariaLabel={t("dmDelivery.gaugeAria", {
                  value: percent(totals.deliveryRatio),
                  sent: countTa(totals.sent),
                  failed: countTa(totals.failed),
                })}
                stats={[
                  { key: "sent", value: countTa(totals.sent), label: t("dmDelivery.sent"), tone: "success", icon: CircleCheck },
                  { key: "failed", value: countTa(totals.failed), label: t("dmDelivery.failed"), tone: "danger", icon: CircleX },
                ]}
              />
            )}
          </div>
          <dl className="m-0 flex min-w-0 flex-[1_1_280px] flex-col">
            {rows.map((row) => (
              <div
                key={row.key}
                data-testid={`dm-delivery-${row.key}`}
                className="flex items-start justify-between gap-3 border-b border-border py-3 last:border-b-0"
              >
                <dt className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-semibold text-text">{row.label}</span>
                  {row.hint ? <span className="text-xs text-text-muted">{row.hint}</span> : null}
                </dt>
                <dd className="m-0 shrink-0 text-sm font-bold whitespace-nowrap text-text">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <ChartNote>{t("dmDelivery.note")}</ChartNote>
      </div>
    );
  };

  return (
    <Card
      as="section"
      title={t("dmDelivery.title")}
      description={description}
      divided={false}
    >
      {body()}
    </Card>
  );
};

export default memo(DmDeliveryCard);
