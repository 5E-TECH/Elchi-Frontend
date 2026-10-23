import { describe, expect, it } from "vitest";
import { Inbox, Mail, Map as MapIcon, MapPinned, Package, Tag, Users, Wallet } from "lucide-react";
import type { User } from "../../../entities/user/model/types";
import { getSidebarConfigForUser, type BranchType } from "./menuConfig";
import {
  formatNavCount,
  getActiveNavTo,
  getInitials,
  getNavPersona,
  getNavSections,
  getTileAccessibleName,
  toNavEntry,
} from "./navSections";
import { designRoleInCode } from "../../../test/designMenu";
import uzSidebar from "../../../locales/uz/sidebar.json";
import ruSidebar from "../../../locales/ru/sidebar.json";
import enSidebar from "../../../locales/en/sidebar.json";

const userOf = (
  role: string,
  branchType: BranchType | null = null,
  extra: Record<string, unknown> = {},
): User =>
  ({
    id: "1",
    role,
    name: role,
    ...(branchType ? { branch_type: branchType, branch: { id: "1", type: branchType } } : {}),
    ...extra,
  }) as unknown as User;

const ROLES = ["superadmin", "admin", "manager", "registrator", "market", "courier"] as const;
const BRANCH_TYPES: (BranchType | null)[] = [null, "HQ", "REGIONAL", "HYBRID", "PICKUP"];

describe("getNavSections — maketdagi guruhlar (roles.json)", () => {
  it("admin: «Tizim» guruhida Bildirishnomalar → Faoliyat jurnali (NG-A, roles.json)", () => {
    const sections = getNavSections("admin", userOf("admin"));
    expect(sections.find((section) => section.id === "system")?.items.map((item) => item.to)).toEqual([
      "/notifications",
      "/activity-logs",
    ]);
  });

  it("superadmin: bosh sahifa yakka, keyin Ish · Moliya · Ma'lumotnoma · Tizim; Integratsiyalar Ma'lumotnoma oxirida", () => {
    const sections = getNavSections("superadmin", userOf("superadmin"));

    expect(sections.map((section) => section.id)).toEqual([
      null,
      "work",
      "finance",
      "directory",
      "system",
    ]);
    expect(sections[0].items.map((item) => item.to)).toEqual(["/"]);
    expect(sections[3].items.map((item) => item.to)).toEqual([
      "/products",
      "/all-users",
      "/regions",
      "/branches",
      "/integrations",
    ]);
    expect(sections[4].items.map((item) => item.to)).toEqual([
      "/notifications",
      "/activity-logs",
      "/ops",
    ]);
  });

  it("qisqa menyu (market, kuryer, registrator) guruhsiz — maketda ham `grouped: false`", () => {
    for (const [role, branchType] of [
      ["market", null],
      ["courier", "REGIONAL"],
      ["registrator", "HQ"],
    ] as const) {
      const sections = getNavSections(role, userOf(role, branchType));
      expect(sections).toHaveLength(1);
      expect(sections[0].id).toBeNull();
    }
  });

  it.each(ROLES.flatMap((role) => BRANCH_TYPES.map((branchType) => [role, branchType] as const)))(
    "%s (%s): menuConfig'dagi har band aynan bir marta, tartibi guruh ichida saqlanadi",
    (role, branchType) => {
      const user = userOf(role, branchType);
      const config = getSidebarConfigForUser(role, user).map((item) => item.to);
      const shown = getNavSections(role, user).flatMap((section) =>
        section.items.map((item) => item.to),
      );

      expect([...shown].sort()).toEqual([...config].sort());
      expect(new Set(shown).size).toBe(shown.length);
    },
  );

  it("kuryerning `/cash-box` bandi «Kassa», marketniki «To'lovlar»", () => {
    const courier = getNavSections("courier", userOf("courier", "REGIONAL"))[0].items;
    const market = getNavSections("market", userOf("market"))[0].items;

    expect(courier.find((item) => item.to === "/cash-box")?.labelKey).toBe("cashbox");
    expect(market.find((item) => item.to === "/cash-box")?.labelKey).toBe("payments");
  });

  it("kanonik ikonkalar (icon-registry); kuryer «Hududlar» — MapPinned (roles.json)", () => {
    const iconOf = (role: string, to: string, branchType: BranchType | null = null) =>
      getNavSections(role, userOf(role, branchType))
        .flatMap((section) => section.items)
        .find((item) => item.to === to)?.icon;

    expect(iconOf("superadmin", "/new-orders")).toBe(Inbox);
    expect(iconOf("superadmin", "/mails")).toBe(Mail);
    expect(iconOf("superadmin", "/batches")).toBe(Package);
    expect(iconOf("superadmin", "/products")).toBe(Tag);
    expect(iconOf("superadmin", "/all-users")).toBe(Users);
    expect(iconOf("superadmin", "/regions")).toBe(MapIcon);
    expect(iconOf("market", "/cash-box")).toBe(Wallet);
    expect(iconOf("courier", "/cash-box", "REGIONAL")).toBe(Wallet);
    expect(iconOf("courier", "/regions", "REGIONAL")).toBe(MapPinned);
  });

  it("rolsiz foydalanuvchida menyu bo'sh", () => {
    expect(getNavSections(null, null)).toEqual([]);
    expect(getNavSections("operator", userOf("operator"))).toEqual([]);
  });
});

