import { describe, expect, it } from "vitest";
import type { HandoverBatch } from "../../../entities/orders/cancelledHandovers";
import {
  formatDayDots,
  formatTashkentTime,
  groupHandoverBatchesByDay,
  handoverMarketName,
  isValidDay,
  readCancelledTab,
  readHandedRange,
  shiftDay,
  tashkentDayOf,
} from "./handedModel";

const batch = (id: string, day: string, orders: number, extra: Partial<HandoverBatch> = {}): HandoverBatch => ({
  id,
  market_id: "201",
  market: { id: "201", name: "Baraka Shop", phone_number: null },
  handed_at: `${day}T10:00:00.000Z`,
  day,
  handed_by: null,
  method: "qr",
  manual_count: 0,
  orders_count: orders,
  total_price_sum: 0,
  ...extra,
});

const MONTH = { from: "2026-11-01", to: "2026-11-10" };

describe("«Bekor qilinganlar» ichki tablari — URL", () => {
  it("?tab=handed — «Topshirilgan», qolgani — «Kutilmoqda»", () => {
    expect(readCancelledTab(new URLSearchParams("tab=handed"))).toBe("handed");
    expect(readCancelledTab(new URLSearchParams("tab=xyz"))).toBe("pending");
    expect(readCancelledTab(new URLSearchParams())).toBe("pending");
  });

  it("sana oralig'i: yaroqli — o'zi, teskari — almashtiriladi, yaroqsiz / yarim — joriy oy", () => {
    expect(readHandedRange(new URLSearchParams("from=2026-10-01&to=2026-10-31"), MONTH)).toEqual({
      from: "2026-10-01",
      to: "2026-10-31",
    });
    expect(readHandedRange(new URLSearchParams("from=2026-10-31&to=2026-10-01"), MONTH)).toEqual({
      from: "2026-10-01",
      to: "2026-10-31",
    });
    expect(readHandedRange(new URLSearchParams("from=2026-02-30&to=2026-03-01"), MONTH)).toBe(MONTH);
    expect(readHandedRange(new URLSearchParams("from=2026-10-01"), MONTH)).toBe(MONTH);
  });

  it("isValidDay — faqat haqiqiy kalendar kuni", () => {
    expect(isValidDay("2028-02-29")).toBe(true);
    expect(isValidDay("2026-02-29")).toBe(false);
    expect(isValidDay("2026-1-01")).toBe(false);
    expect(isValidDay(null)).toBe(false);
  });
});

describe("Toshkent kuni va vaqti", () => {
  it("UTC 20:30 — Toshkentda ertasi kun 01:30", () => {
    const at = new Date("2026-11-09T20:30:00.000Z");
    expect(tashkentDayOf(at)).toBe("2026-11-10");
    expect(formatTashkentTime(at.toISOString())).toBe("01:30");
    expect(formatTashkentTime("yo'q")).toBe("—");
  });

  it("shiftDay oy / yil chegarasidan o'tadi; formatDayDots", () => {
    expect(shiftDay("2026-11-01", -1)).toBe("2026-10-31");
    expect(shiftDay("2026-12-31", 1)).toBe("2027-01-01");
    expect(formatDayDots("2026-11-10")).toBe("10.11.2026");
  });
});

describe("groupHandoverBatchesByDay", () => {
  it("ketma-ket kunlar guruhi, tartib saqlanadi, buyurtmalar yig'indisi", () => {
    const groups = groupHandoverBatchesByDay([
      batch("a", "2026-11-10", 6),
      batch("b", "2026-11-10", 4),
      batch("c", "2026-11-09", 5),
    ]);
    expect(groups.map((g) => [g.day, g.items.map((i) => i.id), g.orders])).toEqual([
      ["2026-11-10", ["a", "b"], 10],
      ["2026-11-09", ["c"], 5],
    ]);
  });

  it("server `day` bermasa — Toshkent kuni vaqtdan", () => {
    const [group] = groupHandoverBatchesByDay([batch("a", "", 1, { handed_at: "2026-11-09T20:30:00.000Z" })]);
    expect(group.day).toBe("2026-11-10");
  });
});

describe("handoverMarketName", () => {
  it("nom bo'lmasa — «Market #id»", () => {
    const fallback = (id: string) => `Market #${id}`;
    expect(handoverMarketName(batch("a", "2026-11-10", 1), fallback)).toBe("Baraka Shop");
    expect(handoverMarketName(batch("a", "2026-11-10", 1, { market: null }), fallback)).toBe("Market #201");
    expect(
      handoverMarketName(batch("a", "2026-11-10", 1, { market: { id: "201", name: "  ", phone_number: null } }), fallback),
    ).toBe("Market #201");
  });
});
