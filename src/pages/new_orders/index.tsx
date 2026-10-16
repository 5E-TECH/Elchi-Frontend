// dizayn-v2: superadmin-neworders-markets, admin-neworders-markets, manager-new-orders-markets, registrator-new-orders-markets, market-new-orders-list
import { memo } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "../../app/config/store";
import { resolveNewOrdersShellMode } from "./model/newOrdersShell";
import NewOrdersHeader from "./ui/NewOrdersHeader";
import NewOrdersTabs from "./ui/NewOrdersTabs";

/**
 * «QABUL VA YARATISH» QOBIG'I — barcha `/new-orders/*` bola route'lari shu ichida.
 *
 * Rejim yo'lga va rolga qarab (`resolveNewOrdersShellMode`):
 *  - `bare`   — faqat `<Outlet/>`: bola o'z sarlavhasini («← Qabul va yaratish» + nom) chizadi (yaratish,
 *               skaner, market buyurtmalari, tahrirlash) — sarlavha va tablar takrorlanmasin;
 *  - `hosted` — sahifa ildizi + «Qabul va yaratish» sarlavhasi; tablar bola sahifaning birinchi kartasida
 *               (`NewOrdersTabs`, maket `superadmin-neworders-markets`);
 *  - `legacy` — hali ko'chirilmagan bolalar (filial paketlari, bekor qilinganlar): sarlavha va tablar sahifa
 *               fonida, bola sahifa o'zgarmagan.
 * Sahifa shell kontent slotida: tashqi karta va chekka yo'q, ildiz faqat bo'limlar oralig'ini beradi.
 */
const NewOrders = () => {
  const location = useLocation();
  const role = useSelector((state: RootState) => state.role.role);
  const mode = resolveNewOrdersShellMode(location.pathname, role);

  if (mode === "bare") return <Outlet />;

  return (
    <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
      <NewOrdersHeader />
      {mode === "legacy" ? <NewOrdersTabs background="bg" listClassName="" /> : null}
      <Outlet />
    </div>
  );
};

export default memo(NewOrders);
