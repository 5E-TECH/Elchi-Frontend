// dizayn-v2: superadmin-warehouse-detail, manager-warehouse-detail, superadmin-warehouse-stock-in-dialog
import { Barcode, QrCode } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import type { ProductCode } from "../model/types";

/**
 * Mahsulot kodi (maket: ikonka `.el-subtle` + `.el-code`): zavod shtrix kodi — `Barcode`, Elchi QR kodi (`ELC-P-…`) —
 * `QrCode`. Ekran o'quvchiga turi aytiladi («Zavod shtrix kodi (EAN-13): …» / «Elchi QR kodi: …»).
 */
export const ProductCodeTag = ({ code, className }: { code: ProductCode; className?: string }) => {
  const { t } = useTranslation("warehouses");
  if (!code.value) return <span className={cx("text-text-subtle", className)}>—</span>;
  const Icon = code.kind === "barcode" ? Barcode : QrCode;
  const label =
    code.kind === "barcode"
      ? t("code.barcodeLabel", { format: code.format === "TEXT" ? t("code.factory") : code.format })
      : t("code.skuLabel");
  return (
    <span className={cx("inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap", className)}>
      <Icon size={16} strokeWidth={2} aria-hidden="true" className="shrink-0 text-text-subtle" />
      <span className="sr-only">{label}: </span>
      <span className="truncate font-mono text-[13px] text-text">{code.value}</span>
    </span>
  );
};
