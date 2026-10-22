// dizayn-v2: superadmin-payments-main-cashbox-shift-closed, admin-payments-main-cashbox-shift-closed, manager-payments-main-cashbox-shift-closed
import { memo, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import { TONE_SOFT } from "../../../shared/ui/primitives";

/**
 * «SMENA BOSHLANMAGAN» BANNERI — maketdagi `.el-alert.el-tone-warning` (`*-payments-main-cashbox-shift-closed`):
 * ogohlantirish ikonkasi, qalin sarlavha, 13 px izoh (qaysi amallar smena ochilgach ishlaydi). Kassa ekranlari
 * (asosiy kassa, menejer «To'lovlar», kassa tafsiloti) bir xil komponentdan foydalanadi; izoh matni ekranga qarab
 * beriladi, ixtiyoriy `action` — matn ostidagi tugma.
 */

type ShiftBannerProps = {
  /** Izoh: qaysi amallar qulf ekani («Pul qabul qilish, … smena ochilgandan keyin ishlaydi …»). */
  description: ReactNode;
  /** Sarlavha (sukut — «Smena boshlanmagan»). */
  title?: ReactNode;
  action?: ReactNode;
  className?: string;
};

const ShiftBanner = ({ description, title, action, className }: ShiftBannerProps) => {
  const { t } = useTranslation("payments");
  return (
    <div
      role="status"
      data-testid="shift-banner"
      className={cx("flex min-w-0 items-start gap-3 rounded-xl px-4 py-3 text-sm", TONE_SOFT.warning, className)}
    >
      <TriangleAlert size={18} aria-hidden="true" className="mt-px shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-1 text-text">
        <div className="font-bold">{title ?? t("v2MainCashbox.shift.banner.title")}</div>
        <div className="text-[13px] leading-[18px] wrap-break-word">{description}</div>
        {action ? <div className="flex flex-wrap gap-2 pt-1">{action}</div> : null}
      </div>
    </div>
  );
};

export default memo(ShiftBanner);
