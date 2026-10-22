// dizayn-v2: courier-orders-pending, courier-orders-all, courier-orders-cancelled, courier-orders-tab-switcher-open
import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Tabs as TabsPrimitive, type TabItem, type TabsBackground } from "../../../../../shared/ui/primitives";
import type { CourierOrderCounts } from "../../../../../entities/orders";
import type { CourierOrdersTab } from "./ordertable/courierOrdersModel";

/**
 * Kuryer buyurtmalari tablari: «Kutilayotgan · Barchasi · Bekor qilingan» (maket `courier-orders-*`).
 * Kompyuter/planshetda — karta ichida (`listClassName="px-3"`), telefonda — karta ustida, butun enda
 * teng bo'lib (`fullWidth`, `courier-orders-tab-switcher-open`).
 *
 * Har tab soni (maketdagi 7 · 24 · 3) — `GET orders/courier/orders/counts` (OR-1; `counts`): kelmaguncha
 * yoki xatoda sonsiz. Ro'yxat yangilanayotganda sonlar xira (`countBusy`, maket `courier-orders-pending-refreshing`).
 */

const TAB_LABEL_KEYS: Record<CourierOrdersTab, string> = {
  pending: "courierList.tabPending",
  all: "courierList.tabAll",
  cancelled: "courierList.tabCancelled",
};

const TAB_ORDER: readonly CourierOrdersTab[] = ["pending", "all", "cancelled"];

/** Tab → `counts` maydoni («Kutilayotgan» = `waiting`). */
const COUNT_FIELD: Record<CourierOrdersTab, keyof CourierOrderCounts> = {
  pending: "waiting",
  all: "all",
  cancelled: "cancelled",
};

type TabsProps = {
  onChange?: (tabId: string) => void;
  defaultTab?: string;
  activeTab?: string;
  /** Telefonda: tablar butun enni teng bo'lib egallaydi. */
  fullWidth?: boolean;
  /** Ro'yxat nomi (sukut «Holat bo'yicha»; telefonda maketdagi «Buyurtmalar turi»). */
  ariaLabel?: string;
  className?: string;
  listClassName?: string;
  background?: TabsBackground;
  /** Tab sonlari (`GET orders/courier/orders/counts`); berilmasa — sonsiz. */
  counts?: CourierOrderCounts;
  /** Ro'yxat yangilanmoqda — sonlar xira (`Tabs countBusy`). */
  countBusy?: boolean;
};

const isTab = (value: string | undefined): value is CourierOrdersTab =>
  value === "pending" || value === "all" || value === "cancelled";

const Tabs = ({
  onChange,
  defaultTab = "pending",
  activeTab,
  fullWidth = false,
  ariaLabel,
  className,
  listClassName = "px-3",
  background,
  counts,
  countBusy = false,
}: TabsProps) => {
  const { t } = useTranslation("orders");
  const [internalTab, setInternalTab] = useState(defaultTab);
  const current = activeTab ?? internalTab;
  const value: CourierOrdersTab = isTab(current) ? current : "pending";

  const items: TabItem<CourierOrdersTab>[] = TAB_ORDER.map((tab) => ({
    value: tab,
    label: t(TAB_LABEL_KEYS[tab]),
    ...(counts ? { count: counts[COUNT_FIELD[tab]] } : {}),
  }));

  return (
    <TabsPrimitive
      items={items}
      value={value}
      onValueChange={(next) => {
        setInternalTab(next);
        onChange?.(next);
      }}
      ariaLabel={ariaLabel ?? t("courierList.tabsLabel")}
      fullWidth={fullWidth}
      className={className}
      listClassName={listClassName}
      background={background}
      countBusy={Boolean(counts) && countBusy}
    />
  );
};

export default memo(Tabs);
