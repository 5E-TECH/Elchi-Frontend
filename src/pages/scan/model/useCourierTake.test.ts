import { describe, expect, it } from "vitest";
import type { ScanEntry } from "../../../features/tg-scan/model/useScanAssign";
import { isOtherCourierError, summarizeTakeEntries } from "./useCourierTake";

const ok = (token: string, orderId: string, status: "assigned" | "already"): ScanEntry => ({
  key: `${token}-${status}`,
  status,
  token,
  orderId,
  order: null,
  at: 0,
});
const failed = (token: string, message = "Buyurtma paketga joylangan"): ScanEntry => ({
  key: `${token}-failed`,
  status: "failed",
  token,
  error: { kind: "message", message },
  at: 0,
});

describe("kuryer «O'zimga olish» — xulosa", () => {
  it("yangi biriktirilgan, avval ham sizda bo'lgan va biriktirilmagan — noyob sanaladi", () => {
    expect(
      summarizeTakeEntries([
        ok("t1", "10191", "assigned"),
        ok("t1", "10191", "already"),
        ok("t2", "10172", "already"),
        failed("t3"),
        failed("t3"),
        failed("t4"),
        ok("t4", "10180", "assigned"),
      ]),
    ).toEqual({ assigned: 2, already: 1, failed: 1 });
  });

  it("boshqa kuryer — backend matnidan (sabab kodi ochiq emas)", () => {
    expect(isOtherCourierError({ kind: "message", message: "Order allaqachon boshqa courierga biriktirilgan" })).toBe(true);
    expect(isOtherCourierError({ kind: "message", message: "Buyurtma boshqa kuryerda" })).toBe(true);
    expect(isOtherCourierError({ kind: "message", message: "Buyurtma paketga joylangan" })).toBe(false);
    expect(isOtherCourierError({ kind: "offline", message: null })).toBe(false);
  });
});
