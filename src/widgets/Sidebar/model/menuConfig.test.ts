import { describe, expect, it } from "vitest";
import {
  MANAGER_CAPABILITIES,
  SIDEBAR_CONFIG,
  SIDEBAR_GROUP_BY_PATH,
  SIDEBAR_GROUP_ORDER,
  getSidebarConfigForUser,
  getSidebarGroupsForUser,
  normalizeSidebarRole,
  type BranchType,
} from "./menuConfig";

const userWithBranchType = (type: BranchType) =>
  ({
    branch: { type },
  }) as never;

describe("sidebar menu config", () => {
  it("does not expose legacy operator as an app role", () => {
    expect(normalizeSidebarRole("operator")).toBeNull();
    expect(getSidebarConfigForUser("operator")).toEqual([]);
  });

  it("keeps manager menu scoped by branch type", () => {
    expect(getSidebarConfigForUser("manager").map((item) => item.to)).toEqual([
      "/branch-dashboard",
      "/orders",
      "/regions",
    ]);

    // /courier-bulk faqat REGIONAL va HYBRID menejerlarga ochiq —
    // routes.tsx dagi canViewCourierBulk guardi bilan bir xil chegara.
    expect(getSidebarConfigForUser("manager", userWithBranchType("REGIONAL")).map((item) => item.to)).toEqual([
      "/branch-dashboard",
      "/dispatch",
      "/orders",
      "/courier-bulk",
      "/mails",
      "/all-users",
      "/payments",
      "/regions",
    ]);

    expect(getSidebarConfigForUser("manager", userWithBranchType("HYBRID")).map((item) => item.to)).toEqual([
      "/branch-dashboard",
      "/dispatch",
      "/orders",
      "/courier-bulk",
      "/new-orders",
      "/mails",
      "/batches",
      "/returns",
      "/all-users",
      "/payments",
      "/regions",
    ]);

    expect(getSidebarConfigForUser("manager", userWithBranchType("PICKUP")).map((item) => item.to)).toEqual([
      "/branch-dashboard",
      "/orders",
      "/new-orders",
      "/batches",
      "/returns",
      "/regions",
    ]);

    // HQ 2026-09-10 da `intake` qobiliyatini OLDI: hamkordan (BeePost) kelgan
    // posilkalar aynan HQ da qabul qilinadi, shuning uchun HQ menejeriga
    // qabul/paket/qaytarish ekranlari ochildi.
    expect(getSidebarConfigForUser("manager", userWithBranchType("HQ")).map((item) => item.to)).toEqual([
      "/branch-dashboard",
      "/orders",
      "/new-orders",
      "/mails",
      "/batches",
      "/returns",
      "/payments",
      "/regions",
    ]);
  });

  it("HYBRID = REGIONAL ∪ PICKUP — qo'lda emas, hosil qilinadi", () => {
    const union = new Set([
      ...MANAGER_CAPABILITIES.REGIONAL,
      ...MANAGER_CAPABILITIES.PICKUP,
    ]);

    expect(new Set(MANAGER_CAPABILITIES.HYBRID)).toEqual(union);

    // Menyu darajasida ham: HYBRID bandlar to'plami ikkisining birlashmasi.
    const paths = (type: BranchType) =>
      getSidebarConfigForUser("manager", userWithBranchType(type)).map((i) => i.to);

    expect(new Set(paths("HYBRID"))).toEqual(
      new Set([...paths("REGIONAL"), ...paths("PICKUP")]),
    );
  });

  it("bandlar tartibi barcha filial turlarida bir xil", () => {
    const paths = (type: BranchType) =>
      getSidebarConfigForUser("manager", userWithBranchType(type)).map((i) => i.to);
    const hybrid = paths("HYBRID");

    // Har bir filial turi HYBRID ro'yxatining KETMA-KET qism to'plami bo'lishi
    // kerak — ya'ni bitta kanonik tartibdan filtrlab olingan.
    for (const type of ["HQ", "PICKUP", "REGIONAL"] as BranchType[]) {
      const own = paths(type);
      expect(own).toEqual(hybrid.filter((path) => own.includes(path)));
    }
  });

  it("SIDEBAR_CONFIG.manager fallback ro'yxat bilan bir xil qoladi", () => {
    // `manager` yozuvi faqat tur uchun; haqiqiy manba MANAGER_MENU_ORDER.
    // Ikkisi ajralib ketmasligi shu yerda qulflanadi.
    expect(SIDEBAR_CONFIG.manager.map((item) => item.to)).toEqual(
      getSidebarConfigForUser("manager").map((item) => item.to),
    );
  });
});

