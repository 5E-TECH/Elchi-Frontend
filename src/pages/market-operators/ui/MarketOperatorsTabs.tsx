// dizayn-v2: (maket yo'q) market-products-warehouse-stock
import { useTranslation } from "react-i18next";
import { Tabs } from "../../../shared/ui/primitives";
import { PAYMENTS_VIEW } from "../model/operatorPayments";

/**
 * «OPERATORLAR» SAHIFASI TABLARI (F2qp6FtE): «Operatorlar» · «To'lovlar» (havola tablar, `?view=payments`). Maket yo'q —
 * eng yaqini market «Mahsulotlar | Ombordagi qoldiq» tablari (`market-products-warehouse-stock`, `MarketProductsTabs`).
 */
export const MarketOperatorsTabs = ({ value }: { value: "operators" | typeof PAYMENTS_VIEW }) => {
  const { t } = useTranslation("marketOperators");
  return (
    <Tabs
      ariaLabel={t("tabs.label")}
      background="bg"
      value={value}
      items={[
        { value: "operators", label: t("tabs.operators"), to: "/market-operators", end: true },
        { value: PAYMENTS_VIEW, label: t("tabs.payments"), to: `/market-operators?view=${PAYMENTS_VIEW}` },
      ]}
    />
  );
};
