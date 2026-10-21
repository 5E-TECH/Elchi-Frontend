import { describe, expect, it } from "vitest";
import {
  MARKET_OPERATOR_CREATE_PATH,
  NEW_ORDERS_RESERVED_SEGMENTS,
  resolveMarketOperatorNewOrdersAccess,
  resolveNewOrdersActiveTab,
  resolveNewOrdersShellMode,
  resolveNewOrdersTabKeys,
} from "./newOrdersShell";

const STAFF = ["superadmin", "admin", "manager", "registrator"] as const;

describe("resolveNewOrdersShellMode — qobiq rejimi", () => {
  it.each(["/new-orders", "/new-orders/"])("%s — hosted (barcha rollar)", (path) => {
    for (const role of [...STAFF, "market"]) expect(resolveNewOrdersShellMode(path, role)).toBe("hosted");
  });

  it("yaratish — bare (o'z sarlavhasi), avvalgidek", () => {
    for (const role of [...STAFF, "market"]) expect(resolveNewOrdersShellMode("/new-orders/create", role)).toBe("bare");
  });

  it("manba tanlash — hosted, skaner — bare", () => {
    expect(resolveNewOrdersShellMode("/new-orders/incoming", "admin")).toBe("hosted");
    expect(resolveNewOrdersShellMode("/new-orders/incoming/", "manager")).toBe("hosted");
    expect(resolveNewOrdersShellMode("/new-orders/incoming/121", "admin")).toBe("bare");
  });

  it("market buyurtmalari: xodimda bare, market rolida hosted (o'z tabi)", () => {
    for (const role of STAFF) expect(resolveNewOrdersShellMode("/new-orders/121", role)).toBe("bare");
    expect(resolveNewOrdersShellMode("/new-orders/121", "market")).toBe("hosted");
    expect(resolveNewOrdersShellMode("/new-orders/121", null)).toBe("bare");
  });

  it("buyurtmani tahrirlash — barcha rollarda bare", () => {
    for (const role of [...STAFF, "market"]) {
      expect(resolveNewOrdersShellMode("/new-orders/121/edit/10257", role)).toBe("bare");
    }
  });

  it("filial paketlari: ro'yxat — hosted (tablar kartada), filial va paket — bare (o'z sarlavhasi)", () => {
    for (const role of ["superadmin", "admin"]) {
      expect(resolveNewOrdersShellMode("/new-orders/branches", role)).toBe("hosted");
      expect(resolveNewOrdersShellMode("/new-orders/branches/", role)).toBe("hosted");
      expect(resolveNewOrdersShellMode("/new-orders/branches/7", role)).toBe("bare");
      expect(resolveNewOrdersShellMode("/new-orders/branches/7/batches/9", role)).toBe("bare");
    }
  });

  it("bekor qilinganlar: marketlar — hosted; market tafsiloti — market rolida hosted (o'z tabi), xodimda bare", () => {
    for (const role of [...STAFF, "market"]) {
      expect(resolveNewOrdersShellMode("/new-orders/cancelled", role)).toBe("hosted");
    }
    for (const role of STAFF) expect(resolveNewOrdersShellMode("/new-orders/cancelled/121", role)).toBe("bare");
    expect(resolveNewOrdersShellMode("/new-orders/cancelled/121", "market")).toBe("hosted");
    expect(resolveNewOrdersShellMode("/new-orders/cancelled/121", null)).toBe("bare");
  });

  it("/new-orders/userDetail/5 — bare (v2 tafsilot: o'z sarlavhasi, qobiq h1 va tugmasi takrorlanmaydi)", () => {
    expect(resolveNewOrdersShellMode("/new-orders/userDetail/5", "admin")).toBe("bare");
    expect(resolveNewOrdersShellMode("/new-orders/userDetail/5", "market")).toBe("bare");
  });

  it.each(["/new-orders/external", "/new-orders/external/3", "/new-orders/integrations", "/new-orders/integrations/incoming"])(
    "%s — eski yo'naltirish: bare (sarlavha miltillamaydi)",
    (path) => {
      expect(resolveNewOrdersShellMode(path, "admin")).toBe("bare");
    },
  );

  it("band qilingan segmentlar hech biri market id deb o'qilmaydi", () => {
    for (const segment of NEW_ORDERS_RESERVED_SEGMENTS) {
      // `cancelled/:marketId` — market rolining o'z «Bekor qilinganlar» tabi: hosted ATAYLAB (yuqoridagi test).
      if (segment === "cancelled") continue;
      // Market rolida `:marketId` → hosted; band segment esa o'z rejimini oladi.
      const mode = resolveNewOrdersShellMode(`/new-orders/${segment}/x`, "market");
      expect(mode).not.toBe("hosted");
    }
  });
});

