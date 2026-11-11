// dizayn-v2: superadmin-neworders-markets, admin-neworders-markets, manager-new-orders-markets, registrator-new-orders-markets, market-new-orders-list
import { memo } from "react";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import type { RootState } from "../../../app/config/store";
import { buttonClasses, PageHeader } from "../../../shared/ui/primitives";
import OrderIntakeControl from "./OrderIntakeControl";

/**
 * «Qabul va yaratish» sarlavhasi — qobiq (`hosted` va `legacy` rejimlar) chizadi.
 *
 * Yagona asosiy amal — «Buyurtma yaratish» havolasi (`/new-orders/create`): v1 dagi tugma o'rnida,
 * havola bo'lgani uchun yangi oynada ham ochiladi. Telefonda `PageHeader` uni to'liq enga cho'zadi.
 * Izoh market rolida boshqacha (maket `market-new-orders-list`).
 *
 * Yonida — «Bugungi qabul vaqti» (`OrderIntakeControl`, 2026-11-08): superadmin uchun ikkinchi darajali havola Ops →
 * «Kun tartibi»ga (2026-11-10), boshqa rollarda (admin ham) holat belgisi; backend endpointi yo'q bo'lsa ko'rinmaydi.
 */
const NewOrdersHeader = () => {
  const { t } = useTranslation("newOrders");
  const isMarket = useSelector((state: RootState) => state.role.role) === "market";

  return (
    <PageHeader
      title={t("pageTitle")}
      description={isMarket ? t("shell.marketDescription") : t("pageDescription")}
      actions={
        <>
          <OrderIntakeControl />
          <Link to="/new-orders/create" className={buttonClasses()}>
            <Plus aria-hidden="true" size={18} strokeWidth={2} className="shrink-0" />
            {t("createOrderBtn")}
          </Link>
        </>
      }
    />
  );
};

export default memo(NewOrdersHeader);
