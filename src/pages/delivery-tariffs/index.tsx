// dizayn-v2: superadmin-regions-delivery-tariffs, admin-regions-delivery-tariffs, superadmin-regions-delivery-tariff-edit-dialog, admin-regions-delivery-tariff-edit-dialog
import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useDeliveryPricingSettings,
  useDeliveryPricingSettingsHistory,
  useDeliveryTariffs,
  type DeliveryTariffId,
} from "../../entities/delivery-pricing";
import { PageHeader } from "../../shared/ui/primitives";
import { PriceCalculatorCard } from "./ui/PriceCalculatorCard";
import { PricingRulesCard } from "./ui/PricingRulesCard";
import { TariffEditDialog } from "./ui/TariffEditDialog";
import { TariffHistoryCard } from "./ui/TariffHistoryCard";
import { TariffsCard } from "./ui/TariffsCard";

/**
 * «YETKAZISH TARIFLARI» — `/delivery-tariffs` (47WFHzlx; guard `canManageDeliveryTariffs`: superadmin, admin —
 * backend boshqa rolga 403). Maketlar `superadmin-regions-delivery-tariffs` (= admin) va
 * `*-regions-delivery-tariff-edit-dialog`. «← Hududlar»; bloklar: tariflar jadvali + «O'zgartirish» oynasi (yangi
 * versiya, `POST /delivery/tariffs`), «Hisob qoidalari» (`first_kg_included` — qo'shimcha haq chegarasi va boshqa
 * sozlamalar, `PATCH /delivery/pricing-settings`), «Narx kalkulyatori» (`POST /delivery/quote/by-tariff`),
 * «O'zgarishlar tarixi» (`GET /delivery/tariffs` versiyalari). Saqlangach `deliveryPricing` keshi yangilanadi —
 * jadval, tarix va kalkulyator yangi qiymatlar bilan qayta chiziladi.
 */
const DeliveryTariffsPage = () => {
  const { t } = useTranslation("deliveryPricing");
  const tariffsQuery = useDeliveryTariffs();
  const settingsQuery = useDeliveryPricingSettings();
  const settingsHistoryQuery = useDeliveryPricingSettingsHistory();
  const settings = settingsQuery.data ?? null;
  const [editing, setEditing] = useState<DeliveryTariffId | null>(null);
  // Har ochilish — oynaning yangi nusxasi (forma o'sha paytdagi tarif bilan to'ladi).
  const [session, setSession] = useState(0);

  const openEdit = (id: DeliveryTariffId) => {
    setSession((value) => value + 1);
    setEditing(id);
  };

  return (
    <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
      <PageHeader back="/regions" backLabel={t("page.back")} title={t("page.title")} description={t("page.subtitle")} />
      <TariffsCard query={tariffsQuery} settings={settings} onEdit={openEdit} />
      <PricingRulesCard query={settingsQuery} tariffs={tariffsQuery.data} />
      <div className="flex min-w-0 flex-wrap items-start gap-6 max-md:gap-4">
        <PriceCalculatorCard settings={settings} className="flex-[1_1_420px]" />
        <TariffHistoryCard
          query={tariffsQuery}
          settingsVersions={settingsHistoryQuery.data}
          className="flex-[1_1_360px]"
        />
      </div>
      <TariffEditDialog
        key={session}
        tariffId={editing}
        current={editing ? (tariffsQuery.data?.current[editing] ?? null) : null}
        settings={settings}
        onClose={() => setEditing(null)}
      />
    </div>
  );
};

export default memo(DeliveryTariffsPage);
