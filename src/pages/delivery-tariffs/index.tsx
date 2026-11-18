// dizayn-v2: superadmin-regions-delivery-tariffs, admin-regions-delivery-tariffs, superadmin-regions-delivery-tariff-edit-dialog, admin-regions-delivery-tariff-edit-dialog
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { PageHeader } from "../../shared/ui/primitives";
import { DeliveryTariffsContent } from "./ui/DeliveryTariffsContent";

/**
 * «YETKAZISH TARIFLARI» — `/delivery-tariffs` (47WFHzlx; guard `canManageDeliveryTariffs`: superadmin, admin —
 * backend boshqa rolga 403). Maketlar `superadmin-regions-delivery-tariffs` (= admin) va
 * `*-regions-delivery-tariff-edit-dialog`. «← Hududlar»; bloklar: tariflar jadvali + «O'zgartirish» oynasi (yangi
 * versiya, `POST /delivery/tariffs`), «Hisob qoidalari» (`first_kg_included` — qo'shimcha haq chegarasi,
 * `volumetric_from_kg` — hajm bo'yicha hisoblash chegarasi va boshqa sozlamalar, `PATCH /delivery/pricing-settings`),
 * «Narx kalkulyatori» (`POST /delivery/quote/by-tariff`), «O'zgarishlar tarixi» (`GET /delivery/tariffs` versiyalari).
 * Saqlangach `deliveryPricing` keshi yangilanadi — jadval, tarix va kalkulyator yangi qiymatlar bilan qayta chiziladi.
 *
 * Ops vositalaridagi «Yetkazish narxi» tabi (ega 2026-10-25) shu sahifani takrorlardi — LIuf0DcD da olib tashlandi
 * (ega 2026-11-16): `/ops?tab=delivery-pricing` shu sahifaga yo'naltiradi.
 */
const DeliveryTariffsPage = () => {
  const { t } = useTranslation("deliveryPricing");

  return (
    <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
      <PageHeader back="/regions" backLabel={t("page.back")} title={t("page.title")} description={t("page.subtitle")} />
      <DeliveryTariffsContent />
    </div>
  );
};

export default memo(DeliveryTariffsPage);
