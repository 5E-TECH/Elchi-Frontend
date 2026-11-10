import { describe, expect, it } from "vitest";
import {
  cutoffClosesAt,
  isCutoffPassed,
  isIntakeUnsupportedError,
  isOrderIntakeClosed,
  isOrderIntakeClosedError,
  isOrderReceiveClosed,
  isOrderReceiveClosedError,
  normalizeOrderIntake,
  UNSUPPORTED_INTAKE,
} from "./model";

/** Bugungi qabul vaqti (2026-11-08) — backend kontrakti taklifi va «hozir yopiqmi» qoidasi. */
const at = (iso: string) => Date.parse(iso);

describe("normalizeOrderIntake", () => {
  it("`{ data: {...} }` va «10:00:00» → «10:00»; noto'g'ri qiymatlar — null", () => {
    expect(
      normalizeOrderIntake({
        data: {
          cutoff_time: "10:00:00",
          is_open: true,
          closes_at: "2026-11-08T05:00:00.000Z",
          reopens_at: "2026-11-08T19:00:00.000Z",
        },
      }),
    ).toEqual({
      supported: true,
      cutoffTime: "10:00",
      isOpen: true,
      closesAt: "2026-11-08T05:00:00.000Z",
      reopensAt: "2026-11-08T19:00:00.000Z",
      dayChangeTime: "00:00",
      dayStartedAt: null,
      nextDayChangeAt: null,
      receiveSupported: false,
      receiveCutoffTime: null,
      receiveIsOpen: null,
      receiveClosesAt: null,
      receiveReopensAt: null,
    });
    expect(
      normalizeOrderIntake({ cutoff_time: "25:00", is_open: "ha", closes_at: "kecha" }),
    ).toEqual({
      supported: true,
      cutoffTime: null,
      isOpen: null,
      closesAt: null,
      reopensAt: null,
      dayChangeTime: "00:00",
      dayStartedAt: null,
      nextDayChangeAt: null,
      receiveSupported: false,
      receiveCutoffTime: null,
      receiveIsOpen: null,
      receiveClosesAt: null,
      receiveReopensAt: null,
    });
  });

  it("⭐ kun almashish soati (#756): `day_change_time`, `day_started_at`, `next_day_change_at` o'qiladi", () => {
    expect(
      normalizeOrderIntake({
        data: {
          cutoff_time: null,
          day_change_time: "18:00:00",
          day_started_at: "2026-11-09T13:00:00.000Z",
          next_day_change_at: "2026-11-10T13:00:00.000Z",
        },
      }),
    ).toMatchObject({
      dayChangeTime: "18:00",
      dayStartedAt: "2026-11-09T13:00:00.000Z",
      nextDayChangeAt: "2026-11-10T13:00:00.000Z",
    });
  });

  it("⭐ yo'q yoki buzuq kun almashish soati — «00:00», buzuq lahzalar — null; backend yo'q holatida ham «00:00»", () => {
    for (const day_change_time of [undefined, null, "", "24:00", "18", "soat 6", 1800]) {
      expect(
        normalizeOrderIntake({
          data: { day_change_time, day_started_at: "kecha", next_day_change_at: 5 },
        }),
      ).toMatchObject({ dayChangeTime: "00:00", dayStartedAt: null, nextDayChangeAt: null });
    }
    expect(UNSUPPORTED_INTAKE).toMatchObject({
      dayChangeTime: "00:00",
      dayStartedAt: null,
      nextDayChangeAt: null,
    });
  });
});

describe("ish kuni oynasi — «vaqt o'tib ketgan» (#756)", () => {
  // Kun 18:00 (Toshkent) da almashadi: joriy ish kuni 09.11 18:00 (13:00Z) dan 10.11 18:00 gacha.
  const day = { dayChangeTime: "18:00", dayStartedAt: "2026-11-09T13:00:00.000Z" };

  it("«10:00» — ish kuni boshidan 16 soat keyin (ertangi tong, 10.11 05:00Z); «20:00» — 2 soat keyin", () => {
    expect(cutoffClosesAt("10:00", day)).toBe(at("2026-11-10T05:00:00.000Z"));
    expect(cutoffClosesAt("20:00", day)).toBe(at("2026-11-09T15:00:00.000Z"));
    expect(cutoffClosesAt("18:00", day)).toBe(at("2026-11-09T13:00:00.000Z"));
    expect(cutoffClosesAt("10:00", { dayChangeTime: "18:00", dayStartedAt: null })).toBeNull();
  });

  it("⭐ kun 18:00, hozir 20:00 (Toshkent) — «10:00» o'tib KETMAGAN (ertangi tong); «19:00» — o'tgan", () => {
    const now = at("2026-11-09T15:00:00.000Z"); // 20:00 Toshkent
    expect(isCutoffPassed("10:00", day, now)).toBe(false);
    expect(isCutoffPassed("19:00", day, now)).toBe(true);
  });

  it("ish kuni boshi kelmasa — eski qoida (Toshkent kalendar kuni): 20:00 da «10:00» o'tgan", () => {
    const now = at("2026-11-09T15:00:00.000Z");
    expect(isCutoffPassed("10:00", { dayChangeTime: "00:00", dayStartedAt: null }, now)).toBe(true);
    expect(isCutoffPassed("21:00", { dayChangeTime: "00:00", dayStartedAt: null }, now)).toBe(
      false,
    );
  });
});

