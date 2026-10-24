// dizayn-v2: superadmin-warehouse-stock-in-dialog, admin-warehouse-stock-in-dialog
import { CircleX, Link2, Minus, Plus, RotateCw, Store, Tag, Trash2, TriangleAlert, X } from "lucide-react";
import { ProductCodeTag, type WarehouseLookupItem } from "../../../../entities/warehouse";
import { formatKgValue } from "../../../../entities/delivery-pricing";
import { cx } from "../../../../shared/lib/cx";
import { Button, IconButton, StatusBadge, TextInput } from "../../../../shared/ui/primitives";
import { useWarehouseText } from "../../model/useWarehouseText";
import { MAX_LINE_QTY, type ScanIssueLine, type ScanItemLine, type ScanLine } from "../model/scanLines";

export type ScanLinesListProps = {
  lines: readonly ScanLine[];
  /** `stockIn` — «qo'shiladigan dona» (≥ 1); `inventory` — «sanalgan dona» (≥ 0) va farq. */
  variant: "stockIn" | "inventory";
  /** Tanlangan market nomi («Baraka Shop mahsulotini tanlang …»). */
  marketName: string | null;
  disabled?: boolean;
  onQty: (key: string, qty: number) => void;
  onRemove: (key: string) => void;
  /** Berilmasa — «Mahsulotga bog'lash» yo'q (inventarizatsiya). */
  onLink?: (line: ScanIssueLine) => void;
  onPickCandidate: (line: ScanIssueLine, item: WarehouseLookupItem) => void;
  onRetry: (line: ScanIssueLine) => void;
};

/** Miqdor: «−» · son · «+» (maket: 32 px tugmalar va 64 px maydon; telefonda 44 px). */
const QtyStepper = ({
  value,
  min,
  name,
  disabled,
  onChange,
  variant,
}: {
  value: number;
  min: number;
  name: string;
  disabled?: boolean;
  onChange: (next: number) => void;
  variant: ScanLinesListProps["variant"];
}) => {
  const { t } = useWarehouseText();
  return (
    <span role="group" aria-label={t(`scan.${variant}.qtyGroup`, { name })} className="inline-flex items-center gap-1">
      <IconButton
        size="sm"
        variant="secondary"
        icon={Minus}
        label={t("scan.decrease", { name })}
        disabled={disabled || value <= min}
        onClick={() => onChange(value - 1)}
      />
      <span className="w-16 shrink-0 max-md:w-[72px]">
        <TextInput
          mode="number"
          value={String(value)}
          onValueChange={(next) => onChange(next === "" ? 0 : Number(next))}
          // Enter (yoki fokus shu yerda qolganda USB skaner yuborgan Enter) oynani yuborib yubormasin.
          onKeyDown={(event) => {
            if (event.key === "Enter") event.preventDefault();
          }}
          aria-label={t(`scan.${variant}.qtyInput`, { name })}
          inputClassName="text-center"
          maxLength={6}
          readOnly={disabled}
          data-scanner-ignore=""
        />
      </span>
      <IconButton
        size="sm"
        variant="secondary"
        icon={Plus}
        label={t("scan.increase", { name })}
        disabled={disabled || value >= MAX_LINE_QTY}
        onClick={() => onChange(value + 1)}
      />
    </span>
  );
};

/**
 * «SKANERLANGAN MAHSULOTLAR» (maket `superadmin-warehouse-stock-in-dialog`): hal qilinmagan skanlar (sariq — zavod
 * kodi bog'lanmagan «Mahsulotga bog'lash», qizil — topilmadi) va mahsulot qatorlari (`sunken`): nom + «Kod bog'landi» /
 * «+1 · qayta skan», kod va «Hisob vazni» (o'lchovsiz — «O'lchov yo'q — yetkazish narxi hisoblanmaydi»), «Hozirgi
 * qoldiq» (9 dona · 0 · tugagan · 0 · yangi), miqdor va «olib tashlash». Inventarizatsiyada — «Hisobda», sanalgan
 * dona va farq.
 */
