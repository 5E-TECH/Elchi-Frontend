// dizayn-v2: (maket yo'q) courier-mails-detail-print-menu
import { useMemo } from "react";
import { FileText, Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  countReceiptsWithoutQr,
  preloadReceiptPrinting,
  printOrderReceipts,
  useReceiptPrint,
} from "../../../../features/print-receipts";
import PrintModeSelect, {
  type PrintSelectOption,
} from "../../../../shared/components/PrintModeSelect";
import type { OrderDetail } from "./orderDetailModel";

const BROWSER = "browser";
const PDF_LABEL = "pdf_100x60";

/**
 * Tafsilotdagi «Chop etish» (TzfF0bmQ): bitta buyurtma yorlig'ini qayta chop etish. Usullar va matnlar — pochta
 * tafsilotidagidek (`courier-mails-detail-print-menu`): brauzer yoki PDF, ikkalasi termal 100×60 mm. Telefonda
 * menyu o'rniga pastki varaqa, chop etish oqimi — `useReceiptPrint` (QR yo'q ogohlantirishi, xato, «Qayta urinish»).
 */
export const OrderPrintMenu = ({ order }: { order: OrderDetail }) => {
  const { t } = useTranslation(["newOrders", "mails"]);
  const { run, printing } = useReceiptPrint();
  const options = useMemo<PrintSelectOption[]>(
    () => [
      {
        id: BROWSER,
        label: t("printOptions.browser.label", { ns: "mails" }),
        hint: t("printOptions.browser.hint", { ns: "mails" }),
        icon: <Globe size={18} aria-hidden="true" />,
      },
      {
        id: PDF_LABEL,
        label: t("printOptions.labelPdf.label", { ns: "mails" }),
        hint: t("printOptions.labelPdf.hint", { ns: "mails" }),
        icon: <FileText size={18} aria-hidden="true" />,
      },
    ],
    [t],
  );

  const print = (mode: string) => {
    void run({
      withoutQr: countReceiptsWithoutQr([order]),
      print: () =>
        printOrderReceipts([order], {
          sheet: "thermal",
          output: mode === PDF_LABEL ? "pdf" : "browser",
        }),
    });
  };

  return (
    <PrintModeSelect
      count={1}
      hideCount
      buttonLabel={t("print", { ns: "mails" })}
      menuTitle={t("orderQr.printTitle")}
      sheetTitle={t("print", { ns: "mails" })}
      sheetDescription={t("orderQr.printTitle")}
      options={options}
      onSelect={print}
      loading={printing}
      onOpen={preloadReceiptPrinting}
    />
  );
};
