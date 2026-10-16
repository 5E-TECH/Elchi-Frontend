// dizayn-v2: (maket yo'q) Main
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "../../shared/ui/primitives";
import { BadgesSection } from "./sections/BadgesSection";
import { ButtonsSection } from "./sections/ButtonsSection";
import { CardsSection } from "./sections/CardsSection";
import { DateSection } from "./sections/DateSection";
import { DialogSection } from "./sections/DialogSection";
import { FeedbackSection } from "./sections/FeedbackSection";
import { FormatSection } from "./sections/FormatSection";
import { FormsSection } from "./sections/FormsSection";
import { PageHeaderSection } from "./sections/PageHeaderSection";
import { SelectSection } from "./sections/SelectSection";
import { StatesSection } from "./sections/StatesSection";
import { TableSection } from "./sections/TableSection";
import { TabsSection } from "./sections/TabsSection";

/**
 * KOMPONENTLAR TO'PLAMI (`/ops/ui-kit`) — dizayn v2 primitivlari namunasi (1-bosqich; 3-bosqich: forma,
 * ro'yxat, sana, oyna, xabar, holatlar; 4-bosqich: jadval va sahifalash).
 *
 * Maket yo'q: ichki sahifa, eng yaqini — `Main` (dizayn tizimi taxtasi).
 * Faqat superadmin (`canViewUiKit`), menyuda yo'q.
 *
 * Har bo'lim namunani kunduzgi va tungi mavzuda yonma-yon chizadi (`ThemePair`).
 * Skrinshot uchun URL parametrlari:
 *   `?section=<id>`  — faqat shu bo'lim (`buttons`, `badges`, `cards`, `page-header`, `tabs`, `format`,
 *                    `forms`, `select`, `date`, `dialog`, `feedback`, `states`, `table`; noma'lum id — hammasi);
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
  // 3-bosqich: forma, dialog va holatlar.
  { id: "forms", Component: FormsSection },
  { id: "select", Component: SelectSection },
  { id: "date", Component: DateSection },
  { id: "dialog", Component: DialogSection },
  { id: "feedback", Component: FeedbackSection },
  { id: "states", Component: StatesSection },
  // 4-bosqich: ro'yxat sahifalari.
  { id: "table", Component: TableSection },
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
