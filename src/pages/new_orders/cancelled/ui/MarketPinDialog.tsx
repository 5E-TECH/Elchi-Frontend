// dizayn-v2: superadmin-neworders-cancelled-pin-dialog
import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { CircleCheck, KeyRound, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  SCANNER_ENTER_GAP_MS,
  SCANNER_KEY_GAP_MS,
  readScannerKey,
  scannerKeyTime,
} from "../../../../shared/lib/useKeyboardScanner";
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
 *
 * ⚠️ Oyna ochiq paytda USB skaner bilan QR skanerlansa: maydon harflarni tashlab, raqamlarni qoldirardi va skaner
 * Enter'i shu tasodifiy «kod»ni yuborardi — har skan 5 urinishdan birini yerdi (5-sida sessiya bloklanadi, QR ham
 * ishlamay qoladi). Endi skaner tezligida kelgan belgilar (`SCANNER_KEY_GAP_MS`) alohida yig'iladi: ular PIN
 * bo'lmasa (raqam, bo'shliq, «-» dan boshqa belgi yoki 6 dan ko'p raqam) Enter formani yubormaydi — matn
 * `onScan` ga beriladi (sahifa: market QR'i → QR skani kabi tekshiriladi, boshqasi — maydon ostida xato).
 * Odam yozgan kod (belgilar orasi sekinroq) va skanerlangan 6 raqam — avvalgidek yuboriladi.
 * Kuzatuv butun oynada (`onKeyDownCapture`): noto'g'ri koddan keyin fokus «Tasdiqlash» tugmasida qolsa ham skaner
 * Enter'i o'sha kodni qayta yubormaydi. Bosib turilgan tugmaning avtotakrori (`repeat`, ~30 ms) — odam, skan emas.
 */

type ScanRun = { text: string; lastAt: number };

const emptyRun = (): ScanRun => ({ text: "", lastAt: Number.NEGATIVE_INFINITY });

/** Skan matni PIN emas: raqam, bo'shliq va «-» dan boshqa belgi bor yoki raqami 6 dan ko'p. */
const isNotPinScan = (text: string) => text !== "" && !/^\d{0,6}$/.test(text.replace(/[\s-]/g, ""));

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
  /** Maydonga USB skaner yozgan, PIN bo'lmagan matn (market QR'i, buyurtma QR'i …) — forma yuborilmaydi. */
  onScan: (rawValue: string) => void;
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
  onScan,
  onClose,
}: MarketPinDialogProps) => {
  const { t } = useTranslation("newOrders");
  const inputRef = useRef<HTMLInputElement>(null);
  const scanRunRef = useRef<ScanRun>(emptyRun());

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const native = event.nativeEvent;
    const at = scannerKeyTime(native);
    const run = scanRunRef.current;

    if (event.key === "Enter") {
      scanRunRef.current = emptyRun();
      // Kamida 2 ta tez belgi va Enter ular ortidan darhol — skaner; aks holda odam yozgani.
      const scanned = run.text.length > 1 && at - run.lastAt <= SCANNER_ENTER_GAP_MS ? run.text : "";
      if (!isNotPinScan(scanned)) return;
      event.preventDefault();
      if (!pending) onScan(scanned);
      return;
    }

    if (native.repeat) {
      scanRunRef.current = emptyRun();
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const char = readScannerKey(native);
    if (char === null) return;
    run.text = at - run.lastAt > SCANNER_KEY_GAP_MS ? char : run.text + char;
    run.lastAt = at;
  };

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
      onKeyDownCapture={handleKeyDown}
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
