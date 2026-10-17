// dizayn-v2: superadmin-branches-list-table
import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { Branch } from "../../../entities/branch";
import { cx } from "../../../shared/lib/cx";
import { useIsPhone } from "../../../shared/ui/primitives/date/useIsPhone";
import { BranchSummaryCard } from "./BranchSummaryCard";

type BranchCardsProps = {
  data: readonly Branch[];
  onEdit: (branch: Branch) => void;
  onDelete: (branch: Branch) => void;
  onOpen: (branch: Branch) => void;
  busy?: boolean;
};

/**
 * «KARTALAR» KO'RINISHI (maket `superadmin-branches-list-table` — «Jadval / kartalar»): desktopda 4 ustunli
 * to'r (sahifada 8 ta), < 1280 — 3, < 1024 — 2; telefonda jadvalning telefon kartalari bilan bir xil ro'yxat
 * (`.el-list-item`, ichma-ich karta yo'q).
 */
const BranchCards = ({ data, onEdit, onDelete, onOpen, busy = false }: BranchCardsProps) => {
  const { t } = useTranslation("branches");
  const isPhone = useIsPhone();

  return (
    <ul
      aria-label={t("v2.list.cardsLabel")}
      aria-busy={busy || undefined}
      className={cx(
        isPhone ? "flex flex-col" : "grid grid-cols-4 gap-4 p-5 max-xl:grid-cols-3 max-lg:grid-cols-2",
        busy && "opacity-60",
      )}
    >
      {data.map((branch) => (
        <li key={branch.id} className={cx("min-w-0", isPhone && "border-b border-border last:border-b-0")}>
          <BranchSummaryCard branch={branch} onEdit={onEdit} onDelete={onDelete} onOpen={onOpen} framed={!isPhone} />
        </li>
      ))}
    </ul>
  );
};

export default memo(BranchCards);
