import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { useState, type ReactNode } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import i18n, { i18nReady } from "../../../i18n";
import { renderWithProviders } from "../../../test/test-utils";
import type { User } from "../../../entities/user/model/types";
import { CODE_DESIGN_ROLES, designRoleInCode } from "../../../test/designMenu";
import type { BranchType } from "../model/menuConfig";
import MobileMenu from "./MobileMenu";

/**
 * SURILUVCHI MENYU (< 1024) — maket `courier-dashboard-mobile-menu`: planshetda chapdan navy panel,
 * telefonda pastki varaqa. Bandlar, guruhlar va yorliqlar yon menyu bilan bir xil (roles.json).
 */

const pending = vi.hoisted(() => ({ path: null as string | null }));
vi.mock("../../../shared/lib/navigationPending", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../shared/lib/navigationPending")>()),
  useNavPathname: () => {
    const { pathname } = useLocation();
    return pending.path ?? pathname;
  },
}));

const logoutSpy = vi.hoisted(() => vi.fn());
vi.mock("../../../shared/lib/useLogout", () => ({
  useLogout: () => ({ logout: logoutSpy }),
}));

const unread = vi.hoisted(() => ({ count: 0 }));
vi.mock("../../../entities/notification-inbox/api/inboxApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../entities/notification-inbox/api/inboxApi")>()),
  getInboxUnreadCount: vi.fn(async () => unread.count),
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

const DEFAULT_BRANCH: Partial<Record<DesignRole, BranchType>> = {
  manager: "HYBRID",
  registrator: "HQ",
  courier: "REGIONAL",
};

const stateOf = (
  role: string,
  branchType: BranchType | null,
  extra: Record<string, unknown> = {},
) =>
  ({
    role: { id: `${role}-1`, role, region: null, name: role },
    user: {
      user: {
        id: "1",
        role,
        name: role,
        ...(branchType ? { branch_type: branchType, branch: { id: "1", type: branchType } } : {}),
        ...extra,
      } as unknown as User,
      isAuthenticated: true,
      accessToken: null,
      loading: false,
      isAppInitializing: false,
      error: null,
    },
  }) as never;

const LocationProbe = () => {
  const { pathname, search } = useLocation();
  return <span data-testid="path">{`${pathname}${search}`}</span>;
};

const renderMenu = (
  ui: ReactNode,
  role: DesignRole | string = "admin",
  {
    branchType = DEFAULT_BRANCH[role as DesignRole] ?? null,
    route = "/orders",
    user = {},
  }: { branchType?: BranchType | null; route?: string; user?: Record<string, unknown> } = {},
) =>
  renderWithProviders(
    <>
      {ui}
      <LocationProbe />
    </>,
    { route, preloadedState: stateOf(role, branchType, user) },
  );

/** Telefon (< 768) — `matchMedia("(max-width: 767px)")` mos keladi. */
const asPhone = () => {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: query.includes("max-width: 767px"),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as unknown as MediaQueryList,
  );
};

const sectionsNav = () => screen.getByRole("navigation", { name: "Asosiy bo'limlar" });

beforeAll(async () => {
  await i18nReady;
  await i18n.changeLanguage("uz");
});

afterEach(() => {
  pending.path = null;
  unread.count = 0;
  logoutSpy.mockReset();
  vi.restoreAllMocks();
});

