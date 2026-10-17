// dizayn-v2: tizim-charts
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { cx } from "../../lib/cx";
import { formatNumberLocalized } from "../../lib/formatMoney";
import { Badge, Button } from "../primitives";
import { Meter } from "./Meter";
import type { ChartTone } from "./tone";

export interface RankItem {
  id: string;
  name: string;
  /** O'ng tomondagi asosiy qiymat: «84,4%», «112 ta». */
  value: string;
  /** Qiymat ostidagi izoh: «38 / 45 ta». */
  sub?: string;
  /** 0..100 — meter (berilmasa meter yo'q). */
  share?: number;
  /** Berilmasa — ismdan bosh harflar. */
  avatarText?: string;
  /** «Siz», «Sizning filial», «Asosiy». */
  badge?: { label: string; tone?: ChartTone; outline?: boolean };
  /** O'z qatori (pinned qator foni, ekran o'quvchi uchun badge yetarli). */
  highlight?: boolean;
  onClick?: () => void;
  href?: string;
  /** Ism ostidagi qo'shimcha qator: «telefon · summa». */
  meta?: ReactNode;
  /** O'rin raqami (sukut — tartib raqami); pinned qatorda majburiy. */
  rank?: number;
  /** Shu qator meter rangi (`RankListProps.meterTone` ustidan). */
  meterTone?: ChartTone;
  /** Qator nomi (ekran o'quvchi), masalan «3. Jasur Tursunov (siz)». */
  ariaLabel?: string;
}

export interface RankListProps {
  items: RankItem[];
  ariaLabel: string;
  /** Yig'iq holatda ko'rinadigan qatorlar (sukut 5). */
  limit?: number;
  /** Telefonda (< 768) yig'iq holatdagi qatorlar (sukut — `limit`). */
  mobileLimit?: number;
  /** «Yana ko'rsatish · {n} ta» / «Kamroq ko'rsatish». */
  expandable?: boolean;
  showAvatar?: boolean;
  meterTone?: ChartTone;
  /** Meter ustidagi maqsad chizig'i (0..100): «Baraka Shop o'rtachasi». */
  meterTarget?: number;
  /** Ro'yxatdan tashqari, pastda alohida (o'z filiali 6-o'rin). */
  pinned?: RankItem;
  /** Ochilganda ko'rsatiladigan to'liq ro'yxat (sukut — `items`). */
  expandedItems?: RankItem[];
  /** Boshqariladigan ochiq holat (sukut — ichki). */
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  className?: string;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase() ?? "")
    .join("") || "—";

const ROW_GRID = {
  avatar:
    "grid-cols-[24px_32px_minmax(0,1fr)_auto] max-md:grid-cols-[24px_minmax(0,1fr)_auto]",
  plain: "grid-cols-[24px_minmax(0,1fr)_auto]",
} as const;

const RankRow = ({
  item,
  position,
  showAvatar,
  meterTone,
  meterTarget,
  hiddenOnPhone,
  pinned,
}: {
  item: RankItem;
  position: number;
  showAvatar: boolean;
  meterTone?: ChartTone;
  meterTarget?: number;
  hiddenOnPhone?: boolean;
  pinned?: boolean;
}) => {
  const { i18n } = useTranslation();
  const clickable = item.onClick != null || item.href != null;
  // Butun qator bosiladi: ism — haqiqiy havola/tugma, `after:` qatlami qatorni qoplaydi.
  const nameClass = cx(
    "min-w-0 truncate text-left text-sm font-semibold text-text",
    clickable && "after:absolute after:inset-0 after:content-[''] hover:underline",
  );
  const name = item.href ? (
    <Link to={item.href} className={nameClass}>
      {item.name}
    </Link>
  ) : item.onClick ? (
    <button type="button" onClick={item.onClick} className={nameClass}>
      {item.name}
    </button>
  ) : (
    <span className={nameClass}>{item.name}</span>
  );

  return (
    <li
      aria-label={item.ariaLabel}
      data-rank-row=""
      data-highlight={item.highlight ? "" : undefined}
      className={cx(
        "relative grid min-h-11 items-center gap-x-3 py-2.5",
        showAvatar ? ROW_GRID.avatar : ROW_GRID.plain,
        pinned ? "rounded-xl bg-sunken px-3" : "border-t border-border first:border-t-0",
        clickable && "transition-colors duration-150 hover:bg-row-hover motion-reduce:transition-none",
        hiddenOnPhone && "max-md:hidden",
      )}
    >
      <span className="inline-flex size-6 items-center justify-center rounded-full bg-sunken text-xs font-bold text-text-muted">
        {formatNumberLocalized(position, { language: i18n.language })}
      </span>
      {showAvatar ? (
        <span
          aria-hidden="true"
          className="inline-flex size-8 items-center justify-center rounded-full bg-sunken text-xs font-bold text-text-muted ring-1 ring-inset ring-border max-md:hidden"
        >
          {item.avatarText ?? initials(item.name)}
        </span>
      ) : null}
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          {name}
          {item.badge ? (
            <Badge
              size="sm"
              tone={item.badge.tone === "action" ? "info" : (item.badge.tone ?? "info")}
              variant={item.badge.outline ? "outline" : undefined}
              className="shrink-0"
            >
              {item.badge.label}
            </Badge>
          ) : null}
        </span>
        {item.share != null ? (
          <Meter value={item.share} thickness="thin" tone={item.meterTone ?? meterTone} target={meterTarget} />
        ) : null}
        {item.meta != null ? <span className="min-w-0 truncate text-xs text-text-muted">{item.meta}</span> : null}
      </div>
      <div className="flex min-w-16 flex-col items-end text-right">
        <span className="whitespace-nowrap text-sm font-bold text-text proportional-nums">{item.value}</span>
        {item.sub ? <span className="whitespace-nowrap text-xs text-text-muted">{item.sub}</span> : null}
      </div>
    </li>
  );
};

