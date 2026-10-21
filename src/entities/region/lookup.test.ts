import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { REGION_LOOKUP_KEY } from "./lookup";

describe("useRegionLookup keshi (KM-1)", () => {
  it("viloyat/tuman o'zgarishi bekor qiladigan prefiks (`region-district-catalog`) ostida", async () => {
    const client = new QueryClient();
    client.setQueryData(REGION_LOOKUP_KEY, [{ id: "1", name: "Toshkent sh." }]);
    // pages/region/pages/districts — DEPENDENT_KEYS.
    await client.invalidateQueries({ queryKey: ["region-district-catalog"] });
    expect(client.getQueryState(REGION_LOOKUP_KEY)?.isInvalidated).toBe(true);
  });
});
