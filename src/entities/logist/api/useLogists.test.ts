import { describe, expect, it } from "vitest";
import { applyBulkAssignment } from "./useLogists";

describe("applyBulkAssignment", () => {
  it("`region_ids` — shu logistniki, uning qolgan viloyatlari logistsiz, boshqalar o'zgarmaydi", () => {
    expect(
      applyBulkAssignment(
        [
          { id: "1", name: "A", logistId: "7" },
          { id: "2", name: "B", logistId: "9" },
          { id: "3", name: "C", logistId: null },
          { id: "4", name: "D", logistId: "9" },
        ],
        { logist_id: "7", region_ids: ["2", "3"] },
      ),
    ).toEqual([
      { id: "1", name: "A", logistId: null },
      { id: "2", name: "B", logistId: "7" },
      { id: "3", name: "C", logistId: "7" },
      { id: "4", name: "D", logistId: "9" },
    ]);
  });
});
