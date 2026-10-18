import type { MailItem } from "../../../entities/mails";
import type { OrderListItem } from "../../../entities/order/types/order";
import {
  buildFallbackMailsFromOrders,
  readMailItems,
  sortMailsRows,
  summarizeMailRows,
  toMailListRow,
  type MailListRow,
} from "./mailsLists";

const row = (id: string, overrides: Partial<MailListRow> = {}): MailListRow => ({
  id,
  displayId: `№${id}`,
  createdAt: "2026-10-08T05:00:00.000Z",
  regionId: "1",
  regionName: "Andijon",
  courierName: null,
  orders: 1,
  amount: 100,
  status: null,
  ...overrides,
});

describe("mailsLists model", () => {
  it("reads both `{ data: [] }` and `{ data: { data: [] } }` payloads", () => {
    const items = [{ id: "1" }] as MailItem[];
    expect(readMailItems({ data: items })).toBe(items);
    expect(readMailItems({ data: { data: items } })).toBe(items);
    expect(readMailItems({ data: { total: 0 } })).toEqual([]);
    expect(readMailItems(undefined)).toEqual([]);
  });

  it("maps an API mail to a table row (region fallback, courier, numbers)", () => {
    const mail = {
      id: 2486,
      createdAt: "2026-10-08T05:12:00.000Z",
      region_id: "7",
      region: null,
      order_quantity: "18",
      post_total_price: "3420000",
      courier: { name: "  Jasur Tursunov " },
    } as unknown as MailItem;

    expect(
      toMailListRow(mail, {
        status: { tone: "info", label: "Yangi" },
        regionFallback: (id) => `Viloyat ${id}`,
      }),
    ).toEqual({
      id: "2486",
      displayId: "№2486",
      createdAt: "2026-10-08T05:12:00.000Z",
      regionId: "7",
      regionName: "Viloyat 7",
      courierName: "Jasur Tursunov",
      orders: 18,
      amount: 3_420_000,
      status: { tone: "info", label: "Yangi" },
    });
  });

  it("summarizes distinct regions, mails, orders and amount", () => {
    expect(
      summarizeMailRows([
        row("1", { regionId: "1", orders: 2, amount: 10 }),
        row("2", { regionId: "1", orders: 3, amount: 20 }),
        row("3", { regionId: "2", orders: 4, amount: 30 }),
      ]),
    ).toEqual({ regions: 2, mails: 3, orders: 9, amount: 60 });
  });

  it("sorts by date, orders, amount and status label; no sort keeps API order", () => {
    const rows = [
      row("a", { createdAt: "2026-10-07T00:00:00.000Z", orders: 5, amount: 300, status: { tone: "danger", label: "Rad etilgan" } }),
      row("b", { createdAt: "2026-10-08T00:00:00.000Z", orders: 9, amount: 100, status: { tone: "success", label: "Qabul qilingan" } }),
      row("c", { createdAt: "2026-10-06T00:00:00.000Z", orders: 1, amount: 200, status: { tone: "warning", label: "Jo'natilgan" } }),
    ];
    const ids = (sorted: MailListRow[]) => sorted.map((item) => item.id);

    expect(ids(sortMailsRows(rows, null))).toEqual(["a", "b", "c"]);
    expect(ids(sortMailsRows(rows, { key: "createdAt", direction: "desc" }))).toEqual(["b", "a", "c"]);
    expect(ids(sortMailsRows(rows, { key: "orders", direction: "asc" }))).toEqual(["c", "a", "b"]);
    expect(ids(sortMailsRows(rows, { key: "amount", direction: "desc" }))).toEqual(["a", "c", "b"]);
    expect(ids(sortMailsRows(rows, { key: "status", direction: "asc" }))).toEqual(["c", "b", "a"]);
  });

  it("builds the manager fallback mails from on-the-road orders grouped by post", () => {
    const orders = [
      { id: "1", post_id: "74", status: "on the road", region_id: "5", total_price: 100, createdAt: "2026-10-08T05:00:00.000Z", updatedAt: "x", district: { region: { id: "5", name: "Samarqand" } } },
      { id: "2", post_id: "74", status: "on the road", region_id: "5", total_price: 50, createdAt: "2026-10-08T04:00:00.000Z", updatedAt: "x" },
      { id: "3", post_id: "75", status: "received", region_id: "5", total_price: 70, createdAt: "2026-10-08T04:00:00.000Z", updatedAt: "x" },
      { id: "4", post_id: null, status: "on the road", region_id: "5", total_price: 70, createdAt: "2026-10-08T04:00:00.000Z", updatedAt: "x" },
    ] as unknown as OrderListItem[];

    const mails = buildFallbackMailsFromOrders(orders);
    expect(mails).toHaveLength(1);
    expect(mails[0]).toMatchObject({
      id: "74",
      order_quantity: 2,
      post_total_price: 150,
      createdAt: "2026-10-08T04:00:00.000Z",
      region_id: "5",
      region: { id: "5", name: "Samarqand" },
      status: "sent",
    });
  });
});
