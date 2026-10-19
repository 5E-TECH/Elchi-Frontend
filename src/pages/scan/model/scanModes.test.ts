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
  it("kuryer: «O'zimga olish» (sukut) va «Ma'lumot»", () => {
    expect(modesOf("courier", "REGIONAL")).toEqual(["take", "info"]);
    expect(defaultScanMode(modesOf("courier"))).toBe("take");
  });

  it("menejer HYBRID: qabul (transfer) va biriktirish", () => {
    expect(modesOf("manager", "HYBRID")).toEqual(["info", "receive", "dispatch"]);
  });

  it("menejer REGIONAL: qabul yo'q (backend transfer'ni 403 qiladi), biriktirish bor", () => {
    expect(modesOf("manager", "REGIONAL")).toEqual(["info", "dispatch"]);
  });

  it("menejer HQ: qabul bor, biriktirish yo'q (HQ menejerida `/dispatch` yo'q)", () => {
    expect(modesOf("manager", "HQ")).toEqual(["info", "receive"]);
  });

  it("menejer PICKUP: faqat qabul", () => {
    expect(modesOf("manager", "PICKUP")).toEqual(["info", "receive"]);
  });

  it("filial turi aniqlanmagan menejer — faqat «Ma'lumot» (segment chizilmaydi)", () => {
    expect(modesOf("manager")).toEqual(["info"]);
  });

  it("registrator HQ: qabul va biriktirish", () => {
    expect(modesOf("registrator", "HQ")).toEqual(["info", "receive", "dispatch"]);
  });

  it("registrator REGIONAL: qabul yo'q, biriktirish bor", () => {
    expect(modesOf("registrator", "REGIONAL")).toEqual(["info", "dispatch"]);
  });

  it("superadmin va admin: qabul bor, «Kuryerga biriktirish» yo'q (backend assign-to-courier 403)", () => {
    expect(modesOf("superadmin")).toEqual(["info", "receive"]);
    expect(modesOf("admin")).toEqual(["info", "receive"]);
    expect(defaultScanMode(modesOf("superadmin"))).toBe("info");
  });

  it("market — skanerlamaydi", () => {
    expect(modesOf("market")).toEqual([]);
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
