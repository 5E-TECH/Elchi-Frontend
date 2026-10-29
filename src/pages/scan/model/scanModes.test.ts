import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RootState } from "../../../app/config/store";
import {
  defaultScanMode,
  readStoredScanMode,
  resolveScanModes,
  scanModeAccessOf,
  requestedScanMode,
  scanModeState,
  scanModeStorageKey,
  useScanMode,
  writeStoredScanMode,
} from "./scanModes";

/** Rol va filial turi bilan minimal Redux holati (`access.ts` predikatlari o'qiydigan maydonlar). */
const stateOf = (role: string, branchType?: "HQ" | "REGIONAL" | "HYBRID" | "PICKUP") =>
  ({
    role: { id: "u-1", role, region: null, name: role },
    user: {
      user: { id: "u-1", role, ...(branchType ? { branch: { id: "b-1", type: branchType } } : {}) },
      isAuthenticated: true,
    },
  }) as unknown as RootState;

const modesOf = (role: string, branchType?: "HQ" | "REGIONAL" | "HYBRID" | "PICKUP") =>
  resolveScanModes(scanModeAccessOf(stateOf(role, branchType)));

describe("universal skaner rejimlari — rol va filial bo'yicha", () => {
  it("kuryer: «O'zimga olish» (sukut) va «Ma'lumot» — pochta va topshirish rejimlari yo'q", () => {
    expect(modesOf("courier", "REGIONAL")).toEqual(["take", "info"]);
    expect(defaultScanMode(modesOf("courier"))).toBe("take");
  });

  it("menejer HYBRID: qabul (transfer), biriktirish va rad etilgan pochta", () => {
    expect(modesOf("manager", "HYBRID")).toEqual(["info", "receive", "dispatch", "refusedMail"]);
  });

  it("menejer REGIONAL: qabul yo'q (backend transfer'ni 403 qiladi), biriktirish va rad etilgan pochta bor", () => {
    expect(modesOf("manager", "REGIONAL")).toEqual(["info", "dispatch", "refusedMail"]);
  });

  it("menejer HQ: qabul va rad etilgan pochta, biriktirish yo'q (HQ menejerida `/dispatch` yo'q)", () => {
    expect(modesOf("manager", "HQ")).toEqual(["info", "receive", "refusedMail"]);
  });

  it("menejer PICKUP: faqat qabul (PICKUP da `/mails` yo'q — rad etilgan pochta ham yo'q)", () => {
    expect(modesOf("manager", "PICKUP")).toEqual(["info", "receive"]);
  });

  it("filial turi aniqlanmagan menejer — faqat «Ma'lumot» (segment chizilmaydi)", () => {
    expect(modesOf("manager")).toEqual(["info"]);
  });

  it("registrator HQ: qabul, biriktirish, pochtani jo'natish, rad etilgan pochta va marketga topshirish", () => {
    expect(modesOf("registrator", "HQ")).toEqual([
      "info",
      "receive",
      "dispatch",
      "sendMail",
      "refusedMail",
      "handover",
    ]);
  });

  it("registrator REGIONAL: qabul yo'q, biriktirish bor; pochta jo'natish / rad etilgan / topshirish — faqat HQ", () => {
    expect(modesOf("registrator", "REGIONAL")).toEqual(["info", "dispatch"]);
  });

  it("registrator HYBRID va PICKUP: pochta va topshirish yo'q (sahifalar HQ registratoriga); PICKUP da kuryer yo'q", () => {
    expect(modesOf("registrator", "HYBRID")).toEqual(["info", "receive", "dispatch"]);
    expect(modesOf("registrator", "PICKUP")).toEqual(["info", "receive"]);
  });

  it("superadmin va admin: qabul, pochtani jo'natish, rad etilgan pochta, marketga topshirish; «Kuryerga biriktirish» yo'q (backend assign-to-courier 403)", () => {
    const expected = ["info", "receive", "sendMail", "refusedMail", "handover"];
    expect(modesOf("superadmin")).toEqual(expected);
    expect(modesOf("admin")).toEqual(expected);
    expect(defaultScanMode(modesOf("superadmin"))).toBe("info");
  });

  it("market — skanerlamaydi", () => {
    expect(modesOf("market")).toEqual([]);
    // MO-3: market operatori buyurtma yaratadi (`canCreateOrders`), lekin qabul/skaner unda yo'q.
    expect(modesOf("market_operator")).toEqual([]);
  });

  it("boshqa rollar (logist, investor) — faqat «Ma'lumot»", () => {
    expect(modesOf("logist")).toEqual(["info"]);
    expect(modesOf("investor")).toEqual(["info"]);
  });
});

