// dizayn-v2: superadmin-mails-detail, superadmin-mails-detail-refused, admin-mails-detail, admin-mails-refused-detail, manager-mails-detail-receive, manager-mails-detail-refused-receive, registrator-mails-detail, registrator-mails-detail-refused, courier-mails-detail-receive
import { memo } from "react";
import { Check, Send } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatNumberLocalized } from "../../../../shared/lib/formatMoney";
import { Button } from "../../../../shared/ui/primitives";

/**
 * POCHTA TAFSILOTINING ASOSIY AMALI — `Button variant="primary"` (maket: «Pochtani jo'natish — 6 ta» `Send`,
 * «Pochtani qabul qilish — 3 ta» `Check`).
 *
 *  - `isCourier` yoki `mode="receive"` — qabul qilish, aks holda jo'natish (`onSend`).
 *  - Matn sukut bo'yicha soni bilan; `sendLabel` / `receiveLabel` berilsa — AYNAN shu matn (son qo'shilmaydi;
 *    paket tafsiloti «HQ'ga yuborish — n ta» ni o'zi beradi).
 *  - `isBusy` — spinner va `busyLabel` (sukut «Tekshirilmoqda...»); tanlov bo'sh yoki `disabled` — o'chiq.
 *  - `block` — to'liq enli katta tugma (telefondagi pastki panel, karta ostidagi amal).
 *  - `className` — faqat joylashuv.
 */
interface SendButtonProps {
  selectedCount: number;
  isCourier: boolean;
  mode?: "send" | "receive";
  onSend: () => void;
  onReceive: () => void;
  isBusy?: boolean;
  className?: string;
  sendLabel?: string;
  receiveLabel?: string;
  busyLabel?: string;
  disabled?: boolean;
  /** To'liq enli, `lg` o'lcham. */
  block?: boolean;
}

const SendButton = memo(
  ({
    selectedCount,
    isCourier,
    mode = "send",
    onSend,
    onReceive,
    isBusy = false,
    className,
    sendLabel,
    receiveLabel,
    busyLabel,
    disabled = false,
    block = false,
  }: SendButtonProps) => {
    const { t, i18n } = useTranslation("mails");
    const shouldReceive = isCourier || mode === "receive";
    const value = formatNumberLocalized(selectedCount, { language: i18n.resolvedLanguage ?? i18n.language });
    const label = shouldReceive
      ? (receiveLabel ?? t("detailPage.receiveButton", { value, count: selectedCount }))
      : (sendLabel ?? t("detailPage.sendButton", { value, count: selectedCount }));

    return (
      <Button
        variant="primary"
        size={block ? "lg" : "md"}
        fullWidth={block}
        leftIcon={shouldReceive ? Check : Send}
        disabled={disabled || selectedCount === 0}
        loading={isBusy}
        loadingText={busyLabel ?? t("checking")}
        onClick={shouldReceive ? onReceive : onSend}
        className={className}
      >
        {label}
      </Button>
    );
  },
);
SendButton.displayName = "SendButton";

export default SendButton;
