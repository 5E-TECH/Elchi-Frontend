// dizayn-v2: superadmin-mails-detail, superadmin-mails-detail-refused, superadmin-mails-detail-old, admin-mails-detail, admin-mails-refused-detail, admin-mails-old-detail, manager-mails-detail-receive, manager-mails-detail-refused-receive, manager-mails-detail-old, registrator-mails-detail, registrator-mails-detail-refused, registrator-mails-detail-old, courier-mails-detail-receive, courier-mails-detail-refused, courier-mails-detail-old
import { memo } from "react";
import { Building2, ListChecks, MapPin, Package } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../../shared/lib/cx";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../../shared/lib/formatMoney";
import { Card, StatCard } from "../../../../shared/ui/primitives";

/**
 * POCHTA XULOSASI — dizayn v2.
 *
 *  ≥ 768: `StatCard` to'ri (`.el-grid`, `.el-stat`): «Tanlangan» n / N ta · «Uygacha» n ta, jami X ·
 *         «Markazgacha» n ta, jami X. Eski pochtada «Tanlangan» yo'q (`showSelectionCard=false`).
 *  < 768: xodim — bitta karta, `dl` qatorlari (maket `superadmin-mails-detail` «Pochta xulosasi»);
 *         kuryer — ikki ustun «Uygacha» · «Markazgacha» (maket `courier-mails-detail-receive`).
 *
 * Kuryer (`layout="courier"`): birinchi karta — «Tanlangan» (izoh — tanlanganlar summasi + jarayon chizig'i),
 * rad etilgan pochtada «Rad etilgan» N ta, eski pochtada «Jami» N ta (`leadCard`).
 *
 * `variant="compact"` — eski API (paket tafsiloti ishlatgan); ko'rinishi `cards` bilan bir xil.
 */
interface HomeOrderStats {
  homeOrders: number;
  homeOrdersTotalPrice: number;
}

interface CenterOrderStats {
  centerOrders: number;
  centerOrdersTotalPrice: number;
}

interface MailStatCardsProps {
  totalOrders: number;
  selectedCount: number;
  homeStats?: HomeOrderStats;
  centerStats?: CenterOrderStats;
  showSelectionCard?: boolean;
  /** Eski API — ko'rinishga ta'sir qilmaydi. */
  variant?: "cards" | "compact";
  /** Xodim (sukut) yoki kuryer maketi. */
  layout?: "staff" | "courier";
  /** Kuryer: birinchi karta (sukut — «Tanlangan», `showSelectionCard` bo'lsa). */
  leadCard?: "selected" | "refused" | "total";
  /** Tanlangan buyurtmalar summasi (kuryer «Tanlangan» izohi). */
  selectedSum?: number;
  /** Barcha buyurtmalar summasi («Rad etilgan» / «Jami» izohi). */
  totalSum?: number;
}

