import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import i18n, { i18nReady } from "../../../i18n";
import { renderWithProviders } from "../../../test/test-utils";
import { isScannerOverlayOpen, resetScannerHost } from "../../../shared/lib/scanner/scannerHost";
import { resetScanTargets, useScanTarget } from "../../../shared/lib/scanner/scanTargets";
import type { User } from "../../../entities/user/model/types";
import { CODE_DESIGN_ROLES, designRoleInCode, isBottomNavPlanned } from "../../../test/designMenu";
import { getSidebarConfigForUser, type BranchType } from "../model/menuConfig";
import BottomNav from "./BottomNav";

/**
 * PASTKI MENYU (telefon) — maket `.el-bottomnav` (`design/kit/roles.json` → `bottomNav`,
 * taxtalar `tizim-responsive` 05, `tizim-states-navigation` 06).
 */

// Kutilayotgan o'tish (`useNavPathname`) — MemoryRouter'da `window.location` o'zgarmaydi, shuning uchun soxtalanadi.
const pending = vi.hoisted(() => ({ path: null as string | null }));
vi.mock("../../../shared/lib/navigationPending", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../shared/lib/navigationPending")>()),
  useNavPathname: () => {
    const { pathname } = useLocation();
    return pending.path ?? pathname;
  },
}));

type DesignRole =
  | "superadmin"
  | "admin"
  | "manager"
  | "registrator"
  | "market"
  | "courier"
  | "logist"
  | "market_operator"
  | "investor";
type DesignMenuItem = { key: string; label: string; short?: { uz: string; ru: string; en: string } };
// Maket menyusi — kodda bor rollar, kodda hali yo'q bandlarsiz (`route-map.json` → `plannedMenu`).
const ROLES = Object.fromEntries(CODE_DESIGN_ROLES.map((role) => [role, designRoleInCode(role)])) as unknown as Record<
  DesignRole,
  { menu: DesignMenuItem[]; bottomNav: string[] }
>;
const ALL_ROLES = Object.keys(ROLES) as DesignRole[];
/** Pastki menyusi maketda yangilangan, kodda hali eski rollar (`route-map.json` → `plannedBottomNav`). */
const PLANNED_BOTTOM_NAV_ROLES = ALL_ROLES.filter((role) => isBottomNavPlanned(role));
const CURRENT_ROLES = ALL_ROLES.filter((role) => !isBottomNavPlanned(role));

/** `app-shot` dagi sukut filial turlari (maket personasi): menejer — to'liq menyu, registrator — HQ, kuryer — REGIONAL. */
const DEFAULT_BRANCH: Partial<Record<DesignRole, BranchType>> = {
  manager: "HYBRID",
  registrator: "HQ",
  courier: "REGIONAL",
};

const userOf = (role: string, branchType: BranchType | null): User =>
  ({
    id: "1",
    role,
    name: role,
    ...(branchType ? { branch_type: branchType, branch: { id: "1", type: branchType } } : {}),
  }) as unknown as User;

const stateOf = (role: string, branchType: BranchType | null = null) =>
  ({
    role: { id: `${role}-1`, role, region: null, name: role },
    user: {
      user: userOf(role, branchType),
      isAuthenticated: true,
      accessToken: null,
      loading: false,
      isAppInitializing: false,
      error: null,
    },
  }) as never;

const renderNav = (role: string, { branchType = null, route = "/" }: { branchType?: BranchType | null; route?: string } = {}) =>
  renderWithProviders(<BottomNav />, { route, preloadedState: stateOf(role, branchType) });

/** Navigatsiya kataklari tartib bilan (havola yoki «Menyu» tugmasi). */
const cells = () => Array.from(screen.getByRole("navigation").children) as HTMLElement[];
const hrefs = () => cells().map((cell) => cell.getAttribute("href") ?? `button:${cell.textContent}`);

beforeAll(async () => {
  await i18nReady;
  await i18n.changeLanguage("uz");
});

afterAll(async () => {
  pending.path = null;
  await i18n.changeLanguage("uz");
});

