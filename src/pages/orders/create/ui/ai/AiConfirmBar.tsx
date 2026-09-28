import { memo, useId, useState } from "react";
import { Loader2, SendHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import Popup from "../../../../../shared/ui/Popup";
import { formatPrice } from "../../model/orderCreateForm";
import { getActionButtonClassName } from "../formFieldStyles";
import type { AiDraftOrder } from "./evalPreview";

/**
 * Shu sondan KO'P buyurtma birdaniga yaratilsa tasdiq oynasi chiqadi —
 * operator AI natijasini ko'r-ko'rona tasdiqlab yubormasligi uchun oxirgi to'siq.
 */
const CONFIRM_DIALOG_THRESHOLD = 5;

type AiConfirmBarProps = {
  readyOrders: AiDraftOrder[];
  notReadyCount: number;
  pending: boolean;
  onConfirm: () => void;
};

/**
 * ⚠️ "Hammasini yaratish" tugmasi ATAYLAB YO'Q: faqat `ready` kartalar
 * yaratiladi, to'ldirilmaganlari so'rovga umuman qo'shilmaydi.
 */
const AiConfirmBar = ({ readyOrders, notReadyCount, pending, onConfirm }: AiConfirmBarProps) => {
  const { t } = useTranslation(["orders", "common"]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const dialogTitleId = useId();
  const readyCount = readyOrders.length;
  const disabled = readyCount === 0 || pending;

  const handleClick = () => {
    if (disabled) return;
    if (readyCount > CONFIRM_DIALOG_THRESHOLD) {
      setDialogOpen(true);
      return;
    }
    onConfirm();
  };

  return (
    <>
      <div
        data-testid="ai-confirm-bar"
        className="sticky bottom-0 z-20 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-primary p-3 shadow-lg dark:border-primarydark dark:bg-maindark sm:flex-row sm:items-center sm:justify-between sm:p-4"
      >
        <p className="text-sm font-semibold text-maindark dark:text-primary">
          {t("aiReadySummary", { ready: readyCount, notReady: notReadyCount })}
        </p>
        <button
          type="button"
          onClick={handleClick}
          disabled={disabled}
          className={`${getActionButtonClassName({ variant: "primary", disabled })} min-h-12 w-full sm:w-auto`}
        >
          {pending ? <Loader2 size={16} className="animate-spin" /> : <SendHorizontal size={16} />}
          {pending ? t("aiCreating") : t("aiCreateReady", { count: readyCount })}
        </button>
      </div>

      <Popup isShow={dialogOpen} onClose={() => setDialogOpen(false)} labelledBy={dialogTitleId}>
        <div
          className="flex max-h-[85vh] w-[calc(100vw-32px)] max-w-lg flex-col gap-4 rounded-2xl bg-primary p-5 shadow-xl dark:bg-maindark"
        >
          <h3 id={dialogTitleId} className="text-base font-bold text-maindark dark:text-primary">
            {t("aiConfirmDialogTitle", { count: readyCount })}
          </h3>
          <ul className="flex flex-col gap-1.5 overflow-y-auto text-sm" data-testid="ai-confirm-list">
            {readyOrders.map((order, index) => (
              <li
                key={`${order.phone_number}-${index}`}
                className="flex flex-wrap gap-x-2 rounded-lg bg-gray-50 px-3 py-2 text-maindark dark:bg-primarydark dark:text-primary"
              >
                <span className="font-semibold">{order.customer_name}</span>
                <span className="text-gray-400">—</span>
                <span>{order.district_name ?? "—"}</span>
                <span className="text-gray-400">—</span>
                <span className="font-mono">
                  {formatPrice(String(order.total_price ?? 0))} {t("currency")}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setDialogOpen(false)}
              className={getActionButtonClassName({ variant: "secondary" })}
            >
              {t("cancel", { ns: "common" })}
            </button>
            <button
              type="button"
              onClick={() => {
                setDialogOpen(false);
                onConfirm();
              }}
              className={getActionButtonClassName({ variant: "primary" })}
            >
              <SendHorizontal size={16} />
              {t("aiConfirmDialogSubmit")}
            </button>
          </div>
        </div>
      </Popup>
    </>
  );
};

export default memo(AiConfirmBar);