const MailStatCards = memo(
  ({
    totalOrders,
    selectedCount,
    homeStats,
    centerStats,
    showSelectionCard = true,
    layout = "staff",
    leadCard,
    selectedSum = 0,
    totalSum = 0,
  }: MailStatCardsProps) => {
    const { t, i18n } = useTranslation("mails");
    const language = i18n.resolvedLanguage ?? i18n.language;
    const count = (value: number) => formatNumberLocalized(value, { language });
    const money = (value: number) => formatMoneyLocalized(value, { language });

    const isCourier = layout === "courier";
    const lead = leadCard ?? (showSelectionCard ? "selected" : null);
    const homeCount = homeStats?.homeOrders ?? 0;
    const homeSum = homeStats?.homeOrdersTotalPrice ?? 0;
    const centerCount = centerStats?.centerOrders ?? 0;
    const centerSum = centerStats?.centerOrdersTotalPrice ?? 0;
    const unit = t("detailPage.statUnit");
    const selectedHint =
      selectedCount > 0
        ? t("detailPage.statSelectedHint", { value: count(selectedCount), count: selectedCount })
        : t("detailPage.statNoneSelected");
    const percent = totalOrders > 0 ? Math.round((selectedCount / totalOrders) * 100) : 0;

    const leadNode =
      lead === "selected" ? (
        <StatCard
          label={t("detailPage.statSelected")}
          icon={ListChecks}
          value={count(selectedCount)}
          unit={t("detailPage.statOfTotal", { value: count(totalOrders), count: totalOrders })}
          hint={isCourier ? t("detailPage.statSum", { sum: money(selectedSum) }) : selectedHint}
        >
          {isCourier ? (
            <span
              role="progressbar"
              aria-label={t("detailPage.statProgress")}
              aria-valuemin={0}
              aria-valuemax={totalOrders}
              aria-valuenow={selectedCount}
              className="mt-1.5 block h-2 overflow-hidden rounded-full bg-sunken"
            >
              <span
                className="block h-full rounded-full bg-action transition-[width] duration-200 motion-reduce:transition-none"
                style={{ width: `${percent}%` }}
              />
            </span>
          ) : null}
        </StatCard>
      ) : lead === "refused" || lead === "total" ? (
        <StatCard
          label={t(lead === "refused" ? "detailPage.statRefused" : "detailPage.statTotal")}
          icon={Package}
          value={count(totalOrders)}
          unit={unit}
          hint={t("detailPage.statSum", { sum: money(totalSum) })}
        />
      ) : null;

    const phoneRows = [
      showSelectionCard && !isCourier
        ? {
            key: "selected",
            label: t("detailPage.statSelected"),
            sub: selectedHint,
            value: t("detailPage.statSelectedOf", { selected: count(selectedCount), total: count(totalOrders) }),
          }
        : null,
      {
        key: "home",
        label: t("detailPage.statHome"),
        sub: t("detailPage.statOrders", { value: count(homeCount), count: homeCount }),
        value: money(homeSum),
      },
      {
        key: "center",
        label: t("detailPage.statCenter"),
        sub: t("detailPage.statOrders", { value: count(centerCount), count: centerCount }),
        value: money(centerSum),
      },
    ].filter((row): row is { key: string; label: string; sub: string; value: string } => row !== null);

    return (
      <>
        {/* ≥ 768 — ko'rsatkich kartalari */}
        <div
          role="group"
          aria-label={t("detailPage.summaryLabel")}
          // Planshetda ham bir qatorda (maket: 768 da uchta karta yonma-yon).
          className={cx("grid gap-4 max-md:hidden", leadNode ? "grid-cols-3" : "grid-cols-2")}
        >
          {leadNode}
          <StatCard
            label={t("detailPage.statHome")}
            icon={MapPin}
            value={count(homeCount)}
            unit={unit}
            hint={t("detailPage.statSum", { sum: money(homeSum) })}
          />
          <StatCard
            label={t("detailPage.statCenter")}
            icon={Building2}
            value={count(centerCount)}
            unit={unit}
            hint={t("detailPage.statSum", { sum: money(centerSum) })}
          />
        </div>

        {/* < 768 — xulosa kartasi */}
        {isCourier ? (
          <Card as="section" padding="none" aria-label={t("detailPage.summaryLabel")} className="hidden max-md:flex">
            <div className="grid grid-cols-2">
              {[
                { key: "home", label: t("detailPage.statHome"), value: homeCount, sum: homeSum },
                { key: "center", label: t("detailPage.statCenter"), value: centerCount, sum: centerSum },
              ].map((item, index) => (
                <div key={item.key} className={index > 0 ? "border-l border-border px-4 py-3.5" : "px-4 py-3.5"}>
                  <div className="text-[13px] font-semibold text-text-muted">{item.label}</div>
                  <div className="text-[22px] leading-[30px] font-bold text-text">
                    {count(item.value)}
                    <span className="ml-1 text-[13px] font-semibold text-text-muted">{unit}</span>
                  </div>
                  <div className="text-xs text-text-muted">{money(item.sum)}</div>
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <Card as="section" padding="none" aria-label={t("detailPage.summaryLabel")} className="hidden max-md:flex">
            <dl className="m-0 flex flex-col px-4">
              {phoneRows.map((row) => (
                <div
                  key={row.key}
                  className="flex items-center justify-between gap-3 border-b border-border py-3 last:border-b-0"
                >
                  <dt className="flex min-w-0 flex-col">
                    <span className="text-sm font-semibold text-text">{row.label}</span>
                    <span className="text-xs text-text-muted">{row.sub}</span>
                  </dt>
                  <dd className="m-0 whitespace-nowrap text-sm font-semibold text-text">{row.value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        )}
      </>
    );
  },
);
MailStatCards.displayName = "MailStatCards";

export default MailStatCards;
