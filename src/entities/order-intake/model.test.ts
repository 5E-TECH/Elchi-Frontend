import { describe, expect, it } from "vitest";
import {
  isIntakeUnsupportedError,
  isOrderIntakeClosed,
  isOrderIntakeClosedError,
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
    });
    expect(
      normalizeOrderIntake({ cutoff_time: "25:00", is_open: "ha", closes_at: "kecha" }),
    ).toEqual({
      supported: true,
      cutoffTime: null,
      isOpen: null,
      closesAt: null,
      reopensAt: null,
    });
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
