import { describe, expect, it } from "vitest";
import type { BatchDetail } from "../../../entities/batch";
import { mapBatchOrdersToPostOrders } from "./batchOrderMailAdapter";

const batch = (orders: BatchDetail["orders"]): BatchDetail => ({
  id: "172",
  token: "BTB-172",
  from_branch: { id: "7", name: "Urgut filiali", code: "SMQ-URG" },
  to_branch: { id: "1", name: "Toshkent HQ", region: "Samarqand viloyati" },
  direction: "forward",
  orders_count: orders.length,
  total_price: 0,
  status: "new",
  created_at: "2026-10-17T04:20:00.000Z",
  orders,
  history: [],
});

describe("batchOrderMailAdapter — paket buyurtmasi → PostOrder", () => {
  it("yetkazish (D13): center — Markazgacha, home/address/noma'lum — Uygacha", () => {
    const rows = mapBatchOrdersToPostOrders(
      batch([
        { id: "1", receiver: "A", phone: "", address: "", price: 1, status: "new", where_deliver: "center" },
        { id: "2", receiver: "B", phone: "", address: "", price: 1, status: "new", where_deliver: "home" },
        { id: "3", receiver: "C", phone: "", address: "", price: 1, status: "new", where_deliver: "address" },
        { id: "4", receiver: "D", phone: "", address: "", price: 1, status: "new" },
      ]),
    );
    expect(rows.map((row) => row.where_deliver)).toEqual(["center", "address", "address", "address"]);
  });

  it("sana — buyurtmaning o'zi, bo'lmasa paketniki; tuman, viloyat va market — enriched buyurtmadan", () => {
    const [enriched, minimal] = mapBatchOrdersToPostOrders(
      batch([
        {
          id: "10166",
          qr_code_token: "qr-10166",
          receiver: "Hulkar Abdullayeva",
          phone: "+998912451780",
          address: "Mustaqillik ko'chasi, 14-uy",
          price: 265000,
          status: "received",
          created_at: "2026-10-16T09:00:00.000Z",
          district: "Urgut tumani",
          region: "Samarqand",
          market: "Baraka Shop",
        },
        { id: "10165", receiver: "—", phone: "", address: "—", price: 410000, status: "—" },
      ]),
    );

    expect(enriched).toMatchObject({
      id: "10166",
      createdAt: "2026-10-16T09:00:00.000Z",
      total_price: 265000,
      qr_code_token: "qr-10166",
      address: "Mustaqillik ko'chasi, 14-uy",
      customer: { name: "Hulkar Abdullayeva", phone_number: "+998912451780" },
      district: { name: "Urgut tumani" },
      region: { name: "Samarqand" },
      market: { name: "Baraka Shop" },
    });
    expect(minimal.createdAt).toBe("2026-10-17T04:20:00.000Z");
    expect(minimal.district?.name).toBe("");
    expect(minimal.region?.name).toBe("Toshkent HQ");
    expect(minimal.market).toBeUndefined();
  });

  it("holat — ko'rsatish uchun backend holati («Sotilgan», «Yo'lda»), noma'lumi — «Yangi»", () => {
    const rows = mapBatchOrdersToPostOrders(
      batch(
        ["sold", "on_the_road", "waiting_customer", "cancelled (sent)", "—", "lost_in_space"].map((status, index) => ({
          id: String(index),
          receiver: "X",
          phone: "",
          address: "",
          price: 1,
          status,
        })),
      ),
    );
    expect(rows.map((row) => row.status)).toEqual(["sold", "on the road", "waiting_customer", "cancelled (sent)", "new", "new"]);
  });

  it("paket yo'q — bo'sh ro'yxat", () => {
    expect(mapBatchOrdersToPostOrders(undefined)).toEqual([]);
  });
});
