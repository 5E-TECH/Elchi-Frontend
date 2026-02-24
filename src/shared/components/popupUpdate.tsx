import { memo, type ReactNode } from "react";
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
  imageProps,
}: UpdatePopupProps) => {
  return (
    <Popup isShow={isOpen} onClose={onClose}>
      <div className="bg-[#1e1e2d] w-[92vw] max-w-md rounded-3xl text-white shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-white/5">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            {icon && <div className="text-purple-500">{icon}</div>}
            <h3 className="text-xl font-semibold tracking-wide">{title}</h3>
          </div>
          <X
            className="cursor-pointer text-gray-400 hover:text-white transition-colors"
            onClick={onClose}
          />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* Universal Image Update Section */}
          {imageProps && (
            <div className="space-y-2">
              <label className="text-sm text-gray-400 ml-1">
                {imageProps.label}
              </label>
              <label className="relative h-44 rounded-2xl overflow-hidden border border-dashed border-white/10 group cursor-pointer flex flex-col items-center justify-center bg-white/2 hover:bg-white/4 transition-all">
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
                      typeof imageProps.value === "string"
                        ? imageProps.value
                        : imageProps.previewUrl
                    }
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="text-center space-y-2">
                    <ImagePlus className="mx-auto text-gray-500" size={32} />
                    <span className="text-xs text-gray-500">Rasm yuklash</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-sm">
                  O'zgartirish
                </div>
              </label>
            </div>
          )}

          {/* Boshqa inputlar (Columns) */}
          {children}
        </div>

        {/* Footer */}
        <div className="p-6 flex gap-4 border-t border-white/5 bg-white/2">
          <Button
            label={cancelLabel}
            onClick={onClose}
            className="flex-1 border border-white/10 text-gray-300 hover:bg-white/5 bg-transparent py-3"
          />
          <Button
            label={isLoading ? "Saqlanmoqda..." : saveLabel}
            onClick={onSave}
            disabled={isLoading}
            className={`flex-1 py-3 shadow-lg shadow-indigo-500/20 ${!isLoading ? "bg-[#6366f1] hover:bg-[#5558e3]" : "opacity-50"}`}
          />
        </div>
      </div>
    </Popup>
  );
};

export default memo(UpdatePopup);
