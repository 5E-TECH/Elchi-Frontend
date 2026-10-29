import { describe, expect, it } from "vitest";
import {
  cancelledHandoverArrivalState,
  cancelledHandoverPath,
  cancelledHandoverTargetId,
  isMailReadyFor,
  mailArrivalState,
  mailDetailPath,
  mailScanTargetId,
  newOrdersMarketTargetId,
  readScannedMail,
  toScanCancelledMarketRows,
  toScanMailRows,
} from "./scanPickers";

describe("skan maqsadlari — kelinadigan sahifalar ro'yxatdan o'tkazadigan id'lar bilan aynan", () => {
  it("pochta (`pages/mails/detail` — `mail:<id>:<cameraMode>`), topshirish va market yangi buyurtmalari", () => {
    expect(mailScanTargetId("2486", "send")).toBe("mail:2486:send");
    expect(mailScanTargetId("2476", "refused")).toBe("mail:2476:refused");
    // `pages/new_orders/cancelled/detail.test.tsx` — «cancelled-handover:201» (QR va tanlov bosqichida bir xil).
    expect(cancelledHandoverTargetId("201")).toBe("cancelled-handover:201");
    expect(newOrdersMarketTargetId("7")).toBe("new-orders:market:7");
    expect(mailDetailPath("2486")).toBe("/mails/2486");
    expect(cancelledHandoverPath("201")).toBe("/new-orders/cancelled/201");
  });

  it("pochtaga o'tish holati — ro'yxat havolasi bilan bir xil + kamera bayrog'i", () => {
    expect(mailArrivalState({ id: "2486", regionId: "14", regionName: "Samarqand", orders: 6 }, "send")).toEqual({
      fromTab: "today",
      fallbackRegionId: "14",
      fallbackRegionName: "Samarqand",
      expectedOrderCount: 6,
      openScanner: { targetId: "mail:2486:send" },
    });
    expect(mailArrivalState({ id: "2476" }, "refused")).toEqual({
      fromTab: "refused",
      type: "refused",
      openScanner: { targetId: "mail:2476:refused" },
    });
    expect(cancelledHandoverArrivalState("201")).toEqual({ openScanner: { targetId: "cancelled-handover:201" } });
  });
});

describe("varaq qatorlari", () => {
  it("pochtalar: `{ data: [] }` va `{ data: { data: [] } }`; id'siz yozuv tashlanadi", () => {
    const mail = {
      id: 2476,
      order_quantity: "3",
      region_id: "14",
      region: { id: "14", name: " Samarqand " },
      courier: { name: "Akmal Karimov" },
    };
    expect(toScanMailRows({ data: [mail, { id: "" }] })).toEqual([
      { id: "2476", regionId: "14", regionName: "Samarqand", orders: 3, courierName: "Akmal Karimov" },
    ]);
    expect(toScanMailRows({ data: { data: [{ id: "2490", region_id: "3" }] } })).toEqual([
      { id: "2490", regionId: "3", regionName: null, orders: 0, courierName: null },
    ]);
    expect(toScanMailRows(null)).toEqual([]);
  });

  it("bekorlari bor marketlar — «Bekor qilinganlar» ro'yxati bilan bir xil o'qish", () => {
    expect(
      toScanCancelledMarketRows({
        data: [{ market_id: "201", orders_count: "3", total_price_sum: "761000", market: { name: "Baraka Shop" } }],
      }),
    ).toEqual([{ market_id: "201", name: "Baraka Shop", phone_number: "—", orders_count: 3, total_price_sum: 761000 }]);
  });
});

describe("skanerlangan pochta QR'i", () => {
  it("`GET post/scan/:token` javobi (global o'ram bilan) → id, holat, viloyat, son", () => {
    expect(
      readScannedMail({
        statusCode: 200,
        data: { id: "2486", status: "NEW", region_id: "14", order_quantity: 6, qr_code_token: "POST-x" },
      }),
    ).toEqual({ id: "2486", status: "new", regionId: "14", regionName: null, orders: 6 });
    expect(readScannedMail({ statusCode: 200, data: {} })).toBeNull();
    expect(readScannedMail(null)).toBeNull();
  });

  it("holat rejimga mosmi: jo'natish — yangi, qabul — rad etilgan; holat kelmasa — sahifa hal qiladi", () => {
    expect(isMailReadyFor("send", "new")).toBe(true);
    expect(isMailReadyFor("send", "sent")).toBe(false);
    expect(isMailReadyFor("send", "canceled")).toBe(false);
    expect(isMailReadyFor("refused", "canceled")).toBe(true);
    expect(isMailReadyFor("refused", "canceled_received")).toBe(false);
    expect(isMailReadyFor("refused", "new")).toBe(false);
    expect(isMailReadyFor("send", null)).toBe(true);
  });
});
