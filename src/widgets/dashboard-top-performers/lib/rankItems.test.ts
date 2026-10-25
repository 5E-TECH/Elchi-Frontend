import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";
import { LOW_RATE_THRESHOLD, lowRateTone, toRankItems, type PerformerRow } from "./rankItems";

/** PMa5dgYQ — reytingda sotuv foizi 50% dan past qator qizil (`danger`) meter bilan ajralib turadi. */
const t = ((key: string) => key) as unknown as TFunction;
const row = (id: string, rate: number): PerformerRow => ({ id, name: id, total: 10, successful: rate / 10, rate });

describe("lowRateTone / toRankItems — past sotuv foizi", () => {
  it("chegara 50%: 49,9 — danger; aynan 50 va undan yuqori — o'z rangi", () => {
    expect(LOW_RATE_THRESHOLD).toBe(50);
    expect(lowRateTone(row("a", 49.9))).toBe("danger");
    expect(lowRateTone(row("b", 0))).toBe("danger");
    expect(lowRateTone(row("c", 50))).toBeUndefined();
    expect(lowRateTone(row("d", 90))).toBeUndefined();
  });

  it("meterToneFor qator rangini beradi, bermasa — othersMeterTone; o'z qatori — selfMeterTone", () => {
    const items = toRankItems([row("low", 35), row("high", 84.4), row("self", 20)], {
      t,
      meterToneFor: lowRateTone,
      othersMeterTone: "neutral",
      selfId: "self",
      selfMeterTone: "action",
    });
    expect(items.map((item) => item.meterTone)).toEqual(["danger", "neutral", "action"]);
  });

  it("meterToneFor berilmasa — avvalgidek (hamma qator othersMeterTone)", () => {
    const items = toRankItems([row("low", 35), row("high", 84.4)], { t });
    expect(items.map((item) => item.meterTone)).toEqual([undefined, undefined]);
  });
});
