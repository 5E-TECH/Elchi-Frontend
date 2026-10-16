// dizayn-v2: superadmin-orders-detail, admin-orders-detail, manager-orders-detail, registrator-orders-detail
import { Lock, Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../../../../shared/ui/primitives";

/**
 * Karta sarlavhasidagi «Tahrirlash» (`.el-btn-ghost.el-btn-sm`, maket `*-orders-detail`).
 * O'chiq holatda: `Lock` ikonka, nomi «… — qulflangan» (yoki rol sababi), `aria-describedby` —
 * sahifadagi qulf izohi, `title` — qulf sababi (avvalgi sahifadagidek; testlar ham shuni o'qiydi).
 */
type EditButtonProps = {
  /** Faol tugma nomi: «Mijoz ma'lumotini tahrirlash», «Manzilni tahrirlash», «Buyurtmani tahrirlash». */
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** O'chiq tugma nomi (sukut — «{label} — qulflangan»). */
  disabledLabel?: string;
  /** O'chiq tugma sababi (`title`). */
  reason?: string;
  /** O'chiq tugmani izohlovchi element (`#products-lock`, `#edit-lock`, `#cust-lock`). */
  describedBy?: string;
};

export const EditButton = ({ label, onClick, disabled = false, disabledLabel, reason, describedBy }: EditButtonProps) => {
  const { t } = useTranslation(["orders", "common"]);
  return (
    <Button
      variant="ghost"
      size="sm"
      leftIcon={disabled ? Lock : Pencil}
      onClick={onClick}
      disabled={disabled}
      aria-haspopup="dialog"
      aria-label={disabled ? (disabledLabel ?? t("orderDetail.editLocked", { label })) : label}
      aria-describedby={disabled ? describedBy : undefined}
      title={disabled ? reason : undefined}
      className="-my-1 -mr-2"
    >
      {t("edit", { ns: "common" })}
    </Button>
  );
};