describe("qisqa yorliq (telefon varaqasi katagi)", () => {
  type DesignItem = { key: string; short?: Record<"uz" | "ru" | "en", string> };
  const LOCALES = { uz: uzSidebar, ru: ruSidebar, en: enSidebar } as Record<
    "uz" | "ru" | "en",
    Record<string, string>
  >;
  const DEFAULT_BRANCH: Partial<Record<string, BranchType>> = {
    manager: "HYBRID",
    registrator: "HQ",
    courier: "REGIONAL",
  };

  it.each(ROLES)("%s: maketdagi `short` (uz/ru/en) bilan bir xil", (role) => {
    const entries = getNavSections(role, userOf(role, DEFAULT_BRANCH[role] ?? null)).flatMap(
      (section) => section.items,
    );
    // Maketdagi, kodda hali yo'q bandlar (`route-map.json` → `plannedMenu`) chiqariladi.
    const design: DesignItem[] = designRoleInCode(role).menu;
    expect(entries).toHaveLength(design.length);
    design.forEach((item, index) => {
      if (!item.short) return;
      const entry = entries[index];
      for (const lang of ["uz", "ru", "en"] as const) {
        expect(
          LOCALES[lang][entry.shortLabelKey ?? entry.labelKey],
          `${role}.${item.key}.${lang}`,
        ).toBe(item.short[lang]);
      }
    });
  });

  it("har qisqa yorliq kaliti uchala tilda bor", () => {
    const keys = new Set(
      ROLES.flatMap((role) =>
        BRANCH_TYPES.flatMap((branchType) =>
          getNavSections(role, userOf(role, branchType)).flatMap((section) =>
            section.items.flatMap((item) => (item.shortLabelKey ? [item.shortLabelKey] : [])),
          ),
        ),
      ),
    );
    expect(keys.size).toBeGreaterThan(0);
    for (const key of keys) {
      for (const locale of Object.values(LOCALES)) expect(locale[key], key).toBeTruthy();
    }
  });

  it("ekran o'quvchi nomi: qisqasi to'liq nomda bo'lsa — to'liq nom, aks holda ko'ringan so'zdan boshlanadi", () => {
    expect(getTileAccessibleName("Pochta", "Pochta")).toBeUndefined();
    expect(getTileAccessibleName("Qabul", "Qabul va yaratish")).toBe("Qabul va yaratish");
    expect(getTileAccessibleName("Yaratish", "Qabul va yaratish")).toBe("Qabul va yaratish");
    expect(getTileAccessibleName("Создать", "Приём и создание")).toBe("Создать (Приём и создание)");
    expect(getTileAccessibleName("Закрыть день", "Быстрое действие")).toBe(
      "Закрыть день (Быстрое действие)",
    );
  });
});

