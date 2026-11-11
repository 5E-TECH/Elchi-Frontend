import type { OrderIntakeSettingsPatch, OrderIntakeState } from "../../../entities/order-intake";
import type {
  ShiftAutoCloseSettings,
  ShiftAutoOpenSettings,
  ShiftCheckSettings,
  ShiftLateAlertSettings,
  UpdateShiftSettingsRequest,
} from "../../../entities/payments";
import { CLOCK_TIME } from "../../../shared/lib/clockTime";

/**
 * «Kun tartibi» formasi (Ops, 2026-11-10): qoralama, faqat o'zgargan maydonlar (ikki PATCH — `orders/intake-settings`
 * va `finance/shift/settings`) va tekshiruvlar (backend 400 qoidalarining nusxasi — «Saqlash» oldindan o'chiq).
 */

/** Buyurtma qabuli: matn maydonlari (`""` — cheklovsiz; kun almashishi — majburiy). */
export type IntakeDraft = {
  cutoff: string;
  receiveCutoff: string;
  dayChange: string;
};

/** Smena jadvali: javobda yo'q blok (`null`) chizilmaydi va so'rovga kirmaydi. */
export type ShiftDraft = {
  auto_open: ShiftAutoOpenSettings | null;
  auto_close: ShiftAutoCloseSettings | null;
  late_alert: ShiftLateAlertSettings | null;
};

export type ScheduleDraft = { intake: IntakeDraft; shift: ShiftDraft };

export const toIntakeDraft = (state: OrderIntakeState): IntakeDraft => ({
  cutoff: state.cutoffTime ?? "",
  receiveCutoff: state.receiveCutoffTime ?? "",
  dayChange: state.dayChangeTime,
});

export const toShiftDraft = (settings: ShiftCheckSettings): ShiftDraft => ({
  auto_open: settings.auto_open ? { ...settings.auto_open, times: [...settings.auto_open.times] } : null,
  auto_close: settings.auto_close ? { ...settings.auto_close, times: [...settings.auto_close.times] } : null,
  late_alert: settings.late_alert
    ? { ...settings.late_alert, channels: { ...settings.late_alert.channels } }
    : null,
});

export type ScheduleErrors = {
  cutoff?: "invalid";
  receiveCutoff?: "invalid";
  dayChange?: "invalid";
  /** Yoqilgan, lekin vaqt yo'q (backend 1–12 ta kutadi) yoki vaqt yopishda ham bor. */
  openTimes?: "required" | "conflict";
  closeTimes?: "required" | "conflict";
  /** Kechikish xabari yoqilgan, lekin birorta kanal tanlanmagan — xabar hech kimga bormaydi. */
  lateChannels?: "required";
};

const optionalClockError = (value: string): "invalid" | undefined =>
  value === "" || CLOCK_TIME.test(value) ? undefined : "invalid";

/** Ham ochish, ham yopish ro'yxatidagi vaqtlar (backend `SHIFT_SCHEDULE_CONFLICT`). */
export const conflictingTimes = (shift: ShiftDraft): string[] => {
  const open = shift.auto_open?.times ?? [];
  const close = new Set(shift.auto_close?.times ?? []);
  return open.filter((time) => close.has(time));
};

export const scheduleErrors = (draft: ScheduleDraft, intake: OrderIntakeState): ScheduleErrors => {
  const errors: ScheduleErrors = {};
  if (intake.supported) {
    const cutoff = optionalClockError(draft.intake.cutoff);
    if (cutoff) errors.cutoff = cutoff;
    if (intake.receiveSupported) {
      const receive = optionalClockError(draft.intake.receiveCutoff);
      if (receive) errors.receiveCutoff = receive;
    }
    if (!CLOCK_TIME.test(draft.intake.dayChange)) errors.dayChange = "invalid";
  }
  const { auto_open, auto_close, late_alert } = draft.shift;
  if (auto_open?.enabled && auto_open.times.length === 0) errors.openTimes = "required";
  if (auto_close?.enabled && auto_close.times.length === 0) errors.closeTimes = "required";
  if (conflictingTimes(draft.shift).length) {
    errors.openTimes ??= "conflict";
    errors.closeTimes ??= "conflict";
  }
  if (late_alert?.enabled && !late_alert.channels.telegram && !late_alert.channels.in_app) {
    errors.lateChannels = "required";
  }
  return errors;
};

/** `PATCH orders/intake-settings` — faqat o'zgargan maydonlar (bo'sh — o'zgarish yo'q). */
export const diffIntake = (state: OrderIntakeState, draft: IntakeDraft): OrderIntakeSettingsPatch => {
  const body: OrderIntakeSettingsPatch = {};
  if (!state.supported) return body;
  const cutoff = draft.cutoff || null;
  if (cutoff !== state.cutoffTime) body.cutoff_time = cutoff;
  if (state.receiveSupported) {
    const receive = draft.receiveCutoff || null;
    if (receive !== state.receiveCutoffTime) body.receive_cutoff_time = receive;
  }
  if (draft.dayChange !== state.dayChangeTime) body.day_change_time = draft.dayChange;
  return body;
};

const sameTimes = (a: string[], b: string[]) => a.length === b.length && a.every((value, index) => value === b[index]);

/** `PATCH finance/shift/settings` — faqat o'zgargan bloklar va ularning maydonlari (bo'sh — o'zgarish yo'q). */
export const diffShift = (base: ShiftCheckSettings, draft: ShiftDraft): UpdateShiftSettingsRequest => {
  const body: UpdateShiftSettingsRequest = {};
  if (base.auto_open && draft.auto_open) {
    const before = base.auto_open;
    const next = draft.auto_open;
    const patch: NonNullable<UpdateShiftSettingsRequest["auto_open"]> = {};
    if (next.enabled !== before.enabled) patch.enabled = next.enabled;
    if (!sameTimes(next.times, before.times)) patch.times = [...next.times];
    if (next.scope !== before.scope) patch.scope = next.scope;
    if (Object.keys(patch).length) body.auto_open = patch;
  }
  if (base.auto_close && draft.auto_close) {
    const before = base.auto_close;
    const next = draft.auto_close;
    const patch: NonNullable<UpdateShiftSettingsRequest["auto_close"]> = {};
    if (next.enabled !== before.enabled) patch.enabled = next.enabled;
    if (!sameTimes(next.times, before.times)) patch.times = [...next.times];
    if (next.scope !== before.scope) patch.scope = next.scope;
    if (next.warn_before_min !== before.warn_before_min) patch.warn_before_min = next.warn_before_min;
    if (Object.keys(patch).length) body.auto_close = patch;
  }
  if (base.late_alert && draft.late_alert) {
    const before = base.late_alert;
    const next = draft.late_alert;
    const patch: NonNullable<UpdateShiftSettingsRequest["late_alert"]> = {};
    if (next.enabled !== before.enabled) patch.enabled = next.enabled;
    if (next.grace_min !== before.grace_min) patch.grace_min = next.grace_min;
    const channels: { telegram?: boolean; in_app?: boolean } = {};
    if (next.channels.telegram !== before.channels.telegram) channels.telegram = next.channels.telegram;
    if (next.channels.in_app !== before.channels.in_app) channels.in_app = next.channels.in_app;
    if (Object.keys(channels).length) patch.channels = channels;
    if (Object.keys(patch).length) body.late_alert = patch;
  }
  return body;
};
