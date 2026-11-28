// dizayn-v2: (maket yo'q) tizim-states-forms
import { CalendarDays, Percent } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  useSetInvestorShareTerms,
  useSetInvestorStartDate,
  type InvestorProfitBasis,
  type InvestorShareTerm,
} from "../../../entities/investors";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { getErrorStatus } from "../../../shared/lib/errorKind";
import { notify } from "../../../shared/lib/notify";
import { Button, DateInput, Dialog, Field, SegmentedControl, TextInput } from "../../../shared/ui/primitives";
import { todayISODay } from "../../../shared/ui/primitives/date/calendarMath";

/**
 * ULUSH SHARTI OYNALARI (ega 2026-11-28, BeePost «Ulush / Foyda asosi» naqshi) — superadmin/admin nazorati
 * (`/investor/:id`). Maket yo'q — eng yaqini: forma oynasi `tizim-states-forms`.
 *
 *  - `ShareTermsDialog` — «shu kundan boshlab ulush X%, asos Y» (`PUT investors/:id/share-terms`). Sana joriy shart
 *    boshidan keyin — yangi versiya (o'tgan kunlar eski shart bilan qoladi); teng yoki oldin — joriy shart tuzatiladi
 *    (backend qoidasi). Ulush hali yo'q bo'lsa sana — investorlik sanasi.
 *  - `StartDateDialog` — «Investorlik sanasi»ni tuzatish (`PATCH investors/:id {share_started_at}`).
 * Backend 400 matni maydon ostida emas, xabarda (sana qoidalari), oyna ochiq qoladi.
 */

/** «Ulush (%)»: `12`, `12.5`, `12,75` → son; noto'g'ri yoki 0..100 dan tashqari → `null` (yaratish formasi bilan bir xil). */
export const parseSharePercent = (value: string): number | null => {
  const text = value.trim().replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(text)) return null;
  const share = Number(text);
  return share <= 100 ? share : null;
};

const saveErrorDescription = (error: unknown) =>
  getErrorStatus(error) ? getBackendErrorMessage(error) : undefined;

type ShareTermsDialogProps = {
  open: boolean;
  investorId: string;
  /** Joriy (ochiq) shart — maydonlar undan to'ldiriladi; `null` — ulush hali yo'q. */
  current: InvestorShareTerm | null;
  onClose: () => void;
};

export const ShareTermsDialog = ({ open, investorId, current, onClose }: ShareTermsDialogProps) => {
  const { t } = useTranslation("investor");
  const mutation = useSetInvestorShareTerms(investorId);
  const today = todayISODay();
  // Maydonda o'nlik vergul bilan («12,5») — forma ikkalasini ham qabul qiladi.
  const [share, setShare] = useState(current ? String(current.sharePercent).replace(".", ",") : "");
  const [basis, setBasis] = useState<InvestorProfitBasis>(current?.profitBasis ?? "net");
  const [from, setFrom] = useState(today);
  const [errors, setErrors] = useState<{ share?: string; from?: string }>({});
  const shareRef = useRef<HTMLInputElement>(null);
  const busy = mutation.isPending;
  const k = (key: string) => t(`terms.dialog.${key}`);

  const handleClose = () => {
    if (!busy) onClose();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const next: typeof errors = {};
    const sharePercent = parseSharePercent(share);
    if (!share.trim()) next.share = k("shareRequired");
    else if (sharePercent === null) next.share = k("shareInvalid");
    if (!from) next.from = k("fromRequired");
    else if (from > today) next.from = k("fromFuture");
    if (next.share || next.from || sharePercent === null) {
      setErrors(next);
      if (next.share) shareRef.current?.focus();
      return;
    }
    try {
      await mutation.mutateAsync({ share_percent: sharePercent, profit_basis: basis, effective_from: from });
      notify.success(k("saved"));
      onClose();
    } catch (error) {
      notify.error(k("saveError"), { description: saveErrorDescription(error) });
    }
  };

  const basisHint = basis === "gross" ? t("terms.basisGrossHint") : t("terms.basisNetHint");

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      busy={busy}
      size="md"
      icon={Percent}
      title={current ? k("title") : k("setTitle")}
      description={k("subtitle")}
      initialFocus={shareRef}
      onSubmit={(event) => void handleSubmit(event)}
      formProps={{ noValidate: true }}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={busy}>
            {k("cancel")}
          </Button>
          <Button type="submit" loading={busy} loadingText={k("saving")}>
            {k("save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label={k("share")} required error={errors.share}>
          <TextInput
            ref={shareRef}
            name="share_percent"
            value={share}
            onValueChange={(value) => {
              setShare(value);
              if (errors.share) setErrors((prev) => ({ ...prev, share: undefined }));
            }}
            inputMode="decimal"
            suffix="%"
            placeholder={k("sharePlaceholder")}
          />
        </Field>
        <Field label={t("terms.basis")} labelAs="span" hint={basisHint}>
          <SegmentedControl
            ariaLabel={t("terms.basis")}
            value={basis}
            onValueChange={(value) => setBasis(value === "gross" ? "gross" : "net")}
            options={[
              { value: "net", label: t("terms.basisNet") },
              { value: "gross", label: t("terms.basisGross") },
            ]}
            className="self-start max-md:self-stretch"
          />
        </Field>
        <Field
          label={k("from")}
          labelAs="span"
          required
          hint={current ? k("fromHint") : k("firstFromHint")}
          error={errors.from}
        >
          <DateInput
            value={from}
            onChange={(value) => {
              setFrom(value);
              if (errors.from) setErrors((prev) => ({ ...prev, from: undefined }));
            }}
            max={today}
            clearable={false}
            invalid={Boolean(errors.from)}
            aria-label={k("from")}
          />
        </Field>
      </div>
    </Dialog>
  );
};

type StartDateDialogProps = {
  open: boolean;
  investorId: string;
  /** Joriy investorlik sanasi (`YYYY-MM-DD`). */
  startedAt: string;
  onClose: () => void;
};

export const StartDateDialog = ({ open, investorId, startedAt, onClose }: StartDateDialogProps) => {
  const { t } = useTranslation("investor");
  const mutation = useSetInvestorStartDate(investorId);
  const today = todayISODay();
  const [day, setDay] = useState(startedAt);
  const [error, setError] = useState<string | undefined>(undefined);
  const busy = mutation.isPending;
  const k = (key: string) => t(`terms.startDialog.${key}`);

  const handleClose = () => {
    if (!busy) onClose();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    if (!day) return setError(t("terms.dialog.fromRequired"));
    if (day > today) return setError(t("terms.dialog.fromFuture"));
    if (day === startedAt) return onClose();
    try {
      await mutation.mutateAsync(day);
      notify.success(k("saved"));
      onClose();
    } catch (saveError) {
      notify.error(k("saveError"), { description: saveErrorDescription(saveError) });
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      busy={busy}
      size="sm"
      icon={CalendarDays}
      title={k("title")}
      description={k("subtitle")}
      onSubmit={(event) => void handleSubmit(event)}
      formProps={{ noValidate: true }}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={busy}>
            {t("terms.dialog.cancel")}
          </Button>
          <Button type="submit" loading={busy} loadingText={t("terms.dialog.saving")}>
            {t("terms.dialog.save")}
          </Button>
        </>
      }
    >
      <Field label={k("field")} labelAs="span" required error={error}>
        <DateInput
          value={day}
          onChange={(value) => {
            setDay(value);
            setError(undefined);
          }}
          max={today}
          clearable={false}
          invalid={Boolean(error)}
          aria-label={k("field")}
        />
      </Field>
    </Dialog>
  );
};