describe("B1 — menyu guruhlari", () => {
  const ROLE_CASES: Array<[string, BranchType | undefined]> = [
    ["superadmin", undefined],
    ["admin", undefined],
    ["market", undefined],
    ["registrator", undefined],
    ["courier", undefined],
    ["manager", "HQ"],
    ["manager", "PICKUP"],
    ["manager", "REGIONAL"],
    ["manager", "HYBRID"],
    ["manager", undefined],
  ];

  const flat = (role: string, type?: BranchType) =>
    getSidebarConfigForUser(role, type ? userWithBranchType(type) : undefined);
  const grouped = (role: string, type?: BranchType) =>
    getSidebarGroupsForUser(role, type ? userWithBranchType(type) : undefined);

  it("HECH BIR band yo'qolmaydi va takrorlanmaydi", () => {
    for (const [role, type] of ROLE_CASES) {
      const before = flat(role, type).map((i) => i.to);
      const after = grouped(role, type).flatMap((g) => g.items.map((i) => i.to));

      expect(after.sort(), `${role}/${type ?? "-"}`).toEqual([...before].sort());
      expect(new Set(after).size, `${role}/${type ?? "-"} takror`).toBe(
        after.length,
      );
    }
  });

  it("guruh ichidagi tartib rol ro'yxatidagidek qoladi", () => {
    for (const [role, type] of ROLE_CASES) {
      const before = flat(role, type).map((i) => i.to);
      for (const group of grouped(role, type)) {
        const own = group.items.map((i) => i.to);
        expect(own, `${role}/${type ?? "-"}`).toEqual(
          before.filter((path) => own.includes(path)),
        );
      }
    }
  });

  it("qisqa menyu guruhlanmaydi (shovqin qo'shmaslik uchun)", () => {
    // courier/market/registrator — 6 band, chegaradan past.
    for (const role of ["courier", "market", "registrator"]) {
      const groups = grouped(role);
      expect(groups, role).toHaveLength(1);
      expect(groups[0].id, role).toBeNull();
    }
  });

  it("uzun menyu guruhlanadi va boshqaruv paneli yakka turadi", () => {
    const groups = grouped("superadmin");
    expect(groups.length).toBeGreaterThan(1);

    // Birinchi guruh — guruhsiz boshqaruv paneli.
    expect(groups[0].id).toBeNull();
    expect(groups[0].items.map((i) => i.to)).toEqual(["/"]);

    // Qolganlari nomlangan guruhlar, belgilangan tartibda.
    const ids = groups.slice(1).map((g) => g.id);
    expect(ids).toEqual(
      SIDEBAR_GROUP_ORDER.filter((id) => ids.includes(id)),
    );
  });

  it("har bir menyu yo'li guruhga biriktirilgan (guruhsiz qolmaydi)", () => {
    const ungrouped = new Set<string>();
    for (const [role, type] of ROLE_CASES) {
      for (const item of flat(role, type)) {
        const standalone = item.to === "/" || item.to === "/branch-dashboard";
        if (!standalone && !SIDEBAR_GROUP_BY_PATH[item.to]) {
          ungrouped.add(item.to);
        }
      }
    }
    expect([...ungrouped]).toEqual([]);
  });
});
