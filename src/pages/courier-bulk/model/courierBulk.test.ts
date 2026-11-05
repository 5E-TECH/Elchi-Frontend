import { describe, expect, it } from "vitest";
import {
  extractCourierBulkOrders,
  extractCourierBulkTotal,
  filterCourierBulkOrders,
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

  it("counts explicit and scanned actions; an unmarked order counts only in total (no default «sold»)", () => {
    const counts = getCourierBulkCounts(
      [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }],
      { "1": "sold", "2": "cancel", "3": "tomorrow" },
    );

    // Belgilanmagan «4» hech qaysi natijaga kirmaydi — faqat jami (ega 2026-11-05: sukut natija yo'q).
    expect(counts).toEqual({ cancel: 1, sold: 1, tomorrow: 1, total: 4 });
    expect(getCourierBulkFinalizeLabelCounts(counts)).toEqual({ changed: 2, sold: 1 });
    expect(getCourierBulkOrderAction("1", { "1": "sold" })).toBe("sold");
    expect(getCourierBulkOrderAction("4", { "1": "sold" })).toBeNull();
  });

  it("nothing marked — nothing is sold and no finalize request is made", () => {
    const orders = [{ id: "1" }, { id: "2" }, { id: "3" }];
    const counts = getCourierBulkCounts(orders, {});

    expect(counts).toEqual({ cancel: 0, sold: 0, tomorrow: 0, total: 3 });
    expect(getCourierBulkFinalizeLabelCounts(counts)).toEqual({ changed: 0, sold: 0 });
    expect(getCourierBulkFinalizeTasks(orders, {})).toEqual([]);
    expect(getCourierBulkKept(orders, {})).toEqual({
      unmarked: orders,
      tomorrow: [],
      replacement: [],
      courierHeld: [],
      awaitingPost: [],
    });
    expect(getCourierBulkUnmarkedCount(orders, {})).toBe(3);
  });

  it("owner's case: 20 orders, only 10 marked «Sotildi» — the other 10 are NOT sold", () => {
    const orders = Array.from({ length: 20 }, (_, index) => ({ id: String(index + 1) }));
    const ids = (list: Array<{ id: string }>) => list.map((order) => order.id);
    const sold: Record<string, CourierBulkAction> = Object.fromEntries(
      orders.slice(0, 10).map((order) => [order.id, "sold"]),
    );

    // Ilgari belgilanmagan 10 tasi ham «sotildi» bo'lib ketardi; endi faqat belgilangan 10 tasiga so'rov ketadi.
    const soldTasks = getCourierBulkFinalizeTasks(orders, sold);
    expect(soldTasks).toHaveLength(10);
    expect(soldTasks.map((task) => task.order.id)).toEqual(ids(orders.slice(0, 10)));
    expect(soldTasks.every((task) => task.action === "sold")).toBe(true);
    expect(getCourierBulkCounts(orders, sold)).toEqual({ cancel: 0, sold: 10, tomorrow: 0, total: 20 });
    expect(getCourierBulkUnmarkedCount(orders, sold)).toBe(10);
    expect(ids(getCourierBulkKept(orders, sold).unmarked)).toEqual(ids(orders.slice(10)));

    // Qolgan 10 tasidan 5 tasi «Bekor», 5 tasi «Ertaga» belgilansa: 10 sotildi + 5 bekor so'rovi, «ertaga» — so'rovsiz.
    const marked: Record<string, CourierBulkAction> = {
      ...sold,
      ...Object.fromEntries(orders.slice(10, 15).map((order) => [order.id, "cancel"])),
      ...Object.fromEntries(orders.slice(15).map((order) => [order.id, "tomorrow"])),
    };
    const markedTasks = getCourierBulkFinalizeTasks(orders, marked);
    expect(markedTasks).toHaveLength(15);
    expect(markedTasks.filter((task) => task.action === "sold").map((task) => task.order.id)).toEqual(
      ids(orders.slice(0, 10)),
    );
    expect(markedTasks.filter((task) => task.action === "cancel").map((task) => task.order.id)).toEqual(
      ids(orders.slice(10, 15)),
    );
    expect(getCourierBulkCounts(orders, marked)).toEqual({ cancel: 5, sold: 10, tomorrow: 5, total: 20 });
    expect(getCourierBulkUnmarkedCount(orders, marked)).toBe(0);
    expect(getCourierBulkKept(orders, marked).unmarked).toEqual([]);
    expect(ids(getCourierBulkKept(orders, marked).tomorrow)).toEqual(ids(orders.slice(15)));
  });

  it("counts unmarked orders (explicit «sold» is a mark; sell-blocked rows count, awaiting-post rows do not)", () => {
    const orders = [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }];
    const actions = { "2": "cancel", "3": "sold" } as const;

    expect(getCourierBulkUnmarkedCount(orders, actions)).toBe(2);
    expect(isCourierBulkOrderMarked("3", actions)).toBe(true);
    expect(isCourierBulkOrderMarked("4", actions)).toBe(false);
    expect(getCourierBulkUnmarkedCount([], actions)).toBe(0);

    // Eski mahsulot olinmagan almashtirish (lQjt6sKP) belgilanmagan bo'lsa — endi u ham «belgilanmagan» sanaladi
    // (sukut «sotildi» yo'q, u ham o'zgarmaydi); pochtasi qabul qilinmagan posilka sanalmaydi — uni belgilab bo'lmaydi.
    const replacement = { id: "5", replacement_of_order_id: "99", replacement_state: "awaiting_old_pickup" };
    const awaitingPost = { id: "6", status: "on_the_road" };
    const mixed = [...orders, replacement, awaitingPost];
    const ids = (list: Array<{ id: string }>) => list.map((order) => order.id);

    expect(getCourierBulkUnmarkedCount(mixed, actions)).toBe(3);
    expect(getCourierBulkKept(mixed, actions)).toEqual({
      unmarked: [orders[0], orders[3], replacement],
      tomorrow: [],
      replacement: [],
      courierHeld: [],
      awaitingPost: [awaitingPost],
    });
    expect(getCourierBulkCounts(mixed, actions)).toEqual({ cancel: 1, sold: 1, tomorrow: 0, total: 6 });
    expect(ids(getCourierBulkFinalizeTasks(mixed, actions).map((task) => task.order))).toEqual(["2", "3"]);

    // Almashtirish aniq «Sotildi» belgilansa — «Buyurtmalar»dan sotiladi guruhiga o'tadi, belgilanmagan emas.
    const replacementSold = { ...actions, "5": "sold" } as const;
    expect(getCourierBulkUnmarkedCount(mixed, replacementSold)).toBe(2);
    expect(ids(getCourierBulkKept(mixed, replacementSold).unmarked)).toEqual(["1", "4"]);
    expect(ids(getCourierBulkKept(mixed, replacementSold).replacement)).toEqual(["5"]);

    // Menejerda kuryer qo'lidagi buyurtma (LC-04): belgilanmagan — «unmarked», faqat aniq «Sotildi» — «courierHeld».
    const courierHeld = { id: "7", courier_id: "41" };
    expect(ids(getCourierBulkKept([courierHeld], {}, "manager").unmarked)).toEqual(["7"]);
    expect(getCourierBulkKept([courierHeld], {}, "manager").courierHeld).toEqual([]);
    expect(ids(getCourierBulkKept([courierHeld], { "7": "sold" }, "manager").courierHeld)).toEqual(["7"]);
    expect(getCourierBulkFinalizeTasks([courierHeld], {}, "manager")).toEqual([]);
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
    // «Sotiladi» — faqat aniq «Sotildi» belgilangani; belgilanmagan «10240» bu yerga kirmaydi (sukut natija yo'q).
    expect(ids("", "sold")).toEqual(["10236"]);
    expect(ids("laylo", "sold")).toEqual([]);
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

    // Belgilanmagan almashtirish «2» ham «Belgilanmagan»da (u ham o'zgarmaydi); pochtasi qabul qilinmagan «4» — faqat
    // «Barchasi»da; sotib bo'lmaydigan «Sotildi» belgili «3» — «Sotiladi»ga kirmaydi.
    expect(ids("unmarked")).toEqual(["1", "2"]);
    expect(ids("sold")).toEqual(["5"]);
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
