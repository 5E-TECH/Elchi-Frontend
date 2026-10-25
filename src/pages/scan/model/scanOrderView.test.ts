import { describe, expect, it } from "vitest";
import { normalizeOrderDetail } from "../../new_orders/components/detail/orderDetailModel";
import {
  buildScanOrderView,
  getInitials,
  getCourierTakeState,
  getManagerScanActions,
  getScanDeliveryKind,
  getScanRoleKind,
  hasAnyManagerAction,
} from "./scanOrderView";

const order = (raw: Record<string, unknown>) => {
  const detail = normalizeOrderDetail({ statusCode: 200, data: raw });
  if (!detail) throw new Error("order expected");
  return detail;
};

describe("getScanRoleKind", () => {
  it("maps roles to the scan result content (spec G3 §2.3)", () => {
    expect(getScanRoleKind("courier")).toBe("courier");
    expect(getScanRoleKind("manager")).toBe("manager");
    expect(getScanRoleKind("superadmin")).toBe("staff");
    expect(getScanRoleKind("admin")).toBe("staff");
    expect(getScanRoleKind("registrator")).toBe("staff");
    expect(getScanRoleKind("market")).toBe("readonly");
    expect(getScanRoleKind(null)).toBe("readonly");
  });
});

describe("getScanDeliveryKind", () => {
  it("reads the raw `where_deliver`, not a translated label", () => {
    expect(getScanDeliveryKind("address")).toBe("home");
    expect(getScanDeliveryKind("home")).toBe("home");
    expect(getScanDeliveryKind("center")).toBe("center");
    expect(getScanDeliveryKind("")).toBeNull();
    expect(getScanDeliveryKind(undefined)).toBeNull();
  });
});

describe("buildScanOrderView", () => {
  it("builds the enriched QR order view (district, region, market, items, courier)", () => {
    const view = buildScanOrderView(
      order({
        id: "10226",
        status: "received",
        where_deliver: "address",
        total_price: "365000.00",
        paid_amount: 0,
        address: "Bog'ishamol ko'chasi, 21-uy",
        comment: "  Soat 18:00 dan keyin yetkazing.  ",
        createdAt: "2026-10-17T09:40:00.000Z",
        customer: { id: "c1", name: "Zarina Yo'ldosheva", phone_number: "+998902146608" },
        district: { id: "d1", name: "Qibray tumani" },
        region: { id: "r1", name: "Toshkent viloyati" },
        market: { id: "m1", name: "Baraka Shop" },
        items: [
          { id: "i1", quantity: 1, product: { id: "p1", name: "Bolalar kurtkasi" } },
          { id: "i2", quantity: 2, product: null, product_name: "Qishki etik" },
        ],
      }),
    );

    expect(view).toMatchObject({
      id: "10226",
      delivery: "home",
      total: 365000,
      customerName: "Zarina Yo'ldosheva",
      initials: "ZY",
      place: "Qibray tumani, Toshkent viloyati",
      address: "Bog'ishamol ko'chasi, 21-uy",
      comment: "Soat 18:00 dan keyin yetkazing.",
      marketName: "Baraka Shop",
      courierHeld: false,
      courierName: null,
    });
    expect(view.items).toEqual([
      { key: "i1", name: "Bolalar kurtkasi", quantity: 1 },
      { key: "i2", name: "Qishki etik", quantity: 2 },
    ]);
  });

  it("detects a courier-held order and reads the enriched courier name", () => {
    const view = buildScanOrderView(
      order({ id: "1", status: "waiting", holder_type: "COURIER", courier: { id: "93", name: "Bekzod Normurodov" } }),
    );
    expect(view.courierHeld).toBe(true);
    expect(view.courierName).toBe("Bekzod Normurodov");
  });

  it("keeps empty fields empty (no invented text)", () => {
    const view = buildScanOrderView(order({ id: "2", status: "new" }));
    expect(view.place).toBeNull();
    expect(view.comment).toBeNull();
    expect(view.marketName).toBeNull();
    expect(view.customerName).toBe("");
    expect(view.initials).toBe("—");
  });
});

describe("getInitials", () => {
  it("takes the first letters of two words", () => {
    expect(getInitials("Gulnora Ismoilova")).toBe("GI");
    expect(getInitials("  ali ")).toBe("A");
  });
});

describe("getManagerScanActions", () => {
  const access = (canUseCourierActions: boolean, canSell = canUseCourierActions, isRegionalManager = true) => ({
    canUseCourierActions,
    canSell,
    isRegionalManager,
  });

  it("REGIONAL manager with the permission: sell, cancel, dispatch", () => {
    const actions = getManagerScanActions({
      access: access(true),
      canSellCancel: true,
      courierHeld: false,
      canViewDispatch: true,
    });
    expect(actions).toEqual({
      courierHeld: false,
      canSell: true,
      canCancel: true,
      canDispatch: true,
      hasSellPermission: true,
    });
    expect(hasAnyManagerAction(actions)).toBe(true);
  });

  it("courier-held order: no action buttons at all (maket «Buyurtma kuryerda»)", () => {
    const actions = getManagerScanActions({
      access: access(true, false),
      canSellCancel: true,
      courierHeld: true,
      canViewDispatch: true,
    });
    expect(actions).toMatchObject({ courierHeld: true, canSell: false, canCancel: false, canDispatch: false });
    expect(hasAnyManagerAction(actions)).toBe(true);
  });

  it("no permission: only dispatch remains", () => {
    const actions = getManagerScanActions({
      access: access(false),
      canSellCancel: false,
      courierHeld: false,
      canViewDispatch: true,
    });
    expect(actions).toMatchObject({ canSell: false, canCancel: false, canDispatch: true, hasSellPermission: false });
  });

  it("HQ / PICKUP manager: nothing to do", () => {
    const actions = getManagerScanActions({
      access: access(false, false, false),
      canSellCancel: true,
      courierHeld: false,
      canViewDispatch: false,
    });
    expect(hasAnyManagerAction(actions)).toBe(false);
    expect(actions.hasSellPermission).toBe(false);
  });
});

describe("getCourierTakeState (6qypMFeT — backend scanAssignOrder bilan bir xil)", () => {
  it("mine — courier_id = me and on the road (snake / space / camelCase)", () => {
    expect(getCourierTakeState({ courier_id: "31", status: "on_the_road" }, "31")).toBe("mine");
    expect(getCourierTakeState({ courierId: 31, status: "on the road" }, 31)).toBe("mine");
  });

  it("other — courier_id belongs to another courier, whatever the status", () => {
    expect(getCourierTakeState({ courier_id: "93", status: "on_the_road" }, "31")).toBe("other");
    expect(getCourierTakeState({ courier_id: "93", status: "received" }, "31")).toBe("other");
  });

  it("free — no courier, «0» sentinel, mine but not on the road, or user unknown", () => {
    expect(getCourierTakeState({ courier_id: null, status: "received" }, "31")).toBe("free");
    expect(getCourierTakeState({ courier_id: "0", status: "on_the_road" }, "31")).toBe("free");
    expect(getCourierTakeState({ courier_id: "31", status: "waiting" }, "31")).toBe("free");
    expect(getCourierTakeState({ courier_id: "31", status: "on_the_road" }, null)).toBe("free");
    expect(getCourierTakeState(null, "31")).toBe("free");
  });
});