/**
 * REYTING (`.el-rank`, `<ol>`): o'rin · avatar (bosh harflar, telefonda yashirin) · ism + meter ·
 * qiymat + «38 / 45 ta». Yig'iq holatda `limit` (telefonda `mobileLimit`) qator, «Yana ko'rsatish»
 * qolganini ochadi. `pinned` — ro'yxatdan tashqari pastdagi o'z qatori («Sizning filial»).
 */
export const RankList = ({
  items,
  ariaLabel,
  limit = 5,
  mobileLimit,
  expandable = false,
  showAvatar = true,
  meterTone,
  meterTarget,
  pinned,
  expandedItems,
  expanded: expandedProp,
  onExpandedChange,
  className,
}: RankListProps) => {
  const { t } = useTranslation("dashboard");
  const [expandedState, setExpandedState] = useState(false);
  const expanded = expandedProp ?? expandedState;
  const setExpanded = (next: boolean) => {
    if (expandedProp === undefined) setExpandedState(next);
    onExpandedChange?.(next);
  };

  const phoneLimit = Math.min(mobileLimit ?? limit, limit);
  const fullList = expandedItems ?? items;
  const rows = expanded ? fullList : items.slice(0, limit);
  // Yig'iq holatda ko'rinmay qolganlar (to'liq ro'yxat qisqasidan uzun bo'lishi mumkin — «Top marketlar»).
  const moreDesktop = Math.max(0, fullList.length - Math.min(items.length, limit));
  const morePhone = Math.max(0, fullList.length - Math.min(items.length, phoneLimit));
  const canToggle = expandable && (expanded || morePhone > 0);

  return (
    <div className={cx("flex min-w-0 flex-col gap-2", className)}>
      <ol aria-label={ariaLabel} className="m-0 flex list-none flex-col p-0">
        {rows.map((item, index) => (
          <RankRow
            key={item.id}
            item={item}
            position={item.rank ?? index + 1}
            showAvatar={showAvatar}
            meterTone={meterTone}
            meterTarget={meterTarget}
            hiddenOnPhone={!expanded && index >= phoneLimit}
          />
        ))}
      </ol>
      {pinned ? (
        <ol aria-label={ariaLabel} className="m-0 list-none p-0">
          <RankRow
            item={pinned}
            position={pinned.rank ?? items.length + 1}
            showAvatar={showAvatar}
            meterTone={meterTone}
            meterTarget={meterTarget}
            pinned
          />
        </ol>
      ) : null}
      {canToggle ? (
        <Button
          variant="ghost"
          size="sm"
          className={cx("self-center", !expanded && moreDesktop === 0 && "md:hidden")}
          aria-expanded={expanded}
          rightIcon={expanded ? ChevronUp : ChevronDown}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            t("v2Charts.showLess")
          ) : (
            <>
              <span className="max-md:hidden">{t("v2Charts.showMore", { count: moreDesktop })}</span>
              <span className="md:hidden">{t("v2Charts.showMore", { count: morePhone })}</span>
            </>
          )}
        </Button>
      ) : null}
    </div>
  );
};
