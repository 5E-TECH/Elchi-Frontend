import { describe, expect, it } from "vitest";
import {
  extractCouriers,
  filterCouriers,
  getBranchStem,
  getDispatchErrorMessage,
  getDispatchStats,
  normalizeDispatchOrder,
  readDeliveryKind,
  type DispatchOrder,
} from "./dispatchModel";

const order = (id: string, amount: number, deliveryKind: DispatchOrder["deliveryKind"]): DispatchOrder => ({
  id,
  token: `tok-${id}`,
  market: null,
  name: null,
  phone: null,
  district: null,
  region: null,
  amount,
  deliveryKind,
  createdAt: null,
  status: null,
});

describe("dispatchModel", () => {
  it("skan javobidan qator: ichma-ich `data`, mijoz, tuman/viloyat, xom yetkazish turi va sana", () => {
    const row = normalizeDispatchOrder(
      {
        statusCode: 200,
        data: {
          id: 10285,
          status: "received",
          total_price: "185000",
          where_deliver: "address",
          created_at: "2026-10-06T14:05:00.000Z",
          customer: { name: "Zarina Mirzayeva", phone_number: "+998907421836" },
          district: { name: "Chilonzor tumani", region: { name: "Toshkent sh." } },
          market: { name: "Baraka Shop" },
        },
      },
      "tok-1",
    );

    expect(row).toEqual({
      id: "10285",
      token: "tok-1",
      market: "Baraka Shop",
      name: "Zarina Mirzayeva",
      phone: "+998907421836",
      district: "Chilonzor tumani",
      region: "Toshkent sh.",
      amount: 185000,
      deliveryKind: "home",
      createdAt: "2026-10-06T14:05:00.000Z",
      status: "received",
    });
    expect(normalizeDispatchOrder({ data: { status: "new" } }, "tok-2")).toBeNull();
  });

  it("yetkazish turi xom qiymatdan (tarjima matnidan emas)", () => {
    expect(readDeliveryKind("address")).toBe("home");
    expect(readDeliveryKind("home")).toBe("home");
    expect(readDeliveryKind("CENTER")).toBe("center");
    expect(readDeliveryKind("Uygacha")).toBeNull();
    expect(readDeliveryKind(undefined)).toBeNull();
  });

  it("ko'rsatkichlar: tanlangan, uygacha, markazgacha va summalar", () => {
    const stats = getDispatchStats(
      [order("1", 100, "home"), order("2", 200, "center"), order("3", 300, "home"), order("4", 50, null)],
      new Set(["1", "2"]),
    );

    expect(stats).toEqual({
      total: 4,
      selected: 2,
      selectedAmount: 300,
      home: 2,
      homeAmount: 400,
      center: 1,
      centerAmount: 200,
    });
  });

  it("kuryerlar: `GET /couriers` elementi — ism, telefon, viloyat; ismsiz bo'lsa telefon", () => {
    expect(
      extractCouriers({
        data: {
          items: [
            { id: "263", name: "Jasur Tursunov", phone_number: "+998904121855", region: { id: "1", name: "Toshkent sh." } },
            { id: "264", phone_number: "+998932204710", region: null },
            { name: "id yo'q" },
          ],
        },
      }),
    ).toEqual([
      { id: "263", name: "Jasur Tursunov", phone: "+998904121855", region: "Toshkent sh." },
      { id: "264", name: "+998932204710", phone: "+998932204710", region: null },
    ]);
  });

  it("kuryer qidiruvi: ism (katta-kichik harfsiz) va telefon raqamlari bo'yicha", () => {
    const couriers = [
      { id: "1", name: "Jasur Tursunov", phone: "+998904121855", region: null },
      { id: "2", name: "Sherzod Komilov", phone: "+998932204710", region: null },
    ];

    expect(filterCouriers(couriers, "  ").map((c) => c.id)).toEqual(["1", "2"]);
    expect(filterCouriers(couriers, "sherzod").map((c) => c.id)).toEqual(["2"]);
    expect(filterCouriers(couriers, "90 412").map((c) => c.id)).toEqual(["1"]);
    expect(filterCouriers(couriers, "Ali")).toEqual([]);
  });

  it("filial nomi: oxiridagi «filiali» olib tashlanadi", () => {
    expect(getBranchStem("Urgut filiali")).toBe("Urgut");
    expect(getBranchStem("Toshkent HQ")).toBe("Toshkent HQ");
    expect(getBranchStem("  ")).toBeNull();
    expect(getBranchStem(null)).toBeNull();
  });

  it("biriktirish xatosi: buyurtmalar bo'yicha ro'yxat yoki backend matni", () => {
    expect(
      getDispatchErrorMessage(
        { response: { data: { errors: [{ order_id: 10241, message: "kuryerda" }, { id: 10242 }] } } },
        "zaxira",
      ),
    ).toBe("10241: kuryerda; 10242: zaxira");
    expect(getDispatchErrorMessage({ response: { data: { message: "Ruxsat yo'q" } } }, "zaxira")).toBe("Ruxsat yo'q");
    expect(getDispatchErrorMessage(null, "zaxira")).toBe("zaxira");
  });
});
