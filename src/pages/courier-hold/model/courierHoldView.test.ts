import { describe, expect, it } from "vitest";
import {
  buildCourierHoldListParams,
  ordersListHref,
  readCourierHoldCourier,
  readCourierHoldTab,
  showsOrderList,
  writeCourierHoldCourier,
  writeCourierHoldTab,
} from "./courierHoldView";

/** onXzDc5n — «Kuryerdagi buyurtmalar»: URL'dagi tab va kuryer, `GET /orders` parametrlari, /orders havolasi. */
describe("courierHoldView (onXzDc5n)", () => {
  it("⭐ tab: sukut «72 soatdan oshgan»; ogohlantirish havolasi `?tab=near_48` — «48 soatga yaqin»", () => {
    expect(readCourierHoldTab(new URLSearchParams())).toBe("over_72");
    expect(readCourierHoldTab(new URLSearchParams("tab=near_48"))).toBe("near_48");
    expect(readCourierHoldTab(new URLSearchParams("tab=COURIERS"))).toBe("couriers");
    expect(readCourierHoldTab(new URLSearchParams("tab=all"))).toBe("over_72");
  });

  it("kuryer id: faqat raqam", () => {
    expect(readCourierHoldCourier(new URLSearchParams("courier=26"))).toBe("26");
    expect(readCourierHoldCourier(new URLSearchParams("courier=abc"))).toBe("");
    expect(readCourierHoldCourier(new URLSearchParams())).toBe("");
  });

  it("⭐ tab almashdi: sahifa 1 ga; «Kuryerlar bo'yicha» — kuryer tanlovi tozalanadi, qolganlarida saqlanadi", () => {
    const prev = new URLSearchParams("tab=near_48&courier=26&page=3&limit=50");
    expect(writeCourierHoldTab(prev, "over_72").toString()).toBe("courier=26&limit=50");
    expect(writeCourierHoldTab(prev, "couriers").toString()).toBe("tab=couriers&limit=50");
    expect(writeCourierHoldCourier(new URLSearchParams("tab=couriers&page=2"), "27").toString()).toBe("tab=couriers&courier=27");
    expect(writeCourierHoldCourier(new URLSearchParams("tab=couriers&courier=27"), "").toString()).toBe("tab=couriers");
  });

  it("⭐ ro'yxat parametrlari: tab → `courier_hold`; kuryer tanlangan — `courier_id` (kuryerlar tabida — hammasi)", () => {
    expect(buildCourierHoldListParams("over_72", "", { page: 1, limit: 25 })).toEqual({
      page: 1,
      limit: 25,
      courier_hold: "over_72",
    });
    expect(buildCourierHoldListParams("near_48", "26", { page: 2, limit: 10 })).toEqual({
      page: 2,
      limit: 10,
      courier_hold: "near_48",
      courier_id: "26",
    });
    expect(buildCourierHoldListParams("couriers", "26", { page: 1, limit: 25 })).toMatchObject({
      courier_hold: "any",
      courier_id: "26",
    });
    expect(showsOrderList("couriers", "")).toBe(false);
    expect(showsOrderList("couriers", "26")).toBe(true);
    expect(showsOrderList("over_72", "")).toBe(true);
  });

  it("/orders havolasi — «Kuryerda turgan vaqti» filtri va kuryer bilan", () => {
    expect(ordersListHref("over_72", "")).toBe("/orders?courier_hold=over_72");
    expect(ordersListHref("couriers", "26")).toBe("/orders?courier_hold=any&orderCourierId=26");
  });
});
