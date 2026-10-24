// dizayn-v2: superadmin-products-edit-dialog-barcode, tizim-product-labels
import { useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";
import { Copy, Minus, Plus, Printer, ScanLine } from "lucide-react";
import { useTranslation } from "react-i18next";
import { copyToClipboard } from "../../../shared/lib/clipboard";
import { notify } from "../../../shared/lib/notify";
import {
  Button,
  Field,
  IconButton,
  Portal,
  Pressable,
  TextInput,
  useDismiss,
  usePopover,
} from "../../../shared/ui/primitives";
import { qrPath } from "../model/productCode";
import { printProductLabels, type LabelSize } from "../model/productLabelPrint";

const MAX_COPIES = 500;
const MENU_ITEM =
  "flex min-h-9 w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm text-text outline-none! " +
  "transition-[background-color] duration-150 motion-reduce:transition-none hover:bg-sunken focus-visible:bg-sunken max-md:min-h-11";

export type ProductCodeSectionProps = {
  /** Zavod shtrix kodi (maydon qiymati). */
  barcode: string;
  onBarcodeChange: (value: string) => void;
  barcodeError?: string | null;
  /** Elchi kodi (`ELC-P-…`, avtomatik; yo'q bo'lsa — stiker bloki chizilmaydi). */
  skuCode: string | null;
  productName: string;
  marketName: string | null;
  readOnly?: boolean;
};

/** Stiker ko'rinishi 40×30 mm, haqiqiy o'lchamda (1 mm = 5 px; qog'oz har ikki mavzuda oq). */
const LabelPreview = ({
  name,
  market,
  code,
}: {
  name: string;
  market: string | null;
  code: string;
}) => {
  const { t } = useTranslation("warehouses");
  const qr = useMemo(() => qrPath(code), [code]);
  const match = /^(ELC-P-?)(\d+)$/i.exec(code);
  return (
    <div
      role="img"
      aria-label={t("productCode.previewLabel", { name, code })}
      className="relative h-[152px] w-[202px] shrink-0 overflow-hidden rounded-lg border border-border-strong bg-on-nav text-nav"
    >
      <span className="absolute left-[7.5px] top-[6px] w-[185px] truncate text-[13.2px] font-bold leading-[14.5px]">
        {name}
      </span>
      {qr ? (
        <svg
          aria-hidden="true"
          viewBox={`0 0 ${qr.size} ${qr.size}`}
          shapeRendering="crispEdges"
          className="absolute left-[15px] top-[50px] size-[79px] fill-current"
        >
          <path d={qr.path} />
        </svg>
      ) : null}
      {market ? (
        <span className="absolute left-[108.75px] top-[50px] w-[84px] truncate text-[12.35px] font-medium leading-[14px]">
          {market}
        </span>
      ) : null}
      <span className="absolute left-[108.75px] top-[92.75px] w-[84px] truncate text-[12.35px] font-semibold leading-[14px]">
        {match ? match[1].toUpperCase() : ""}
      </span>
      <span className="absolute left-[108.75px] top-[106.75px] w-[84px] truncate text-[19.4px] font-bold leading-[22px] tracking-[.02em]">
        {match ? match[2] : code}
      </span>
    </div>
  );
};

/** «QR stiker chop etish» menyusi: 40×30 mm · 58×40 mm. */
const PrintMenu = ({
  onPrint,
  disabled,
}: {
  onPrint: (size: LabelSize) => void;
  disabled?: boolean;
}) => {
  const { t } = useTranslation("warehouses");
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const { anchorRef, floatingRef, floatingStyles } = usePopover<HTMLButtonElement, HTMLDivElement>({
    open,
    placement: "bottom-start",
    offset: 6,
  });
  useDismiss({ open, refs: [anchorRef, floatingRef], onDismiss: () => setOpen(false) });
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() =>
      floatingRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus(),
    );
    return () => cancelAnimationFrame(frame);
  }, [floatingRef, open]);
  return (
    <>
      <Button
        ref={anchorRef}
        variant="secondary"
        leftIcon={Printer}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className="self-start"
      >
        {t("productCode.print")}
      </Button>
      {open ? (
        <Portal layer="dropdown" anchor={anchorRef}>
          <div
            ref={floatingRef}
            id={menuId}
            role="menu"
            aria-label={t("productCode.printSize")}
            style={floatingStyles}
            className="flex min-w-[200px] flex-col gap-0.5 rounded-xl border border-border bg-raised p-1.5 shadow-xl"
          >
            {(["40x30", "58x40"] as const).map((size) => (
              <Pressable
                key={size}
                role="menuitem"
                tabIndex={-1}
                className={MENU_ITEM}
                onClick={() => {
                  setOpen(false);
                  onPrint(size);
                }}
              >
                <Printer size={18} aria-hidden="true" className="shrink-0 text-text-muted" />
                {t(`productCode.size.${size}`)}
              </Pressable>
            ))}
          </div>
        </Portal>
      ) : null}
    </>
  );
};

