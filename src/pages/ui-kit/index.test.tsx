import { screen } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { RootState } from "../../app/config/store";
import { canViewUiKit } from "../../app/lib/access";
import ProtectedRoute from "../../features/auth/ui/ProtectedRoute";
import { renderWithProviders } from "../../test/test-utils";
import { SIDEBAR_CONFIG } from "../../widgets/Sidebar/model/menuConfig";
import en from "../../locales/en/ui.json";
import ru from "../../locales/ru/ui.json";
import uz from "../../locales/uz/ui.json";
import UiKitPage from "./index";

// «Cheklar va yorliqlar» namunalari (jsPDF, shriftlar) — o'z testida (`ReceiptsSection.test.tsx`); bu yerda yuklanish
// holatida qoladi.
vi.mock("../../features/print-receipts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../features/print-receipts")>()),
  loadReceiptPreviews: () => new Promise(() => undefined),
}));

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

const SECTION_IDS = [
  "buttons",
  "badges",
  "cards",
  "page-header",
  "tabs",
  "format",
  "forms",
  "select",
  "date",
  "dialog",
  "feedback",
  "states",
  "table",
  "charts",
  "receipts",
];

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
  it("bo'limlar tartibi: 1-bosqich primitivlari, keyin 3-bosqich (forma, ro'yxat, sana, oyna, xabar, holatlar)", () => {
    renderWithProviders(<UiKitPage />, { route: "/ops/ui-kit" });
    expect(sectionIds()).toEqual(SECTION_IDS);
    const headings = Array.from(document.querySelectorAll("[data-kit-section] > div > h2")).map((h) => h.textContent);
    expect(headings).toEqual([
      "Tugmalar",
      "Holat belgilari",
      "Kartalar",
      "Sahifa sarlavhasi",
      "Tablar va segmentlar",
      "Formatlash",
      "Forma elementlari",
      "Tanlash ro'yxatlari",
      "Sana oralig'i",
      "Oynalar va tasdiqlash",
      "Qalqib chiquvchi xabarlar",
      "Yuklanish, bo'sh va xato holatlari",
      "Jadval va sahifalash",
      "Grafiklar",
      "Cheklar va yorliqlar",
    ]);
  });

  it("har bo'limda kunduzgi va tungi panel; tungi panel `.dark` klassi bilan", () => {
    renderWithProviders(<UiKitPage />, { route: "/ops/ui-kit" });
    for (const section of document.querySelectorAll("[data-kit-section]")) {
      const id = section.getAttribute("data-kit-section");
      const lightIn = section.querySelectorAll('[data-kit-theme="light"]').length;
      expect(lightIn, `${id}: kunduzgi panel`).toBeGreaterThan(0);
      expect(section.querySelectorAll('[data-kit-theme="dark"]').length, `${id}: tungi panel`).toBe(lightIn);
    }
    const light = document.querySelectorAll('[data-kit-theme="light"]');
    const dark = document.querySelectorAll('[data-kit-theme="dark"]');
    dark.forEach((panel) => expect(panel).toHaveClass("dark", "bg-bg", "text-text"));
    light.forEach((panel) => {
      expect(panel).not.toHaveClass("dark");
      // Ilova tungi bo'lsa ham kunduzgi panel kunduzgi tokenlarni o'zi beradi.
      expect((panel as HTMLElement).style.getPropertyValue("--color-surface")).not.toBe("");
    });
    expect(screen.getAllByText("Kunduzgi")).toHaveLength(light.length);
    expect(screen.getAllByText("Tungi")).toHaveLength(dark.length);
  });

  it("?section=badges — faqat shu bo'lim", () => {
    renderWithProviders(<UiKitPage />, { route: "/ops/ui-kit?section=badges" });
    expect(sectionIds()).toEqual(["badges"]);
  });

  it("noma'lum ?section — barcha bo'limlar", () => {
    renderWithProviders(<UiKitPage />, { route: "/ops/ui-kit?section=yoq" });
    expect(sectionIds()).toHaveLength(SECTION_IDS.length);
  });

  it.each(["forms", "select", "date", "dialog", "feedback", "states", "table", "charts", "receipts"])("?section=%s — faqat shu bo'lim", (id) => {
    renderWithProviders(<UiKitPage />, { route: `/ops/ui-kit?section=${id}` });
    expect(sectionIds()).toEqual([id]);
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
