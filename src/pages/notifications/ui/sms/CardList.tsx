// dizayn-v2: superadmin-notifications-sms-campaign, superadmin-notifications-sms-templates
import type { ReactNode } from "react";
import { cx } from "../../../../shared/lib/cx";

type CardListProps<T> = {
  rows: readonly T[];
  getRowKey: (row: T, index: number) => string;
  renderCard: (row: T, index: number) => ReactNode;
  /** Ro'yxat nomi (`aria-label`). */
  label: string;
  /** Fonda yangilanmoqda — ro'yxat xiralashadi (`aria-busy`). */
  busy?: boolean;
};

/**
 * Planshetdagi ro'yxat (`.el-list.el-show-tablet`): maketda SMS tarixi va shablonlar jadvali < 1024 da kartalarga
 * aylanadi. Kartaning o'zi — o'sha `renderCard` (telefondagi `DataTable` kartasi bilan bir xil).
 */
export const CardList = <T,>({
  rows,
  getRowKey,
  renderCard,
  label,
  busy = false,
}: CardListProps<T>) => (
  <ul
    aria-label={label}
    aria-busy={busy || undefined}
    className={cx(
      "m-0 flex min-w-0 list-none flex-col p-0",
      busy && "opacity-60 transition-opacity duration-150 motion-reduce:transition-none",
    )}
  >
    {rows.map((row, index) => (
      <li key={getRowKey(row, index)} className="min-w-0 border-b border-border last:border-b-0">
        {renderCard(row, index)}
      </li>
    ))}
  </ul>
);

export default CardList;
