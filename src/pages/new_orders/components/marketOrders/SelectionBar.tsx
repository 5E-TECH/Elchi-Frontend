// dizayn-v2: superadmin-neworders-market-orders, admin-neworders-market-detail, manager-new-orders-market-detail, registrator-new-orders-market-detail
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { FileText, ListChecks, Printer } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import PrintModeSelect, { type PrintSelectOption } from "../../../../shared/components/PrintModeSelect";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../../shared/lib/formatMoney";
import { Button } from "../../../../shared/ui/primitives";
import { SelectionRegion } from "../../../../shared/ui/SelectionRegion";

/**
 * Tanlangan buyurtmalar paneli (maket: `role="region"` «Tanlangan buyurtmalar», umumiy `SelectionRegion`;
 * hech narsa tanlanmaganda — `idle`, `bg-sunken`):
 * «5 ta buyurtma tanlandi · 908 500 so'm» + izoh, «Barchasini tanlash» / «Tanlovni bekor qilish» va
 * «Chop etish» menyusi (brauzer · PDF 60×100 · A4 varaq — 12 ta; chek — `features/print-receipts`, tayyorlanayotganda
 * tugma `loading`). Transfer rejimida (PICKUP/HYBRID menejer, registrator) izoh —
 * «… yangi paketga qo'shiladi — Paketlar»; «Paketlar» havola faqat `/batches` ga ruxsat bo'lsa.
 */

type SelectionBarProps = {
  selectedCount: number;
  selectedTotal: number;
  allSelected: boolean;
  onToggleAll: () => void;
  transferHint: boolean;
  /** Qabul yo'q (REGIONAL) — tanlov faqat chop etish uchun, izoh shunga mos. */
  printOnly?: boolean;
  canOpenBatches: boolean;
  onPrint: (mode: string) => void;
  /** Chek tayyorlanmoqda — «Chop etish» tugmasi `loading`. */
  printing?: boolean;
  /** Menyu ochilganda (chop etish modulini oldindan yuklash). */
  onPrintMenuOpen?: () => void;
};

const linkClass = "font-semibold text-action-fg underline-offset-2 hover:underline";

export const SelectionBar = ({
  selectedCount,
  selectedTotal,
  allSelected,
  onToggleAll,
  transferHint,
  printOnly = false,
  canOpenBatches,
  onPrint,
  printing = false,
  onPrintMenuOpen,
}: SelectionBarProps) => {
  const { t, i18n } = useTranslation("newOrders");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const count = formatNumberLocalized(selectedCount, { language });

  const printOptions = useMemo<PrintSelectOption[]>(
    () => [
      { id: "browser", label: t("browserPrint"), hint: t("anyPrinter"), icon: <Printer size={18} /> },
      { id: "pdf", label: t("pdfPrint"), hint: t("gainschaPrinter"), icon: <FileText size={18} /> },
      { id: "a4", label: t("a4Print"), hint: t("a4Printer"), icon: <FileText size={18} /> },
    ],
    [t],
  );

  return (
    <SelectionRegion
      idle={selectedCount === 0}
      label={t("marketOrders.selectionRegion")}
      title={
        selectedCount > 0
          ? t("marketOrders.selectedSummary", { value: count, sum: formatMoneyLocalized(selectedTotal, { language }) })
          : t("marketOrders.noneSelected")
      }
      hint={
        transferHint ? (
          <Trans
            t={t}
            i18nKey="marketOrders.transferHint"
            components={{ batches: canOpenBatches ? <Link to="/batches" className={linkClass} /> : <span /> }}
          />
        ) : printOnly ? (
          t("marketOrders.selectionHintPrintOnly")
        ) : (
          t("marketOrders.selectionHint")
        )
      }
      action={
        <>
          <Button variant="ghost" size="sm" leftIcon={ListChecks} onClick={onToggleAll} className="max-md:px-2">
            {allSelected ? t("marketOrders.clearSelection") : t("selectAll")}
          </Button>
          <PrintModeSelect
            count={selectedCount}
            onSelect={onPrint}
            buttonLabel={t("print")}
            menuLabel={t("marketOrders.printMenuLabel")}
            menuTitle={selectedCount > 0 ? t("marketOrders.printMenuTitle", { value: count }) : undefined}
            options={printOptions}
            loading={printing}
            onOpen={onPrintMenuOpen}
            className="max-md:basis-full"
          />
        </>
      }
    />
  );
};
