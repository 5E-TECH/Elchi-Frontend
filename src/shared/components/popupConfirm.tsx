import { memo, type ReactNode } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import Popup from '../ui/Popup';

interface PopupConfirmProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
  variant?: 'danger' | 'warning';
}

const PopupConfirm = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Tasdiqlang",
  message,
  confirmLabel = "Ha, o'chirish",
  cancelLabel = "Bekor qilish",
  isLoading = false,
  variant = 'danger',
}: PopupConfirmProps) => {
  const iconBg = variant === 'danger'
    ? 'bg-red-100 dark:bg-red-500/10'
    : 'bg-amber-100 dark:bg-amber-500/10';

  const iconColor = variant === 'danger' ? 'text-red-500' : 'text-amber-500';

  const confirmBg = variant === 'danger'
    ? 'bg-red-500 hover:bg-red-600'
    : 'bg-amber-500 hover:bg-amber-600';

  return (
    <Popup isShow={isOpen} onClose={onClose}>
      <div className="bg-white dark:bg-maindark w-[92vw] max-w-md rounded-2xl p-8 shadow-2xl text-center">
        <div className={`w-16 h-16 mx-auto mb-4 rounded-full ${iconBg} flex items-center justify-center`}>
          <AlertTriangle size={28} className={iconColor} />
        </div>

        <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
          {title}
        </h3>

        {message && (
          <div className="text-gray-500 dark:text-gray-400 text-sm mb-6">
            {message}
          </div>
        )}

        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-6 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-medium text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-6 py-2.5 rounded-xl ${confirmBg} text-white font-medium text-sm transition-colors disabled:opacity-50 flex items-center gap-2`}
          >
            {isLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                O'chirilmoqda...
              </>
            ) : (
              <>
                <Trash2 size={16} />
                {confirmLabel}
              </>
            )}
          </button>
        </div>
      </div>
    </Popup>
  );
};

export default memo(PopupConfirm);