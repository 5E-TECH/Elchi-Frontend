// dizayn-v2: (maket yo'q) superadmin-orders-detail
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { GitBranch } from "lucide-react";

/**
 * QISMAN SOTUVDAN TUG'ILGAN BUYURTMA — asosiy (ota) buyurtmaga havola.
 *
 * Maket yo'q — tafsilot sahifasidagi ogohlantirishlar qatorida `.el-alert.el-tone-info` sifatida
 * (eng yaqini: `superadmin-orders-detail` qulf ogohlantirishi). Ilgari `parent_order_id` faqat QR
 * moslashtirishda ishlatilardi; operator bu buyurtmaning qaysi buyurtmadan qolganini bilmasdi.
 * Teskari yo'nalish (ota → bola) uchun backendda `parent_order_id` bo'yicha qidiruv kerak — hozir yo'q.
 */
const OrderParentBanner = ({ parentOrderId }: { parentOrderId: string | null | undefined }) => {
  const { t } = useTranslation("orders");
  if (!parentOrderId) return null;
  return (
    <div
      role="note"
      data-testid="order-parent-banner"
      className="flex flex-wrap items-start gap-x-3 gap-y-1 rounded-xl bg-info-soft px-4 py-3 text-sm text-info-fg"
    >
      <GitBranch size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
      {/* Boshlang'ich kenglik 12rem: tor ekranda matn siqilmaydi, havola keyingi qatorga o'tadi. */}
      <span className="min-w-0 flex-[1_1_12rem] text-text" data-testid="order-parent-banner-text">
        {t("metaParentBanner", { id: parentOrderId })}
      </span>
      <Link
        to={`/orders/edit/${parentOrderId}`}
        className="shrink-0 whitespace-nowrap font-semibold text-action-fg underline-offset-2 hover:underline max-md:inline-flex max-md:min-h-11 max-md:items-center max-md:-my-3"
      >
        {t("metaParentOpen")}
      </Link>
    </div>
  );
};

export default memo(OrderParentBanner);
