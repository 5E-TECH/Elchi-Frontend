import { memo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { X, ImagePlus } from "lucide-react";
import Button from "./button";
import Popup from "../ui/Popup";

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
  widthClassName?: string;
  // Rasm uchun ixtiyoriy propslar
  imageProps?: {
    label: string;
    value?: string | File;
    onChange: (file: File) => void;
    previewUrl?: string;
  };
}

const UpdatePopup = ({
  isOpen,
  onClose,
  onSave,
  title,
  icon,
  children,
  saveLabel = "Saqlash",
  cancelLabel = "Bekor qilish",
  isLoading = false,
  widthClassName = "max-w-md",
  imageProps,
}: UpdatePopupProps) => {
  const { t } = useTranslation("common");
  const resolvedSaveLabel = saveLabel ?? t("save");
  const resolvedCancelLabel = cancelLabel ?? t("cancel");

  return (
    <Popup isShow={isOpen} onClose={onClose}>
      <div className={`w-[92vw] ${widthClassName} flex max-h-[90vh] flex-col overflow-hidden rounded-3xl border border-[color:var(--color-border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(246,248,255,0.99)_100%)] shadow-[0_30px_70px_rgba(46,54,98,0.18)] dark:border-white/10 dark:bg-[color:var(--color-surface-elevated-dark)] dark:bg-none dark:shadow-[0_30px_70px_rgba(0,0,0,0.34)]`}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[color:var(--color-border-soft)] bg-[linear-gradient(180deg,rgba(124,92,255,0.08)_0%,rgba(124,92,255,0.02)_100%)] p-6 dark:border-white/10 dark:bg-[color:var(--color-card-surface-strong)] dark:bg-none">
          <div className="flex items-center gap-3">
            {icon && <div className="text-main">{icon}</div>}
            <h3 className="text-xl font-semibold tracking-wide text-maindark dark:text-primary">{title}</h3>
          </div>
          <X
            className="cursor-pointer text-[color:var(--color-text-muted)] transition-colors hover:text-maindark dark:text-[color:var(--color-text-muted-dark)] dark:hover:text-primary"
            onClick={onClose}
          />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-transparent dark:bg-maindark">
          {/* Universal Image Update Section */}
          {imageProps && (
            <div className="space-y-2">
              <label className="text-sm text-gray-500 dark:text-gray-400 ml-1">
                {imageProps.label}
              </label>
              <label className="relative h-44 rounded-2xl overflow-hidden border border-dashed border-[color:var(--color-border-soft)] dark:border-white/10 group cursor-pointer flex flex-col items-center justify-center bg-[var(--color-main-soft)] dark:bg-white/2 hover:bg-white dark:hover:bg-white/4 transition-all">
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={(e) =>
                    e.target.files?.[0] &&
                    imageProps.onChange(e.target.files[0])
                  }
                />
                {imageProps.previewUrl || imageProps.value ? (
                  <img
                    src={
                      imageProps.previewUrl
                        ?? (typeof imageProps.value === "string" ? imageProps.value : undefined)
                    }
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="text-center space-y-2">
                    <ImagePlus className="mx-auto text-gray-400 dark:text-gray-500" size={32} />
                    <span className="text-xs text-gray-400 dark:text-gray-500">{t("uploadImage")}</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-sm">
                  {t("edit")}
                </div>
              </label>
            </div>
          )}

          {/* Boshqa inputlar (Columns) */}
          {children}
        </div>

        {/* Footer */}
        <div className="grid grid-cols-2 gap-3 border-t border-[color:var(--color-border-soft)] bg-[linear-gradient(180deg,rgba(124,92,255,0.04)_0%,rgba(255,255,255,0.82)_100%)] p-4 dark:border-white/10 dark:bg-[color:var(--color-card-surface-strong)] dark:bg-none sm:p-5">
          <Button
            label={resolvedCancelLabel}
            onClick={onClose}
            className="h-12 rounded-2xl border border-[color:var(--color-border-soft)] bg-white/80 text-sm font-semibold text-maindark shadow-none hover:bg-[var(--color-main-soft)] dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
          />
          <Button
            label={isLoading ? t("submitting") : resolvedSaveLabel}
            onClick={onSave}
            disabled={isLoading}
            className={`h-12 rounded-2xl text-sm font-semibold shadow-lg shadow-main/25 ${!isLoading ? "bg-main hover:bg-primarydark" : "opacity-50"}`}
          />
        </div>
      </div>
    </Popup>
  );
};

export default memo(UpdatePopup);
