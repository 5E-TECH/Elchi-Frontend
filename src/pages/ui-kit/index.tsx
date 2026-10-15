// dizayn-v2: (maket yo'q) Main
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "../../shared/ui/primitives";
import { BadgesSection } from "./sections/BadgesSection";
import { ButtonsSection } from "./sections/ButtonsSection";
import { CardsSection } from "./sections/CardsSection";
import { FormatSection } from "./sections/FormatSection";
import { PageHeaderSection } from "./sections/PageHeaderSection";
import { TabsSection } from "./sections/TabsSection";

/**
 * KOMPONENTLAR TO'PLAMI (`/ops/ui-kit`) — dizayn v2 1-bosqich primitivlari namunasi.
 *
 * Maket yo'q: ichki sahifa, eng yaqini — `Main` (dizayn tizimi taxtasi).
 * Faqat superadmin (`canViewUiKit`), menyuda yo'q.
 *
 * Har bo'lim namunani kunduzgi va tungi mavzuda yonma-yon chizadi (`ThemePair`).
 * Skrinshot uchun URL parametrlari:
 *   `?section=<id>`  — faqat shu bo'lim (`buttons`, `badges`, `cards`, `page-header`, `tabs`, `format`;
 *                    noma'lum id — hammasi);
 *   `?theme-pair=0`  — har bo'limda bitta panel, ilovaning joriy mavzusida.
 *   npm run app:shot -- "/ops/ui-kit?section=buttons" --device phone
 */
const SECTIONS: ReadonlyArray<{ id: string; Component: ComponentType }> = [
  { id: "buttons", Component: ButtonsSection },
  { id: "badges", Component: BadgesSection },
  { id: "cards", Component: CardsSection },
  { id: "page-header", Component: PageHeaderSection },
  { id: "tabs", Component: TabsSection },
  { id: "format", Component: FormatSection },
];

export const UiKitPage = () => {
  const { t } = useTranslation("ui");
  const [params] = useSearchParams();
  const only = params.get("section");
  const matched = SECTIONS.filter((section) => section.id === only);
  // Noma'lum `section` — bo'sh sahifa emas, hammasi.
  const sections = matched.length ? matched : SECTIONS;

  return (
    <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
      <PageHeader title={t("kit.title")} description={t("kit.description")} />
      {sections.map(({ id, Component }) => (
        <Component key={id} />
      ))}
    </div>
  );
};

export default UiKitPage;
