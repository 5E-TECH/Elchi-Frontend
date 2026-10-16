import { describe, expect, it } from "vitest";
import {
  DEFAULT_MARKET_ORDERS_SORT,
  matchesMarketOrderSearch,
  pickUnselectedPreview,
  readMarketName,
  readOrderDistrict,
  readOrderRegion,
  readProductLines,
  readUserBranchName,
  sortMarketOrders,
  sumTotalPrice,
  type MarketOrder,
} from "./marketOrdersModel";

const order = (patch: Partial<MarketOrder> & { id: string }): MarketOrder => ({
  status: "new",
  where_deliver: "address",
  total_price: 100000,
  paid_amount: 0,
  to_be_paid: 100000,
  createdAt: "2026-10-16T09:00:00.000Z",
  comment: null,
  address: null,
  items: [],
  customer: { id: `c-${patch.id}`, name: "Zarina Qosimova", phone_number: "+998902143658" },
  ...patch,
});

describe("marketOrdersModel — qidiruv", () => {
  const zarina = order({ id: "10257", order_number: "EL-100081" });

  it.each([
    ["mijoz ismi (registrsiz)", "zarina"],
    ["buyurtma raqami", "10257"],
    ["«№» bilan raqam", "№10257"],
    ["inson o'qiydigan raqam", "el-1000"],
    ["telefon — bo'sh joy bilan", "90 214"],
    ["telefon — to'liq", "+998 90 214 36 58"],
  ])("%s bo'yicha topadi", (_label, query) => {
    expect(matchesMarketOrderSearch(zarina, query)).toBe(true);
  });

  it("bo'sh qidiruv — hammasi", () => {
    expect(matchesMarketOrderSearch(zarina, "   ")).toBe(true);
  });

  it("mos kelmasa — yo'q", () => {
    expect(matchesMarketOrderSearch(zarina, "Rustam")).toBe(false);
    expect(matchesMarketOrderSearch(zarina, "93 571")).toBe(false);
  });

  it("qo'shimcha raqam bo'yicha ham topadi", () => {
    const withExtra = order({
      id: "1",
      customer: { id: "c", name: "Ali", phone_number: "+998901112233", extra_number: "+998935712044" },
    });
    expect(matchesMarketOrderSearch(withExtra, "93 571")).toBe(true);
  });
});

describe("marketOrdersModel — saralash va summa", () => {
  const a = order({ id: "a", createdAt: "2026-10-16T09:15:00.000Z", total_price: 141500 });
  const b = order({ id: "b", createdAt: "2026-10-16T14:40:00.000Z", total_price: 185000 });
  const c = order({ id: "c", createdAt: "2026-10-16T12:10:00.000Z", total_price: 232500 });

  it("sukut — yangilari tepada", () => {
    expect(sortMarketOrders([a, b, c], DEFAULT_MARKET_ORDERS_SORT).map((o) => o.id)).toEqual(["b", "c", "a"]);
  });

  it("asc — eskilari tepada; null — kelgan tartib", () => {
    expect(sortMarketOrders([a, b, c], { key: "createdAt", direction: "asc" }).map((o) => o.id)).toEqual([
      "a",
      "c",
      "b",
    ]);
    expect(sortMarketOrders([a, b, c], null).map((o) => o.id)).toEqual(["a", "b", "c"]);
  });

  it("summa", () => {
    expect(sumTotalPrice([a, b, c])).toBe(559000);
    expect(sumTotalPrice([])).toBe(0);
  });
});

describe("marketOrdersModel — joy va mahsulotlar", () => {
  it("tuman/viloyat: buyurtmada bo'lmasa — mijozda", () => {
    const own = order({ id: "1", district: { name: "Chilonzor tumani" }, region: { name: "Toshkent sh." } });
    const fromCustomer = order({
      id: "2",
      customer: {
        id: "c",
        name: "Ali",
        phone_number: "+998901112233",
        district: { name: "Urgut tumani" },
        region: { name: "Samarqand" },
      },
    });
    expect([readOrderDistrict(own), readOrderRegion(own)]).toEqual(["Chilonzor tumani", "Toshkent sh."]);
    expect([readOrderDistrict(fromCustomer), readOrderRegion(fromCustomer)]).toEqual(["Urgut tumani", "Samarqand"]);
    expect(readOrderDistrict(order({ id: "3" }))).toBeNull();
  });

  it("katalogsiz mahsulot nomi `product_name` dan", () => {
    const lines = readProductLines(
      order({
        id: "1",
        items: [
          { id: "i1", quantity: 2, product: { id: "p1", name: "Telefon g'ilofi", image_url: null } },
          { id: "i2", quantity: 1, product: null, product_name: "Himoya oynasi" },
          { id: "i3", quantity: 1 },
        ],
      }),
    );
    expect(lines).toEqual([
      { key: "i1", name: "Telefon g'ilofi", quantity: 2 },
      { key: "i2", name: "Himoya oynasi", quantity: 1 },
      { key: "i3", name: "—", quantity: 1 },
    ]);
  });
});

describe("marketOrdersModel — qabul oynasi", () => {
  const orders = ["10257", "10256", "10255", "10254", "10253", "10252"].map((id) => order({ id }));

  it("tanlanmaganlar: soni va 3 tagacha raqam", () => {
    expect(pickUnselectedPreview(orders, new Set(["10257", "10256", "10255", "10254", "10253"]))).toEqual({
      count: 1,
      ids: ["10252"],
      more: false,
    });
    expect(pickUnselectedPreview(orders, new Set(["10257"]))).toEqual({
      count: 5,
      ids: ["10256", "10255", "10254"],
      more: true,
    });
    expect(pickUnselectedPreview(orders, new Set(orders.map((o) => o.id))).count).toBe(0);
  });
});

describe("marketOrdersModel — nomlar", () => {
  it("market nomi: buyurtmadan, bo'lmasa markets/new ro'yxatidan", () => {
    const withMarket = order({ id: "1", market: { id: "121", name: "Ipak Yo'li Savdo" } });
    expect(readMarketName([withMarket], undefined, "121")).toBe("Ipak Yo'li Savdo");

    const list = { data: [{ market_id: "121", market: { name: "Urgut Savdo" } }] };
    expect(readMarketName([], list, "121")).toBe("Urgut Savdo");
    expect(readMarketName([], list.data, 121)).toBe("Urgut Savdo");
    expect(readMarketName([], list, "999")).toBeNull();
    expect(readMarketName([], undefined, "121")).toBeNull();
  });

  it("xodim filiali nomi (ichma-ich `branch.branch` ham)", () => {
    expect(readUserBranchName({ branch: { branch: { name: "Toshkent HQ" } } })).toBe("Toshkent HQ");
    expect(readUserBranchName({ branch: { name: "Urgut filiali" } })).toBe("Urgut filiali");
    expect(readUserBranchName({ id: "1" })).toBeNull();
    expect(readUserBranchName(null)).toBeNull();
  });
});
