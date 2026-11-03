// dizayn-v2: superadmin-payments-shift-settings-correction
import { useEffect, useRef, type MouseEvent } from "react";
import { CircleX, Info, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PAYMENT_CORRECTION_WINDOW, type PaymentCorrectionPreset } from "../../../entities/payments";
import { useUser } from "../../../entities/user/api/userApi";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { Card, ErrorState, Field, QueryBoundary, SegmentedControl, TextInput } from "../../../shared/ui/primitives";
import { resolveUserName } from "../components/lib/useCashboxShift";
import { CardTitle } from "./AutomationCards";
import { CUSTOM, type PaymentCorrectionDraft, type SegmentValue } from "./paymentCorrectionDraft";

/**
 * «TO'LOVLARNI TUZATISH MUDDATI» KARTASI (T6-FE-3, 2wgTzcG0; maket `superadmin-payments-shift-settings-correction`).
 * Superadmin shu muddat ichida kuryerdan olingan pulni yoki marketga to'lovni qaytaradi yoki summasini tahrirlaydi.
 * Segment «7 kun · 10 kun · 30 kun · Boshqa»; «Boshqa» — «Kunlar soni» (1–365, butun). Backendda «Boshqa» rejimi yo'q:
 * faqat son ketadi (`PATCH finance/payment-corrections/settings { window_days }`), server qiymati 7/10/30 dan boshqa
 * bo'lsa — «Boshqa» shu son bilan. O'zgarish sahifadagi yagona «Saqlash» bilan ketadi; qiymat yaroqsiz bo'lsa «Saqlash»
 * o'chiq (maketdagi «Noto'g'ri qiymat» holati). Muddat qisqartirilganda tasdiq so'ralmaydi (maketda yo'q).
 *
 * Qoralama sahifa darajasida — `usePaymentCorrectionDraft` (`paymentCorrectionDraft.ts`).
 */

/** «Muddat» maydoni id si — izoh `${id}-hint` radioguruhga `aria-describedby` bilan ulanadi. */
const PERIOD_FIELD_ID = "payment-correction-period";

export const PaymentCorrectionCard = ({ correction }: { correction: PaymentCorrectionDraft }) => {
  const { t, i18n } = useTranslation("payments");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const { useGetUserById } = useUser();
  const { query, value, invalid, setPreset, setCustom, setText } = correction;
  // Javobda `updated_by` — ID: ism alohida o'qiladi (o'qilmasa — faqat sana).
  const authorQuery = useGetUserById(query.data?.updated_by ?? "", undefined, { silentError: true });
  const author = resolveUserName(authorQuery.data);

  const inputRef = useRef<HTMLInputElement>(null);
  const focusCustom = useRef(false);
  const mode = value?.mode ?? null;
  // Fokus «Kunlar soni» ga faqat «Boshqa» bosilganda o'tadi (server qiymati «Boshqa» bo'lib yuklanganda emas).
  useEffect(() => {
    if (mode !== CUSTOM || !focusCustom.current) return;
    focusCustom.current = false;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [mode]);

  // Bosish (sichqoncha, barmoq, Enter / Bo'sh joy) — fokus maydonga; ← → bilan yurilganda segmentda qoladi.
  const onSegmentClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!(event.target as HTMLElement).closest(`[data-value="${CUSTOM}"]`)) return;
    if (mode === CUSTOM) inputRef.current?.focus();
    else focusCustom.current = true;
  };

  const onSegment = (next: SegmentValue) => {
    if (next === CUSTOM) setCustom();
    else setPreset(Number(next) as PaymentCorrectionPreset);
  };

  // Maketda variant kamida 72 px (`min-width: 72px`): yon oraliq 12 + 12, yorliq kamida 48.
  const optionLabel = (label: string) => <span className="inline-block min-w-12 text-center">{label}</span>;
  const options = [
    ...PAYMENT_CORRECTION_WINDOW.presets.map((days) => ({
      value: String(days) as SegmentValue,
      label: optionLabel(
        t("paymentCorrection.settings.days", { count: days, value: formatNumberLocalized(days, { language }) }),
      ),
    })),
    { value: CUSTOM, label: optionLabel(t("paymentCorrection.settings.custom")) },
  ];
  const segment: SegmentValue = value ? (value.mode === "preset" ? `${value.days}` : CUSTOM) : "30";

  const data = query.data;
  const updated = data?.updated_at
    ? [author, formatDateTimeLocalized(data.updated_at, { language })].filter(Boolean).join(" · ")
    : null;

  return (
    <Card
      id="payment-correction"
      title={<CardTitle icon={RotateCcw} title={t("paymentCorrection.settings.title")} />}
      description={t("paymentCorrection.settings.subtitle")}
      divided
      footer={
        data ? (
          <span className="text-[13px] text-text-muted">
            {updated
              ? t("paymentCorrection.settings.updated", { value: updated })
              : t("paymentCorrection.settings.neverChanged")}
          </span>
        ) : undefined
      }
    >
      <QueryBoundary
        query={query}
        skeleton="lines"
        isEmpty={() => false}
        error={(error, retry) => (
          <ErrorState
            error={error}
            size="card"
            icon={CircleX}
            title={t("paymentCorrection.settings.loadError")}
            description={null}
            onRetry={retry}
          />
        )}
      >
        {() => (
          <div className="flex max-w-[640px] flex-col gap-4">
            {/* Izoh guruhga bog'lanadi (ekran o'quvchi aytadi): `SegmentedControl` Field kontekstini o'qimaydi — id
                qo'lda (karta sahifada bitta, xato holati yo'q — `${id}-hint` doim bor). */}
            <Field
              id={PERIOD_FIELD_ID}
              label={t("paymentCorrection.settings.period")}
              labelAs="span"
              hint={t("paymentCorrection.settings.hint")}
            >
              <SegmentedControl<SegmentValue>
                ariaLabel={t("paymentCorrection.settings.period")}
                aria-describedby={`${PERIOD_FIELD_ID}-hint`}
                className="self-start"
                options={options}
                value={segment}
                onValueChange={onSegment}
                onClick={onSegmentClick}
              />
            </Field>
            {value?.mode === CUSTOM ? (
              <Field
                label={t("paymentCorrection.settings.customLabel")}
                required
                hint={t("paymentCorrection.settings.customHint")}
                error={invalid ? t("paymentCorrection.settings.customError") : undefined}
              >
                <TextInput
                  ref={inputRef}
                  mode="number"
                  autoComplete="off"
                  className="max-w-[200px]"
                  suffix={t("paymentCorrection.settings.customSuffix")}
                  value={value.text}
                  onValueChange={setText}
                />
              </Field>
            ) : null}
            <p className="m-0 flex items-start gap-2 rounded-xl bg-sunken px-3.5 py-3 text-[13px] text-text-muted">
              <Info aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
              <span>{t("paymentCorrection.settings.note")}</span>
            </p>
          </div>
        )}
      </QueryBoundary>
    </Card>
  );
};