describe("getActiveNavTo — faol band (maketdagi menuKey)", () => {
  const itemsOf = (role: string) =>
    getNavSections(role, userOf(role)).flatMap((section) => section.items);

  it("eng uzun mos yo'l: ichki sahifada ota bo'lim", () => {
    expect(getActiveNavTo(itemsOf("superadmin"), "/orders/42")).toBe("/orders");
    expect(getActiveNavTo(itemsOf("superadmin"), "/")).toBe("/");
    expect(getActiveNavTo(itemsOf("superadmin"), "/profile")).toBeNull();
  });

  it.each([
    "/finance-operators",
    "/integrations-ops",
    "/investors-ops",
    "/logistics-ops",
    "/branch-ops",
    "/identity-ops",
    "/system-ops",
    "/logs",
    "/ops/ui-kit",
  ])("superadmin %s → «Ops vositalari» (maket menuKey: ops)", (pathname) => {
    expect(getActiveNavTo(itemsOf("superadmin"), pathname)).toBe("/ops");
  });

  it("superadmin /inbox → «Bildirishnomalar» (maket superadmin-notifications-inbox); admin ham (NG-A); boshqa rolda hech biri", () => {
    expect(getActiveNavTo(itemsOf("superadmin"), "/inbox")).toBe("/notifications");
    // NG-A: admin menyusida ham «Bildirishnomalar» — alias shu xulq bilan qabul qilindi (17HWafL7, ega savoli ochiq).
    expect(getActiveNavTo(itemsOf("admin"), "/inbox")).toBe("/notifications");
    expect(getActiveNavTo(itemsOf("admin"), "/logs")).toBeNull();
    expect(getActiveNavTo(itemsOf("manager"), "/inbox")).toBeNull();
  });

  it("to'g'ridan-to'g'ri mos band ustun: suriluvchi menyudagi shaxsiy /inbox faol qoladi", () => {
    expect(getActiveNavTo([...itemsOf("superadmin"), { to: "/inbox" }], "/inbox")).toBe("/inbox");
  });
});

describe("formatNavCount", () => {
  it.each([
    [undefined, null],
    [null, null],
    [0, null],
    [-3, null],
    [Number.NaN, null],
    [1, "1"],
    [99, "99"],
    [100, "99+"],
    [1500, "99+"],
  ] as const)("%s → %s", (value, expected) => {
    expect(formatNavCount(value)).toBe(expected);
  });
});

describe("getInitials / getNavPersona", () => {
  it("ism-familiyadan ikki harf, bitta so'zdan dastlabki ikki harf", () => {
    expect(getInitials("Jasur Tursunov")).toBe("JT");
    expect(getInitials("  o'tkir   xolmatov ")).toBe("OX");
    expect(getInitials("Baraka")).toBe("BA");
    expect(getInitials("")).toBe("");
    expect(getInitials(null)).toBe("");
  });

  it("ism profil → sessiya; filial nomi faqat profil bersa", () => {
    expect(getNavPersona(userOf("courier", "REGIONAL", { name: "Jasur Tursunov" }), "x")).toEqual({
      name: "Jasur Tursunov",
      initials: "JT",
      branchName: null,
    });
    expect(
      getNavPersona(
        userOf("manager", "HYBRID", {
          name: "",
          fullName: "Ravshan Ortiqov",
          branch: { name: "Urgut filiali" },
        }),
        null,
      ),
    ).toEqual({ name: "Ravshan Ortiqov", initials: "RO", branchName: "Urgut filiali" });
    expect(getNavPersona(null, "Nilufar Rashidova")).toEqual({
      name: "Nilufar Rashidova",
      initials: "NR",
      branchName: null,
    });
  });
});

describe("market_operator — «Buyurtma yaratish» yorlig'i (MO-2 → MO-3 shartnomasi)", () => {
  // MO-3 bandni `/new-orders` yoki `/new-orders/create` bilan qo'shishi mumkin — ikkalasida ham rolga xos yorliq.
  it.each(["/new-orders", "/new-orders/create"])("%s → createOrder / createShort", (to) => {
    const entry = toNavEntry("market_operator", { to, label: "newOrders", icon: Inbox });
    expect(entry.labelKey).toBe("createOrder");
    expect(entry.shortLabelKey).toBe("createShort");
    expect(uzSidebar.createOrder).toBe("Buyurtma yaratish");
  });

  it("market egasi bandi o'zgarmaydi (umumiy yorliq, qisqasi «Yaratish»)", () => {
    const entry = toNavEntry("market", { to: "/new-orders", label: "newOrders", icon: Inbox });
    expect(entry.labelKey).toBe("newOrders");
    expect(entry.shortLabelKey).toBe("createShort");
  });
});