describe("BottomNav — maketdagi bandlar (roles.json → bottomNav)", () => {
  it.each(CURRENT_ROLES)("%s: 5 ta katak, tartibi, manzili va qisqa yorlig'i maketdagidek", (role) => {
    const branchType = DEFAULT_BRANCH[role] ?? null;
    renderNav(role, { branchType });
    const menu = getSidebarConfigForUser(role, userOf(role, branchType));
    const design = ROLES[role];

    expect(design.bottomNav).toHaveLength(5);
    expect(cells()).toHaveLength(5);

    design.bottomNav.forEach((key, index) => {
      const cell = cells()[index];
      if (key === "@scan") {
        expect(cell).toHaveAttribute("href", "/scan");
        expect(cell).toHaveTextContent("Skaner");
        return;
      }
      if (key === "@menu") {
        expect(cell.tagName).toBe("BUTTON");
        expect(cell).toHaveTextContent("Menyu");
        return;
      }
      const designItem = design.menu.find((item) => item.key === key);
      const appItem = menu.find((item) => item.label === key);
      expect(appItem, `${role}: «${key}» foydalanuvchi menyusida bor`).toBeDefined();
      expect(cell).toHaveAttribute("href", appItem?.to);
      expect(cell).toHaveTextContent(designItem?.short?.uz ?? designItem?.label ?? "");
    });
  });

  it.each(["ru", "en"] as const)("%s: qisqa yorliqlar maketdagidek (roles.json → short)", async (lang) => {
    await i18n.changeLanguage(lang);
    try {
      for (const role of CURRENT_ROLES) {
        const { unmount } = renderNav(role, { branchType: DEFAULT_BRANCH[role] ?? null });
        ROLES[role].bottomNav.forEach((key, index) => {
          const short = ROLES[role].menu.find((item) => item.key === key)?.short?.[lang];
          if (short) expect(cells()[index]).toHaveTextContent(short);
        });
        unmount();
      }
    } finally {
      await i18n.changeLanguage("uz");
    }
  });

  it("plannedBottomNav: kod hali maketdagi kataklarga yetmagan (yetgach — ro'yxatdan oling)", () => {
    for (const role of PLANNED_BOTTOM_NAV_ROLES) {
      const branchType = DEFAULT_BRANCH[role] ?? null;
      const { unmount } = renderNav(role, { branchType });
      const menu = getSidebarConfigForUser(role, userOf(role, branchType));
      const expected = ROLES[role].bottomNav.map((key) =>
        key === "@scan" ? "/scan" : key === "@menu" ? "button:Menyu" : menu.find((item) => item.label === key)?.to,
      );
      // Menyusi hali bo'sh yangi rol (ROL-0) — pastki menyu umuman chizilmaydi.
      const nav = screen.queryByRole("navigation");
      const actual = nav
        ? (Array.from(nav.children) as HTMLElement[]).map((cell) =>
            cell.tagName === "BUTTON" && cell.textContent?.includes("Menyu") ? "button:Menyu" : cell.getAttribute("href"),
          )
        : [];
      expect(actual, `${role}: kod maketdagi pastki menyuga yetdi — route-map.json → plannedBottomNav dan oling`).not.toEqual(
        expected,
      );
      unmount();
    }
  });

  it("skaner rollarida «Skaner» markazda, «Menyu» oxirida; marketda skaner yo'q", () => {
    for (const role of ["superadmin", "admin", "manager", "registrator", "courier"] as const) {
      const { unmount } = renderNav(role, { branchType: DEFAULT_BRANCH[role] ?? null });
      expect(cells()[2]).toHaveAttribute("href", "/scan");
      expect(cells()[4].tagName).toBe("BUTTON");
      unmount();
    }
  });

  it("market (ega MO-S1): Bosh sahifa · Buyurtmalar · Yaratish · To'lovlar · Menyu; «Mahsulotlar» — Menyu varaqasida", () => {
    renderNav("market");
    expect(hrefs()).toEqual(["/", "/orders", "/new-orders", "/cash-box", "button:Menyu"]);
    expect(screen.queryByRole("link", { name: "Skaner" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Mahsulotlar" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Yaratish" })).toHaveAttribute("href", "/new-orders");
    expect(screen.getByRole("link", { name: "To'lovlar" })).toHaveAttribute("href", "/cash-box");
    expect(screen.getByRole("button", { name: "Menyu" })).toHaveAttribute("aria-haspopup", "dialog");
  });

  it.each(["logist", "market_operator", "investor"] as const)(
    "%s (ROL-0): menyusi hali bo'sh — pastki menyu chizilmaydi (yolg'iz «Menyu» yoki admin havolalari yo'q)",
    (role) => {
      renderNav(role);
      expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
      expect(screen.queryAllByRole("link")).toHaveLength(0);
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    },
  );
});

