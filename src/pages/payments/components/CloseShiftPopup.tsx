import { memo, useEffect, useState } from "react";
import { LoaderCircle, Square, X } from "lucide-react";
import Popup from "../../../shared/ui/Popup";
import { useTranslation } from "react-i18next";

interface CloseShiftPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (comment: string) => void;
  isLoading?: boolean;
}

const CloseShiftPopup = ({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}: CloseShiftPopupProps) => {
  const { t } = useTranslation("payments");
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setComment("");
    }
  }, [isOpen]);

  const handleClose = () => {
    if (isLoading) return;
    setComment("");
    onClose();
  };

  const handleConfirm = () => {
    onConfirm(comment.trim());
  };

  return (
    <Popup isShow={isOpen} onClose={handleClose}>
      <div className="w-[92vw] max-w-115 overflow-hidden rounded-2xl border border-white/10 bg-primary shadow-2xl dark:bg-maindark">
        <div className="flex items-start justify-between bg-linear-to-r from-rose-500 via-orange-500 to-amber-400 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/16 text-white shadow-lg backdrop-blur-sm">
              <Square size={20} />
            </div>
            <div>
              <h3 className="text-xl font-bold tracking-tight text-white">
                {t("closeShiftTitle")}
              </h3>
              <p className="mt-1 text-sm font-medium text-white/75">
                {t("closeShiftDescription")}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/18 text-white transition-colors hover:bg-white/28 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 px-6 py-6">
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-4">
            <p className="text-base font-medium leading-7 text-amber-300">
              {t("closeShiftWarning")}
            </p>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="close-shift-comment"
              className="block text-sm font-semibold text-gray-700 dark:text-white/70"
            >
              {t("optionalComment")}
            </label>
            <textarea
              id="close-shift-comment"
              rows={3}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder={t("closeShiftPlaceholder")}
              className="min-h-28 w-full resize-none rounded-xl border border-glass-border bg-sidebar px-4 py-3 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-main focus:ring-2 focus:ring-main/20 dark:bg-primarydark dark:text-white dark:placeholder:text-white/30"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-glass-border bg-sidebar/70 px-6 py-4 dark:bg-primarydark/70">
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="inline-flex h-11 min-w-30 items-center justify-center rounded-xl border border-glass-border px-5 text-sm font-semibold text-gray-600 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60 dark:text-white/70"
          >
            {t("cancelLabel")}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading}
            className="inline-flex h-11 min-w-40 items-center justify-center gap-2 rounded-xl bg-linear-to-r from-rose-500 via-orange-500 to-orange-400 px-5 text-sm font-bold text-white shadow-lg shadow-orange-500/20 transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <LoaderCircle size={16} className="animate-spin" />
                {t("loadingLabel")}
              </>
            ) : (
              <>
                <Square size={16} />
                {t("closeShiftTitle")}
              </>
            )}
          </button>
        </div>
      </div>
    </Popup>
  );
};

export default memo(CloseShiftPopup);
