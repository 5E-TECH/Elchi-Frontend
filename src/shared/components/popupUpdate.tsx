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
      <div className={`w-[92vw] ${widthClassName} rounded-3xl border border-[color:var(--color-border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(246,248,255,0.99)_100%)] shadow-[0_30px_70px_rgba(46,54,98,0.18)] dark:bg-maindark flex flex-col max-h-[90vh] overflow-hidden`}>
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-[color:var(--color-border-soft)] bg-[linear-gradient(180deg,rgba(124,92,255,0.08)_0%,rgba(124,92,255,0.02)_100%)] dark:border-white/5">
          <div className="flex items-center gap-3">
            {icon && <div className="text-main">{icon}</div>}
            <h3 className="text-xl font-semibold tracking-wide text-maindark dark:text-primary">{title}</h3>
          </div>
          <X
            className="cursor-pointer text-gray-400 hover:text-maindark dark:hover:text-primary transition-colors"
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
        <div className="p-6 flex gap-4 border-t border-[color:var(--color-border-soft)] dark:border-white/5 bg-[linear-gradient(180deg,rgba(124,92,255,0.04)_0%,rgba(255,255,255,0.82)_100%)] dark:bg-white/2">
          <Button
            label={resolvedCancelLabel}
            onClick={onClose}
            className="flex-1 border border-[color:var(--color-border-soft)] dark:border-white/10 text-maindark dark:text-gray-300 hover:bg-[var(--color-main-soft)] dark:hover:bg-white/5 bg-white/75 dark:bg-transparent py-3"
          />
          <Button
            label={isLoading ? t("submitting") : resolvedSaveLabel}
            onClick={onSave}
            disabled={isLoading}
            className={`flex-1 py-3 shadow-lg shadow-main/20 ${!isLoading ? "bg-main hover:bg-primarydark" : "opacity-50"}`}
          />
        </div>
      </div>
    </Popup>
  );
};

export default memo(UpdatePopup);
