import { describe, expect, it } from "vitest";
import * as barrel from "./index";

/**
 * Barrel (`src/shared/ui/primitives`) har primitiv faylining HAR runtime eksportini beradi —
 * yangi primitiv qo'shilib, barrelga yozilmay qolsa test yiqiladi.
 */
const modules = import.meta.glob<Record<string, unknown>>(["./*.ts", "./*.tsx", "!./*.test.*", "!./index.ts"], {
  eager: true,
});

describe("primitives barrel", () => {
  it.each(Object.entries(modules))("%s — barcha eksportlar barrelda", (_file, mod) => {
    for (const [name, value] of Object.entries(mod)) {
      expect(barrel, name).toHaveProperty(name, value);
    }
  });

  it("default eksport yo'q; buyurtma holati (entities) qayta eksport qilinmaydi", () => {
    expect(barrel).not.toHaveProperty("default");
    expect(barrel).not.toHaveProperty("OrderStatusBadge");
  });
});
