// dizayn-v2: market-operators-commission-dialog, market-operators-commission-fixed-dialog
import { useRef, useState, type FormEvent } from "react";
import { CircleX, Info, Percent, TriangleAlert } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import {
  COMMISSION_SAMPLE_PRICE,
  COMMISSION_SAMPLE_PRICE_HIGH,
  commissionInputText,
  hasCommission,
  parseCommissionInput,
  percentEarning,
  useUpdateMarketOperatorCommission,
  type CommissionInputError,
  type CommissionType,
  type MarketOperator,
} from "../../../entities/market-operator";
import { formatPhone } from "../../../shared/lib/formatPhone";
import { notify } from "../../../shared/lib/notify";
import { Button, Dialog, Field, useConfirm } from "../../../shared/ui/primitives";
import { httpStatusOf } from "../model/httpStatus";
import { useCommissionErrorText, useCommissionText } from "../model/useCommissionText";
import { CommissionTypeSwitch, CommissionValueInput } from "./CommissionParts";

/** `.el-alert.el-tone-warning` (CODE-MAP 2.8). */
const ALERT = "flex items-start gap-3 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning-fg";
/** Kulrang izoh bloki (maketda `background: var(--sunken)`, r 10). */
const INSET = "flex flex-col gap-1 rounded-[10px] bg-sunken px-4 py-3";
/** Summa + «lik» qo'shimchasi bo'linmasin (maketda `white-space: nowrap`); daromad — qalin (`el-strong`). */
const MONEY_PARTS = {
  nw: <span className="whitespace-nowrap" />,
  earn: <span className="whitespace-nowrap font-semibold" />,
};

type CommissionDialogProps = {
  /** Ochiq oyna operatori; `null` — yopiq. */
  operator: MarketOperator | null;
  onClose: () => void;
};

/**
 * «KOMISSIYA» oynasi (maketlar `market-operators-commission-dialog` — foiz, belgilanmagan operator;
 * `market-operators-commission-fixed-dialog` — qat'iy summa, xato holati, «Komissiyani olib tashlash»).
 *
 * Belgilanmagan operatorda — ogohlantirish «Komissiya belgilanmagan — daromad yozilmaydi»; belgilanganida — «Hozirgi
 * stavka». Tur (Foiz | Qat'iy summa) va qiymat: foiz 0..100, so'm 0..1 000 000, ko'pi bilan 2 kasr. Foizda «Namuna»
 * (250 000 so'mlik sotuvdan; qiymat yo'q — «foizni kiriting») va izoh «Yangi stavka faqat keyingi sotuvlarga», qat'iyda
 * «Qanday hisoblanadi» (summalar bo'linmaydi). «Komissiyani olib tashlash» — `useConfirm` (danger)
 * tasdig'i bilan `PATCH { commission_type: null, commission_value: null }` (404 — «Operator topilmadi»). Yangi stavka
 * faqat keyingi sotuvlarga (backend sotuv paytida stavkani daromad qatoriga yozib qo'yadi).
 */
