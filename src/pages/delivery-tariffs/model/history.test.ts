import { describe, expect, it } from "vitest";
import type { DeliveryPricingSettingsVersion, DeliveryTariffVersion } from "../../../entities/delivery-pricing";
import { buildHistory, buildSettingsHistory, buildTimeline, diffSettings, diffTariffs, scheduledChanges } from "./history";

const version = (
  id: string,
  tariffId: "city" | "center" | "address",
  extraPerKg: number,
  validFrom: string,
  extra: Partial<DeliveryTariffVersion> = {},
): DeliveryTariffVersion => ({
  id,
  tariffId,
  basePrice: tariffId === "city" ? 35000 : 40000,
  extraPerKg,
  daysMin: 1,
  daysMax: 2,
  validFrom,
  createdAt: null,
  createdBy: null,
  createdByName: null,
  isCurrent: false,
  isScheduled: false,
  ...extra,
});

describe("tarix", () => {
  it("har versiya shu tarifning oldingisi bilan solishtiriladi; eng eskisi — dastlabki", () => {
    const versions = [
      version("9", "center", 4500, "2026-10-25T00:00:00+05:00", { isScheduled: true }),
      version("2", "center", 4000, "2026-10-08T00:00:00+05:00", { isCurrent: true }),
      version("1", "city", 4000, "2026-10-08T00:00:00+05:00", { isCurrent: true }),
    ];
    const history = buildHistory(versions);
    expect(history[0]).toMatchObject({ initial: false, changes: [{ kind: "perKg", from: 4000, to: 4500 }] });
    expect(history[1].initial).toBe(true);
    expect(history[2].initial).toBe(true);
  });

  it("diffTariffs: asosiy narx, kg narxi, muddat; o'zgarishsiz — bo'sh", () => {
    const a = version("1", "center", 4000, "2026-10-08");
    expect(diffTariffs(a, { ...a, basePrice: 42000, daysMin: 2, daysMax: 3 })).toEqual([
      { kind: "base", from: 40000, to: 42000 },
      { kind: "days", from: [1, 2], to: [2, 3] },
    ]);
    expect(diffTariffs(a, a)).toEqual([]);
  });

  it("rejalashtirilgan — hozirgi tarif bilan solishtiriladi", () => {
    const current = version("2", "center", 4000, "2026-10-08", { isCurrent: true });
    const scheduled = version("9", "center", 4500, "2026-10-25", { isScheduled: true });
    const result = scheduledChanges({
      current: { city: null, center: current, address: null },
      versions: [scheduled, current],
    });
    expect(result).toHaveLength(1);
    expect(result[0].changes).toEqual([{ kind: "perKg", from: 4000, to: 4500 }]);
  });
});

const settingsVersion = (
  id: string,
  createdAt: string,
  extra: Partial<DeliveryPricingSettingsVersion> = {},
): DeliveryPricingSettingsVersion => ({
  id,
  volumetricDivisor: 5000,
  volumetricFromKg: 0,
  firstKgIncluded: 1,
  minBillableKg: 0.1,
  billableStepKg: 0.1,
  roundTo: 500,
  pickupFee: 20000,
  pickupFreeFromCount: 10,
  expressMultiplier: 1.4,
  isActive: false,
  createdAt,
  createdBy: null,
  createdByName: null,
  ...extra,
});

describe("hisob qoidalari tarixi (47WFHzlx)", () => {
  it("diffSettings: chegara, yaxlitlash va pickup tekin (null — hech qachon)", () => {
    const before = settingsVersion("1", "2026-10-08T04:00:00Z");
    const after = settingsVersion("2", "2026-10-20T10:00:00Z", { firstKgIncluded: 2, roundTo: 1000, pickupFreeFromCount: null });
    expect(diffSettings(before, after)).toEqual([
      { kind: "firstKg", from: 1, to: 2 },
      { kind: "roundTo", from: 500, to: 1000 },
      { kind: "pickupFree", from: 10, to: null },
    ]);
  });

  it("diffSettings: «Hajm bo'yicha hisoblash chegarasi» 0 → 3 kg (chegara birinchi kg dan keyin)", () => {
    const before = settingsVersion("1", "2026-10-08T04:00:00Z");
    const after = settingsVersion("2", "2026-10-25T10:00:00Z", { volumetricFromKg: 3, firstKgIncluded: 2 });
    expect(diffSettings(before, after)).toEqual([
      { kind: "firstKg", from: 1, to: 2 },
      { kind: "volumetricFrom", from: 0, to: 3 },
    ]);
    expect(diffSettings(after, settingsVersion("3", "2026-10-26T10:00:00Z", { volumetricFromKg: 2, firstKgIncluded: 2 }))).toEqual([
      { kind: "volumetricFrom", from: 3, to: 2 },
    ]);
  });

  it("buildSettingsHistory: eng eskisi — dastlabki, o'zgarishsiz versiya tashlanadi", () => {
    const list = buildSettingsHistory([
      settingsVersion("3", "2026-10-21T10:00:00Z", { firstKgIncluded: 2 }),
      settingsVersion("2", "2026-10-20T10:00:00Z", { firstKgIncluded: 2 }),
      settingsVersion("1", "2026-10-08T04:00:00Z"),
    ]);
    expect(list.map((entry) => [entry.version.id, entry.initial, entry.changes.length])).toEqual([
      ["2", false, 1],
      ["1", true, 0],
    ]);
  });

  it("buildTimeline: tarif (valid_from) va qoidalar (createdAt) bitta ro'yxatda, yangisi tepada", () => {
    const timeline = buildTimeline(
      [version("2", "center", 4500, "2026-10-25T00:00:00+05:00"), version("1", "center", 4000, "2026-10-08T00:00:00+05:00")],
      [settingsVersion("2", "2026-10-20T10:00:00Z", { firstKgIncluded: 2 }), settingsVersion("1", "2026-10-08T04:00:00Z")],
    );
    expect(timeline.map((item) => `${item.type}-${item.entry.version.id}`)).toEqual([
      "tariff-2",
      "settings-2",
      "settings-1",
      "tariff-1",
    ]);
  });
});
