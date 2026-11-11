import { describe, expect, it } from "vitest";
import { normalizeOrderIntake } from "../../../entities/order-intake";
import { normalizeShiftCheckSettings } from "../../../entities/payments";
import {
  conflictingTimes,
  diffIntake,
  diffShift,
  scheduleErrors,
  toIntakeDraft,
  toShiftDraft,
  type ScheduleDraft,
} from "./scheduleDraft";

/** «Kun tartibi» (2026-11-10) — qoralama, faqat o'zgargan maydonlar va tekshiruvlar. */
const intake = normalizeOrderIntake({
  data: { cutoff_time: "10:00", receive_cutoff_time: null, day_change_time: "00:00" },
});
const oldIntake = normalizeOrderIntake({ data: { cutoff_time: null, day_change_time: "00:00" } });
const settings = normalizeShiftCheckSettings({
  data: {
    cards: [],
    auto_open: { enabled: false, times: ["08:00"], scope: "main" },
    auto_close: { enabled: true, times: ["14:00", "23:00"], scope: "main", warn_before_min: 15 },
    late_alert: { enabled: false, grace_min: 15, channels: { telegram: true, in_app: true } },
  },
});
const draftOf = (): ScheduleDraft => ({ intake: toIntakeDraft(intake), shift: toShiftDraft(settings) });

describe("diffIntake", () => {
  it("o'zgarishsiz — bo'sh; bo'sh maydon → `null` (cheklovsiz); faqat o'zgarganlar", () => {
    expect(diffIntake(intake, toIntakeDraft(intake))).toEqual({});
    expect(diffIntake(intake, { cutoff: "", receiveCutoff: "16:00", dayChange: "18:00" })).toEqual({
      cutoff_time: null,
      receive_cutoff_time: "16:00",
      day_change_time: "18:00",
    });
  });

  it("eski backend — `receive_cutoff_time` so'rovga kirmaydi; backend yo'q — hech narsa", () => {
    expect(diffIntake(oldIntake, { cutoff: "09:00", receiveCutoff: "16:00", dayChange: "00:00" })).toEqual({
      cutoff_time: "09:00",
    });
    expect(diffIntake({ ...oldIntake, supported: false }, { cutoff: "09:00", receiveCutoff: "", dayChange: "00:00" })).toEqual({});
  });
});

describe("diffShift", () => {
  it("faqat o'zgargan bloklar va maydonlar (kanallar — faqat o'zgargani)", () => {
    const draft = toShiftDraft(settings);
    expect(diffShift(settings, draft)).toEqual({});
    draft.auto_open = { ...draft.auto_open!, enabled: true, times: ["07:30", "08:00"] };
    draft.late_alert = { ...draft.late_alert!, grace_min: 30, channels: { telegram: true, in_app: false } };
    expect(diffShift(settings, draft)).toEqual({
      auto_open: { enabled: true, times: ["07:30", "08:00"] },
      late_alert: { grace_min: 30, channels: { in_app: false } },
    });
  });

  it("javobda yo'q blok (eski backend) — so'rovga kirmaydi", () => {
    const old = normalizeShiftCheckSettings({ data: { cards: [] } });
    const draft = toShiftDraft(old);
    expect(draft).toEqual({ auto_open: null, auto_close: null, late_alert: null });
    expect(diffShift(old, draft)).toEqual({});
  });
});

describe("scheduleErrors", () => {
  it("to'g'ri qoralama — xato yo'q; noto'g'ri / chala soat — xato; kun almashishi majburiy", () => {
    expect(scheduleErrors(draftOf(), intake)).toEqual({});
    const draft = draftOf();
    draft.intake = { cutoff: "25:00", receiveCutoff: "1", dayChange: "" };
    expect(scheduleErrors(draft, intake)).toEqual({
      cutoff: "invalid",
      receiveCutoff: "invalid",
      dayChange: "invalid",
    });
    // Eski backend — qabul maydoni tekshirilmaydi.
    expect(scheduleErrors(draft, oldIntake)).toEqual({ cutoff: "invalid", dayChange: "invalid" });
  });

  it("yoqilgan, lekin vaqtsiz — `required`; ochish va yopishda bir xil vaqt — ikkalasida `conflict`", () => {
    const empty = draftOf();
    empty.shift.auto_open = { ...empty.shift.auto_open!, enabled: true, times: [] };
    empty.shift.auto_close = { ...empty.shift.auto_close!, times: [] };
    expect(scheduleErrors(empty, intake)).toEqual({ openTimes: "required", closeTimes: "required" });

    const clash = draftOf();
    clash.shift.auto_open = { ...clash.shift.auto_open!, times: ["08:00", "14:00"] };
    expect(conflictingTimes(clash.shift)).toEqual(["14:00"]);
    expect(scheduleErrors(clash, intake)).toEqual({ openTimes: "conflict", closeTimes: "conflict" });
  });

  it("kechikish xabari yoqilgan, kanal yo'q — `lateChannels`", () => {
    const draft = draftOf();
    draft.shift.late_alert = { enabled: true, grace_min: 15, channels: { telegram: false, in_app: false } };
    expect(scheduleErrors(draft, intake)).toEqual({ lateChannels: "required" });
    draft.shift.late_alert = { ...draft.shift.late_alert, enabled: false };
    expect(scheduleErrors(draft, intake)).toEqual({});
  });
});
