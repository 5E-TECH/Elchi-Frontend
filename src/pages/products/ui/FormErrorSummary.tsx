// dizayn-v2: superadmin-products-create-errors, admin-products-create-errors
import { CircleX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import { TONE_SOFT } from "../../../shared/ui/primitives";

/**
 * FORMA XATO XULOSASI — maket `*-products-create-errors` (`.el-alert.el-tone-danger`, CODE-MAP 2.7): «Saqlab
 * bo'lmadi» + «N ta maydonda xato bor — qizil bilan belgilanganlarni to'g'rilang.». «Saqlash» bosilgandan keyin
 * forma tepasida (yaratish sahifasi va tahrirlash oynasi); xato maydon qolmasa yo'qoladi. `count` 0 — chizilmaydi.
 */
export const FormErrorSummary = ({ count }: { count: number }) => {
  const { t } = useTranslation("products");
  if (count <= 0) return null;
  return (
    <div
      role="alert"
      className={cx(
        "flex min-w-0 items-start gap-3 rounded-xl px-4 py-3 text-sm",
        TONE_SOFT.danger,
      )}
    >
      <CircleX size={20} strokeWidth={2} aria-hidden="true" className="mt-px shrink-0" />
      <div className="flex min-w-0 flex-col gap-0.5 text-text">
        <span className="font-bold">{t("v2.form.errorTitle")}</span>
        <span className="text-[13px] leading-[18px]">
          {t("v2.form.errorDescription", { count })}
        </span>
      </div>
    </div>
  );
};
