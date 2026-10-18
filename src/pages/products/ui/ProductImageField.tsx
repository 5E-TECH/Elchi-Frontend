// dizayn-v2: superadmin-products-edit-dialog, admin-products-edit-dialog, market-products-edit-dialog, superadmin-products-create, admin-products-create, market-products-create
import { useId, useRef, useState, type ChangeEvent } from "react";
import { ImagePlus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import { Field, IconButton, useFieldControl } from "../../../shared/ui/primitives";
import type { PickedImage } from "../model/usePickedImage";

/** `.el-input` + `2px dashed` zona (maket `*-products-edit-dialog`, `*-products-create`): 152 px, `input` foni. */
const ZONE =
  "flex min-h-[152px] w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 " +
  "border-dashed border-border-strong bg-input px-3.5 py-5 text-center " +
  "transition-[background-color,border-color,box-shadow] duration-150 motion-reduce:transition-none " +
  "hover:border-text-subtle focus-within:border-action focus-within:ring-3 focus-within:ring-focus";

type ImageZoneProps = {
  picked: PickedImage | null;
  existingUrl?: string;
  onPick: (file: File | null) => void;
  disabled?: boolean;
};

const ImageZone = ({ picked, existingUrl, onPick, disabled = false }: ImageZoneProps) => {
  const { t } = useTranslation("products");
  const field = useFieldControl({ disabled });
  const hintId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const previewUrl = picked?.url ?? existingUrl;
  const showPreview = Boolean(previewUrl) && failedUrl !== previewUrl;

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    // Bir xil faylni qayta tanlash ham `change` bersin.
    event.target.value = "";
    if (file) onPick(file);
  };

  const removePicked = () => {
    onPick(null);
    inputRef.current?.focus();
  };

  return (
    <div className="relative min-w-0">
      <label className={cx(ZONE, disabled && "pointer-events-none cursor-not-allowed opacity-45")}>
        <input
          ref={inputRef}
          id={field.id}
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={field.disabled}
          aria-labelledby={field.labelId}
          aria-describedby={hintId}
          onChange={handleChange}
        />
        {showPreview ? (
          <img
            src={previewUrl}
            alt={t("v2.image.previewAlt")}
            className="max-h-[120px] max-w-full rounded-lg object-contain"
            onError={() => setFailedUrl(previewUrl ?? null)}
          />
        ) : (
          <span
            aria-hidden="true"
            className="mb-1 inline-flex size-10 items-center justify-center rounded-full border border-border bg-sunken text-text-muted"
          >
            <ImagePlus size={18} strokeWidth={2} />
          </span>
        )}
        <span className="text-sm font-semibold text-text">
          {showPreview ? t("v2.image.replace") : t("v2.image.upload")}
        </span>
        <span id={hintId} className="text-xs text-text-muted">
          {showPreview ? t("v2.image.replaceHint") : t("v2.image.hint")}
        </span>
      </label>
      {picked && !disabled ? (
        <IconButton
          variant="secondary"
          size="sm"
          icon={X}
          label={t("v2.image.remove")}
          onClick={removePicked}
          className="absolute right-2 top-2"
        />
      ) : null}
    </div>
  );
};

export type ProductImageFieldProps = ImageZoneProps & {
  /** Yorliq: xodim tahrir oynasida «Rasm», qolgan joyda «Mahsulot rasmi» (maket). */
  label: string;
};

/**
 * MAHSULOT RASMI — maydon (`Field`) + fayl tanlash zonasi: «Rasm yuklash · Ixtiyoriy · bosing va rasm faylini
 * tanlang». Rasm bo'lsa (tanlangan yoki mavjud) — oldindan ko'rish va «Rasmni almashtirish»; yangi tanlangan
 * faylni × bilan olib tashlash mumkin (mavjud rasm serverda qoladi — backend rasmni o'chirishni qabul qilmaydi).
 */
export const ProductImageField = ({ label, ...zone }: ProductImageFieldProps) => (
  <Field label={label} disabled={zone.disabled}>
    <ImageZone {...zone} />
  </Field>
);
