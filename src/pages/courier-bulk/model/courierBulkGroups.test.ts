import { describe, expect, it } from "vitest";
import {
  COURIER_BULK_BRANCH_GROUP,
  COURIER_BULK_SELF_GROUP,
  COURIER_BULK_UNKNOWN_COURIER_GROUP,
  getCourierBulkFinalizeGroups,
  getCourierBulkFinalizeTasks,
  getCourierBulkGroupKey,
  getCourierBulkKept,
  splitCourierBulkByGroups,
  type CourierBulkAction,
  type CourierBulkGroupOrder,
} from "./courierBulk";

/**
 * #4 (audit): menejer «Kunni yakunlash» bilan filialdagi barcha kuryerlarning buyurtmalarini bir bosishda yakunlaydi.
 * Tasdiq oynasida kuryerlar bo'yicha jadval — kim nomidan nechta sotiladi / bekor / qoladi va kassaga qancha; katagi
 * olib tashlangan kuryerning buyurtmalariga so'rov ketmaydi. Guruh kaliti backend LC-04 tartibi bilan bir xil.
 */

type Order = CourierBulkGroupOrder & Record<string, unknown>;

const ALI = { id: "11", name: "Ali Valiyev", phone_number: "+998900000011" };
const VALI = { id: "12", name: "Vali Aliyev", phone_number: "+998900000012" };

const held = (id: string, courier: typeof ALI, over: Partial<Order> = {}): Order => ({
  id,
  total_price: 100000,
  holder_type: "COURIER",
  holder_courier_id: courier.id,
  courier_id: courier.id,
  courier,
  ...over,
});

const atBranch = (id: string, over: Partial<Order> = {}): Order => ({
  id,
  total_price: 50000,
  holder_type: "BRANCH",
  holder_courier_id: null,
  courier_id: null,
  courier: null,
  ...over,
});

const groupsOf = (orders: Order[], actions: Record<string, CourierBulkAction>, viewer: "manager" | "courier") => {
  const tasks = getCourierBulkFinalizeTasks(orders, actions);
  const kept = getCourierBulkKept(orders, actions);
  return getCourierBulkFinalizeGroups(tasks, [...kept.tomorrow, ...kept.replacement], viewer);
};

describe("getCourierBulkGroupKey — backend LC-04 kuryer tartibi", () => {
  it("custody egasi birinchi: buyurtma boshqa kuryerga o'tgan bo'lsa — qo'lida turgan kuryer", () => {
    // Biriktirilgan kuryer Ali, lekin posilka hozir Valida (custody) — backend Vali nomidan sotadi.
    expect(getCourierBulkGroupKey(held("1", ALI, { holder_courier_id: VALI.id }), "manager")).toBe("courier:12");
  });

  it("custody bo'sh — biriktirilgan kuryer, u ham bo'sh — pochta kuryeri (`courier.id`)", () => {
    expect(getCourierBulkGroupKey(held("1", ALI, { holder_courier_id: null }), "manager")).toBe("courier:11");
    expect(
      getCourierBulkGroupKey(held("1", ALI, { holder_courier_id: "0", courier_id: null }), "manager"),
    ).toBe("courier:11");
  });

  it("kuryer qo'lida, lekin kuryeri aniqlanmadi — alohida guruh", () => {
    expect(
      getCourierBulkGroupKey(
        { id: "1", holder_type: "COURIER", holder_courier_id: null, courier_id: null, courier: null },
        "manager",
      ),
    ).toBe(COURIER_BULK_UNKNOWN_COURIER_GROUP);
  });

  it("filialda turgan — filial guruhi; kuryer o'z sahifasida — doim o'zi", () => {
    expect(getCourierBulkGroupKey(atBranch("1"), "manager")).toBe(COURIER_BULK_BRANCH_GROUP);
    expect(getCourierBulkGroupKey(held("1", ALI), "courier")).toBe(COURIER_BULK_SELF_GROUP);
    expect(getCourierBulkGroupKey(atBranch("1"), "courier")).toBe(COURIER_BULK_SELF_GROUP);
  });
});

