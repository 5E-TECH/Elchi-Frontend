import { describe, expect, it } from "vitest";
import {
  NEW_ORDERS_RESERVED_SEGMENTS,
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

describe("resolveNewOrdersTabKeys — ko'rinadigan tablar (v1 shartlari)", () => {
  it("superadmin/admin: 4 ta tab", () => {
    for (const role of ["superadmin", "admin"]) {
      expect(resolveNewOrdersTabKeys({ role, roleId: "1", canSeeCancelled: true })).toEqual([
        "markets",
        "incoming",
        "branches",
        "cancelled",
      ]);
    }
  });

  it("menejer — faqat «Marketlar» (tablar qatori yo'q)", () => {
    expect(resolveNewOrdersTabKeys({ role: "manager", roleId: "2", canSeeCancelled: false })).toEqual(["markets"]);
  });

  it("HQ registratori — Marketlar + Bekor qilinganlar; boshqa registrator — bitta", () => {
    expect(resolveNewOrdersTabKeys({ role: "registrator", roleId: "3", canSeeCancelled: true })).toEqual([
      "markets",
      "cancelled",
    ]);
    expect(resolveNewOrdersTabKeys({ role: "registrator", roleId: "3", canSeeCancelled: false })).toEqual([
      "markets",
    ]);
  });

  it("market — Yangi buyurtmalar + (id bo'lsa) Bekor qilinganlar", () => {
    expect(resolveNewOrdersTabKeys({ role: "market", roleId: "121", canSeeCancelled: false })).toEqual([
      "marketNew",
      "marketCancelled",
    ]);
    expect(resolveNewOrdersTabKeys({ role: "market", roleId: null, canSeeCancelled: false })).toEqual(["marketNew"]);
  });
});

describe("resolveNewOrdersActiveTab", () => {
  it("xodim: yo'l bo'yicha", () => {
    expect(resolveNewOrdersActiveTab("/new-orders", "admin")).toBe("markets");
    expect(resolveNewOrdersActiveTab("/new-orders/incoming", "admin")).toBe("incoming");
    expect(resolveNewOrdersActiveTab("/new-orders/branches/4", "admin")).toBe("branches");
    expect(resolveNewOrdersActiveTab("/new-orders/cancelled/121", "registrator")).toBe("cancelled");
    expect(resolveNewOrdersActiveTab("/new-orders/userDetail/9", "admin")).toBe("markets");
  });

  it("market: o'z yangi buyurtmalari yoki bekor qilinganlari", () => {
    expect(resolveNewOrdersActiveTab("/new-orders/121", "market")).toBe("marketNew");
    expect(resolveNewOrdersActiveTab("/new-orders/cancelled/121", "market")).toBe("marketCancelled");
  });
});
