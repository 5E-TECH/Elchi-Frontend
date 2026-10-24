// dizayn-v2: superadmin-warehouse-detail, admin-warehouse-detail, manager-warehouse-detail
import type { WarehouseMovement } from "../../../../entities/warehouse";
import { Badge } from "../../../../shared/ui/primitives";
import { cx } from "../../../../shared/lib/cx";
import { STAT_ICON } from "../../model/classes";
import { MOVEMENT_ICON, useWarehouseText } from "../../model/useWarehouseText";

/**
 * Harakat qatori (maket «Oxirgi harakatlar» `.el-list-item`): neytral ikonka katagi, tur belgisi («Kirim», «Band»,
 * «Chiqim», «Qaytdi», «Tuzatish») + sarlavha, «mahsulot · market» (qaytishda «· omborga qaytdi»; izoh/sabab bo'lsa —
 * oxirida), o'ngda miqdor (kirim va qaytish — yashil «+40 dona», qolgani neytral) va «sana · muallif»; telefonda sana
 * matn ostida.
 */
export const MovementItem = ({ movement }: { movement: WarehouseMovement }) => {
  const text = useWarehouseText();
  const { t } = text;
  const Icon = MOVEMENT_ICON[movement.type];
  const amount = text.movementAmount(movement);
  const subParts = [
    movement.product.name,
    movement.market.name,
    movement.type === "RETURN" ? t("movement.returnedToWarehouse") : null,
    movement.note,
  ].filter(Boolean);
  const actor = text.actorText(movement.actor);
  const when = [text.dateTime(movement.createdAt), actor].filter(Boolean).join(" · ");

  return (
    <li className="flex min-w-0 items-start gap-3 border-b border-border px-5 py-3 last:border-b-0 max-md:px-4">
      <span aria-hidden="true" className={STAT_ICON}>
        <Icon size={18} strokeWidth={2} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Badge>{text.movementLabel(movement.type)}</Badge>
          <span className="font-semibold text-text">{text.movementTitle(movement)}</span>
        </span>
        {subParts.length ? <span className="text-[13px] text-text-muted">{subParts.join(" · ")}</span> : null}
        <span className="text-xs text-text-muted md:hidden">{when}</span>
      </span>
      <span className="flex flex-none flex-col items-end gap-0.5 text-right">
        <span className={cx("whitespace-nowrap font-semibold", amount.positive ? "text-success-fg" : "text-text")}>
          {amount.text}
        </span>
        <span className="whitespace-nowrap text-xs text-text-muted max-md:hidden">{when}</span>
      </span>
    </li>
  );
};
