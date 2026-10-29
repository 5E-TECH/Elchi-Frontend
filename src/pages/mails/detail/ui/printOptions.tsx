import { useMemo } from "react";
import { FileText, Globe, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { PrintSelectOption } from "../../../../shared/components/PrintModeSelect";

/**
 * Pochta tafsilotidagi chop etish usullari (D7, maket `courier-mails-detail-print-menu`; HJ5sLHiz, TZ F10):
 * «Brauzer orqali chop etish» → `browser`, «PDF yorliq (100×60 mm)» → `pdf_100x60`, «A4 varaq (12 ta)» → `a4`
 * (`lib/printMode.ts`); `withPostReceipt` — oxirida «Pochta cheki» (`post_receipt`, qop uchun; qator menyusida yo'q).
 * `ordersDisabled` — buyurtma tanlanmagan: buyurtma cheki bandlari o'chiq («Avval buyurtmalarni tanlang»), «Pochta
 * cheki» tanlovsiz ham ishlaydi (HJ5sLHiz).
 * Maketda faqat birinchi ikkitasi — qolganlari ega qarori 4 (eng yaqin maket — `courier-mails-detail-print-menu`).
 * Ikonkalar neytral — menyu ularni `sunken` qutichada chizadi; nomlari `design/icon-registry.json` dan: yorliq va A4
 * varaq — «Hujjat» (`FileText`), pochta cheki — «Pochta» (`Mail`, pochta qopi).
 */
export const useMailPrintOptions = ({
  withPostReceipt = false,
  ordersDisabled = false,
}: { withPostReceipt?: boolean; ordersDisabled?: boolean } = {}): PrintSelectOption[] => {
  const { t } = useTranslation("mails");
  return useMemo(() => {
    const order = (option: PrintSelectOption): PrintSelectOption =>
      ordersDisabled ? { ...option, disabled: true, hint: t("printOptions.selectFirst") } : option;
    return [
      order({
        id: "browser",
        label: t("printOptions.browser.label"),
        hint: t("printOptions.browser.hint"),
        icon: <Globe size={18} aria-hidden="true" />,
      }),
      order({
        id: "pdf_100x60",
        label: t("printOptions.labelPdf.label"),
        hint: t("printOptions.labelPdf.hint"),
        icon: <FileText size={18} aria-hidden="true" />,
      }),
      order({
        id: "a4",
        label: t("printOptions.a4.label"),
        hint: t("printOptions.a4.hint"),
        icon: <FileText size={18} aria-hidden="true" />,
      }),
      ...(withPostReceipt
        ? [
            {
              id: "post_receipt",
              label: t("printOptions.postReceipt.label"),
              hint: t("printOptions.postReceipt.hint"),
              icon: <Mail size={18} aria-hidden="true" />,
            },
          ]
        : []),
    ];
  }, [ordersDisabled, t, withPostReceipt]);
};
