// dizayn-v2: superadmin-neworders-markets, admin-neworders-markets, registrator-new-orders-markets, market-new-orders-list
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import type { RootState } from "../../../app/config/store";
import { Tabs } from "../../../shared/ui/primitives";
import { useIsPhone } from "../../../shared/ui/primitives/date/useIsPhone";
import { useNewOrdersTabs } from "../model/useNewOrdersTabs";

type Props = {
  /** Ro'yxat chekkasi (sukut: karta ichida `px-3`, market telefonda `px-1`). */
  listClassName?: string;
  className?: string;
};

/**
 * «Qabul va yaratish» bo'limlari — havola tablar (har tab alohida route, `aria-current="page"`).
 *
 * Bola sahifa birinchi kartasini shu bilan boshlaydi (maket: `.el-tabs` karta ichida, 12 px chekka).
 * Bitta yoki undan kam tab bo'lsa `null` — bola o'z karta sarlavhasini chizadi (`useHasNewOrdersTabs`;
 * maket `manager-new-orders-markets`). Market telefonda ikki tab teng bo'lib to'liq enni egallaydi
 * (maket `market-new-orders-list`).
 */
const NewOrdersTabs = ({ listClassName, className }: Props) => {
  const { t } = useTranslation("newOrders");
  const isMarket = useSelector((state: RootState) => state.role.role) === "market";
  const isPhone = useIsPhone();
  const { items, active } = useNewOrdersTabs();

  if (items.length <= 1) return null;

  const fullWidth = isMarket && isPhone;
  return (
    <Tabs
      items={items}
      value={active}
      ariaLabel={isMarket ? t("shell.marketTabsLabel") : t("shell.tabsLabel")}
      background="surface"
      fullWidth={fullWidth}
      listClassName={listClassName ?? (fullWidth ? "px-1" : "px-3")}
      className={className}
    />
  );
};

export default memo(NewOrdersTabs);