describe("yangi rejimlar — kelinadigan sahifa sharti bilan aynan (vNcGDnNh)", () => {
  const base = {
    role: "superadmin",
    branchType: null,
    canCreateOrders: true,
    canViewDispatch: true,
    canSendMail: true,
    canReceiveRefusedMail: true,
    canHandoverCancelled: true,
  } as const;

  it("har rejim faqat o'z huquqi bilan", () => {
    expect(resolveScanModes({ ...base, canSendMail: false })).not.toContain("sendMail");
    expect(resolveScanModes({ ...base, canReceiveRefusedMail: false })).not.toContain("refusedMail");
    expect(resolveScanModes({ ...base, canHandoverCancelled: false })).not.toContain("handover");
  });

  it("«Marketga topshirish» — `/new-orders` qobig'i yopiq bo'lsa ham yo'q (ota guard)", () => {
    expect(resolveScanModes({ ...base, canCreateOrders: false })).not.toContain("handover");
  });

  it("tanlangan yangi rejim qurilmada eslab qolinadi", () => {
    writeStoredScanMode("u-9", "handover");
    expect(readStoredScanMode("u-9")).toBe("handover");
    writeStoredScanMode("u-9", "sendMail");
    expect(readStoredScanMode("u-9")).toBe("sendMail");
    writeStoredScanMode("u-9", "refusedMail");
    expect(readStoredScanMode("u-9")).toBe("refusedMail");
    window.localStorage.clear();
  });
});

describe("tanlangan rejim — qurilmada", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("foydalanuvchi bo'yicha saqlanadi va o'qiladi; buzilgan qiymat — null", () => {
    writeStoredScanMode("u-1", "receive");
    expect(readStoredScanMode("u-1")).toBe("receive");
    expect(readStoredScanMode("u-2")).toBeNull();
    window.localStorage.setItem(scanModeStorageKey("u-2"), "boshqa");
    expect(readStoredScanMode("u-2")).toBeNull();
  });

  it("localStorage yopiq bo'lsa ham yiqilmaydi", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => writeStoredScanMode("u-1", "info")).not.toThrow();
    expect(readStoredScanMode("u-1")).toBeNull();
  });
});

describe("so'ralgan rejim (router state) — shu ochilish uchun", () => {
  afterEach(() => window.localStorage.clear());

  it("Sozlamalar «Kamerani sinash»: kuryer «Ma'lumot» da ochiladi, saqlangan «O'zimga olish» o'zgarmaydi", () => {
    writeStoredScanMode("u-1", "take");
    const requested = requestedScanMode(scanModeState("info"));
    const { result } = renderHook(() => useScanMode(["take", "info"], "u-1", requested));
    expect(result.current[0]).toBe("info");
    expect(readStoredScanMode("u-1")).toBe("take");

    // Foydalanuvchi o'zi tanlasa — odatdagidek saqlanadi.
    act(() => result.current[1]("take"));
    expect(result.current[0]).toBe("take");
    expect(readStoredScanMode("u-1")).toBe("take");
  });

  it("noma'lum yoki ruxsatsiz so'rov e'tiborsiz", () => {
    expect(requestedScanMode(null)).toBeUndefined();
    const { result } = renderHook(() => useScanMode(["take", "info"], "u-1", "dispatch"));
    expect(result.current[0]).toBe("take");
  });
});
