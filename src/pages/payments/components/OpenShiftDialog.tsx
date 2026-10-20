// dizayn-v2: superadmin-payments-main-cashbox-shift-open-dialog, admin-payments-main-cashbox-shift-open-dialog, manager-payments-main-cashbox-shift-open-dialog
import { memo, useState } from "react";
import { Banknote, CreditCard, Timer } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatMoneyLocalized } from "../../../shared/lib/formatMoney";
import { Button, Dialog, Field, TextInput } from "../../../shared/ui/primitives";
import ShiftSummaryList from "./ShiftSummaryList";

/**
 * «SMENANI OCHISH» OYNASI (maketlar `{superadmin,admin,manager}-payments-main-cashbox-shift-open-dialog`).
 *
 * «Ochadigan xodim» (o'zi — backend JWT'dan yozadi) · «Boshlanish: hozir» · «Ochilish qoldig'i» (naqd, karta, jami —
 * kassaning jonli qoldig'i; backend ochish paytidagi qoldiqni yozadi) · ixtiyoriy izoh. «Smenani ochish» →
 * `onSubmit(izoh.trim())`; oynani ota komponent yopadi (muvaffaqiyatda) — xatoda oyna ochiq qoladi va xabar chiqadi.
 * Yuborilayotganda (`isLoading`) Esc, fon, × va «Bekor qilish» oynani yopmaydi.
 *
 * Maketdagi «Oxirgi smena kamomad bilan yopilgan» ogohlantirishi chizilmaydi — `last_closed` hali backendda yo'q
 * (Taklif · backend kerak, CB-3).
 */

type OpenShiftDialogProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (comment: string) => void;
  isLoading?: boolean;
  /** Ochadigan xodim (joriy foydalanuvchi). */
  openerName: string;
  /** «Asosiy kassa» yoki «Urgut filiali kassasi». */
  cashboxLabel: string;
  /** Kassaning jonli qoldig'i; noma'lum — `null` («—»). */
  cash: number | null;
  card: number | null;
  /** «Karta (Click)» (asosiy kassa) yoki «Karta» (filial). */
  cardLabel: string;
};

const OpenShiftDialog = ({
  open,
  onClose,
  onSubmit,
  isLoading = false,
  openerName,
  cashboxLabel,
  cash,
  card,
  cardLabel,
}: OpenShiftDialogProps) => {
  const { t, i18n } = useTranslation("payments");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const [comment, setComment] = useState("");

  const money = (value: number | null) =>
    value === null ? "—" : <span className="whitespace-nowrap">{formatMoneyLocalized(value, { language })}</span>;
  const total = cash === null || card === null ? null : cash + card;

  const handleClose = () => {
    if (isLoading) return;
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      onExited={() => setComment("")}
      busy={isLoading}
      size="md"
      icon={Timer}
      title={t("v2MainCashbox.shift.open.title")}
      description={t("v2MainCashbox.shift.open.subtitle", { cashbox: cashboxLabel })}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={isLoading}>
            {t("v2MainCashbox.shift.cancel")}
          </Button>
          <Button
            leftIcon={Timer}
            onClick={() => {
              if (!isLoading) onSubmit(comment.trim());
            }}
            loading={isLoading}
            loadingText={t("v2MainCashbox.shift.open.opening")}
          >
            {t("v2MainCashbox.shift.open.submit")}
          </Button>
        </>
      }
    >
      <ShiftSummaryList
        rows={[
          { key: "opener", label: t("v2MainCashbox.shift.opener"), value: openerName.trim() || "—" },
          { key: "start", label: t("v2MainCashbox.shift.open.start"), value: t("v2MainCashbox.shift.open.now") },
        ]}
      />

      <div className="flex flex-col gap-2">
        <h3 className="m-0 text-sm font-semibold text-text">{t("v2MainCashbox.shift.open.balanceTitle")}</h3>
        <ShiftSummaryList
          label={t("v2MainCashbox.shift.open.balanceTitle")}
          rows={[
            { key: "cash", icon: Banknote, label: t("v2MainCashbox.shift.cash"), value: money(cash) },
            { key: "card", icon: CreditCard, label: cardLabel, value: money(card) },
            { key: "total", strong: true, label: t("v2MainCashbox.shift.open.total"), value: money(total) },
          ]}
        />
        <p className="m-0 text-[13px] text-text-muted">{t("v2MainCashbox.shift.open.balanceHint")}</p>
      </div>

      <Field label={t("v2MainCashbox.shift.comment")} optional>
        <TextInput
          multiline
          rows={2}
          value={comment}
          onValueChange={setComment}
          placeholder={t("v2MainCashbox.shift.open.commentPlaceholder")}
        />
      </Field>
    </Dialog>
  );
};

export default memo(OpenShiftDialog);
