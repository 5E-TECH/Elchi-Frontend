// dizayn-v2: superadmin-batches-detail, admin-batches-detail, manager-batches-detail-send, manager-batches-detail-readonly, manager-returns-batch-detail
import { useMemo } from "react";
import { FileText, Receipt } from "lucide-react";
import { useTranslation } from "react-i18next";
import { preloadReceiptPrinting, type ReceiptPackageSheet } from "../../../features/print-receipts";
import PrintModeSelect, {
  type PrintSelectOption,
} from "../../../shared/components/PrintModeSelect";

type Props = {
  onSelect: (sheet: ReceiptPackageSheet) => void;
  loading?: boolean;
  className?: string;
};

/**
 * Paket «Chop etish» menyusi (HJ5sLHiz, TZ F10 «Termal 100×60 · A5»): paket cheki termal printerda (qopga
 * yopishtiriladi) yoki ofis printerida A5 varaq. Maketda menyu yo'q — eng yaqini `courier-mails-detail-print-menu`
 * (`PrintModeSelect`): kompyuterda ochiladigan menyu, telefonda (< 768) — sarlavha va izohli pastki varaqa, pochta
 * tafsilotidagi kabi.
 */
const BatchPrintMenu = ({ onSelect, loading = false, className }: Props) => {
  const { t } = useTranslation("batches");
  const options = useMemo<PrintSelectOption[]>(
    () => [
      {
        id: "thermal",
        label: t("print.thermal.label"),
        hint: t("print.thermal.hint"),
        icon: <Receipt size={18} aria-hidden="true" />,
      },
      {
        id: "a5",
        label: t("print.a5.label"),
        hint: t("print.a5.hint"),
        icon: <FileText size={18} aria-hidden="true" />,
      },
    ],
    [t],
  );
  return (
    <PrintModeSelect
      count={1}
      hideCount
      buttonLabel={t("detail.print")}
      sheetTitle={t("detail.print")}
      sheetDescription={t("print.sheetDescription")}
      options={options}
      onSelect={(mode) => onSelect(mode === "a5" ? "a5" : "thermal")}
      loading={loading}
      onOpen={preloadReceiptPrinting}
      className={className}
    />
  );
};

export default BatchPrintMenu;
