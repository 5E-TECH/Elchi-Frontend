// dizayn-v2: (maket yo'q) superadmin-integrations-rotate-key-dialog
import { useEffect, useId, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { CircleX, LoaderCircle, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useFocusTrap } from "../../../../shared/lib/useFocusTrap";

/**
 * BUYURTMANI POCHTADAN O'CHIRISH — tasdiq (yokjwjXG).
 *
 * Qaytarib bo'lmaydi, shuning uchun sabab MAJBURIY (backend: 3..500 belgi).
 * Backend rad etsa (409 — pochta jo'natilgan, buyurtma kuryerda / sotilgan …)
 * sabab oynaning o'zida ko'rinadi, oyna yopilmaydi.
 *
 * Maket yo'q — eng yaqini `superadmin-integrations-rotate-key-dialog`
 * (xavfli tasdiq) + `tizim-states-forms` (majburiy maydon).
 */

export const DELETE_REASON_MIN = 3;
export const DELETE_REASON_MAX = 500;

const BTN =
  "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] border px-4 text-sm font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action disabled:cursor-not-allowed disabled:opacity-45 max-md:min-h-11";
const BTN_SECONDARY = `${BTN} border-border-strong bg-surface text-text hover:bg-sunken`;
// To'liq `bg-danger` tungi mavzuda AA dan past (CODE-MAP 0.4) — `danger-soft`.
const BTN_DANGER = `${BTN} border-transparent bg-danger-soft text-danger-fg hover:bg-danger hover:text-on-solid`;
const INPUT =
  "w-full rounded-[10px] border border-border-strong bg-input px-3 py-2.5 text-base text-text placeholder:text-text-subtle hover:border-text-subtle focus:border-action focus:outline-none focus:ring-3 focus:ring-focus aria-[invalid=true]:border-danger md:text-sm";

type Props = {
  open: boolean;
  count: number;
  pending: boolean;
  /** Backend rad etgan sabab (409 va h.k.) — oynada ko'rsatiladi. */
  error: string;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
};

const DeleteFromPostDialog = ({ open, count, pending, error, onCancel, onConfirm }: Props) => {
  const { t } = useTranslation(["mails", "common"]);
  const ids = useId();
  const [reason, setReason] = useState("");
  const cancel = () => {
    if (!pending) onCancel();
  };
  const panelRef = useFocusTrap<HTMLDivElement>(open, { onEscape: cancel, inertAppRoot: true });

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const trimmed = reason.trim();
  const reasonValid = trimmed.length >= DELETE_REASON_MIN && trimmed.length <= DELETE_REASON_MAX;
  const id = (suffix: string) => `${ids}-${suffix}`;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!reasonValid || pending) return;
    onConfirm(trimmed);
  };

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-overlay p-6 max-md:items-end max-md:p-0">
      <button type="button" aria-hidden="true" tabIndex={-1} onClick={cancel} className="absolute inset-0 cursor-default" />
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={id("title")}
        aria-describedby={id("text")}
        tabIndex={-1}
        className="relative flex w-full max-w-[460px] flex-col gap-4 rounded-[20px] border border-border bg-raised p-6 shadow-xl outline-none max-md:max-h-[92dvh] max-md:max-w-full max-md:overflow-auto max-md:rounded-b-none max-md:px-4 max-md:pb-6 max-md:pt-5"
      >
        <div className="flex items-start gap-3">
          <span className="inline-flex size-10 flex-none items-center justify-center rounded-full bg-danger-soft text-danger-fg">
            <Trash2 className="size-5" aria-hidden="true" />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <h2 id={id("title")} className="text-lg font-semibold text-text">
              {t("deleteFromPostTitle", { count })}
            </h2>
            <p id={id("text")} className="text-[13px] text-text-muted">
              <span className="font-semibold text-text">{t("deleteFromPostLead")}</span>{" "}
              {t("deleteFromPostDescription")}
            </p>
          </div>
        </div>

        <form id={id("form")} noValidate onSubmit={submit} className="flex flex-col gap-1.5">
          <label htmlFor={id("reason")} className="text-[13px] font-semibold text-text">
            {t("deleteFromPostReason")} <span className="text-danger-fg">*</span>
          </label>
          <textarea
            id={id("reason")}
            value={reason}
            rows={3}
            maxLength={DELETE_REASON_MAX}
            required
            aria-required="true"
            aria-invalid={reason !== "" && !reasonValid ? true : undefined}
            aria-describedby={id("hint")}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t("deleteFromPostReasonPlaceholder")}
            className={`${INPUT} min-h-[88px] resize-y`}
          />
          <span id={id("hint")} className="text-xs text-text-muted">
            {t("deleteFromPostReasonHint", { min: DELETE_REASON_MIN, max: DELETE_REASON_MAX })}
          </span>
        </form>

        {error ? (
          <div role="alert" className="flex items-start gap-2 rounded-xl bg-danger-soft px-3 py-2.5 text-[13px] text-danger-fg">
            <CircleX className="mt-0.5 size-4 flex-none" aria-hidden="true" />
            <p className="min-w-0 text-text">{error}</p>
          </div>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2 max-md:[&>*]:flex-1">
          <button type="button" disabled={pending} onClick={cancel} className={BTN_SECONDARY}>
            {t("cancel", { ns: "common" })}
          </button>
          <button
            type="submit"
            form={id("form")}
            disabled={!reasonValid || pending}
            aria-busy={pending || undefined}
            className={BTN_DANGER}
          >
            {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Trash2 className="size-4" aria-hidden="true" />}
            {t("deleteFromPostConfirm")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default DeleteFromPostDialog;
