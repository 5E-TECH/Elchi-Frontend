// dizayn-v2: superadmin-dashboard-main, admin-dashboard-main, registrator-dashboard-main, courier-dashboard-home, market-dashboard-home, manager-branch-dashboard-main
import type { LucideIcon } from "lucide-react";
import { memo, type ReactNode } from "react";
import { ChartNote, RankList, type RankItem, type RankListProps } from "../../../shared/ui/charts";
import { Card, TONE_SOFT } from "../../../shared/ui/primitives";

export interface TopRankCardProps {
  title: string;
  description: string;
  items: RankItem[];
  /** «Yana ko'rsatish» ochadigan to'liq ro'yxat (sukut — `items`). */
  expandedItems?: RankItem[];
  expandable?: boolean;
  /** Yig'iq holatdagi qatorlar: sukut 5, telefonda 3 (maket). */
  limit?: number;
  mobileLimit?: number;
  pinned?: RankItem;
  meterTarget?: number;
  meterTone?: RankListProps["meterTone"];
  /** Ro'yxat bo'sh bo'lganda (`EmptyState size="chart"`). */
  empty: ReactNode;
  /** Ro'yxat ostidagi qism (`.el-chart-foot`): «Sizning o'rningiz», legenda. */
  footer?: ReactNode;
  /** ⓘ izoh: «Ma'lumot hali kam — …». */
  note?: ReactNode;
  /** Sarlavha yonidagi neytral ikonka (kuryer «Top kuryerlar» — kubok, telefonda yashirin). */
  icon?: LucideIcon;
  className?: string;
}

/**
 * REYTING KARTASI («Top marketlar / filiallar / kuryerlar / operatorlar»): `Card` + `RankList`.
 * Top 5 (telefonda 3), «Yana ko'rsatish · {n} ta» — to'liq ro'yxat.
 */
const TopRankCard = ({
  title,
  description,
  items,
  expandedItems,
  expandable = false,
  limit = 5,
  mobileLimit = 3,
  pinned,
  meterTarget,
  meterTone,
  empty,
  footer,
  note,
  icon: Icon,
  className,
}: TopRankCardProps) => (
  <Card
    divided={false}
    className={className}
    title={title}
    description={description}
    actions={
      Icon ? (
        <span
          aria-hidden="true"
          className={`inline-flex size-9 items-center justify-center rounded-[10px] max-md:hidden ${TONE_SOFT.neutral}`}
        >
          <Icon size={18} />
        </span>
      ) : undefined
    }
    bodyClassName="flex flex-1 flex-col gap-4"
  >
    {items.length === 0 && !pinned ? (
      empty
    ) : (
      <RankList
        items={items}
        expandedItems={expandedItems}
        ariaLabel={title}
        limit={limit}
        mobileLimit={mobileLimit}
        expandable={expandable}
        pinned={pinned}
        meterTarget={meterTarget}
        meterTone={meterTone}
      />
    )}
    {footer || note ? (
      <div className="mt-auto flex flex-col gap-3">
        {footer ? (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-4">{footer}</div>
        ) : null}
        {note ? <ChartNote>{note}</ChartNote> : null}
      </div>
    ) : null}
  </Card>
);

export default memo(TopRankCard);
