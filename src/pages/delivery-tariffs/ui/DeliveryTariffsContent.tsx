// dizayn-v2: superadmin-regions-delivery-tariffs, admin-regions-delivery-tariffs, superadmin-regions-delivery-tariff-edit-dialog, admin-regions-delivery-tariff-edit-dialog
import { useState } from "react";
import {
  useDeliveryPricingSettings,
  useDeliveryPricingSettingsHistory,
  useDeliveryTariffs,
  type DeliveryTariffId,
} from "../../../entities/delivery-pricing";
import { PriceCalculatorCard } from "./PriceCalculatorCard";
import { PricingRulesCard } from "./PricingRulesCard";
import { TariffEditDialog } from "./TariffEditDialog";
import { TariffHistoryCard } from "./TariffHistoryCard";
import { TariffsCard } from "./TariffsCard";

/**
 * «YETKAZISH NARXI» TANASI — sarlavhasiz bloklar: tariflar jadvali + «O'zgartirish» oynasi, «Hisob qoidalari»
 * (`volumetric_from_kg` — hajm chegarasi ham), «Narx kalkulyatori», «O'zgarishlar tarixi». Ikki joyda bir xil:
 * `/delivery-tariffs` («← Hududlar», superadmin va admin) va Ops vositalari → «Yetkazish narxi»
 * (`/ops?tab=delivery-pricing`, superadmin). Ildiz — fragment: bo'limlar oralig'ini ota konteyner beradi.
 */
export const DeliveryTariffsContent = () => {
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
    <>
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
    </>
  );
};
