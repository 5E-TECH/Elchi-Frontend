import { memo, useState, useEffect } from "react";
import { X, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Order } from "./ordertable/pendingOrderTable";

type Props = {
  order: Order | null;
  open: boolean;
  onClose: () => void;
  onCancel: (
    orderId: string,
    payload: { comment: string; extraCost: number; paidAmount: number }
  ) => void;
  isLoading?: boolean;
};

const CancelModal = ({ order, open, onClose, onCancel, isLoading }: Props) => {
  const { t } = useTranslation(["orders", "common"]);
  const [comment, setComment]       = useState("");
  const [extraCost, setExtraCost]   = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);

  useEffect(() => {
    if (open) {
      setComment("");
      setExtraCost(0);
      setPaidAmount(0);
    }
  }, [open]);

  if (!open || !order) return null;

  const handleSubmit = () => {
    onCancel(order.id, { comment, extraCost, paidAmount });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md bg-white dark:bg-maindark rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-red-500">
          <div className="flex items-center gap-2">
            <XCircle size={20} className="text-white" />
            <h2 className="text-white font-bold text-base">
              {t("cancelOrder")}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
          >
            <X size={16} className="text-white" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-4">
          {/* Order info */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20">
            <span className="text-sm text-gray-600 dark:text-gray-400">{t("customer")}:</span>
            <span className="text-sm font-semibold text-gray-800 dark:text-white">
              {order.customer?.name}
            </span>
          </div>

          {/* extraCost */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("extraCost")}
            </label>
            <input
              type="number"
              min={0}
              value={extraCost}
              onChange={(e) => setExtraCost(Number(e.target.value))}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-gray-800 dark:text-white text-sm outline-none focus:border-red-400 dark:focus:border-red-500 transition-colors"
              placeholder="0"
            />
          </div>

          {/* paidAmount */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("paidAmount")}
            </label>
            <input
              type="number"
              min={0}
              value={paidAmount}
              onChange={(e) => setPaidAmount(Number(e.target.value))}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-gray-800 dark:text-white text-sm outline-none focus:border-red-400 dark:focus:border-red-500 transition-colors"
              placeholder="0"
            />
          </div>

          {/* comment */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("note")}
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-gray-800 dark:text-white text-sm outline-none focus:border-red-400 dark:focus:border-red-500 transition-colors resize-none"
              placeholder={t("cancelReason")}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-5 pb-5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
          >
            {t("back", { ns: "common" })}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <XCircle size={15} />
            )}
            {t("cancelOrderAction")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default memo(CancelModal);
