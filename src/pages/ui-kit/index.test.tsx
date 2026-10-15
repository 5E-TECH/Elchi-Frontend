import { screen } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { RootState } from "../../app/config/store";
import { canViewUiKit } from "../../app/lib/access";
import ProtectedRoute from "../../features/auth/ui/ProtectedRoute";
import { renderWithProviders } from "../../test/test-utils";
import { SIDEBAR_CONFIG } from "../../widgets/Sidebar/model/menuConfig";
import en from "../../locales/en/ui.json";
import ru from "../../locales/ru/ui.json";
import uz from "../../locales/uz/ui.json";
import UiKitPage from "./index";

/**
 * `/ops/ui-kit` — dizayn v2 komponentlar to'plami: faqat superadmin, menyuda yo'q,
 * bo'limlar tartibi va URL parametrlari (`?section=`, `?theme-pair=0`).
 */

const stateFor = (role: string | null) => ({ role: { role } }) as unknown as RootState;

const renderRoute = (role: string, route = "/ops/ui-kit") =>
  renderWithProviders(
    <Routes>
      <Route
        path="/ops/ui-kit"
        element={
          <ProtectedRoute canActivate={canViewUiKit}>
            <UiKitPage />
          </ProtectedRoute>
        }
      />
      <Route path="/403" element={<p>Ruxsat yo'q sahifasi</p>} />
    </Routes>,
    { route, preloadedState: { role: { id: "1", role, region: null, name: null } } as Partial<RootState> },
  );

const sectionIds = () =>
  Array.from(document.querySelectorAll("[data-kit-section]")).map((el) => el.getAttribute("data-kit-section"));

const routesSource = Object.values(
  import.meta.glob("../../app/lib/routes.tsx", { eager: true, query: "?raw", import: "default" }) as Record<string, string>,
)[0];

describe("canViewUiKit — faqat superadmin", () => {
  it.each([
    ["superadmin", true],
    ["admin", false],
    ["manager", false],
    ["registrator", false],
    ["market", false],
    ["courier", false],
    [null, false],
  ])("%s → %s", (role, allowed) => {
    expect(canViewUiKit(stateFor(role))).toBe(allowed);
  });
});

describe("/ops/ui-kit marshruti", () => {
  it("routes.tsx da shu guard bilan ro'yxatdan o'tgan (lazy sahifa)", () => {
    expect(routesSource).toMatch(/lazy\(\(\) => import\("\.\.\/\.\.\/pages\/ui-kit"\)\)/);
    expect(routesSource).toMatch(
      /path: "ops\/ui-kit",\s*element: \(\s*<ProtectedRoute canActivate=\{canViewUiKit\}>\s*<UiKitPage \/>/,
    );
  });

  it("hech bir rol menyusida yo'q", () => {
    const all = Object.values(SIDEBAR_CONFIG).flat();
    expect(all.some((item) => item.to?.includes("ui-kit"))).toBe(false);
  });

  it("superadmin sahifani ko'radi", async () => {
    renderRoute("superadmin");
    expect(await screen.findByRole("heading", { level: 1, name: "Komponentlar to'plami" })).toBeInTheDocument();
  });

  it.each(["admin", "manager", "market", "courier", "registrator"])("%s → /403", async (role) => {
    renderRoute(role);
    expect(await screen.findByText("Ruxsat yo'q sahifasi")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  });
});

describe("UiKitPage", () => {
  it("bo'limlar tartibi: tugmalar, badge, kartalar, sahifa sarlavhasi, tablar, formatlash", () => {
    renderWithProviders(<UiKitPage />, { route: "/ops/ui-kit" });
    expect(sectionIds()).toEqual(["buttons", "badges", "cards", "page-header", "tabs", "format"]);
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual([
      "Tugmalar",
      "Holat belgilari",
      "Kartalar",
      "Sahifa sarlavhasi",
      "Tablar va segmentlar",
      "Formatlash",
    ]);
  });

  it("har bo'limda kunduzgi va tungi panel; tungi panel `.dark` klassi bilan", () => {
    renderWithProviders(<UiKitPage />, { route: "/ops/ui-kit" });
    const light = document.querySelectorAll('[data-kit-theme="light"]');
    const dark = document.querySelectorAll('[data-kit-theme="dark"]');
    expect(light).toHaveLength(6);
    expect(dark).toHaveLength(6);
    dark.forEach((panel) => expect(panel).toHaveClass("dark", "bg-bg", "text-text"));
    light.forEach((panel) => {
      expect(panel).not.toHaveClass("dark");
      // Ilova tungi bo'lsa ham kunduzgi panel kunduzgi tokenlarni o'zi beradi.
      expect((panel as HTMLElement).style.getPropertyValue("--color-surface")).not.toBe("");
    });
    expect(screen.getAllByText("Kunduzgi")).toHaveLength(6);
    expect(screen.getAllByText("Tungi")).toHaveLength(6);
  });

  it("?section=badges — faqat shu bo'lim", () => {
    renderWithProviders(<UiKitPage />, { route: "/ops/ui-kit?section=badges" });
    expect(sectionIds()).toEqual(["badges"]);
  });

  it("noma'lum ?section — barcha bo'limlar", () => {
    renderWithProviders(<UiKitPage />, { route: "/ops/ui-kit?section=yoq" });
    expect(sectionIds()).toHaveLength(6);
  });

  it("?theme-pair=0 — bitta panel, joriy mavzuda", () => {
    renderWithProviders(<UiKitPage />, { route: "/ops/ui-kit?section=cards&theme-pair=0" });
    expect(document.querySelectorAll('[data-kit-theme="current"]')).toHaveLength(1);
    expect(document.querySelector('[data-kit-theme="light"], [data-kit-theme="dark"]')).toBeNull();
    expect(screen.queryByText("Kunduzgi")).not.toBeInTheDocument();
  });
});

describe("ui.json — uz/ru/en kalitlari bir xil", () => {
  const keys = (obj: object, prefix = ""): string[] =>
    Object.entries(obj).flatMap(([key, value]) =>
      value && typeof value === "object" ? keys(value, `${prefix}${key}.`) : [`${prefix}${key}`],
    );

  it("ru va en uz bilan bir xil kalitlarga ega, bo'sh qiymat yo'q", () => {
    const base = keys(uz).sort();
    expect(keys(ru).sort()).toEqual(base);
    expect(keys(en).sort()).toEqual(base);
    for (const locale of [uz, ru, en]) {
      expect(JSON.stringify(locale)).not.toMatch(/:\s*""/);
    }
  });
});