export const CommissionDialog = ({ operator, onClose }: CommissionDialogProps) => {
  const { t } = useTranslation("marketOperators");
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const confirm = useConfirm();
  const update = useUpdateMarketOperatorCommission();
  const commissionError = useCommissionErrorText();
  const text = useCommissionText();

  const [type, setType] = useState<CommissionType>("percent");
  const [valueText, setValueText] = useState("");
  const [code, setCode] = useState<CommissionInputError | null>(null);
  const [busy, setBusy] = useState(false);
  const submittingRef = useRef(false);

  // Har ochilishda joriy stavka bilan (render paytida, effektsiz). `shown` — yopilish harakati paytida ham mazmun
  // yo'qolmasin (oxirgi operator saqlanadi).
  const openId = operator?.id ?? null;
  const [syncedId, setSyncedId] = useState<string | null>(null);
  const [shown, setShown] = useState<MarketOperator | null>(null);
  if (syncedId !== openId) {
    setSyncedId(openId);
    if (operator) {
      setShown(operator);
      setType(operator.commission_type ?? "percent");
      setValueText(commissionInputText(operator.commission_value, language));
      setCode(null);
    }
  }
  const current = shown && hasCommission(shown) ? shown : null;

  const close = () => {
    if (busy) return;
    onClose();
  };

  const failed = (error: unknown) => {
    if (httpStatusOf(error) === 404) {
      notify.error(t("commissionDialog.notFound"));
      onClose();
      return;
    }
    notify.error(t("commissionDialog.failed"), { description: t("commissionDialog.failedText") });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!operator || submittingRef.current) return;
    const parsed = parseCommissionInput(type, valueText);
    if (!parsed.ok) {
      setCode(parsed.error);
      return;
    }
    submittingRef.current = true;
    setBusy(true);
    try {
      await update.mutateAsync({
        id: operator.id,
        commission: { commission_type: type, commission_value: parsed.value },
      });
      notify.success(t("commissionDialog.saved"));
      onClose();
    } catch (error) {
      if (httpStatusOf(error) === 400) setCode("range");
      else failed(error);
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!operator) return;
    const ok = await confirm({
      tone: "danger",
      size: "sm",
      icon: CircleX,
      title: t("commissionDialog.removeConfirm.title"),
      description: t("commissionDialog.removeConfirm.description"),
      confirmLabel: t("commissionDialog.removeConfirm.confirm"),
      loadingLabel: t("commissionDialog.removeConfirm.loading"),
      cancelLabel: t("commissionDialog.cancel"),
      errorMessage: (error) =>
        httpStatusOf(error) === 404 ? t("commissionDialog.notFound") : t("commissionDialog.removeConfirm.failed"),
      onConfirm: () =>
        update.mutateAsync({ id: operator.id, commission: { commission_type: null, commission_value: null } }),
    });
    if (!ok) return;
    notify.success(t("commissionDialog.removeConfirm.removed"));
    onClose();
  };

  const parsed = parseCommissionInput(type, valueText);
  const sampleValue = parsed.ok && parsed.value !== null ? parsed.value : null;

  return (
    <Dialog
      open={operator !== null}
      onClose={close}
      busy={busy}
      size="lg"
      icon={Percent}
      title={t("commissionDialog.title")}
      description={
        shown ? (
          <>
            {shown.name} · <span className="whitespace-nowrap">{formatPhone(shown.phone_number)}</span>
          </>
        ) : null
      }
      onSubmit={submit}
      formProps={{ noValidate: true }}
      footer={
        <>
          {current ? (
            <Button
              variant="ghost"
              leftIcon={CircleX}
              onClick={() => void remove()}
              disabled={busy}
              className="mr-auto text-danger-fg! not-disabled:hover:bg-danger-soft max-md:basis-full"
            >
              {t("commissionDialog.remove")}
            </Button>
          ) : null}
          <Button variant="secondary" onClick={close} disabled={busy}>
            {t("commissionDialog.cancel")}
          </Button>
          <Button type="submit" loading={busy} loadingText={t("commissionDialog.saving")}>
            {t("commissionDialog.save")}
          </Button>
        </>
      }
    >
      {current ? (
        <div className="flex items-center justify-between gap-3 rounded-[10px] bg-sunken px-3 py-2.5 text-sm">
          <span className="text-text-muted">{t("commissionDialog.current")}</span>
          <span className="whitespace-nowrap font-semibold text-text">
            {text.short(current.commission_type, current.commission_value)}
          </span>
        </div>
      ) : (
        <div role="status" className={ALERT}>
          <TriangleAlert size={20} aria-hidden="true" className="mt-px shrink-0" />
          <div className="flex min-w-0 flex-col gap-0.5 text-text">
            <p className="m-0 font-bold">{t("commissionDialog.unsetTitle")}</p>
            <p className="m-0 text-[13px]">{t("commissionDialog.unsetText")}</p>
          </div>
        </div>
      )}

      <Field label={t("commissionForm.type")} labelAs="span" required>
        <CommissionTypeSwitch
          ariaLabel={t("commissionForm.type")}
          value={type}
          disabled={busy}
          onChange={(next) => {
            setType(next);
            setCode(null);
          }}
        />
      </Field>

      <Field
        label={t(type === "percent" ? "commissionForm.percentLabel" : "commissionForm.fixedLabel")}
        required
        hint={
          type === "percent" ? t("commissionForm.percentHint") : t("commissionForm.fixedHint", { max: text.maxFixed })
        }
        error={commissionError(type, code)}
      >
        <CommissionValueInput
          type={type}
          value={valueText}
          onValueChange={(next) => {
            setValueText(next);
            if (code) setCode(null);
          }}
        />
      </Field>

      {type === "percent" ? (
        <div className={INSET}>
          <span className="text-xs font-semibold text-text-muted">{t("commissionDialog.sample")}</span>
          <span className="text-[13px] text-text">
            <Trans
              t={t}
              i18nKey={sampleValue === null ? "commissionDialog.sampleTextEmpty" : "commissionDialog.sampleText"}
              values={{
                price: text.money(COMMISSION_SAMPLE_PRICE),
                earning: sampleValue === null ? "" : text.money(percentEarning(sampleValue)),
              }}
              components={MONEY_PARTS}
            />
          </span>
        </div>
      ) : (
        <div className={INSET}>
          <span className="text-xs font-semibold text-text-muted">{t("commissionDialog.howTitle")}</span>
          <span className="text-[13px] text-text">
            <Trans
              t={t}
              i18nKey="commissionDialog.howText"
              values={{ low: text.money(COMMISSION_SAMPLE_PRICE), high: text.money(COMMISSION_SAMPLE_PRICE_HIGH) }}
              components={MONEY_PARTS}
            />
          </span>
        </div>
      )}

      {/* Maketda izoh faqat foiz oynasida (`-commission-fixed-dialog` da yo'q). */}
      {type === "percent" ? (
        <p className="m-0 flex items-start gap-2 text-[13px] text-text-muted">
          <Info size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span className="min-w-0">{t("commissionDialog.note")}</span>
        </p>
      ) : null}
    </Dialog>
  );
};

export default CommissionDialog;
