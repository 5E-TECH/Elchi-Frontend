import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addToDispatchBasket,
  DISPATCH_BASKET_TTL_MS,
  dispatchBasketStorageKey,
  isInDispatchBasket,
  readDispatchBasket,
  removeFromDispatchBasket,
  resetDispatchBaskets,
  setDispatchBasketSelected,
  useDispatchBasket,
} from "./dispatchBasket";
import { normalizeDispatchOrder, type DispatchOrder } from "./dispatchOrder";

/** Kuryerga biriktirish savati qurilmada (ega qarori D2, skaner 2-bosqich). */

const SCOPE = { userId: "198", branchId: "15" };
const order = (id: string, token = `tok-${id}`): DispatchOrder => ({
  id,
  token,
  market: "Baraka Shop",
  name: "Zarina Mirzayeva",
  phone: null,
  district: "Chilonzor tumani",
  region: null,
  amount: 185000,
  deliveryKind: "home",
  createdAt: null,
  status: "received",
});

const stored = (scope = SCOPE) => {
  const raw = window.localStorage.getItem(dispatchBasketStorageKey(scope));
  return raw ? (JSON.parse(raw) as { items: { order: DispatchOrder; selected: boolean; addedAt: number }[] }) : null;
};

beforeEach(() => {
  window.localStorage.clear();
  resetDispatchBaskets();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("dispatchBasket", () => {
  it("qo'shilgan buyurtma tanlangan holda qurilmaga yoziladi; kalit — foydalanuvchi + filial", () => {
    expect(addToDispatchBasket(SCOPE, order("10285"), 1000)).toBe("added");

    expect(dispatchBasketStorageKey(SCOPE)).toBe("elchi:dispatch-basket:v1:198:15");
    expect(stored()?.items).toEqual([{ order: order("10285"), selected: true, addedAt: 1000 }]);
    expect(readDispatchBasket({ userId: "198", branchId: "16" })).toEqual([]);
    expect(readDispatchBasket({ userId: "199", branchId: "15" })).toEqual([]);
  });

  it("takror (raqami yoki tokeni) — qayta qo'shilmaydi, faqat tanlanadi", () => {
    addToDispatchBasket(SCOPE, order("10285"));
    setDispatchBasketSelected(SCOPE, ["10285"], false);

    expect(addToDispatchBasket(SCOPE, order("10285", "TOK-10285"))).toBe("duplicate");
    expect(readDispatchBasket(SCOPE)).toHaveLength(1);
    expect(readDispatchBasket(SCOPE)[0].selected).toBe(true);
    expect(isInDispatchBasket(SCOPE, "TOK-10285")).toBe(true);
    expect(isInDispatchBasket(SCOPE, "10285")).toBe(true);
    expect(isInDispatchBasket(SCOPE, "tok-10286")).toBe(false);
  });

  it("yangi sessiya savatni qurilmadan o'qiydi; eskirgan va buzilgan yozuvlar tashlanib, qayta yoziladi", () => {
    const now = Date.now();
    window.localStorage.setItem(
      dispatchBasketStorageKey(SCOPE),
      JSON.stringify({
        items: [
          { order: order("1"), selected: true, addedAt: now - DISPATCH_BASKET_TTL_MS - 1 },
          { order: { id: "2" }, selected: true, addedAt: now },
          { order: order("3"), selected: false, addedAt: now - 1000 },
          { order: order("3"), selected: true, addedAt: now },
          "buzilgan",
        ],
      }),
    );

    const items = readDispatchBasket(SCOPE);
    expect(items.map((item) => [item.order.id, item.selected])).toEqual([["3", false]]);
    expect(stored()?.items.map((item) => item.order.id)).toEqual(["3"]);
  });

  it("JSON emas — bo'sh savat, xato chiqmaydi", () => {
    window.localStorage.setItem(dispatchBasketStorageKey(SCOPE), "{buzilgan");
    expect(readDispatchBasket(SCOPE)).toEqual([]);
  });

  it("localStorage yopiq — savat shu sessiyada xotirada ishlayveradi", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    expect(addToDispatchBasket(SCOPE, order("10285"))).toBe("added");
    expect(readDispatchBasket(SCOPE).map((item) => item.order.id)).toEqual(["10285"]);
  });

  it("olib tashlash va tanlov", () => {
    addToDispatchBasket(SCOPE, order("1"));
    addToDispatchBasket(SCOPE, order("2"));
    setDispatchBasketSelected(SCOPE, ["1", "2"], false);
    expect(readDispatchBasket(SCOPE).every((item) => !item.selected)).toBe(true);

    removeFromDispatchBasket(SCOPE, ["1"]);
    expect(readDispatchBasket(SCOPE).map((item) => item.order.id)).toEqual(["2"]);
    removeFromDispatchBasket(SCOPE, ["2"]);
    expect(window.localStorage.getItem(dispatchBasketStorageKey(SCOPE))).toBeNull();
  });

  it("useDispatchBasket: o'zgarish va boshqa varaqdagi yozuv (`storage` hodisasi) darhol ko'rinadi", () => {
    const { result } = renderHook(() => useDispatchBasket(SCOPE));
    expect(result.current.orders).toEqual([]);

    act(() => {
      result.current.add(order("10285"));
    });
    expect(result.current.orders.map((item) => item.id)).toEqual(["10285"]);
    expect([...result.current.selectedIds]).toEqual(["10285"]);

    // Boshqa varaq savatga yana bittasini qo'shdi.
    const key = dispatchBasketStorageKey(SCOPE);
    window.localStorage.setItem(
      key,
      JSON.stringify({
        items: [...(stored()?.items ?? []), { order: order("10286"), selected: false, addedAt: Date.now() }],
      }),
    );
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key }));
    });
    expect(result.current.orders.map((item) => item.id)).toEqual(["10285", "10286"]);
    expect([...result.current.selectedIds]).toEqual(["10285"]);
  });

  it("normalizeDispatchOrder: skan javobidan savat qatori", () => {
    expect(
      normalizeDispatchOrder(
        {
          statusCode: 200,
          data: {
            id: 10285,
            total_price: "185000",
            where_deliver: "center",
            customer: { name: "Zarina", phone_number: "+998907421836" },
            district: { name: "Chilonzor tumani", region: { name: "Toshkent sh." } },
            market: { name: "Baraka Shop" },
          },
        },
        "tok",
      ),
    ).toMatchObject({ id: "10285", token: "tok", amount: 185000, deliveryKind: "center", region: "Toshkent sh." });
  });
});
