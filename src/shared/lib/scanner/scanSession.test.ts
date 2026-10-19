import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { notify } from "../notify";
import { orderByRecent, scanNotify, useRecentScans } from "./scanSession";
import { markScannerCameraMounted, resetScannerHost } from "./scannerHost";

/** Skan oqimi yordamchilari: kamera ro'yxati tartibi va kamera ochiq paytdagi jim xabarlar. */

afterEach(() => {
  resetScannerHost();
});

describe("useRecentScans + orderByRecent", () => {
  it("yangi skanerlangan birinchi; takror skan tepaga chiqaradi; skanersizlar oxirida asl tartibda", () => {
    const { result } = renderHook(() => useRecentScans());
    act(() => result.current.touch("b"));
    act(() => result.current.touch("c"));
    act(() => result.current.touch("b"));

    const items = ["a", "b", "c", "d"];
    expect(orderByRecent(items, (item) => item, result.current.recent)).toEqual(["b", "c", "a", "d"]);

    act(() => result.current.forget("b"));
    expect(orderByRecent(items, (item) => item, result.current.recent)).toEqual(["c", "a", "b", "d"]);
    act(() => result.current.clear());
    expect(result.current.recent).toEqual([]);
  });
});

describe("scanNotify", () => {
  it("kamera yopiq — oddiy xabar; kamera ochiq — jim (natija kamera ichida)", () => {
    expect(scanNotify.warning("QR topilmadi")).toEqual(expect.any(String));

    const unmount = markScannerCameraMounted();
    expect(scanNotify.warning("QR topilmadi")).toBeNull();
    unmount();
    expect(scanNotify.warning("QR topilmadi")).toEqual(expect.any(String));
    notify.dismiss();
  });
});
