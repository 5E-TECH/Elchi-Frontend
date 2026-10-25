import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import i18n, { i18nReady } from "../../../i18n";
import { renderWithProviders } from "../../../test/test-utils";
import type { User } from "../../../entities/user/model/types";
import { CODE_DESIGN_ROLES, designRoleInCode } from "../../../test/designMenu";
import { api } from "../../../shared/api/api";
import { DEFAULT_SETTINGS, SETTINGS_KEY, type AppSettings } from "../../../entities/settings";
import type { BranchType } from "../model/menuConfig";
import Sidebar from "./Sidebar";

/**
 * YON MENYU (≥ 1024) — maket `.el-sidebar` / `.el-nav*`, menyu va guruhlar `design/kit/roles.json`,
 * holatlar taxtasi `tizim-states-navigation`.
 */

// MemoryRouter'da `window.location` o'zgarmaydi — kutilayotgan o'tish o'rniga router yo'li.
const pending = vi.hoisted(() => ({ path: null as string | null }));
vi.mock("../../../shared/lib/navigationPending", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../shared/lib/navigationPending")>()),
  useNavPathname: () => {
    const { pathname } = useLocation();
    return pending.path ?? pathname;
  },
}));

// XtcEyQjb: menejerning «Ombor» bandi — faqat o'z filialida ombor bo'lsa (`GET /warehouses` bo'sh emas). Sukut — bor
// (maket personasi); haqiqiy so'rov ketmaydi.
const ownWarehouse = vi.hoisted(() => ({ exists: true as boolean | undefined }));
vi.mock("../../../entities/warehouse/api/ownWarehouse", () => ({
  useHasOwnWarehouse: (enabled: boolean) => (enabled ? ownWarehouse.exists : undefined),
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
type DesignMenuItem = { key: string; label: string; group?: string };
// Maket menyusi — kodda bor rollar, kodda hali yo'q bandlarsiz (`route-map.json` → `plannedMenu`).
const ROLES = Object.fromEntries(CODE_DESIGN_ROLES.map((role) => [role, designRoleInCode(role)])) as unknown as Record<
  DesignRole,
  { grouped: boolean; menu: DesignMenuItem[] }
>;

/** Maket personasi filiali (`app-shot` sukuti): menejer — HYBRID (to'liq menyu), registrator — HQ, kuryer — REGIONAL. */
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

const stateOf = (
  role: string,
  { branchType = null, open = true }: { branchType?: BranchType | null; open?: boolean } = {},
) =>
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
    sidebar: { isOpen: open, isMobileMenuOpen: false },
  }) as never;

const renderSidebar = (
  role: string,
  {
    branchType = null,
    open = true,
    route = "/",
  }: { branchType?: BranchType | null; open?: boolean; route?: string } = {},
) =>
  renderWithProviders(<Sidebar />, { route, preloadedState: stateOf(role, { branchType, open }) });

const mainNav = () => screen.getByRole("navigation", { name: "Asosiy bo'limlar" });
// `queryAll` — yangi rollarning (logist, market operatori, investor) menyusi hali bo'sh (ROL-0).
const linkNames = () =>
  within(mainNav())
    .queryAllByRole("link")
    .map((link) => link.textContent?.trim());
const groupHeaders = () =>
  within(mainNav())
    .queryAllByRole("button")
    .map((button) => button.textContent?.trim());

beforeAll(async () => {
  await i18nReady;
  await i18n.changeLanguage("uz");
});

afterEach(() => {
  pending.path = null;
  localStorage.removeItem("sidebar:collapsedGroups");
  ownWarehouse.exists = true;
  vi.restoreAllMocks();
});

describe("Sidebar — maketdagi menyu (roles.json)", () => {
  const roles = Object.keys(ROLES) as DesignRole[];

  it.each(roles)("%s: bandlar, yorliqlar va guruh sarlavhalari maketdagidek", (role) => {
    renderSidebar(role, { branchType: DEFAULT_BRANCH[role] ?? null });
    const design = ROLES[role];

    expect(screen.getByRole("complementary", { name: "Asosiy menyu" })).toBeInTheDocument();
    expect(linkNames()).toEqual(design.menu.map((item) => item.label));

    const expectedGroups = design.grouped
      ? [...new Set(design.menu.map((item) => item.group).filter(Boolean))].map((group) =>
          group!.toUpperCase(),
        )
      : [];
    // Sarlavha CSS bilan katta harf (`uppercase`); matnning o'zi gap registrida.
    expect(groupHeaders().map((header) => header?.toUpperCase())).toEqual(expectedGroups);
  });

  it("logotip oq (navy fon), ikkala mavzuda bir xil", () => {
    renderSidebar("superadmin");
    expect(screen.getByRole("img", { name: "Elchi Pochta" })).toHaveAttribute(
      "src",
      expect.stringContaining("elchi-logo-white"),
    );
  });

  it("kanonik ikonkalar: Qabul — Inbox, Mahsulotlar — Tag", () => {
    renderSidebar("superadmin");
    expect(
      screen.getByRole("link", { name: "Qabul va yaratish" }).querySelector("svg.lucide-inbox"),
    ).not.toBeNull();
    expect(
      screen.getByRole("link", { name: "Mahsulotlar" }).querySelector("svg.lucide-tag"),
    ).not.toBeNull();
  });
});

describe("Sidebar — faol band", () => {
  it("ichki sahifada ota bo'lim faol, faqat bitta band", () => {
    renderSidebar("superadmin", { route: "/orders/42" });

    const current = within(mainNav())
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(current.map((link) => link.textContent)).toEqual(["Buyurtmalar"]);
  });

  it("menyuda alohida bandi yo'q sahifada maketdagi ota band faol (Ops eski manzili → «Ops vositalari»)", () => {
    renderSidebar("superadmin", { route: "/finance-operators" });
    expect(screen.getByRole("link", { name: "Ops vositalari" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("bosh sahifa faqat aynan `/` da", () => {
    renderSidebar("admin", { route: "/" });
    expect(screen.getByRole("link", { name: "Bosh sahifa" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("bosilgan band sahifa yuklanguncha ham darhol tanlangan (useNavPathname)", () => {
    pending.path = "/payments";
    renderSidebar("admin", { route: "/orders" });

    expect(screen.getByRole("link", { name: "To'lovlar" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Buyurtmalar" })).not.toHaveAttribute("aria-current");
  });
});

describe("Sidebar — guruhlar va yig'ish", () => {
  it("guruh sarlavhasi bosilsa guruh yig'iladi, holat brauzerda eslab qolinadi", async () => {
    const user = userEvent.setup();
    const view = renderSidebar("superadmin");

    const finance = screen.getByRole("button", { name: "Moliya" });
    expect(finance).toHaveAttribute("aria-expanded", "true");
    await user.click(finance);

    expect(finance).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: "Balans" })).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("sidebar:collapsedGroups") ?? "[]")).toEqual([
      "finance",
    ]);

    view.unmount();
    renderSidebar("superadmin");
    expect(screen.getByRole("button", { name: "Moliya" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("buzilgan localStorage menyuni yiqitmaydi", () => {
    localStorage.setItem("sidebar:collapsedGroups", "{not json");
    renderSidebar("superadmin");
    expect(screen.getByRole("link", { name: "Balans" })).toBeInTheDocument();
  });

  it("«Yashirish» → 72px: faqat ikonkalar, nomlari aria-label da, barcha bandlar ko'rinadi", async () => {
    const user = userEvent.setup();
    localStorage.setItem("sidebar:collapsedGroups", JSON.stringify(["finance"]));
    const { store } = renderSidebar("superadmin");

    await user.click(screen.getByRole("button", { name: "Yashirish" }));

    expect(store.getState().sidebar.isOpen).toBe(false);
    const aside = screen.getByRole("complementary", { name: "Asosiy menyu" });
    expect(aside.className).toContain("w-[72px]");
    // Yig'ilgan guruh ham ko'rinadi (taxta qoidasi 5), sarlavha o'rnida chiziq.
    expect(screen.getByRole("link", { name: "Balans" })).toBeInTheDocument();
    expect(within(mainNav()).queryAllByRole("button")).toHaveLength(0);
    expect(within(mainNav()).getAllByRole("link")).toHaveLength(ROLES.superadmin.menu.length);
    expect(screen.getByRole("link", { name: "Buyurtmalar" }).textContent).toBe("");

    await user.click(screen.getByRole("button", { name: "Menyuni kengaytirish" }));
    expect(store.getState().sidebar.isOpen).toBe(true);
  });

  it("«Yashirish» serverdagi sozlamaga ham yoziladi — qayta kirishda va mavzu/til almashganda saqlanadi", async () => {
    const user = userEvent.setup();
    const patch = vi.spyOn(api, "patch").mockResolvedValue({ data: {} });
    const { store, queryClient } = renderSidebar("superadmin");
    queryClient.setQueryData(SETTINGS_KEY, DEFAULT_SETTINGS);

    await user.click(screen.getByRole("button", { name: "Yashirish" }));

    expect(store.getState().sidebar.isOpen).toBe(false);
    // `SettingsSync` keshdagi qiymatni qayta qo'llaydi — u ham yangilangan bo'lishi shart.
    expect(queryClient.getQueryData<AppSettings>(SETTINGS_KEY)?.interface.sidebarOpen).toBe(false);
    await vi.waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    expect(patch.mock.calls[0][1]).toMatchObject({
      settings: { interface: { sidebarOpen: false } },
    });

    await user.click(screen.getByRole("button", { name: "Menyuni kengaytirish" }));
    expect(store.getState().sidebar.isOpen).toBe(true);
    await vi.waitFor(() => expect(patch).toHaveBeenCalledTimes(2));
    expect(patch.mock.calls[1][1]).toMatchObject({
      settings: { interface: { sidebarOpen: true } },
    });
  });

  it("sozlamalar hali yuklanmagan bo'lsa serverga yozilmaydi (sukut qiymatlar mavzu/tilni bosib ketmasin)", async () => {
    const user = userEvent.setup();
    const patch = vi.spyOn(api, "patch").mockResolvedValue({ data: {} });
    const { store } = renderSidebar("superadmin");

    await user.click(screen.getByRole("button", { name: "Yashirish" }));

    expect(store.getState().sidebar.isOpen).toBe(false);
    expect(patch).not.toHaveBeenCalled();
  });

  it("yig'ilgan menyuda nom maslahati: hover va fokusda chiqadi, Escape yopadi", async () => {
    renderSidebar("admin", { open: false });

    const link = screen.getByRole("link", { name: "Pochta" });
    fireEvent.pointerEnter(link);
    expect(screen.getByText("Pochta")).toHaveAttribute("aria-hidden", "true");

    act(() => link.focus());
    fireEvent.keyDown(link, { key: "Escape" });
    expect(screen.queryByText("Pochta")).not.toBeInTheDocument();
  });
});

describe("Sidebar — menejer filial turi", () => {
  it("filial turi aniqlanmasa ogohlantirish va bazaviy menyu", () => {
    renderSidebar("manager", { branchType: null });

    expect(screen.getByRole("status")).toHaveTextContent("Filial turi aniqlanmadi");
    expect(screen.getByRole("status")).toHaveTextContent("Menyuning bir qismi yashirin");
    expect(linkNames()).toEqual(["Bosh sahifa", "Buyurtmalar", "Mahsulotlar", "Hududlar"]);
  });

  it("XtcEyQjb: «Ombor» — faqat o'z filialida ombor bo'lsa (javob kelguncha ham yashirin)", () => {
    ownWarehouse.exists = false;
    const view = renderSidebar("manager", { branchType: "REGIONAL" });
    expect(linkNames()).not.toContain("Ombor");
    view.unmount();

    ownWarehouse.exists = undefined;
    const pendingView = renderSidebar("manager", { branchType: "HYBRID" });
    expect(linkNames()).not.toContain("Ombor");
    pendingView.unmount();

    ownWarehouse.exists = true;
    renderSidebar("manager", { branchType: "REGIONAL" });
    expect(screen.getByRole("link", { name: "Ombor" })).toHaveAttribute("href", "/warehouses");
  });

  it("filial turi bor bo'lsa ogohlantirish yo'q", () => {
    renderSidebar("manager", { branchType: "REGIONAL" });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("kuryer kassasi «Kassa», market — «To'lovlar»", () => {
    const view = renderSidebar("courier", { branchType: "REGIONAL" });
    expect(screen.getByRole("link", { name: "Kassa" })).toHaveAttribute("href", "/cash-box");
    view.unmount();

    renderSidebar("market");
    expect(screen.getByRole("link", { name: "To'lovlar" })).toHaveAttribute("href", "/cash-box");
  });
});
