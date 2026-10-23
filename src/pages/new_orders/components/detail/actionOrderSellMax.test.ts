import { describe, expect, it } from "vitest";
import { buildActionOrder, normalizeOrderDetail } from "./orderDetailModel";

/** uguUEhin — buyurtma tafsilotidagi «Sotish» oynasiga backend chegarasi (`sale_market_paid_max`) yetib boradi. */
describe("buildActionOrder — «Marketga to'langan summa» chegarasi", () => {
  it("kutilayotgan buyurtma: `sale_market_paid_max` uzatiladi (`to_be_paid` hali 0)", () => {
    const action = buildActionOrder(
      normalizeOrderDetail({ id: "73", status: "waiting", to_be_paid: 0, sale_market_paid_max: 30000, items: [] }),
    );
    expect(action?.sale_market_paid_max).toBe(30000);
    expect(action?.to_be_paid).toBe(0);
  });

  it("maydon kelmasa yoki `null` — `null` (oyna `to_be_paid` ga qaytadi)", () => {
    expect(buildActionOrder(normalizeOrderDetail({ id: "1", status: "sold", items: [] }))?.sale_market_paid_max).toBeNull();
    expect(
      buildActionOrder(normalizeOrderDetail({ id: "1", status: "waiting", sale_market_paid_max: null, items: [] }))?.sale_market_paid_max,
    ).toBeNull();
  });
});
