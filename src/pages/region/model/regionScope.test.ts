import { describe, expect, it } from "vitest";
import {
  findOrderRegionScope,
  resolveRegionScope,
} from "./regionScope";

describe("region scope resolution", () => {
  it("resolves a courier region from nested profile data", () => {
    expect(
      resolveRegionScope({
        courier: {
          region: { id: "12", name: "Jizzax" },
        },
      }),
    ).toEqual({ id: "12", name: "Jizzax" });
  });

  it("resolves the courier region from a scoped order response", () => {
    expect(
      findOrderRegionScope({
        data: {
          items: [
            {
              id: "order-1",
              region_id: "12",
              region: { id: "12", name: "Jizzax" },
            },
          ],
        },
      }),
    ).toEqual({ id: "12", name: "Jizzax" });
  });
});
