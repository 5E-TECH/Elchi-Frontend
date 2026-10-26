import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { I18nextProvider } from "react-i18next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryRouter, Link, MemoryRouter, Route, RouterProvider, Routes, useLocation } from "react-router-dom";
import i18n from "../../i18n";
import { createTestStore } from "../../test/test-utils";
import DashboardLayout, { SHELL_DESKTOP_QUERY } from "./dashboardLayout";
import { useShellBannerSlot } from "../../shared/lib/shellBannerSlot";
import { PageHeader } from "../../shared/ui/primitives";

/**
 * SHELL tuzilmasi (maket `.el-app` / `.el-main` / `.el-content`): slotlar, bitta skroll
 * konteyneri, kontent karta emas, telefon menyusi holati (`useMobileMenu`).
 * Yon menyu, yuqori panel, pastki menyu o'z quruvchilarining testlarida — bu yerda o'rinbosar.
 */
vi.mock("../header/ui/Header", () => ({
  default: ({ onMenuClick }: { onMenuClick?: () => void }) => (
    <header data-testid="topbar">
      <button type="button" onClick={onMenuClick}>
        Menyuni ochish
      </button>
    </header>
  ),
}));
vi.mock("../Sidebar/ui/Sidebar", () => ({ default: () => <aside data-testid="sidebar" /> }));
vi.mock("../Sidebar/ui/BottomNav", () => ({ default: () => <nav data-testid="bottomnav" /> }));
vi.mock("../Sidebar/ui/MobileMenu", () => ({
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div role="dialog" aria-label="Menyu">
        <button type="button" onClick={onClose}>
          Yopish
        </button>
        <Link to="/mails">Pochta</Link>
      </div>
    ) : null,
}));

type MediaListener = (event: { matches: boolean }) => void;

const renderShell = (initial = "/orders") => {
  const store = createTestStore();
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: <DashboardLayout />,
        children: [
          { path: "orders", element: <h1>Buyurtmalar</h1> },
          { path: "mails", element: <h1>Pochta</h1> },
        ],
      },
    ],
    { initialEntries: [initial] },
  );
  const view = render(
    <I18nextProvider i18n={i18n}>
      <Provider store={store}>
        <RouterProvider router={router} />
      </Provider>
    </I18nextProvider>,
  );
  return { ...view, store, router };
};

const originalMatchMedia = window.matchMedia;
afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

