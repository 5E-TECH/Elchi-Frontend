// dizayn-v2: (maket yo'q) superadmin-integrations-rotate-key-dialog
import { useState, type FormEvent } from "react";
import { CircleX, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, Dialog, Field, TextInput } from "../../../../shared/ui/primitives";

/**
 * BUYURTMANI POCHTADAN O'CHIRISH — tasdiq (yokjwjXG), `Dialog` primitivi (telefonda pastki varaqa, fokus tuzog'i,
 * Esc, skroll qulfi — primitivning o'zida).
 *
 * Qaytarib bo'lmaydi, shuning uchun sabab MAJBURIY (backend: 3..500 belgi). So'rov ketayotganda (`pending`)
 * Esc, fon va «Bekor qilish» ishlamaydi. Backend rad etsa (409 — pochta jo'natilgan, buyurtma kuryerda /
 * sotilgan …) sabab oynaning o'zida ko'rinadi, oyna yopilmaydi.
 *
 * Maket yo'q — eng yaqini `superadmin-integrations-rotate-key-dialog` (xavfli tasdiq) + `tizim-states-forms`
 * (majburiy maydon).
 */

export const DELETE_REASON_MIN = 3;
export const DELETE_REASON_MAX = 500;

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
  const [reason, setReason] = useState("");
  // Har ochilishda sabab bo'sh (effektsiz: oldingi `open` bilan solishtirib, render paytida tozalanadi).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setReason("");
  }

  const cancel = () => {
    if (!pending) onCancel();
  };

  const trimmed = reason.trim();
  const reasonValid = trimmed.length >= DELETE_REASON_MIN && trimmed.length <= DELETE_REASON_MAX;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!reasonValid || pending) return;
    onConfirm(trimmed);
  };

  return (
    <Dialog
      open={open}
      onClose={cancel}
      role="alertdialog"
      size="sm"
      icon={Trash2}
      iconTone="danger"
      iconShape="circle"
      busy={pending}
      title={t("deleteFromPostTitle", { count })}
      description={
        <>
          <span className="font-semibold text-text">{t("deleteFromPostLead")}</span> {t("deleteFromPostDescription")}
        </>
      }
      onSubmit={submit}
      footer={
        <>
          <Button variant="secondary" disabled={pending} onClick={cancel} className="flex-[1_1_auto]">
            {t("cancel", { ns: "common" })}
          </Button>
          <Button
            type="submit"
            variant="danger"
            leftIcon={Trash2}
            disabled={!reasonValid}
            loading={pending}
            className="flex-[1_1_auto]"
          >
            {t("deleteFromPostConfirm")}
          </Button>
        </>
      }
    >
      <Field
        label={t("deleteFromPostReason")}
        required
        hint={t("deleteFromPostReasonHint", { min: DELETE_REASON_MIN, max: DELETE_REASON_MAX })}
        invalid={reason !== "" && !reasonValid}
      >
        <TextInput
          multiline
          rows={3}
          value={reason}
          maxLength={DELETE_REASON_MAX}
          onValueChange={setReason}
          placeholder={t("deleteFromPostReasonPlaceholder")}
        />
      </Field>

      {error ? (
        <div role="alert" className="flex items-start gap-2 rounded-xl bg-danger-soft px-3 py-2.5 text-[13px] text-danger-fg">
          <CircleX className="mt-0.5 size-4 flex-none" aria-hidden="true" />
          <p className="min-w-0 text-text">{error}</p>
        </div>
      ) : null}
    </Dialog>
  );
};

export default DeleteFromPostDialog;
