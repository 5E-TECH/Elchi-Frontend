import { describe, expect, it } from "vitest";
import type { DeliveryTariffVersion } from "../../../entities/delivery-pricing";
import { buildHistory, diffTariffs, scheduledChanges } from "./history";

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