describe("DashboardLayout (shell)", () => {
  it("⭐ bitta kanvas: bitta <main>, kontent karta emas, max-w 1440 va maketdagi chekkalar", () => {
    const { container } = renderShell();
    expect(container.querySelectorAll("main")).toHaveLength(1);
    const main = screen.getByRole("main");
    expect(main.className).toMatch(/\boverflow-y-auto\b/);
    expect(main.className).not.toMatch(/rounded|shadow|\bborder\b|bg-surface/);

    const content = container.querySelector('[data-shell-slot="content"]') as HTMLElement;
    expect(main).toContainElement(content);
    expect(content).toContainElement(screen.getByRole("heading", { name: "Buyurtmalar" }));
    // ≥ 1024: 24px 32px 48px · < 1024: 16px 16px 88px
    // `mx-auto`: 1440 dan keng ekranda markazda (taxta `tizim-responsive`: «katta ekranda markazda turadi»).
    for (const cls of ["mx-auto", "max-w-[1440px]", "px-8", "pt-6", "pb-12", "max-lg:px-4", "max-lg:pt-4", "max-lg:pb-[88px]"]) {
      expect(content.classList.contains(cls), cls).toBe(true);
    }
    expect(content.className).not.toMatch(/rounded|shadow|bg-surface/);

    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toMatch(/\bbg-bg\b/);
    expect(root.className).toMatch(/\bh-dvh\b/);
  });

  it("⭐ slotlar: yon menyu faqat ≥ 1024, pastki menyu faqat telefonda va ustun uning joyini qoldiradi", () => {
    const { container } = renderShell();
    const sidebarSlot = container.querySelector('[data-shell-slot="sidebar"]') as HTMLElement;
    expect(sidebarSlot).toContainElement(screen.getByTestId("sidebar"));
    expect(sidebarSlot.className).toMatch(/\bhidden\b/);
    expect(sidebarSlot.className).toMatch(/\blg:flex\b/);

    const bottomSlot = container.querySelector('[data-shell-slot="bottomnav"]') as HTMLElement;
    expect(bottomSlot).toContainElement(screen.getByTestId("bottomnav"));
    expect(bottomSlot.className).toMatch(/\bmd:hidden\b/);

    const column = container.querySelector('[data-shell-slot="column"]') as HTMLElement;
    expect(column.className).toContain("max-md:pb-[var(--shell-bottomnav-h)]");
    expect((container.firstElementChild as HTMLElement).className).toContain(
      "[--shell-bottomnav-h:calc(4rem+env(safe-area-inset-bottom))]",
    );

    const topbarSlot = container.querySelector('[data-shell-slot="topbar"]') as HTMLElement;
    expect(topbarSlot).toContainElement(screen.getByTestId("topbar"));
    expect(topbarSlot.className).toMatch(/\bshrink-0\b/);
    // Qatlamlar: yuqori panel (va undagi profil menyusi) `z-40` — pastki menyu (`BottomNav`, `z-30`) ustida;
    // aks holda telefon yotiq holatida profil menyusining pastki bandlari (Chiqish) pastki menyu ostida qolardi.
    expect(topbarSlot.className).toMatch(/\bz-40\b/);
  });

  it("⭐ banner sloti: yuqori panel va <main> orasida, oqimda (`shrink-0`), skroll konteyneridan tashqarida", () => {
    const slot = renderHook(() => useShellBannerSlot());
    const { container, unmount } = renderShell();

    const topbarSlot = container.querySelector('[data-shell-slot="topbar"]') as HTMLElement;
    const bannerSlot = container.querySelector('[data-shell-slot="banner"]') as HTMLElement;
    const main = screen.getByRole("main");
    expect(topbarSlot.nextElementSibling).toBe(bannerSlot);
    expect(bannerSlot.nextElementSibling).toBe(main);
    expect(bannerSlot.className).toMatch(/\bshrink-0\b/);
    expect(bannerSlot.className).not.toMatch(/\b(fixed|absolute|sticky)\b/);
    expect(main).not.toContainElement(bannerSlot);
    // Bannerlar (`SessionExpiryCountdown`) shu elementga portal qiladi.
    expect(slot.result.current).toBe(bannerSlot);

    unmount();
    expect(slot.result.current).toBeNull();
  });

  it("⭐ menyu tugmasi suriluvchi menyuni ochadi, orqa fon `inert`; yopish — qaytaradi", () => {
    const { container, store } = renderShell();
    const column = container.querySelector('[data-shell-slot="column"]') as HTMLElement;
    expect(column).not.toHaveAttribute("inert");

    fireEvent.click(screen.getByRole("button", { name: "Menyuni ochish" }));
    expect(store.getState().sidebar.isMobileMenuOpen).toBe(true);
    expect(screen.getByRole("dialog", { name: "Menyu" })).toBeInTheDocument();
    expect(column).toHaveAttribute("inert");
    expect(container.querySelector('[data-shell-slot="bottomnav"]')).toHaveAttribute("inert");
    // «Asosiy kontentga o'tish» ham orqa fon bilan birga `inert` (skrinrider kursori menyudan chiqmaydi).
    const skipLink = container.querySelector("[data-skip-link]") as HTMLElement;
    expect(skipLink).toHaveAttribute("inert");

    fireEvent.click(screen.getByRole("button", { name: "Yopish" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(column).not.toHaveAttribute("inert");
    expect(skipLink).not.toHaveAttribute("inert");
  });

  it("⭐ bo'lim almashsa menyu o'zi yopiladi", async () => {
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Menyuni ochish" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("link", { name: "Pochta" }));
    });
    expect(await screen.findByRole("heading", { name: "Pochta" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("⭐ «Asosiy kontentga o'tish» (KI-S2): shell'ning birinchi fokuslanadigan elementi, nishoni — kontent sloti", () => {
    const { container, router } = renderShell();
    const root = container.firstElementChild as HTMLElement;
    const link = screen.getByRole("link", { name: "Asosiy kontentga o'tish" });
    expect(root.firstElementChild).toBe(link);
    expect(link).toHaveAttribute("href", "#main-content");
    // Hujjat tartibida undan oldin fokuslanadigan narsa yo'q.
    const focusable = container.querySelectorAll("a[href], button, input, select, textarea, [tabindex]:not([tabindex='-1'])");
    expect(focusable[0]).toBe(link);

    const content = container.querySelector('[data-shell-slot="content"]') as HTMLElement;
    expect(content).toHaveAttribute("id", "main-content");
    expect(content).toHaveAttribute("tabindex", "-1");
    expect(content).toHaveClass("outline-none");

    fireEvent.click(link);
    expect(content).toHaveFocus();
    // URL'ga `#main-content` yozilmaydi.
    expect(router.state.location.hash).toBe("");
    expect(router.state.location.pathname).toBe("/orders");
  });

  it("ekran ≥ 1024 ga kengaysa ochiq menyu yopiladi (aks holda orqa fon `inert` qotib qolardi)", () => {
    const listeners: MediaListener[] = [];
    const query = {
      matches: false,
      media: SHELL_DESKTOP_QUERY,
      addEventListener: (_type: string, listener: MediaListener) => listeners.push(listener),
      removeEventListener: vi.fn(),
    };
    window.matchMedia = vi.fn(() => query) as unknown as typeof window.matchMedia;

    const { store } = renderShell();
    expect(window.matchMedia).toHaveBeenCalledWith(SHELL_DESKTOP_QUERY);
    fireEvent.click(screen.getByRole("button", { name: "Menyuni ochish" }));
    expect(store.getState().sidebar.isMobileMenuOpen).toBe(true);

    act(() => {
      query.matches = true;
      listeners.forEach((listener) => listener({ matches: true }));
    });
    expect(store.getState().sidebar.isMobileMenuOpen).toBe(false);
  });
});

/**
 * QKCeGZ3N — sahifa yiqilsa xato shell ichida (taxta `tizim-errors` 01): yon menyu va yuqori panel joyida, manzil
 * o'zgarmaydi, `/runtime-error` ga o'tilmaydi. Ilova `useRoutes` (data router emas) — test ham `Routes` bilan.
 */
describe("DashboardLayout — sahifa xatosi shell ichida (QKCeGZ3N)", () => {
  const crash = { current: true };
  const CrashingOrders = () => {
    if (crash.current) throw new TypeError("r.forEach is not a function");
    return <h1>Buyurtmalar</h1>;
  };
  const renderCrash = () => {
    const store = createTestStore();
    return render(
      <I18nextProvider i18n={i18n}>
        <Provider store={store}>
          <MemoryRouter initialEntries={["/orders"]}>
            <Routes>
              <Route path="/" element={<DashboardLayout />}>
                <Route path="orders" element={<CrashingOrders />} />
                <Route path="mails" element={<h1>Pochta</h1>} />
              </Route>
            </Routes>
            <LocationProbe />
          </MemoryRouter>
        </Provider>
      </I18nextProvider>,
    );
  };
  const replace = vi.fn();

  beforeEach(() => {
    crash.current = true;
    window.sessionStorage.clear();
    replace.mockReset();
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, replace } as Location);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("⭐ yon menyu va yuqori panel joyida, kontentda «Sahifani ko'rsatib bo'lmadi», manzil /orders", async () => {
    const { container } = renderCrash();

    expect(await screen.findByRole("heading", { level: 1, name: "Sahifani ko'rsatib bo'lmadi" })).toBeInTheDocument();
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("topbar")).toBeInTheDocument();
    const content = container.querySelector('[data-shell-slot="content"]') as HTMLElement;
    expect(content).toContainElement(screen.getByRole("heading", { level: 1 }));
    expect(screen.getByTestId("location")).toHaveTextContent("/orders");
    expect(replace).not.toHaveBeenCalled();
  });

  it("«Qayta urinish» — sahifa qayta chiziladi (yo'l o'zgarmaydi)", async () => {
    renderCrash();
    await screen.findByRole("heading", { level: 1, name: "Sahifani ko'rsatib bo'lmadi" });

    crash.current = false;
    fireEvent.click(screen.getByRole("button", { name: "Qayta urinish" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Buyurtmalar" })).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/orders");
  });

  it("takroriy yiqilish — «Qayta urinish» yo'q, «Bosh sahifaga qaytish» asosiy", async () => {
    renderCrash();
    await screen.findByRole("heading", { level: 1, name: "Sahifani ko'rsatib bo'lmadi" });

    fireEvent.click(screen.getByRole("button", { name: "Qayta urinish" }));
    expect(await screen.findByText("Bu sahifa takroran xato bermoqda. Administratorga murojaat qiling.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Qayta urinish" })).toBeNull();
    expect(screen.getByRole("button", { name: "Bosh sahifaga qaytish" })).toHaveAttribute("data-variant", "primary");
  });
});

const LocationProbe = () => <span data-testid="location">{useLocation().pathname}</span>;

describe("DashboardLayout — bo'lim almashuvi (WuVeVZqo)", () => {
  const renderPages = () => {
    const router = createMemoryRouter(
      [
        {
          path: "/",
          element: <DashboardLayout />,
          children: [
            { path: "orders", element: <PageHeader title="Buyurtmalar" /> },
            { path: "payments", element: <PageHeader title="To'lovlar" /> },
          ],
        },
      ],
      { initialEntries: ["/orders"] },
    );
    render(
      <I18nextProvider i18n={i18n}>
        <Provider store={createTestStore()}>
          <RouterProvider router={router} />
        </Provider>
      </I18nextProvider>,
    );
    return router;
  };
  const announcer = () => document.getElementById("route-announcer") as HTMLElement;

  it("⭐ jonli hudud: birinchi yuklanishda jim, bo'lim almashganda yangi sahifa nomi; brauzer sarlavhasi ham", async () => {
    const router = renderPages();
    expect(announcer()).toHaveAttribute("role", "status");
    expect(announcer()).toHaveAttribute("aria-live", "polite");
    expect(announcer()).toHaveTextContent("");
    expect(document.title).toBe("Buyurtmalar — Elchi Pochta");

    await act(() => router.navigate("/payments"));

    expect(announcer()).toHaveTextContent("To'lovlar");
    expect(document.title).toBe("To'lovlar — Elchi Pochta");
  });

  it("⭐ fokus: menyudan (kontent tashqarisidan) o'tilsa — kontentga; kontent ichida bo'lsa — joyida", async () => {
    const router = renderPages();
    const content = document.getElementById("main-content") as HTMLElement;

    screen.getByRole("button", { name: "Menyuni ochish" }).focus();
    await act(() => router.navigate("/payments"));
    expect(content).toHaveFocus();

    // Sahifa ichidagi element fokusda — o'tishda tegilmaydi (masalan sahifa ichidagi tab-havola).
    const inner = document.createElement("button");
    content.appendChild(inner);
    inner.focus();
    await act(() => router.navigate("/orders"));
    expect(inner).toHaveFocus();
  });
});
