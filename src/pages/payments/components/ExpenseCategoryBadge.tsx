// dizayn-v2: (maket yo'q) superadmin-payments-main-cashbox
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import { Badge } from "../../../shared/ui/primitives";

/**
 * Kassa tarixi qatoridagi xarajat kategoriyasi (Elchi Pochta №1) — `expense_category_name`, yozilgan paytdagi nom
 * (kategoriya keyin o'zgartirilsa yoki o'chirilsa ham tarix o'zgarmaydi). Dizayn tizimi: tur va toifa — nuqtasiz
 * neytral `Badge` (`Badge.tsx`). Maketda yo'q (`route-map.json` izohi: backend kategoriya bermasdi) — eng yaqini
 * jadvaldagi «Chiqim» belgisi. Uzun nom kesiladi (to'liq nomi `title` da), ekran o'quvchiga «Kategoriya: …».
 */

const ExpenseCategoryBadge = ({ name, className }: { name: string; className?: string }) => {
  const { t } = useTranslation("payments");
  return (
    <Badge title={name} data-expense-category="" className={cx("max-w-full min-w-0", className)}>
      <span className="sr-only">{t("v2Common.category")}: </span>
      <span className="min-w-0 truncate">{name}</span>
    </Badge>
  );
};

export default memo(ExpenseCategoryBadge);
