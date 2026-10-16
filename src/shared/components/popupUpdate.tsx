import { memo, useId, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ImagePlus } from "lucide-react";
import { Button, Dialog, type DialogSize } from "../ui/primitives";

interface UpdatePopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  saveLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
  /** ESKI: Tailwind `max-w-*` klassi — v2 da eng yaqin oyna kengligi (`max-w-md` → 480, `max-w-xl` → 560 …). */
  widthClassName?: string;
  // Rasm uchun ixtiyoriy propslar
  imageProps?: {
    label: string;
    value?: string | File;
    onChange: (file: File) => void;
    previewUrl?: string;
  };
}

const WIDTH_SIZE: Record<string, DialogSize> = {
  "max-w-sm": "sm",
  "max-w-md": "md",
  "max-w-lg": "md",
  "max-w-xl": "lg",
  "max-w-2xl": "xl",
  "max-w-3xl": "xl",
};

/**
 * Rasm yuklash maydoni — maket `superadmin-products-edit-dialog` («Rasm»): uzuq chegarali quti,
 * doira ichida ikonka, «Rasm yuklash». Rasm bor bo'lsa — rasm va «Almashtirish».
 */
const ImageField = ({ label, value, onChange, previewUrl }: NonNullable<UpdatePopupProps["imageProps"]>) => {
  const { t } = useTranslation("ui");
  const id = useId();
  const src = previewUrl ?? (typeof value === "string" && value ? value : undefined);
  const fileName = value instanceof File ? value.name : null;

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span id={`${id}-label`} className="text-[13px] font-semibold text-text">
        {label}
      </span>
      <label
        className={
          "flex min-h-[152px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 " +
          "border-dashed border-border-strong bg-input px-3.5 py-5 text-center transition-[border-color,background-color] " +
          "duration-150 hover:border-text-subtle has-[:focus-visible]:border-action has-[:focus-visible]:ring-3 " +
          "has-[:focus-visible]:ring-focus motion-reduce:transition-none"
        }
      >
        <input
          type="file"
          accept="image/*"
          aria-labelledby={`${id}-label`}
          aria-describedby={`${id}-action`}
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onChange(file);
          }}
        />
        {src ? (
          <img src={src} alt="" className="max-h-40 max-w-full rounded-lg object-contain" />
        ) : (
          <span
            aria-hidden="true"
            className="mb-1 inline-flex size-10 items-center justify-center rounded-full border border-border bg-sunken text-text-muted"
          >
            <ImagePlus size={20} />
          </span>
        )}
        <span id={`${id}-action`} className="text-sm font-semibold text-text">
          {src || fileName ? t("dialog.replaceImage") : t("dialog.uploadImage")}
        </span>
        {fileName ? <span className="max-w-full truncate text-xs text-text-muted">{fileName}</span> : null}
      </label>
    </div>
  );
};

/**
 * ESKI (v1) TAHRIRLASH OYNASI — API o'zgarmagan, ko'rinishi dizayn v2 `Dialog` (3-bosqich): sarlavha
 * (ikonka · sarlavha · «Yopish»), tana (ixtiyoriy rasm maydoni + maydonlar), pastda «Bekor qilish» +
 * «Saqlash»; telefonda pastki varaqa. Yangi kodda to'g'ridan-to'g'ri `Dialog`.
 */
const UpdatePopup = ({
  isOpen,
  onClose,
  onSave,
  title,
  icon,
  children,
  saveLabel,
  cancelLabel,
  isLoading = false,
  widthClassName = "max-w-md",
  imageProps,
}: UpdatePopupProps) => {
  const { t } = useTranslation("common");
  const resolvedSaveLabel = saveLabel ?? t("save");
  const resolvedCancelLabel = cancelLabel ?? t("cancel");

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      title={title}
      icon={icon ?? undefined}
      size={WIDTH_SIZE[widthClassName.trim()] ?? "md"}
      busy={isLoading}
      footer={
        <>
          <Button variant="secondary" disabled={isLoading} onClick={onClose}>
            {resolvedCancelLabel}
          </Button>
          <Button loading={isLoading} loadingText={t("submitting")} onClick={onSave}>
            {resolvedSaveLabel}
          </Button>
        </>
      }
    >
      {imageProps ? <ImageField {...imageProps} /> : null}
      {children}
    </Dialog>
  );
};

export default memo(UpdatePopup);
