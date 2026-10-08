import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { GitBranch } from "lucide-react";

/**
 * QISMAN SOTUVDAN TUG'ILGAN BUYURTMA — asosiy (ota) buyurtmaga havola.
 *
 * Ilgari `parent_order_id` faqat QR moslashtirishda ishlatilardi; operator
 * bu buyurtmaning qaysi buyurtmadan qolganini bilmasdi. Teskari yo'nalish
 * (ota → bola) uchun backendda `parent_order_id` bo'yicha qidiruv kerak — hozir yo'q.
 */
const OrderParentBanner = ({ parentOrderId }: { parentOrderId: string | null | undefined }) => {
  const { t } = useTranslation("orders");
  if (!parentOrderId) return null;
  return (
    <div
      role="note"
      data-testid="order-parent-banner"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100"
    >
      <GitBranch size={16} className="shrink-0" />
      <span className="min-w-0 flex-1">{t("metaParentBanner", { id: parentOrderId })}</span>
      <Link
        to={`/orders/edit/${parentOrderId}`}
        className="font-semibold text-main underline-offset-2 hover:underline dark:text-amber-200"
      >
        {t("metaParentOpen")}
      </Link>
    </div>
  );
};

export default memo(OrderParentBanner);
