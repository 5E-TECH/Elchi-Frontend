import { memo, useState, useEffect } from "react";
import { Camera, X, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Order } from "./ordertable/pendingOrderTable";
import Popup from "../../../../../shared/ui/Popup";

type Props = {
  order: Order | null;
  open: boolean;
  onClose: () => void;
  onCancel: (
    orderId: string,
    payload: { comment: string; extraCost: number; paidAmount: number; proof?: File }
  ) => void;
  isLoading?: boolean;
};

const MAX_PROOF_SIZE_MB = 10;
const MAX_PROOF_SIZE_BYTES = MAX_PROOF_SIZE_MB * 1024 * 1024;

const CancelModal = ({ order, open, onClose, onCancel, isLoading }: Props) => {
  const { t } = useTranslation(["orders", "common"]);
  const [comment, setComment]       = useState("");
  const [extraCost, setExtraCost]   = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [proof, setProof] = useState<File | null>(null);
  const [proofError, setProofError] = useState("");

  useEffect(() => {
    if (open) {
      setComment("");
      setExtraCost(0);
      setPaidAmount(0);
      setProof(null);
      setProofError("");
    }
  }, [open]);

  if (!open || !order) return null;

  const orderFlags = order as Order & Record<string, unknown>;
  const proofConditions = Array.isArray(order.market?.expense_proof_conditions)
    ? order.market.expense_proof_conditions
    : [];
  const cancelRequiresMedia = Boolean(
    orderFlags.cancel_requires_media ??
    orderFlags.cancelRequiresMedia ??
    orderFlags.require_cancel_proof ??
    orderFlags.cancel_proof_required ??
    proofConditions.includes("cancel_any"),
  );
  const isProofMissing = cancelRequiresMedia && !proof;

  const handleSubmit = () => {
    if (cancelRequiresMedia && !proof) {
      setProofError(t("mediaProofRequired"));
      return;
    }
    onCancel(order.id, { comment, extraCost, paidAmount, ...(proof ? { proof } : {}) });
  };

  const handleProofChange = (file?: File) => {
    setProofError("");
    if (!file) {
      setProof(null);
      return;
    }
    if (file.size > MAX_PROOF_SIZE_BYTES) {
      setProof(null);
      setProofError(t("mediaProofTooLarge", { size: MAX_PROOF_SIZE_MB }));
      return;
    }
    setProof(file);
  };

  return (
    <Popup isShow={open} onClose={onClose}>
      <div className="relative mx-3 w-[calc(100vw-24px)] max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-primary shadow-2xl dark:border-primarydark/60 dark:bg-maindark">
        {/* Header */}
        <div className="flex items-center justify-between bg-gradient-to-r from-rose-600 to-red-500 px-5 py-4 dark:from-rose-700 dark:to-red-600">
          <div className="flex items-center gap-2">
            <XCircle size={20} className="text-white" />
            <h2 className="text-white font-bold text-base">
              {t("cancelOrder")}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
            aria-label={t("close", { ns: "common" })}
          >
            <X size={16} className="text-white" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-4">
          {/* Order info */}
          <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-500/20 dark:bg-rose-500/10">
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
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 outline-none transition-colors focus:border-rose-400 dark:border-white/10 dark:bg-primarydark/35 dark:text-white dark:focus:border-rose-400"
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
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 outline-none transition-colors focus:border-rose-400 dark:border-white/10 dark:bg-primarydark/35 dark:text-white dark:focus:border-rose-400"
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
              className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 outline-none transition-colors placeholder:text-gray-400 focus:border-rose-400 dark:border-white/10 dark:bg-primarydark/35 dark:text-white dark:placeholder:text-white/35 dark:focus:border-rose-400"
              placeholder={t("cancelReason")}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">
              <Camera size={14} className="text-rose-500" />
              {t("mediaProof")}
              {cancelRequiresMedia ? <span className="text-error">*</span> : null}
            </label>
            {cancelRequiresMedia ? (
              <p className="text-xs font-semibold text-rose-600 dark:text-rose-300">
                {t("cancelMediaProofRequiredNotice")}
              </p>
            ) : null}
            <label className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-3 py-4 text-center transition-colors ${
              proofError
                ? "border-error/50 bg-error/10"
                : "border-gray-200 bg-gray-50 hover:border-rose-400 dark:border-white/10 dark:bg-primarydark/35"
            }`}>
              <input
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={(event) => handleProofChange(event.target.files?.[0])}
              />
              <Camera size={20} className="text-rose-500" />
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-100">
                {proof ? proof.name : t("mediaProofUpload")}
              </span>
              <span className="text-xs text-gray-400">
                {t("mediaProofHint", { size: MAX_PROOF_SIZE_MB })}
              </span>
            </label>
            {proofError ? <p className="text-xs font-semibold text-error">{proofError}</p> : null}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 border-t border-gray-200 px-5 py-4 dark:border-white/10">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 bg-white/70 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/80 dark:hover:bg-white/10"
          >
            {t("back", { ns: "common" })}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || isProofMissing}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-500 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose-500/20 transition-colors hover:from-rose-500 hover:to-red-500 disabled:opacity-60"
          >
            {isLoading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <XCircle size={15} />
            )}
            {isProofMissing ? t("cancelMediaProofRequiredNotice") : t("cancelOrderAction")}
          </button>
        </div>
      </div>
    </Popup>
  );
};

export default memo(CancelModal);
