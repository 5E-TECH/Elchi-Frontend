// dizayn-v2: superadmin-neworders-market-orders, admin-neworders-market-detail, manager-new-orders-market-detail, registrator-new-orders-market-detail
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { FileText, ListChecks, Printer } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import PrintModeSelect, { type PrintSelectOption } from "../../../../shared/components/PrintModeSelect";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../../shared/lib/formatMoney";
import { Button } from "../../../../shared/ui/primitives";

/**
 * Tanlangan buyurtmalar paneli (maket: `role="region"` «Tanlangan buyurtmalar», `bg-action-soft`):
 * «5 ta buyurtma tanlandi · 908 500 so'm» + izoh, «Barchasini tanlash» / «Tanlovni bekor qilish» va
 * «Chop etish» menyusi (brauzer · PDF 60×100). Transfer rejimida (PICKUP/HYBRID menejer, registrator) izoh —
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
}: SelectionBarProps) => {
  const { t, i18n } = useTranslation("newOrders");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const count = formatNumberLocalized(selectedCount, { language });

  const printOptions = useMemo<PrintSelectOption[]>(
    () => [
      { id: "browser", label: t("browserPrint"), hint: t("anyPrinter"), icon: <Printer size={18} /> },
      { id: "pdf", label: t("pdfPrint"), hint: t("gainschaPrinter"), icon: <FileText size={18} /> },
    ],
    [t],
  );

  return (
    <div
      role="region"
      aria-label={t("marketOrders.selectionRegion")}
      className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border bg-action-soft px-5 py-3 max-md:px-4"
    >
      <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-0.5">
        <span className="font-semibold text-action-fg" aria-live="polite">
          {selectedCount > 0
            ? t("marketOrders.selectedSummary", { value: count, sum: formatMoneyLocalized(selectedTotal, { language }) })
            : t("marketOrders.noneSelected")}
        </span>
        <span className="text-xs text-text-muted">
          {transferHint ? (
            <Trans
              t={t}
              i18nKey="marketOrders.transferHint"
              components={{ batches: canOpenBatches ? <Link to="/batches" className={linkClass} /> : <span /> }}
            />
          ) : printOnly ? (
            t("marketOrders.selectionHintPrintOnly")
          ) : (
            t("marketOrders.selectionHint")
          )}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 max-md:w-full">
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
          className="max-md:basis-full"
        />
      </div>
    </div>
  );
};