describe("MobileMenu — klaviatura va dialog", () => {
  it("modal dialog «Menyu», ochilganda fokus ichida", () => {
    renderMenu(<MobileMenu isOpen onClose={vi.fn()} />);

    const dialog = screen.getByRole("dialog", { name: "Menyu" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("yopiq bo'lsa hech narsa chizilmaydi", () => {
    renderMenu(<MobileMenu isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Escape — onClose", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderMenu(<MobileMenu isOpen onClose={onClose} />);

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("fon (overlay) bosilsa yopiladi; «Menyuni yopish» tugmasi ham", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderMenu(<MobileMenu isOpen onClose={onClose} />);

    await user.click(screen.getByRole("dialog").querySelector(".bg-overlay") as HTMLElement);
    await user.click(screen.getByRole("button", { name: "Menyuni yopish" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("Tab menyu ichida aylanadi", async () => {
    const user = userEvent.setup();
    renderMenu(
      <>
        <button type="button">fon</button>
        <MobileMenu isOpen onClose={vi.fn()} />
      </>,
    );
    const dialog = screen.getByRole("dialog");

    for (let i = 0; i < 30; i += 1) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  it("yopilganda fokus ochgan tugmaga qaytadi", async () => {
    const user = userEvent.setup();
    const Harness = () => {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Menyuni ochish
          </button>
          <MobileMenu isOpen={open} onClose={() => setOpen(false)} />
        </>
      );
    };
    renderMenu(<Harness />);

    const opener = screen.getByRole("button", { name: "Menyuni ochish" });
    await user.click(opener);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});

describe("MobileMenu — planshet paneli (768–1023)", () => {
  const roles = Object.keys(ROLES) as DesignRole[];

  it.each(roles)("%s: bandlar, yorliqlar va guruhlar yon menyudagidek", (role) => {
    renderMenu(<MobileMenu isOpen onClose={vi.fn()} />, role);
    const design = ROLES[role];

    expect(screen.getByRole("dialog").querySelector('[data-mobile-menu="drawer"]')).not.toBeNull();
    // `queryAll` — yangi rollarning menyusi hali bo'sh (ROL-0; har band o'z sahifasi bilan keladi).
    expect(
      within(sectionsNav())
        .queryAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(design.menu.map((item) => item.label));
    const groups = design.grouped
      ? [...new Set(design.menu.map((item) => item.group).filter(Boolean))]
      : [];
    for (const group of groups) {
      expect(within(sectionsNav()).getByRole("list", { name: group })).toBeInTheDocument();
    }
  });

  it("faol band — joriy bo'lim (ichki sahifada ota bo'lim)", () => {
    renderMenu(<MobileMenu isOpen onClose={vi.fn()} />, "superadmin", { route: "/orders/42" });

    const current = within(sectionsNav())
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(current.map((link) => link.textContent)).toEqual(["Buyurtmalar"]);
  });

  it("band bosilsa o'tadi va menyu yopiladi (joriy band bosilsa ham)", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderMenu(<MobileMenu isOpen onClose={onClose} />, "courier");

    await user.click(screen.getByRole("link", { name: "Kassa" }));
    expect(screen.getByTestId("path")).toHaveTextContent("/cash-box");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("foydalanuvchi bloki: ism, rol · filial, profilga havola; «Chiqish»", async () => {
    const user = userEvent.setup();
    renderMenu(<MobileMenu isOpen onClose={vi.fn()} />, "courier", {
      user: {
        name: "Jasur Tursunov",
        branch: { id: "1", type: "REGIONAL", name: "Chilonzor filiali" },
      },
    });

    const profile = screen.getByRole("link", { name: "Profilni ochish: Jasur Tursunov" });
    expect(profile).toHaveAttribute("href", "/profile");
    expect(profile).toHaveTextContent("JT");
    expect(profile).toHaveTextContent("Kuryer · Chilonzor filiali");

    await user.click(screen.getByRole("button", { name: "Chiqish" }));
    expect(logoutSpy).toHaveBeenCalledTimes(1);
  });

  it("qidiruv buyurtmalar ro'yxatiga o'tadi va menyuni yopadi", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderMenu(<MobileMenu isOpen onClose={onClose} />, "admin", { route: "/" });

    await user.type(screen.getByRole("searchbox", { name: "Qidiruv" }), "  Dilnoza {Enter}");
    expect(screen.getByTestId("path")).toHaveTextContent("/orders?search=Dilnoza");
    expect(onClose).toHaveBeenCalled();
  });

  it("menejerga filial turi biriktirilmagan — ogohlantirish", () => {
    renderMenu(<MobileMenu isOpen onClose={vi.fn()} />, "manager", { branchType: null });
    expect(screen.getByRole("status")).toHaveTextContent("Filial turi aniqlanmadi");
  });
});

describe("MobileMenu — telefon varaqasi (< 768)", () => {
  it("sarlavha, foydalanuvchi kartasi, bo'lim kataklari, shaxsiy qatorlar va «Chiqish»", async () => {
    asPhone();
    const user = userEvent.setup();
    renderMenu(<MobileMenu isOpen onClose={vi.fn()} />, "courier", {
      route: "/",
      user: { name: "Jasur Tursunov" },
    });

    const dialog = screen.getByRole("dialog", { name: "Menyu" });
    expect(dialog.querySelector('[data-mobile-menu="sheet"]')).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Menyu" })).toBeVisible();
    expect(
      within(sectionsNav())
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(ROLES.courier.menu.map((item) => item.label));
    expect(screen.getByRole("link", { name: "Bosh sahifa" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: "Profilni ochish: Jasur Tursunov" }),
    ).toBeInTheDocument();

    const personal = screen.getByRole("navigation", { name: "Shaxsiy bo'limlar" });
    expect(
      within(personal)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href")),
    ).toEqual(["/inbox", "/settings"]);

    await user.click(screen.getByRole("button", { name: "Chiqish" }));
    expect(logoutSpy).toHaveBeenCalledTimes(1);
  });

  it("uzun menyu (superadmin) kataklari guruh sarlavhalari bilan", () => {
    asPhone();
    renderMenu(<MobileMenu isOpen onClose={vi.fn()} />, "superadmin");

    for (const group of ["Ish", "Moliya", "Ma'lumotnoma", "Tizim"]) {
      expect(within(sectionsNav()).getByRole("list", { name: group })).toBeInTheDocument();
    }
  });

  it("katakda qisqa yorliq (roles.json → short): «Qabul», marketda «Yaratish»; to'liq nom — aria-label", () => {
    asPhone();
    const view = renderMenu(<MobileMenu isOpen onClose={vi.fn()} />, "admin");
    const intake = within(sectionsNav()).getByRole("link", { name: "Qabul va yaratish" });
    expect(intake).toHaveTextContent(/^Qabul$/);
    expect(intake).toHaveAttribute("title", "Qabul va yaratish");
    view.unmount();

    renderMenu(<MobileMenu isOpen onClose={vi.fn()} />, "market");
    expect(
      within(sectionsNav()).getByRole("link", { name: "Qabul va yaratish" }),
    ).toHaveTextContent(/^Yaratish$/);
  });

  it("ru: 375px katakka sig'maydigan nomlar qisqa shaklda; ekran o'quvchi nomi ko'ringan so'zdan boshlanadi", async () => {
    asPhone();
    await i18n.changeLanguage("ru");
    try {
      const view = renderMenu(<MobileMenu isOpen onClose={vi.fn()} />, "superadmin");
      const ruSections = () => screen.getByRole("navigation", { name: "Основные разделы" });
      const nav = ruSections();
      // To'liq nom qisqasini o'z ichiga oladi — nom to'liq.
      expect(within(nav).getByRole("link", { name: "Журнал активности" })).toHaveTextContent(
        /^Журнал$/,
      );
      expect(within(nav).getByRole("link", { name: "Ops-инструменты" })).toHaveTextContent(
        /^Инструменты$/,
      );
      view.unmount();

      // Maket `short.ru` («Закрыть день») to'liq nomda yo'q — nom ko'ringan so'z + to'liq nom.
      const courier = renderMenu(<MobileMenu isOpen onClose={vi.fn()} />, "courier");
      const quick = within(ruSections()).getByRole("link", {
        name: "Закрыть день (Быстрое действие)",
      });
      expect(quick).toHaveTextContent(/^Закрыть день$/);
      expect(quick).toHaveAttribute("title", "Быстрое действие");
      courier.unmount();

      renderMenu(<MobileMenu isOpen onClose={vi.fn()} />, "market");
      expect(
        within(ruSections()).getByRole("link", { name: "Создать (Приём и создание)" }),
      ).toHaveTextContent(/^Создать$/);
    } finally {
      await i18n.changeLanguage("uz");
    }
  });
});

describe("MobileMenu — rol personasi (ROL-0)", () => {
  it.each([
    ["investor", false],
    // Menyu qidiruvi `/orders?search=` ga olib boradi — buyurtmalar hali ochilmagan rolda (LG-4 / MO-3 gacha) yo'q.
    ["logist", false],
    ["market_operator", false],
    ["market", true],
    ["courier", true],
  ] as const)("%s: menyu qidiruvi — %s (investor maketida qidiruv yo'q; 403 ga olib bormaydi)", (role, hasSearch) => {
    renderMenu(<MobileMenu isOpen onClose={vi.fn()} />, role);
    if (hasSearch) expect(screen.getByRole("searchbox", { name: "Qidiruv" })).toBeInTheDocument();
    else expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });

  it("investor varaqasi (telefon): qidiruvsiz; profil (rol «Investor»), Bildirishnomalar, Sozlamalar, Chiqish", () => {
    asPhone();
    renderMenu(<MobileMenu isOpen onClose={vi.fn()} />, "investor", { route: "/" });

    expect(screen.getByRole("dialog").querySelector('[data-mobile-menu="sheet"]')).not.toBeNull();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Profilni ochish/ })).toHaveTextContent("Investor");
    expect(screen.getByRole("link", { name: /Bildirishnomalar/ })).toHaveAttribute("href", "/inbox");
    expect(screen.getByRole("link", { name: /Sozlamalar/ })).toHaveAttribute("href", "/settings");
    expect(screen.getByRole("button", { name: "Chiqish" })).toBeInTheDocument();
  });

  it("yangi rollar menyusida moliya bo'limlari yo'q (logist — ega LG-S1)", () => {
    for (const role of ["logist", "market_operator", "investor"]) {
      const view = renderMenu(<MobileMenu isOpen onClose={vi.fn()} />, role, { route: "/" });
      const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
      for (const finance of ["/payments", "/cash-box", "/financial-balance"]) {
        expect(hrefs, `${role}: ${finance}`).not.toContain(finance);
      }
      view.unmount();
    }
  });
});

describe("MobileMenu — bildirishnomalar", () => {
  it("shaxsiy bildirishnomalar qutisiga olib boradi (Telegram guruhlariga emas)", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderMenu(<MobileMenu isOpen onClose={onClose} />, "courier");

    await user.click(screen.getByRole("link", { name: "Bildirishnomalar" }));

    expect(screen.getByTestId("path")).toHaveTextContent("/inbox");
    expect(onClose).toHaveBeenCalled();
  });

  it("o'qilmagan yo'q — son ham, nuqta ham yo'q", async () => {
    unread.count = 0;
    // Menejer menyusida `/notifications` yo'q — quti oddiy «Bildirishnomalar» (admin/superadmin — «… qutisi»).
    renderMenu(<MobileMenu isOpen onClose={vi.fn()} />, "manager");

    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Bildirishnomalar" })).toBeInTheDocument(),
    );
    expect(screen.getByRole("link", { name: "Bildirishnomalar" }).textContent).toBe(
      "Bildirishnomalar",
    );
  });

  it("API'dagi haqiqiy son, o'zgarsa yangilanadi", async () => {
    unread.count = 3;
    // Menejer menyusida Telegram guruhlari (`/notifications`) yo'q — quti nomi «Bildirishnomalar».
    const { queryClient } = renderMenu(<MobileMenu isOpen onClose={vi.fn()} />, "manager");

    const link = await screen.findByRole("link", { name: "Bildirishnomalar, 3 ta yangi" });
    expect(link).toHaveAttribute("href", "/inbox");
    expect(link).toHaveTextContent(/3$/);

    unread.count = 7;
    await queryClient.invalidateQueries();
    expect(
      await screen.findByRole("link", { name: "Bildirishnomalar, 7 ta yangi" }),
    ).toHaveTextContent(/7$/);
  });

  it("katta son «99+»", async () => {
    unread.count = 150;
    // Admin menyusida Telegram guruhlari ham bor (NG-A) — quti «Bildirishnomalar qutisi».
    renderMenu(<MobileMenu isOpen onClose={vi.fn()} />);

    expect(
      await screen.findByRole("link", { name: "Bildirishnomalar qutisi, 150 ta yangi" }),
    ).toHaveTextContent(/99\+$/);
  });

  it("telefonda son qizil belgi (`menu-unread-badge`)", async () => {
    asPhone();
    unread.count = 4;
    renderMenu(<MobileMenu isOpen onClose={vi.fn()} />);

    expect(await screen.findByTestId("menu-unread-badge")).toHaveTextContent(/^4$/);
  });

  it("Telegram guruhlari (`/notifications`) superadmin va admin menyusida (NG-A); u yerda quti «Bildirishnomalar qutisi»", () => {
    for (const role of ["superadmin", "admin"]) {
      const view = renderMenu(<MobileMenu isOpen onClose={vi.fn()} />, role);
      expect(within(sectionsNav()).getByRole("link", { name: "Bildirishnomalar" })).toHaveAttribute(
        "href",
        "/notifications",
      );
      expect(screen.getByRole("link", { name: "Bildirishnomalar qutisi" })).toHaveAttribute(
        "href",
        "/inbox",
      );
      view.unmount();
    }

    for (const role of ["manager", "market", "courier", "registrator"]) {
      const roleView = renderMenu(<MobileMenu isOpen onClose={vi.fn()} />, role);
      expect(
        screen
          .getAllByRole("link")
          .filter((link) => link.getAttribute("href") === "/notifications"),
      ).toHaveLength(0);
      roleView.unmount();
    }
  });
});

describe("MobileMenu — investor (IN-1)", () => {
  it("varaqada «Bosh sahifa» plitkasi (maket `investor-dashboard-mobile-menu`); Investitsiyalar/Foyda tarixi — IN-2", () => {
    asPhone();
    renderMenu(<MobileMenu isOpen onClose={vi.fn()} />, "investor", { route: "/" });
    const links = within(sectionsNav()).getAllByRole("link");
    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([["Bosh sahifa", "/"]]);
    expect(links[0]).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });
});