describe("isOrderIntakeClosed", () => {
  const state = normalizeOrderIntake({
    data: {
      cutoff_time: "10:00",
      closes_at: "2026-11-08T05:00:00.000Z",
      reopens_at: "2026-11-08T19:00:00.000Z",
    },
  });

  it("backend yo'q yoki cheklovsiz — hech qachon yopiq emas", () => {
    expect(isOrderIntakeClosed(UNSUPPORTED_INTAKE, at("2026-11-08T12:00:00Z"))).toBe(false);
    expect(
      isOrderIntakeClosed(
        normalizeOrderIntake({ data: { cutoff_time: null } }),
        at("2026-11-08T12:00:00Z"),
      ),
    ).toBe(false);
  });

  it("10:00 (Toshkent, 05:00Z) gacha ochiq, keyin kun almashguncha (00:00 Toshkent, 19:00Z) yopiq, so'ng ochiq", () => {
    expect(isOrderIntakeClosed(state, at("2026-11-08T04:59:59Z"))).toBe(false);
    expect(isOrderIntakeClosed(state, at("2026-11-08T05:00:00Z"))).toBe(true);
    expect(isOrderIntakeClosed(state, at("2026-11-08T18:59:59Z"))).toBe(true);
    expect(isOrderIntakeClosed(state, at("2026-11-08T19:00:00Z"))).toBe(false);
  });

  it("server `is_open: false` desa — yopiq (kun almashguncha), `reopens_at` o'tgach eski javob ochiq deb olinadi", () => {
    const closed = { ...state, isOpen: false, closesAt: null };
    expect(isOrderIntakeClosed(closed, at("2026-11-08T03:00:00Z"))).toBe(true);
    expect(isOrderIntakeClosed(closed, at("2026-11-08T19:00:01Z"))).toBe(false);
  });
});

describe("«Kun tartibi» — qabul qilish chegarasi (2026-11-10)", () => {
  const fresh = {
    data: {
      cutoff_time: "10:00",
      is_open: true,
      receive_cutoff_time: "16:00:00",
      receive_is_open: true,
      receive_closes_at: "2026-11-11T11:00:00.000Z",
      receive_reopens_at: "2026-11-11T19:00:00.000Z",
      day_change_time: "00:00",
      day_started_at: "2026-11-10T19:00:00.000Z",
    },
  };

  it("yangi backend: `receive_*` o'qiladi, `receiveSupported` — kalit bor (qiymati null bo'lsa ham)", () => {
    const state = normalizeOrderIntake(fresh);
    expect(state.receiveSupported).toBe(true);
    expect(state.receiveCutoffTime).toBe("16:00");
    expect(state.receiveIsOpen).toBe(true);
    expect(state.receiveClosesAt).toBe("2026-11-11T11:00:00.000Z");
    expect(state.receiveReopensAt).toBe("2026-11-11T19:00:00.000Z");
    expect(normalizeOrderIntake({ data: { receive_cutoff_time: null } }).receiveSupported).toBe(true);
    // Eski backend — kalit yo'q.
    expect(normalizeOrderIntake({ data: { cutoff_time: "10:00" } }).receiveSupported).toBe(false);
  });

  it("16:00 (11:00Z) gacha ochiq, keyin kun almashguncha yopiq, so'ng ochiq; eski backend — hech qachon yopiq emas", () => {
    const state = normalizeOrderIntake(fresh);
    expect(isOrderReceiveClosed(state, at("2026-11-11T10:59:00.000Z"))).toBe(false);
    expect(isOrderReceiveClosed(state, at("2026-11-11T11:00:00.000Z"))).toBe(true);
    expect(isOrderReceiveClosed(state, at("2026-11-11T19:00:00.000Z"))).toBe(false);
    expect(isOrderReceiveClosed({ ...state, receiveIsOpen: false }, at("2026-11-11T08:00:00.000Z"))).toBe(true);
    expect(isOrderReceiveClosed({ ...state, receiveSupported: false, receiveIsOpen: false })).toBe(false);
    expect(isOrderReceiveClosed(UNSUPPORTED_INTAKE)).toBe(false);
    // Yaratish va qabul — alohida oynalar.
    expect(isOrderIntakeClosed(state, at("2026-11-11T11:00:00.000Z"))).toBe(false);
  });

  it("`409 ORDER_RECEIVE_CLOSED` — `code` javob ildizida yoki `data` ichida; yaratish xatosi bilan aralashmaydi", () => {
    expect(isOrderReceiveClosedError({ response: { status: 409, data: { code: "ORDER_RECEIVE_CLOSED" } } })).toBe(true);
    expect(
      isOrderReceiveClosedError({ response: { status: 409, data: { data: { code: "ORDER_RECEIVE_CLOSED" } } } }),
    ).toBe(true);
    expect(isOrderReceiveClosedError({ response: { status: 409, data: { code: "ORDER_INTAKE_CLOSED" } } })).toBe(false);
    expect(isOrderIntakeClosedError({ response: { status: 409, data: { code: "ORDER_RECEIVE_CLOSED" } } })).toBe(false);
  });
});

describe("xatolar", () => {
  it("404 / 405 / 501 — endpoint yo'q (funksiya o'chiq); 500 — yo'q emas", () => {
    for (const status of [404, 405, 501])
      expect(isIntakeUnsupportedError({ response: { status } })).toBe(true);
    expect(isIntakeUnsupportedError({ response: { status: 500 } })).toBe(false);
  });

  it("`409 ORDER_INTAKE_CLOSED` — `code` javob ildizida yoki `data` ichida", () => {
    expect(
      isOrderIntakeClosedError({
        response: { status: 409, data: { code: "ORDER_INTAKE_CLOSED" } },
      }),
    ).toBe(true);
    expect(
      isOrderIntakeClosedError({
        response: { status: 409, data: { data: { code: "ORDER_INTAKE_CLOSED" } } },
      }),
    ).toBe(true);
    expect(isOrderIntakeClosedError({ response: { status: 409, data: { code: "OTHER" } } })).toBe(
      false,
    );
    expect(isOrderIntakeClosedError(new Error("x"))).toBe(false);
  });
});
