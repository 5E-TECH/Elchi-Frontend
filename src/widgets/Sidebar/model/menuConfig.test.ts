import { describe, expect, it } from "vitest";
import {
  MANAGER_CAPABILITIES,
  SIDEBAR_CONFIG,
  getSidebarConfigForUser,
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
