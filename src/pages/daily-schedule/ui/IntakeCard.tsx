// dizayn-v2: (maket yo'q) superadmin-payments-shift-settings
import { Clock, Inbox, Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { isCutoffPassed, type OrderIntakeState } from "../../../entities/order-intake";
import { CLOCK_TIME, toClockDraft } from "../../../shared/lib/clockTime";
import { formatTimeLocalized } from "../../../shared/lib/formatDateTime";
import { Card, Field, TextInput } from "../../../shared/ui/primitives";
import type { IntakeDraft, ScheduleErrors } from "../model/scheduleDraft";

/**
 * «Kun tartibi» → «Buyurtma qabuli» (maket yo'q — eng yaqini `superadmin-payments-shift-settings` kartasi): yaratish
 * chegarasi, yaratilgan buyurtmalarni qabul qilish chegarasi (yangi backend bo'lsa) va kun almashish vaqti. Har maydon
 * ostida — serverdagi joriy holat («Hozir ochiq · 10:00 da yopiladi»); yangi soat joriy ish kunida o'tgan bo'lsa —
 * «Saqlansa … darhol yopiladi» (izoh o'rnida). Soat maydoni — `HH:MM`, raqam yoziladi, «:» o'zi qo'yiladi.
 */

type WindowState = { limit: string | null; closed: boolean; closesAt: string | null; reopensAt: string | null };

const StatusLine = ({ window }: { window: WindowState }) => {
  const { t } = useTranslation("ops");
  const time = (iso: string | null) => (iso ? formatTimeLocalized(iso) : null);
  const text = !window.limit
    ? t("dailySchedule.status.unlimited")
    : window.closed
      ? time(window.reopensAt)
        ? t("dailySchedule.status.closedUntil", { time: time(window.reopensAt) })
        : t("dailySchedule.status.closed")
      : time(window.closesAt)
        ? t("dailySchedule.status.openUntil", { time: time(window.closesAt) })
        : t("dailySchedule.status.open");
  return (
    <p className="m-0 flex items-center gap-1.5 text-[13px] text-text-muted">
      <Clock aria-hidden="true" size={14} className="shrink-0" />
      {text}
    </p>
  );
};

const ClockField = ({
  label,
  hint,
  error,
  value,
  placeholder,
  required,
  onChange,
}: {
  label: string;
  hint: string;
  error?: string;
  value: string;
  placeholder: string;
  required?: boolean;
  onChange: (next: string) => void;
}) => (
  <Field label={label} hint={hint} error={error} required={required}>
    <TextInput
      icon={Clock}
      inputMode="numeric"
      autoComplete="off"
      maxLength={5}
      placeholder={placeholder}
      value={value}
      onValueChange={(next) => onChange(toClockDraft(next))}
    />
  </Field>
);

export const IntakeCard = ({
  intake,
  closed,
  receiveClosed,
  draft,
  errors,
  onChange,
}: {
  intake: OrderIntakeState;
  /** Serverdagi joriy holat (`useOrderIntake`). */
  closed: boolean;
  receiveClosed: boolean;
  draft: IntakeDraft;
  errors: ScheduleErrors;
  onChange: (next: IntakeDraft) => void;
}) => {
  const { t } = useTranslation("ops");
  const daily = intake.receiveSupported;
  // Yangi soat joriy ish kunida o'tgan — saqlansa darhol yopiladi (o'zgarmagan qiymat uchun emas).
  const passes = (value: string, saved: string | null) =>
    value !== (saved ?? "") && CLOCK_TIME.test(value) && isCutoffPassed(value, intake);
  const cutoffPasses = passes(draft.cutoff, intake.cutoffTime);
  const receivePasses = daily && passes(draft.receiveCutoff, intake.receiveCutoffTime);

  return (
    <Card
      padding="none"
      title={
        <span className="inline-flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-sunken text-text-muted">
            <Inbox aria-hidden="true" size={18} />
          </span>
          {t("dailySchedule.intake.title")}
        </span>
      }
      description={t("dailySchedule.intake.subtitle")}
      divided
      footer={
        <span className="flex items-start gap-2 text-[13px] text-text-muted">
          <Info aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
          {t("dailySchedule.intake.note")}
        </span>
      }
    >
      <div className="grid gap-x-6 gap-y-5 px-5 py-4 max-md:px-4 [grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr))]">
        <div className="flex min-w-0 flex-col gap-2">
          <ClockField
            label={t("dailySchedule.intake.cutoff")}
            hint={
              cutoffPasses
                ? t("dailySchedule.intake.cutoffPasses")
                : daily
                  ? t("dailySchedule.intake.cutoffHint")
                  : t("dailySchedule.intake.cutoffHintToday")
            }
            error={errors.cutoff ? t("dailySchedule.invalidTime") : undefined}
            value={draft.cutoff}
            placeholder={t("dailySchedule.intake.unlimitedPlaceholder")}
            onChange={(cutoff) => onChange({ ...draft, cutoff })}
          />
          <StatusLine
            window={{
              limit: intake.cutoffTime,
              closed,
              closesAt: intake.closesAt,
              reopensAt: intake.reopensAt,
            }}
          />
        </div>
        {daily ? (
          <div className="flex min-w-0 flex-col gap-2">
            <ClockField
              label={t("dailySchedule.intake.receive")}
              hint={receivePasses ? t("dailySchedule.intake.receivePasses") : t("dailySchedule.intake.receiveHint")}
              error={errors.receiveCutoff ? t("dailySchedule.invalidTime") : undefined}
              value={draft.receiveCutoff}
              placeholder={t("dailySchedule.intake.unlimitedPlaceholder")}
              onChange={(receiveCutoff) => onChange({ ...draft, receiveCutoff })}
            />
            <StatusLine
              window={{
                limit: intake.receiveCutoffTime,
                closed: receiveClosed,
                closesAt: intake.receiveClosesAt,
                reopensAt: intake.receiveReopensAt,
              }}
            />
          </div>
        ) : null}
        <div className="flex min-w-0 flex-col gap-2">
          <ClockField
            label={t("dailySchedule.intake.dayChange")}
            hint={t("dailySchedule.intake.dayChangeHint")}
            error={errors.dayChange ? t("dailySchedule.invalidTime") : undefined}
            value={draft.dayChange}
            placeholder="00:00"
            required
            onChange={(dayChange) => onChange({ ...draft, dayChange })}
          />
          {intake.nextDayChangeAt ? (
            <p className="m-0 flex items-center gap-1.5 text-[13px] text-text-muted">
              <Clock aria-hidden="true" size={14} className="shrink-0" />
              {t("dailySchedule.status.nextDayChange", { time: formatTimeLocalized(intake.nextDayChangeAt) })}
            </p>
          ) : null}
        </div>
      </div>
    </Card>
  );
};