describe("getCourierBulkFinalizeGroups", () => {
  it("har kuryer bo'yicha: sotildi / bekor / qoladi va sotiladiganlar summasi; filial oxirida", () => {
    const orders = [
      atBranch("1", { total_price: 70000 }),
      held("2", VALI, { total_price: 120000 }),
      held("3", ALI, { total_price: 150000 }),
      held("4", ALI, { total_price: 99999.5 }),
      held("5", ALI),
      held("6", ALI),
      // Almashtirish — bu yerdan sotilmaydi, kutilmoqda qoladi.
      held("7", VALI, { replacement_of_order_id: "81", replacement_state: "awaiting_old_pickup" }),
    ];
    const groups = groupsOf(orders, { "5": "cancel", "6": "tomorrow" }, "manager");

    expect(groups).toEqual([
      {
        key: "courier:11",
        kind: "courier",
        courierId: "11",
        name: "Ali Valiyev",
        sold: 2,
        cancel: 1,
        kept: 1,
        soldAmount: 249999.5,
      },
      {
        key: "courier:12",
        kind: "courier",
        courierId: "12",
        name: "Vali Aliyev",
        sold: 1,
        cancel: 0,
        kept: 1,
        soldAmount: 120000,
      },
      {
        key: COURIER_BULK_BRANCH_GROUP,
        kind: "branch",
        courierId: null,
        name: null,
        sold: 1,
        cancel: 0,
        kept: 0,
        soldAmount: 70000,
      },
    ]);
  });

  it("kuryer ismi uning o'z buyurtmasidan olinadi (custody bo'yicha guruhda `courier` boshqa bo'lsa)", () => {
    // 1-buyurtma Aliga biriktirilgan, lekin Vali qo'lida — Vali nomidan sotiladi; ism Valining buyurtmasidan.
    const orders = [held("1", ALI, { holder_courier_id: VALI.id }), held("2", VALI)];
    expect(groupsOf(orders, {}, "manager")).toEqual([
      expect.objectContaining({ key: "courier:12", name: "Vali Aliyev", sold: 2, soldAmount: 200000 }),
    ]);
    // Valining o'z buyurtmasi ro'yxatda yo'q — ismi noma'lum (Ali ismi qo'yilmaydi).
    expect(groupsOf([orders[0]], {}, "manager")).toEqual([
      expect.objectContaining({ key: "courier:12", name: null, sold: 1 }),
    ]);
  });

  it("ismsiz kuryer — ismlilardan keyin", () => {
    const orders = [held("1", { ...ALI, id: "99", name: "" }), held("2", VALI)];
    expect(groupsOf(orders, {}, "manager").map((group) => [group.key, group.name])).toEqual([
      ["courier:12", "Vali Aliyev"],
      ["courier:99", null],
    ]);
  });

  it("kuryer o'z sahifasida — bitta guruh", () => {
    const groups = groupsOf([held("1", ALI), held("2", ALI)], { "2": "cancel" }, "courier");
    expect(groups).toEqual([
      expect.objectContaining({ key: COURIER_BULK_SELF_GROUP, kind: "self", sold: 1, cancel: 1, soldAmount: 100000 }),
    ]);
  });
});

describe("splitCourierBulkByGroups", () => {
  it("tanlanmagan kuryerning buyurtmalariga so'rov ketmaydi; qolganlari o'zgarmaydi", () => {
    const orders = [held("1", ALI), held("2", ALI), held("3", VALI), atBranch("4")];
    const actions: Record<string, CourierBulkAction> = { "2": "tomorrow", "3": "cancel" };
    const tasks = getCourierBulkFinalizeTasks(orders, actions);
    const kept = getCourierBulkKept(orders, actions);

    const split = splitCourierBulkByGroups(tasks, kept, new Set(["courier:11"]), "manager");

    expect(split.tasks.map(({ order, action }) => [order.id, action])).toEqual([
      ["3", "cancel"],
      ["4", "sold"],
    ]);
    // Ali'ning «ertaga» belgisi ham hisobga kirmaydi (uning kuni yakunlanmayapti).
    expect(split.kept.tomorrow).toEqual([]);
    expect(split.skipped).toBe(1);
  });

  it("hech narsa olib tashlanmasa — hammasi", () => {
    const orders = [held("1", ALI), atBranch("2")];
    const tasks = getCourierBulkFinalizeTasks(orders, {});
    const split = splitCourierBulkByGroups(tasks, getCourierBulkKept(orders, {}), new Set(), "manager");
    expect(split.tasks).toEqual(tasks);
    expect(split.skipped).toBe(0);
  });
});