export const ScanLinesList = ({
  lines,
  variant,
  marketName,
  disabled,
  onQty,
  onRemove,
  onLink,
  onPickCandidate,
  onRetry,
}: ScanLinesListProps) => {
  const text = useWarehouseText();
  const { t } = text;

  const issue = (line: ScanIssueLine) => {
    const warning = line.kind === "unlinked" || line.kind === "ambiguous";
    const Icon = warning ? TriangleAlert : CircleX;
    return (
      <li
        key={line.key}
        className={cx(
          "flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-xl px-3 py-2.5",
          warning ? "bg-warning-soft" : "bg-danger-soft",
        )}
      >
        <span className="flex min-w-0 flex-[1_1_280px] items-start gap-3">
          <Icon size={18} aria-hidden="true" className={cx("mt-0.5 shrink-0", warning ? "text-warning-fg" : "text-danger-fg")} />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
              <span className="break-all font-mono text-[13px] text-text">{line.code}</span>
              <span className={cx("font-semibold", warning ? "text-warning-fg" : "text-danger-fg")}>
                {t(`scan.issue.${line.kind}.title`)}
              </span>
            </span>
            <span className="text-[13px] text-text-muted">
              {line.kind === "unlinked" && !onLink
                ? t("scan.issue.unlinked.textInventory")
                : line.kind === "unlinked"
                ? marketName
                  ? t("scan.issue.unlinked.textMarket", { market: marketName })
                  : t("scan.issue.unlinked.text")
                : t(`scan.issue.${line.kind}.text`)}
            </span>
            {line.kind === "ambiguous" ? (
              <span className="mt-1 flex flex-wrap gap-2">
                {line.candidates.map((candidate) => (
                  <Button
                    key={candidate.product.id}
                    variant="secondary"
                    size="sm"
                    leftIcon={Store}
                    disabled={disabled}
                    onClick={() => onPickCandidate(line, candidate)}
                  >
                    {candidate.market.name ?? candidate.product.name}
                  </Button>
                ))}
              </span>
            ) : null}
          </span>
        </span>
        <span className="ml-auto flex items-center gap-2">
          {line.kind === "unlinked" && onLink ? (
            <Button variant="secondary" size="sm" leftIcon={Link2} aria-haspopup="dialog" disabled={disabled} onClick={() => onLink(line)}>
              {t("scan.link")}
            </Button>
          ) : null}
          {line.kind === "failed" ? (
            <Button variant="secondary" size="sm" leftIcon={RotateCw} disabled={disabled} onClick={() => onRetry(line)}>
              {t("scan.retry")}
            </Button>
          ) : null}
          <IconButton
            size="sm"
            icon={X}
            label={t("scan.removeIssue", { code: line.code })}
            disabled={disabled}
            onClick={() => onRemove(line.key)}
          />
        </span>
      </li>
    );
  };

  const currentStock = (line: ScanItemLine) => {
    if (!line.stock) return { text: t("scan.stockNew"), tone: "text-text" };
    const value = variant === "inventory" ? line.stock.onHand : line.stock.available;
    if (line.stock.level === "out" && variant === "stockIn") {
      return { text: t("scan.stockOut", { value: text.number(value) }), tone: "text-danger-fg" };
    }
    return { text: text.pcs(value), tone: "text-text" };
  };

  const item = (line: ScanItemLine) => {
    const stock = currentStock(line);
    const product = line.product;
    const delta = variant === "inventory" ? line.qty - (line.stock?.onHand ?? 0) : 0;
    const belowReserved = variant === "inventory" && line.qty < (line.stock?.reserved ?? 0);
    return (
      <li key={line.key} className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-sunken py-2 pl-2 pr-3 max-md:pl-3">
        <span className="flex min-w-0 flex-[1_1_220px] items-center gap-3">
          <span aria-hidden="true" className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-surface text-text-muted max-md:hidden">
            <Tag size={18} strokeWidth={2} />
          </span>
          <span className="flex min-w-0 flex-col gap-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-semibold text-text">{product.name}</span>
              {line.badge === "linked" ? <StatusBadge tone="success" label={t("scan.linked")} /> : null}
              {line.badge === "rescan" ? <StatusBadge tone="info" label={t("scan.rescan")} /> : null}
            </span>
            <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
              <ProductCodeTag code={product.code} />
              {line.market.name ? <span className="text-xs text-text-muted">{line.market.name}</span> : null}
              {!product.measureMissing && product.chargeableWeightKg !== null ? (
                <span className="whitespace-nowrap text-xs text-text-muted">
                  {t("detail.stock.weightLine", {
                    value: t("units.kg", { value: formatKgValue(product.chargeableWeightKg, text.language) }),
                  })}
                </span>
              ) : null}
            </span>
            {product.measureMissing ? (
              <span className="inline-flex items-center gap-1 text-xs text-warning-fg">
                <TriangleAlert size={14} aria-hidden="true" className="shrink-0" />
                {t("scan.noMeasure")}
              </span>
            ) : null}
            {belowReserved ? (
              <span className="text-xs text-danger-fg">
                {t("inventory.belowReserved", { value: text.number(line.stock?.reserved ?? 0) })}
              </span>
            ) : null}
          </span>
        </span>
        <span className="ml-auto flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
          <span className="flex min-w-[88px] flex-col items-end">
            <span className="whitespace-nowrap text-xs text-text-muted">
              {t(variant === "inventory" ? "scan.inventory.current" : "scan.stockIn.current")}
            </span>
            <span className={cx("whitespace-nowrap font-semibold", stock.tone)}>{stock.text}</span>
          </span>
          {variant === "inventory" ? (
            <span className="flex min-w-[56px] flex-col items-end">
              <span className="whitespace-nowrap text-xs text-text-muted">{t("scan.inventory.delta")}</span>
              <span className={cx("whitespace-nowrap font-semibold", delta === 0 ? "text-text-muted" : "text-text")}>
                {delta > 0 ? `+${text.number(delta)}` : text.number(delta)}
              </span>
            </span>
          ) : null}
          <QtyStepper
            value={line.qty}
            min={variant === "inventory" ? 0 : 1}
            name={product.name}
            disabled={disabled}
            variant={variant}
            onChange={(next) => onQty(line.key, next)}
          />
          <IconButton
            size="sm"
            icon={<Trash2 className="text-danger-fg" />}
            variant="ghost"
            label={t("scan.remove", { name: product.name })}
            disabled={disabled}
            onClick={() => onRemove(line.key)}
          />
        </span>
      </li>
    );
  };

  return (
    <ul aria-label={t("scan.listLabel")} className="m-0 flex list-none flex-col gap-2 p-0">
      {lines.map((line) => (line.kind === "item" ? item(line) : issue(line)))}
    </ul>
  );
};