/**
 * «MAHSULOT KODI» BO'LIMI (maket `superadmin-products-edit-dialog-barcode`, taxta `tizim-product-labels`):
 * «Shtrix kod (EAN-13)» (USB skaner maydonga yozadi — skaner yuboradigan Enter formani saqlamaydi), «Elchi kodi»
 * (faqat o'qish + «Nusxalash»), stiker ko'rinishi 40×30 mm, «Soni» va «QR stiker chop etish» (40×30 · 58×40 mm).
 */
export const ProductCodeSection = ({
  barcode,
  onBarcodeChange,
  barcodeError,
  skuCode,
  productName,
  marketName,
  readOnly,
}: ProductCodeSectionProps) => {
  const { t } = useTranslation("warehouses");
  const [copies, setCopies] = useState(1);
  const copiesLabelId = useId();

  const copy = async () => {
    if (!skuCode) return;
    const ok = await copyToClipboard(skuCode);
    if (ok) notify.success(t("productCode.copied"), { description: skuCode, duration: 2500 });
    else notify.error(t("productCode.copyFailed"));
  };

  const print = (size: LabelSize) => {
    if (!skuCode) return;
    const opened = printProductLabels(
      { name: productName, market: marketName, code: skuCode },
      size,
      copies,
      t("productCode.printTitle", { code: skuCode }),
    );
    if (!opened)
      notify.error(t("productCode.printBlocked"), {
        description: t("productCode.printBlockedText"),
      });
  };

  // USB skaner kodni yozib Enter bosadi — u formani (oynani) saqlab yubormasin.
  const swallowEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") event.preventDefault();
  };

  return (
    // Oldingi bo'lim (o'lcham) o'z chizig'i bilan tugaydi; bu bo'lim ham chiziq bilan yopiladi (maket: rasm oldidan).
    <>
      <section className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="m-0 text-sm font-semibold text-text">{t("productCode.title")}</h3>
          <p className="m-0 text-[13px] text-text-muted">{t("productCode.description")}</p>
        </div>
        <Field
          label={t("productCode.barcode")}
          hint={t("productCode.barcodeHint")}
          error={barcodeError ?? undefined}
        >
          <TextInput
            icon={ScanLine}
            value={barcode}
            onValueChange={onBarcodeChange}
            onKeyDown={swallowEnter}
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            placeholder={t("productCode.barcodePlaceholder")}
            maxLength={512}
            readOnly={readOnly}
            data-scanner-ignore=""
          />
        </Field>
        {skuCode ? (
          <>
            <Field label={t("productCode.sku")} hint={t("productCode.skuHint")} readOnly>
              <div className="flex min-w-0 items-center gap-2">
                <TextInput value={skuCode} readOnly className="min-w-0 flex-1" />
                <Button
                  variant="secondary"
                  leftIcon={Copy}
                  aria-label={t("productCode.copyAria")}
                  onClick={() => void copy()}
                >
                  {t("productCode.copy")}
                </Button>
              </div>
            </Field>
            <div className="flex flex-wrap items-center gap-4 rounded-xl bg-sunken p-4">
              <LabelPreview name={productName} market={marketName} code={skuCode} />
              <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-text">
                    {t("productCode.stickerTitle")}
                  </span>
                  <span className="text-[13px] text-text-muted">
                    {t("productCode.stickerHint")}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="text-[13px] text-text-muted" id={copiesLabelId}>
                    {t("productCode.copies")}
                  </span>
                  <div
                    role="group"
                    aria-labelledby={copiesLabelId}
                    className="inline-flex items-center rounded-xl border border-border-strong bg-surface"
                  >
                    <IconButton
                      icon={Minus}
                      variant="ghost"
                      label={t("productCode.copiesDecrease")}
                      disabled={copies <= 1}
                      onClick={() => setCopies((value) => Math.max(1, value - 1))}
                    />
                    <span
                      className="min-w-9 text-center font-semibold tabular-nums text-text"
                      aria-live="polite"
                    >
                      {copies}
                    </span>
                    <IconButton
                      icon={Plus}
                      variant="ghost"
                      label={t("productCode.copiesIncrease")}
                      disabled={copies >= MAX_COPIES}
                      onClick={() => setCopies((value) => Math.min(MAX_COPIES, value + 1))}
                    />
                  </div>
                </div>
                <PrintMenu onPrint={print} />
              </div>
            </div>
          </>
        ) : null}
      </section>
      <hr className="m-0 h-px border-0 bg-border" />
    </>
  );
};
