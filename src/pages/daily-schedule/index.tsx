// dizayn-v2: (maket yo'q) superadmin-payments-shift-settings
import { memo, useMemo, useState } from "react";
import { CalendarClock, Save } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  useOrderIntake,
  useUpdateOrderIntakeSettings,
  type OrderIntakeState,
} from "../../entities/order-intake";
import {
  useShiftCheckSettings,
  useUpdateShiftCheckSettings,
  type ShiftCheckSettings,
} from "../../entities/payments";
import { getApiErrorMessage } from "../../shared/lib/apiError";
import { notify } from "../../shared/lib/notify";
import { Button, EmptyState, QueryBoundary } from "../../shared/ui/primitives";
import { DAILY_SCHEDULE_TAB } from "../ops/tabs";
import { OpsIntro, OpsToolPage } from "../ops/ui/OpsToolPage";
import {
  conflictingTimes,
  diffIntake,
  diffShift,
  scheduleErrors,
  toIntakeDraft,
  toShiftDraft,
  type ScheduleDraft,
} from "./model/scheduleDraft";
import { IntakeCard } from "./ui/IntakeCard";
import { AutoCloseCard, AutoOpenCard, LateAlertCard } from "./ui/ShiftCards";

/**
 * OPS → «KUN TARTIBI» (`/ops?tab=daily-schedule`, faqat superadmin; ega 2026-11-10). Bitta joyda:
 *  - buyurtma YARATISH chegarasi (har kuni), yaratilgan buyurtmalarni QABUL QILISH chegarasi, KUN ALMASHISH vaqti —
 *    `orders/intake-settings` (`entities/order-intake`);
 *  - smenani AVTOMATIK OCHISH va YOPISH vaqtlari, vaqtida ochilmasa / yopilmasa superadminlarga XABAR —
 *    `finance/shift/settings` (`auto_open`, `auto_close`, `late_alert`; `entities/payments`).
 * Ilgari yaratish chegarasi va kun almashishi «Qabul va yaratish» sarlavhasidagi oynada, «Avtomatik yopish» — «Smena
 * sozlamalari»da edi; endi o'sha joylarda holat va shu tabga havola qoladi.
 *
 * «Saqlash» bitta (kirish kartasida, yagona asosiy amal): faqat o'zgargan maydonlar, ikki PATCH mustaqil — biri
 * yiqilsa ikkinchisi saqlanadi, yiqilganining qoralamasi qoladi (forma server javobi bilan qayta boshlanmaydi: qoralama
 * yangi server qiymati bilan solishtiriladi). Backend bermagan blok (`receive_cutoff_time`, `auto_open`, `late_alert`
 * — yangi backend, Dilshodga prompt) chizilmaydi. Maket yo'q — eng yaqini `superadmin-payments-shift-settings`.
 */