describe("resolveNewOrdersTabKeys — ko'rinadigan tablar", () => {
  it("superadmin/admin: 4 ta tab", () => {
    for (const role of ["superadmin", "admin"]) {
      expect(
        resolveNewOrdersTabKeys({ role, roleId: "1", canReceiveIncoming: true, canSeeCancelled: true }),
      ).toEqual(["markets", "incoming", "branches", "cancelled"]);
    }
  });

  it("⭐ qabul qiladigan menejer (HQ · PICKUP · HYBRID) — «Marketlar · Kiruvchi posilkalar» (ega S1)", () => {
    expect(
      resolveNewOrdersTabKeys({ role: "manager", roleId: "2", canReceiveIncoming: true, canSeeCancelled: false }),
    ).toEqual(["markets", "incoming"]);
  });

  it("⭐ registrator: «Marketlar · Kiruvchi posilkalar», HQ registratorida yana «Bekor qilinganlar»", () => {
    expect(
      resolveNewOrdersTabKeys({ role: "registrator", roleId: "3", canReceiveIncoming: true, canSeeCancelled: true }),
    ).toEqual(["markets", "incoming", "cancelled"]);
    expect(
      resolveNewOrdersTabKeys({ role: "registrator", roleId: "3", canReceiveIncoming: true, canSeeCancelled: false }),
    ).toEqual(["markets", "incoming"]);
  });

  it("qabul huquqi yo'q xodim — «Kiruvchi posilkalar» yo'q; «Filial paketlari» faqat superadmin/admin", () => {
    expect(
      resolveNewOrdersTabKeys({ role: "manager", roleId: "2", canReceiveIncoming: false, canSeeCancelled: false }),
    ).toEqual(["markets"]);
    expect(
      resolveNewOrdersTabKeys({ role: "registrator", roleId: "3", canReceiveIncoming: true, canSeeCancelled: true }),
    ).not.toContain("branches");
  });

  it("market — Yangi buyurtmalar + (id bo'lsa) Bekor qilinganlar", () => {
    expect(
      resolveNewOrdersTabKeys({ role: "market", roleId: "121", canReceiveIncoming: false, canSeeCancelled: false }),
    ).toEqual(["marketNew", "marketCancelled"]);
    expect(
      resolveNewOrdersTabKeys({ role: "market", roleId: null, canReceiveIncoming: false, canSeeCancelled: false }),
    ).toEqual(["marketNew"]);
  });
});

describe("resolveNewOrdersActiveTab", () => {
  it("xodim: yo'l bo'yicha", () => {
    expect(resolveNewOrdersActiveTab("/new-orders", "admin")).toBe("markets");
    expect(resolveNewOrdersActiveTab("/new-orders/incoming", "admin")).toBe("incoming");
    expect(resolveNewOrdersActiveTab("/new-orders/branches/4", "admin")).toBe("branches");
    expect(resolveNewOrdersActiveTab("/new-orders/cancelled/121", "registrator")).toBe("cancelled");
    expect(resolveNewOrdersActiveTab("/new-orders/incoming", "manager")).toBe("incoming");
    expect(resolveNewOrdersActiveTab("/new-orders/userDetail/9", "admin")).toBe("markets");
  });

  it("market: o'z yangi buyurtmalari yoki bekor qilinganlari", () => {
    expect(resolveNewOrdersActiveTab("/new-orders/121", "market")).toBe("marketNew");
    expect(resolveNewOrdersActiveTab("/new-orders/cancelled/121", "market")).toBe("marketCancelled");
  });
});

describe("resolveMarketOperatorNewOrdersAccess — market operatori (MO-3)", () => {
  it("`/new-orders` → yaratishga yo'naltiriladi", () => {
    for (const path of ["/new-orders", "/new-orders/", "new-orders"]) {
      expect(resolveMarketOperatorNewOrdersAccess(path), path).toBe("redirect");
    }
    expect(MARKET_OPERATOR_CREATE_PATH).toBe("/new-orders/create");
  });

  it("faqat `/new-orders/create` ochiq", () => {
    expect(resolveMarketOperatorNewOrdersAccess("/new-orders/create")).toBe("create");
    expect(resolveMarketOperatorNewOrdersAccess("/new-orders/create/")).toBe("create");
  });

  it.each([
    "/new-orders/7",
    "/new-orders/7/edit/12",
    "/new-orders/cancelled",
    "/new-orders/cancelled/7",
    "/new-orders/incoming",
    "/new-orders/incoming/7",
    "/new-orders/branches",
    "/new-orders/branches/3/batches/4",
    "/new-orders/userDetail/9",
    "/new-orders/create/extra",
    "/new-orders/external",
  ])("%s — 403", (path) => {
    expect(resolveMarketOperatorNewOrdersAccess(path)).toBe("forbidden");
  });
});
