import { useMemo } from "react";
import { FileText, Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { PrintSelectOption } from "../../../../shared/components/PrintModeSelect";

/**
 * Pochta tafsilotidagi chop etish usullari (D7, maket `courier-mails-detail-print-menu`):
 * «Brauzer orqali chop etish» → `browser`, «PDF yorliq (100×60 mm)» → `pdf_100x60` (`lib/printMode.ts`).
 * Ikonkalar neytral — menyu ularni `sunken` qutichada chizadi.
 */
export const useMailPrintOptions = (): PrintSelectOption[] => {
  const { t } = useTranslation("mails");
  return useMemo(
    () => [
      {
        id: "browser",
        label: t("printOptions.browser.label"),
        hint: t("printOptions.browser.hint"),
        icon: <Globe size={18} aria-hidden="true" />,
      },
      {
        id: "pdf_100x60",
        label: t("printOptions.labelPdf.label"),
        hint: t("printOptions.labelPdf.hint"),
        icon: <FileText size={18} aria-hidden="true" />,
      },
    ],
    [t],
  );
};