const ScheduleForm = ({
  intake,
  closed,
  receiveClosed,
  settings,
}: {
  intake: OrderIntakeState;
  closed: boolean;
  receiveClosed: boolean;
  settings: ShiftCheckSettings;
}) => {
  const { t } = useTranslation("ops");
  const updateIntake = useUpdateOrderIntakeSettings();
  const updateShift = useUpdateShiftCheckSettings();
  const [draft, setDraft] = useState<ScheduleDraft>(() => ({
    intake: toIntakeDraft(intake),
    shift: toShiftDraft(settings),
  }));

  const intakeBody = useMemo(() => diffIntake(intake, draft.intake), [draft.intake, intake]);
  const shiftBody = useMemo(() => diffShift(settings, draft.shift), [draft.shift, settings]);
  const errors = useMemo(() => scheduleErrors(draft, intake), [draft, intake]);
  const conflicts = conflictingTimes(draft.shift);
  const intakeDirty = Object.keys(intakeBody).length > 0;
  const shiftDirty = Object.keys(shiftBody).length > 0;
  const dirty = intakeDirty || shiftDirty;
  const invalid = Object.keys(errors).length > 0;
  const saving = updateIntake.isPending || updateShift.isPending;
  const { auto_open: autoOpen, auto_close: autoClose, late_alert: lateAlert } = draft.shift;
  const hasShift = Boolean(autoOpen || autoClose || lateAlert);

  const setShift = (patch: Partial<ScheduleDraft["shift"]>) =>
    setDraft((current) => ({ ...current, shift: { ...current.shift, ...patch } }));

  const save = async () => {
    if (!dirty || invalid || saving) return;
    const results = await Promise.allSettled([
      ...(intakeDirty ? [updateIntake.mutateAsync(intakeBody)] : []),
      ...(shiftDirty ? [updateShift.mutateAsync(shiftBody)] : []),
    ]);
    const failed = results.find((result) => result.status === "rejected");
    if (!failed) {
      notify.success(t("dailySchedule.saved"));
      return;
    }
    notify.error(t("dailySchedule.saveError"), {
      description: getApiErrorMessage(failed.reason) || undefined,
    });
  };

  if (!intake.supported && !hasShift) {
    return (
      <EmptyState
        icon={CalendarClock}
        title={t("dailySchedule.unavailable.title")}
        description={t("dailySchedule.unavailable.description")}
      />
    );
  }

  return (
    <>
      <OpsIntro
        title={t("dailySchedule.intro.title")}
        description={t("dailySchedule.intro.description")}
        aside={
          <Button
            leftIcon={Save}
            onClick={() => void save()}
            disabled={!dirty || invalid}
            loading={saving}
            loadingText={t("dailySchedule.saving")}
            className="max-md:w-full"
          >
            {t("dailySchedule.save")}
          </Button>
        }
      />
      {intake.supported ? (
        <IntakeCard
          intake={intake}
          closed={closed}
          receiveClosed={receiveClosed}
          draft={draft.intake}
          errors={errors}
          onChange={(next) => setDraft((current) => ({ ...current, intake: next }))}
        />
      ) : null}
      {hasShift ? (
        <div className="flex flex-wrap items-start gap-4">
          {autoOpen ? (
            <AutoOpenCard
              value={autoOpen}
              timesError={errors.openTimes}
              conflicts={conflicts}
              onChange={(auto_open) => setShift({ auto_open })}
            />
          ) : null}
          {autoClose ? (
            <AutoCloseCard
              value={autoClose}
              timesError={errors.closeTimes}
              conflicts={conflicts}
              onChange={(auto_close) => setShift({ auto_close })}
            />
          ) : null}
          {lateAlert ? (
            <LateAlertCard
              value={lateAlert}
              channelsError={errors.lateChannels === "required"}
              onChange={(late_alert) => setShift({ late_alert })}
            />
          ) : null}
        </div>
      ) : null}
    </>
  );
};

const DailySchedulePage = ({ embedded = false }: { embedded?: boolean }) => {
  const intake = useOrderIntake();
  const shift = useShiftCheckSettings();
  const intakeQuery = intake.query;
  const query = {
    data:
      intakeQuery.data && shift.data ? { intake: intakeQuery.data, settings: shift.data } : undefined,
    isLoading: intakeQuery.isLoading || shift.isLoading,
    isError: intakeQuery.isError || shift.isError,
    error: intakeQuery.error ?? shift.error,
    refetch: () => {
      void intakeQuery.refetch();
      void shift.refetch();
    },
  };
  return (
    <OpsToolPage tabKey={DAILY_SCHEDULE_TAB} embedded={embedded}>
      {/* QueryBoundary o'zi bitta `div` — kartalar orasidagi 24 / 16 px oraliq shu o'ramda. */}
      <QueryBoundary query={query} skeleton="lines" isEmpty={() => false} className="flex flex-col gap-6 max-md:gap-4">
        {(data) => (
          <ScheduleForm
            intake={data.intake}
            closed={intake.closed}
            receiveClosed={intake.receiveClosed}
            settings={data.settings}
          />
        )}
      </QueryBoundary>
    </OpsToolPage>
  );
};

export default memo(DailySchedulePage);
