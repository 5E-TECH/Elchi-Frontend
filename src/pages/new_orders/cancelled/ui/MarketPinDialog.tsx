// dizayn-v2: superadmin-neworders-cancelled-pin-dialog
import { useRef, type ReactNode } from "react";
import { CircleCheck, KeyRound, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, Dialog, Field, TextInput } from "../../../../shared/ui/primitives";
import { DetailAlert } from "../../components/detail/DetailAlert";

/**
 * «Market PIN kodi» oynasi (zkRab9M2, BG6; maket `superadmin-neworders-cancelled-pin-dialog`, telefonda pastki
 * varaqa). Market QR'i skanerlanmasa, xodim market QR oynasidagi 6 xonali kodni yozadi — muvaffaqiyatda QR skani
 * bilan AYNAN bir xil topshirish ruxsati olinadi (sahifa `applyAuthorization`).
 *
 * Maydon: `inputMode="numeric"`, `autoComplete="one-time-code"`, faqat raqamlar (boshidagi nol saqlanadi), 6 belgi;
 * oyna ochilganda fokus darhol maydonda (telefonda klaviatura ochiladi). Oyna `data-scanner-ignore` — 6 raqam +
 * Enter USB skaner deb olinmaydi
 * (sahifa skaneri ham oyna ochiq paytda to'xtatiladi). Xato (noto'g'ri kod va qolgan urinishlar, blok, muddat)
 * — maydon ostida. Maketdagi «Taklif · backend kerak» belgisi olib tashlandi (backend tayyor).
 */

type MarketPinDialogProps = {
  open: boolean;
  /** Sarlavha ostidagi market nomi («Baraka Shop · …»). */
  marketName: string;
  value: string;
  onValueChange: (value: string) => void;
  /** Maydon ostidagi xato (sahifa beradi: noto'g'ri kod, blok, muddat …). */
  error: ReactNode;
  pending: boolean;
  onSubmit: () => void;
  onClose: () => void;
};

export const MarketPinDialog = ({
  open,
  marketName,
  value,
  onValueChange,
  error,
  pending,
  onSubmit,
  onClose,
}: MarketPinDialogProps) => {
  const { t } = useTranslation("newOrders");
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      icon={KeyRound}
      title={t("cancelled.pin.title")}
      description={t("cancelled.pin.description", { market: marketName })}
      initialFocus={inputRef}
      busy={pending}
      data-scanner-ignore=""
      formProps={{ noValidate: true }}
      onSubmit={(event) => {
        event.preventDefault();
        if (!pending) onSubmit();
      }}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending} className="flex-[1_1_auto]">
            {t("cancelled.pin.cancel")}
          </Button>
          <Button type="submit" leftIcon={CircleCheck} loading={pending} className="flex-[1_1_auto]">
            {t("cancelled.pin.confirm")}
          </Button>
        </>
      }
    >
      <Field label={t("cancelled.pin.label")} required hint={t("cancelled.pin.hint")} error={error || undefined}>
        {/* `mode="number"` emas: u boshidagi nollarni olib tashlaydi («042917» → «42917»), kodda nol — raqam. */}
        <TextInput
          ref={inputRef}
          inputMode="numeric"
          autoComplete="one-time-code"
          enterKeyHint="done"
          size="lg"
          maxLength={6}
          placeholder="000000"
          value={value}
          onValueChange={(next) => onValueChange(next.replace(/\D/g, "").slice(0, 6))}
          inputClassName="text-center text-xl! font-semibold tracking-[4px] tabular-nums"
        />
      </Field>

      <DetailAlert tone="neutral" icon={ShieldCheck} role="note" compact>
        {t("cancelled.pin.note")}
      </DetailAlert>
    </Dialog>
  );
};
