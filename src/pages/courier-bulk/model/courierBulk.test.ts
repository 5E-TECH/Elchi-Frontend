import { describe, expect, it } from "vitest";
import {
  extractCourierBulkOrders,
  extractCourierBulkTotal,
  filterCourierBulkOrders,
  getCourierBulkCancelOnlyTasks,
  getCourierBulkCounts,
  getCourierBulkFinalizeLabelCounts,
  getCourierBulkFinalizeTasks,
  getCourierBulkKept,
  getCourierBulkOrderAction,
  getCourierBulkUnmarkedCount,
  isCourierBulkOrderMarked,
  mergeCourierBulkOrders,
  runLimited,
  sortCourierBulkOrders,
  type CourierBulkAction,
  type CourierBulkOrder,
  type CourierBulkResultFilter,
} from "./courierBulk";

describe("courierBulk model", () => {
  it("extracts courier orders from common backend response shapes", () => {
    expect(extractCourierBulkOrders({ data: [{ id: "1" }] })).toHaveLength(1);
    expect(extractCourierBulkOrders({ data: { data: [{ id: "2" }] } })).toHaveLength(1);
    expect(extractCourierBulkOrders({ data: { items: [{ id: "3" }] } })).toHaveLength(1);
  });

  it("extracts total from paginated backend response shapes", () => {
    expect(extractCourierBulkTotal({ total: 240 })).toBe(240);
    expect(extractCourierBulkTotal({ data: { total: 241, data: [] } })).toBe(241);
    expect(extractCourierBulkTotal({ data: { meta: { total: 242 }, items: [] } })).toBe(242);
  });

  it("merges paginated orders without duplicates", () => {
    expect(mergeCourierBulkOrders([
      [{ id: "1" } as any, { id: "2" } as any],
      [{ id: "2" } as any, { id: "3" } as any],
    ]).map((order) => order.id)).toEqual(["1", "2", "3"]);
  });

  it("counts explicit and scanned actions; an unmarked order counts as «sold» (BeePost default)", () => {
    const counts = getCourierBulkCounts(
      [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }],
      { "1": "sold", "2": "cancel", "3": "tomorrow" },
    );

    // Belgilanmagan «4» — sukut «sotildi» (ega 2026-11-21, BeePost modeli; 2026-11-05 dagi «sukut yo'q» bekor).
    expect(counts).toEqual({ cancel: 1, sold: 2, tomorrow: 1, total: 4 });
    expect(getCourierBulkFinalizeLabelCounts(counts)).toEqual({ changed: 2, sold: 2 });
    expect(getCourierBulkOrderAction("1", { "1": "sold" })).toBe("sold");
    expect(getCourierBulkOrderAction("4", { "1": "sold" })).toBe("sold");
    expect(getCourierBulkOrderAction("4", { "4": "cancel" })).toBe("cancel");
  });

  it("nothing marked — every order is sold (one finalize task each), nothing is kept", () => {
    const orders = [{ id: "1" }, { id: "2" }, { id: "3" }];
    const counts = getCourierBulkCounts(orders, {});

    expect(counts).toEqual({ cancel: 0, sold: 3, tomorrow: 0, total: 3 });
    expect(getCourierBulkFinalizeLabelCounts(counts)).toEqual({ changed: 0, sold: 3 });
    expect(getCourierBulkFinalizeTasks(orders, {})).toEqual(orders.map((order) => ({ order, action: "sold" })));
    expect(getCourierBulkKept(orders, {})).toEqual({ tomorrow: [], replacement: [] });
    // «Belgilanmagan» — hali ham «qo'lda / skan bilan belgi qo'yilmagan» (ular sotiladi).
    expect(getCourierBulkUnmarkedCount(orders, {})).toBe(3);
  });

  it("owner's case (BeePost): 20 orders, only 5 «Bekor» and 5 «Ertaga» scanned — the other 10 are sold", () => {
    const orders = Array.from({ length: 20 }, (_, index) => ({ id: String(index + 1) }));
    const ids = (list: Array<{ id: string }>) => list.map((order) => order.id);
    const scanned: Record<string, CourierBulkAction> = {
      ...Object.fromEntries(orders.slice(10, 15).map((order) => [order.id, "cancel"])),
      ...Object.fromEntries(orders.slice(15).map((order) => [order.id, "tomorrow"])),
    };

    // Kuryer faqat qaytgan (bekor) va ertaga qoladiganlarni skanerlaydi — belgisiz 10 tasi sukut bo'yicha sotiladi.
    const tasks = getCourierBulkFinalizeTasks(orders, scanned);
    expect(tasks).toHaveLength(15);
    expect(tasks.filter((task) => task.action === "sold").map((task) => task.order.id)).toEqual(
      ids(orders.slice(0, 10)),
    );
    expect(tasks.filter((task) => task.action === "cancel").map((task) => task.order.id)).toEqual(
      ids(orders.slice(10, 15)),
    );
    expect(getCourierBulkCounts(orders, scanned)).toEqual({ cancel: 5, sold: 10, tomorrow: 5, total: 20 });
    expect(getCourierBulkUnmarkedCount(orders, scanned)).toBe(10);
    expect(ids(getCourierBulkKept(orders, scanned).tomorrow)).toEqual(ids(orders.slice(15)));
    expect(getCourierBulkKept(orders, scanned).replacement).toEqual([]);

    // Aniq «Sotildi» belgisi natijani o'zgartirmaydi (belgisiz ham sotiladi) — faqat «belgilanmagan» sonini kamaytiradi.
    const explicit: Record<string, CourierBulkAction> = {
      ...scanned,
      ...Object.fromEntries(orders.slice(0, 10).map((order) => [order.id, "sold"])),
    };
    expect(getCourierBulkFinalizeTasks(orders, explicit)).toEqual(tasks);
    expect(getCourierBulkCounts(orders, explicit)).toEqual(getCourierBulkCounts(orders, scanned));
    expect(getCourierBulkUnmarkedCount(orders, explicit)).toBe(0);
  });

  it("«Faqat bekorlar» — only explicit «Bekor» marks become tasks (no sold, no tomorrow)", () => {
    const orders = [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }];
    const actions: Record<string, CourierBulkAction> = { "1": "sold", "2": "cancel", "3": "tomorrow" };

    expect(getCourierBulkCancelOnlyTasks(orders, actions)).toEqual([{ order: orders[1], action: "cancel" }]);
    expect(getCourierBulkCancelOnlyTasks(orders, {})).toEqual([]);
  });

  it("counts unmarked orders (explicit «sold» is a mark; sell-blocked and scan-taken rows count too)", () => {
    const orders = [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }];
    const actions = { "2": "cancel", "3": "sold" } as const;

    expect(getCourierBulkUnmarkedCount(orders, actions)).toBe(2);
    expect(isCourierBulkOrderMarked("3", actions)).toBe(true);
    expect(isCourierBulkOrderMarked("4", actions)).toBe(false);
    expect(getCourierBulkUnmarkedCount([], actions)).toBe(0);

    // Eski mahsulot olinmagan almashtirish (lQjt6sKP) belgilanmagan bo'lsa ham «belgilanmagan» sanaladi, lekin sukut
    // «sotildi» uni sotmaydi — «Buyurtmalar»dan sotiladi guruhida. COURIER-SCAN: skan bilan olingan (hatto eski
    // «yo'lda») posilka — oddiy qator: to'siqsiz, belgilanmagan bo'lsa sotiladi.
    const replacement = { id: "5", replacement_of_order_id: "99", replacement_state: "awaiting_old_pickup" };
    const scanTaken = { id: "6", status: "on_the_road" };
    const mixed = [...orders, replacement, scanTaken];
    const ids = (list: Array<{ id: string }>) => list.map((order) => order.id);

    expect(getCourierBulkUnmarkedCount(mixed, actions)).toBe(4);
    expect(getCourierBulkKept(mixed, actions)).toEqual({ tomorrow: [], replacement: [replacement] });
    expect(getCourierBulkCounts(mixed, actions)).toEqual({ cancel: 1, sold: 4, tomorrow: 0, total: 6 });
    expect(ids(getCourierBulkFinalizeTasks(mixed, actions).map((task) => task.order))).toEqual(["1", "2", "3", "4", "6"]);

    // Almashtirish aniq «Sotildi» belgilansa — belgilangan, lekin baribir «Buyurtmalar»dan sotiladi guruhida.
    const replacementSold = { ...actions, "5": "sold" } as const;
    expect(getCourierBulkUnmarkedCount(mixed, replacementSold)).toBe(3);
    expect(ids(getCourierBulkKept(mixed, replacementSold).replacement)).toEqual(["5"]);
    expect(getCourierBulkFinalizeTasks(mixed, replacementSold)).toEqual(getCourierBulkFinalizeTasks(mixed, actions));

    // Kuryer qo'lidagi buyurtma endi to'silmaydi (LC-04, 2026-11-21 — menejer kuryer nomidan sotadi): belgisiz ham,
    // aniq «Sotildi» ham — yuboriladi.
    const courierHeld = { id: "7", courier_id: "41", holder_type: "COURIER", holder_courier_id: "41" };
    expect(getCourierBulkKept([courierHeld], {})).toEqual({ tomorrow: [], replacement: [] });
    expect(getCourierBulkFinalizeTasks([courierHeld], {})).toEqual([{ order: courierHeld, action: "sold" }]);
    expect(getCourierBulkFinalizeTasks([courierHeld], { "7": "sold" })).toEqual([{ order: courierHeld, action: "sold" }]);
  });

  it("filters by search (name, phone digits, id) and result — client-side", () => {
    const orders = [
      { id: "10240", customer: { name: "Laylo Hasanova", phone_number: "+998902146631" } },
      { id: "10238", customer: { name: "Javohir Toshmatov", phone_number: "+998977013345" } },
      { id: "10236", customer: { name: "Kamron Ahmedov", phone_number: "+998931182047" } },
    ] as unknown as CourierBulkOrder[];
    const actions = { "10238": "tomorrow", "10236": "sold" } as const;
    const ids = (query: string, result: CourierBulkResultFilter = "all") =>
      filterCourierBulkOrders(orders, actions, { query, result }).map((order) => order.id);

    expect(ids("")).toEqual(["10240", "10238", "10236"]);
    expect(ids("laylo")).toEqual(["10240"]);
    expect(ids("90 214")).toEqual(["10240"]);
    expect(ids("№10236")).toEqual(["10236"]);
    expect(ids("", "unmarked")).toEqual(["10240"]);
    // «Sotiladi» — aniq «Sotildi» belgilangani VA belgilanmagan «10240» (sukut «sotildi», BeePost modeli).
    expect(ids("", "sold")).toEqual(["10240", "10236"]);
    expect(ids("laylo", "sold")).toEqual(["10240"]);
    expect(ids("laylo", "unmarked")).toEqual(["10240"]);
    expect(ids("", "tomorrow")).toEqual(["10238"]);
    expect(ids("", "cancel")).toEqual([]);
    expect(ids("javohir", "sold")).toEqual([]);
  });

  it("«unmarked» filter lists every unmarked row (sell-blocked too); «sold» skips sell-blocked «Sotildi» rows", () => {
    const orders = [
      { id: "1" },
      { id: "2", replacement_of_order_id: "99", replacement_state: "awaiting_old_pickup" },
      { id: "3", replacement_of_order_id: "98", replacement_state: "awaiting_old_pickup" },
      { id: "4", status: "on_the_road" },
      { id: "5" },
    ] as unknown as CourierBulkOrder[];
    const actions = { "3": "sold", "5": "sold" } as const;
    const ids = (result: CourierBulkResultFilter) =>
      filterCourierBulkOrders(orders, actions, { query: "", result }).map((order) => order.id);

    // Belgilanmagan almashtirish «2» ham «Belgilanmagan»da; COURIER-SCAN: skan bilan olingan «4» ham oddiy belgilanmagan
    // qator. «Sotiladi» — belgisizlar ham (sukut), lekin sotib bo'lmaydigan almashtirish («2» belgisiz, «3» aniq
    // «Sotildi») unga kirmaydi.
    expect(ids("unmarked")).toEqual(["1", "2", "4"]);
    expect(ids("sold")).toEqual(["1", "4", "5"]);
    expect(ids("all")).toEqual(["1", "2", "3", "4", "5"]);
    expect(getCourierBulkUnmarkedCount(orders, actions)).toBe(ids("unmarked").length);
  });

  it("sorts by date or amount, stable; null keeps backend order", () => {
    const orders = [
      { id: "a", total_price: 300, createdAt: "2026-10-15T08:00:00.000Z" },
      { id: "b", total_price: 100, created_at: "2026-10-16T08:00:00.000Z" },
      { id: "c", total_price: 300, createdAt: "2026-10-14T08:00:00.000Z" },
    ] as unknown as CourierBulkOrder[];
    const ids = (sort: Parameters<typeof sortCourierBulkOrders>[1]) =>
      sortCourierBulkOrders(orders, sort).map((order) => order.id);

    expect(ids({ key: "createdAt", direction: "desc" })).toEqual(["b", "a", "c"]);
    expect(ids({ key: "createdAt", direction: "asc" })).toEqual(["c", "a", "b"]);
    expect(ids({ key: "amount", direction: "desc" })).toEqual(["a", "c", "b"]);
    expect(ids({ key: "amount", direction: "asc" })).toEqual(["b", "a", "c"]);
    expect(ids(null)).toEqual(["a", "b", "c"]);
  });

  it("runs tasks with a limited queue", async () => {
    const handled: number[] = [];
    const results = await runLimited([1, 2, 3], 2, async (item) => {
      handled.push(item);
    });

    expect(handled.sort()).toEqual([1, 2, 3]);
    expect(results).toHaveLength(3);
    expect(results.every((result) => result.status === "fulfilled")).toBe(true);
  });
});
