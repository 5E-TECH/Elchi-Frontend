// dizayn-v2: superadmin-payments-main-cashbox-shift-dialog, admin-payments-shift-dialog, manager-payments-close-shift-dialog
import { memo, useState } from "react";
import { Download, Timer } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatMoneyLocalized } from "../../../shared/lib/formatMoney";
import { Button, Dialog, Field, TextInput } from "../../../shared/ui/primitives";

/**
 * «SMENANI YOPISH» OYNASI — asosiy kassa (dizayn v2, maketlar `superadmin-payments-main-cashbox-shift-dialog`,
 * `admin-payments-shift-dialog`, `manager-payments-close-shift-dialog`).
 *
 * Oynaning o'zi tasdiq (ustiga ikkinchi tasdiq qo'yilmaydi): «Joriy smena», «Ochgan xodim», «Kassadagi summa»,
 * Excel haqida eslatma, ixtiyoriy izoh; «Smenani yopish» → `onConfirm(izoh.trim())`. Yopish ketayotganda
 * (`isLoading`) Esc, fon, × va «Bekor qilish» oynani yopmaydi, tugmada yuklanish.
 */

interface CloseShiftPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (comment: string) => void;
  isLoading?: boolean;
  /** Ochiq smena boshlangan vaqt (`opened_at`). */
  openedAt?: string;
  /** Smenani ochgan xodim (o'zi). */
  openedByName?: string;
  /** Kassadagi umumiy summa. */
  cashboxTotal?: number;
}

const CloseShiftPopup = ({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
  openedAt,
  openedByName,
  cashboxTotal,
}: CloseShiftPopupProps) => {
  const { t, i18n } = useTranslation("payments");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const [comment, setComment] = useState("");

  const handleClose = () => {
    if (isLoading) return;
    setComment("");
    onClose();
  };

  const handleConfirm = () => {
    if (isLoading) return;
    onConfirm(comment.trim());
  };

  const openedAtText = openedAt ? formatDateTimeLocalized(openedAt, { language }) : "";
  const rows: Array<[string, string]> = [
    [t("v2MainCashbox.shift.current"), openedAtText && openedAtText !== "—" ? t("v2MainCashbox.shift.since", { time: openedAtText }) : "—"],
    [t("v2MainCashbox.shift.openedBy"), openedByName?.trim() || "—"],
    [
      t("v2MainCashbox.shift.cashboxTotal"),
      cashboxTotal === undefined ? "—" : formatMoneyLocalized(cashboxTotal, { language }),
    ],
  ];

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      onExited={() => setComment("")}
      busy={isLoading}
      size="md"
      icon={Timer}
      title={t("v2MainCashbox.shift.title")}
      description={t("v2MainCashbox.shift.subtitle")}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={isLoading}>
            {t("v2MainCashbox.shift.cancel")}
          </Button>
          <Button
            leftIcon={Timer}
            onClick={handleConfirm}
            loading={isLoading}
            loadingText={t("v2MainCashbox.shift.closing")}
          >
            {t("v2MainCashbox.shift.submit")}
          </Button>
        </>
      }
    >
      <dl className="m-0 flex flex-col rounded-xl bg-sunken px-4 py-1 text-sm">
        {rows.map(([label, value], index) => (
          <div
            key={label}
            className={
              index === 0
                ? "flex flex-wrap justify-between gap-x-3 gap-y-1 py-2"
                : "flex flex-wrap justify-between gap-x-3 gap-y-1 border-t border-border py-2"
            }
          >
            <dt className="text-text-muted">{label}</dt>
            <dd className="m-0 whitespace-nowrap font-semibold text-text">{value}</dd>
          </div>
        ))}
      </dl>

      <div role="note" className="flex items-start gap-3 rounded-xl bg-info-soft px-4 py-3 text-sm text-info-fg">
        <Download aria-hidden="true" size={18} className="mt-px shrink-0" />
        <p className="m-0 min-w-0 text-text">{t("v2MainCashbox.shift.excelNote")}</p>
      </div>

      <Field label={t("v2MainCashbox.shift.comment")} optional>
        <TextInput
          multiline
          rows={3}
          value={comment}
          onValueChange={setComment}
          placeholder={t("v2MainCashbox.shift.commentPlaceholder")}
        />
      </Field>
    </Dialog>
  );
};

export default memo(CloseShiftPopup);