describe("BottomNav — filial turi va ruxsat", () => {
  const BRANCH_TYPES: (BranchType | null)[] = ["HQ", "REGIONAL", "HYBRID", "PICKUP", null];

  it.each([
    ["HYBRID", "/dispatch", "Biriktirish"],
    ["REGIONAL", "/dispatch", "Biriktirish"],
    // Filialda jo'natish yo'q — 4-katak «Qabul» (boshqa skaner rollaridagidek).
    ["HQ", "/new-orders", "Qabul"],
    ["PICKUP", "/new-orders", "Qabul"],
    // Filial turi aniqlanmagan — bazaviy menyu; markaz siljimasin deb katak bo'sh qolmaydi.
    [null, "/products", "Mahsulotlar"],
  ] as const)("menejer %s: 4-katak %s", (branchType, href, label) => {
    renderNav("manager", { branchType, route: "/branch-dashboard" });
    expect(hrefs()).toEqual(["/branch-dashboard", "/orders", "/scan", href, "button:Menyu"]);
    expect(cells()[3]).toHaveTextContent(label);
  });

  it.each(["registrator", "courier"] as const)("%s: filial turidan qat'i nazar bir xil 5 katak", (role) => {
    const results = BRANCH_TYPES.map((branchType) => {
      const { unmount } = renderNav(role, { branchType });
      const result = hrefs();
      unmount();
      return result;
    });
    for (const result of results) expect(result).toEqual(results[0]);
    expect(results[0]).toHaveLength(5);
  });

  it("har havola foydalanuvchining O'Z menyusidagi yo'l (yoki skaner) — pastki menyu yangi yo'l ochmaydi", () => {
    for (const role of ["superadmin", "admin", "manager", "registrator", "market", "courier"] as const) {
      for (const branchType of BRANCH_TYPES) {
        const { unmount } = renderNav(role, { branchType });
        const allowed = new Set(getSidebarConfigForUser(role, userOf(role, branchType)).map((item) => item.to));
        const links = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
        for (const href of links) {
          expect(href === "/scan" || allowed.has(href ?? ""), `${role}/${branchType ?? "none"}: ${href}`).toBe(true);
        }
        expect(cells()).toHaveLength(5);
        unmount();
      }
    }
  });

  it("menyusi yo'q rolga (operator) admin havolalari berilmaydi — pastki menyu chizilmaydi", () => {
    renderNav("operator");

    // Avval operator admin menyusini olardi — /all-users, /payments, ... hammasi 403.
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});

describe("BottomNav — ochiq bo'lim (aria-current)", () => {
  it("ichki sahifada ham bo'lim tanlangan, boshqalari tanlanmagan", () => {
    renderNav("admin", { route: "/orders/123" });
    const current = cells().filter((cell) => cell.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent("Buyurtmalar");
    expect(current[0]).toHaveClass("aria-[current=page]:text-action-fg");
  });

  it("«Bosh sahifa» faqat aynan o'z yo'lida tanlanadi (`end`)", () => {
    renderNav("superadmin", { route: "/" });
    expect(screen.getByRole("link", { name: "Bosh sahifa" })).toHaveAttribute("aria-current", "page");
  });

  it("pastki menyuda yo'q bo'lim (Pochta) ochiq — hech bir katak tanlanmaydi", () => {
    renderNav("superadmin", { route: "/mails" });
    expect(cells().some((cell) => cell.hasAttribute("aria-current"))).toBe(false);
  });

  it("kutilayotgan o'tishda bosilgan katak darhol tanlanadi (useNavPathname)", () => {
    pending.path = "/new-orders";
    try {
      renderNav("superadmin", { route: "/orders" });
      expect(screen.getByRole("link", { name: "Qabul" })).toHaveAttribute("aria-current", "page");
      expect(screen.getByRole("link", { name: "Buyurtmalar" })).not.toHaveAttribute("aria-current");
    } finally {
      pending.path = null;
    }
  });
});

describe("BottomNav — «Menyu» va kirish qulayligi", () => {
  it("«Menyu» suriluvchi menyuni ochadi (shell shartnomasi, useMobileMenu)", async () => {
    const user = userEvent.setup();
    const { store } = renderNav("courier", { branchType: "REGIONAL" });
    const menuButton = screen.getByRole("button", { name: "Menyu" });

    expect(menuButton).toHaveAttribute("aria-haspopup", "dialog");
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
    await user.click(menuButton);

    expect(store.getState().sidebar.isMobileMenuOpen).toBe(true);
    expect(menuButton).toHaveAttribute("aria-expanded", "true");
  });

  it("navigatsiya nomlangan, ikonkalar bezak, har katakda ko'rinadigan yorliq", () => {
    renderNav("superadmin");
    const nav = screen.getByRole("navigation", { name: "Asosiy bo'limlar" });
    for (const cell of cells()) {
      expect(cell.textContent?.trim()).not.toBe("");
      for (const svg of cell.querySelectorAll("svg")) expect(svg).toHaveAttribute("aria-hidden", "true");
      // Kesilgan yorliqning to'liq nomi (maket: «to'liq nom aria-label va title da»).
      expect(cell).toHaveAttribute("title", cell.textContent ?? "");
    }
    expect(within(nav).getByRole("link", { name: "Skaner" })).toHaveAttribute("href", "/scan");
  });
});

describe("BottomNav — ko'rinish (maket `.el-bottomnav`)", () => {
  it("panel: yaxlit `surface` fon + ustki chiziq (shaffof/xira emas), 64px + safe-area, faqat telefonda", () => {
    renderNav("admin");
    const nav = screen.getByRole("navigation");
    expect(nav).toHaveClass(
      "fixed",
      "inset-x-0",
      "bottom-0",
      "bg-surface",
      "border-t",
      "border-border",
      "h-[calc(4rem+env(safe-area-inset-bottom))]",
      "pb-[env(safe-area-inset-bottom)]",
      "md:hidden",
      // «Yopishqoq» qatlam: yuqori panel slotidan (`z-40`, dashboardLayout.test) past — profil menyusi uni yopadi.
      "z-30",
    );
    expect(nav.className).not.toMatch(/backdrop|blur|\/\d|rounded-2xl|shadow-\[/);
    // Teng ustunlar (5 katak — 5 ta bir xil kenglik).
    expect(nav).toHaveClass("grid", "grid-flow-col", "auto-cols-fr");
  });

  it("katak: ≥ 44px (butun katak bosiladi), yorliq 12px/600 bitta qatorda, sig'masa «…»", () => {
    renderNav("courier", { branchType: "REGIONAL" });
    for (const cell of cells()) {
      expect(cell).toHaveClass("min-w-0", "flex-col", "text-xs", "font-semibold", "-outline-offset-6!", "rounded-xl");
      const label = cell.querySelector("span:last-child");
      expect(label).toHaveClass("block", "max-w-full", "truncate");
    }
  });

  it("oddiy katak kulrang, skaner yorlig'i to'q, skaner doirasi 52px `action`", () => {
    renderNav("manager", { branchType: "HYBRID" });
    expect(screen.getByRole("link", { name: "Bosh sahifa" })).toHaveClass("text-text-muted");
    const scan = screen.getByRole("link", { name: "Skaner" });
    expect(scan).toHaveClass("text-text");
    const fab = scan.querySelector("span");
    expect(fab).toHaveClass("size-13", "-mt-7", "rounded-full", "border-4", "border-surface", "bg-action", "text-on-solid");
    // Bosilgan holat (`tizim-states-navigation` 3): maket `box-shadow: 0 0 0 6px var(--focus)` — `action-soft` emas
    // (kunduzgi mavzuda oq fonda ko'rinmaydi).
    expect(fab).toHaveClass("group-active:scale-[.94]", "group-active:bg-action-hover", "group-active:ring-6", "group-active:ring-focus");
    expect(fab?.className).not.toMatch(/ring-action-soft/);
  });
});

describe("BottomNav — kontekstli «Skaner» (ega qarori 2026-10-19)", () => {
  const ScanTargetProbe = () => {
    useScanTarget({ id: "new-orders:market:7", title: "Qabul qilish", onScan: vi.fn() });
    return null;
  };
  const LocationProbe = () => <span data-testid="path">{useLocation().pathname}</span>;

  afterEach(() => {
    resetScanTargets();
    resetScannerHost();
  });

  it("sahifada skan maqsadi bor — kamera shu sahifa ustida (o'tish yo'q), nomi kontekstni aytadi", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <ScanTargetProbe />
        <BottomNav />
        <LocationProbe />
      </>,
      { route: "/new-orders/7", preloadedState: stateOf("superadmin") },
    );
    const scan = screen.getByRole("link", { name: "Skaner — Qabul qilish" });
    expect(scan).toHaveAttribute("href", "/scan");
    expect(scan).toHaveAttribute("aria-haspopup", "dialog");
    expect(scan).toHaveAttribute("title", "Skaner");
    await user.click(scan);
    expect(isScannerOverlayOpen()).toBe(true);
    expect(screen.getByTestId("path")).toHaveTextContent("/new-orders/7");
  });

  it("maqsad yo'q — universal /scan ga o'tadi", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <BottomNav />
        <LocationProbe />
      </>,
      { route: "/", preloadedState: stateOf("courier", "REGIONAL") },
    );
    const scan = screen.getByRole("link", { name: "Skaner" });
    expect(scan).not.toHaveAttribute("aria-haspopup");
    await user.click(scan);
    expect(isScannerOverlayOpen()).toBe(false);
    expect(screen.getByTestId("path")).toHaveTextContent("/scan");
  });
});
