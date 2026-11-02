import { Suspense } from "react";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/test-utils";
import type { RootState } from "../config/store";
import AppRouter from "./routes";

/**
 * `/payments` ↔ `/cash-box`: ruxsatsiz rol ikkinchi sahifaga faqat unga KIRA OLSA yo'naltiriladi, aks holda — 403.
 * Avval ikkala guard bir-biriga qaytarardi va ikkalasiga ham ruxsati yo'q rol (registrator, logist, market operatori,
 * investor) qo'lda yozilgan manzilda ikki sahifa orasida cheksiz aylanardi.
 */

vi.mock("../../widgets/layout/dashboardLayout", async () => {
  const { Outlet } = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    default: () => (
      <div data-testid="shell">
        <main>
          <Outlet />
        </main>
      </div>
    ),
  };
});

vi.mock("../../pages/payments", () => ({ default: () => <p>To'lovlar sahifasi</p> }));
vi.mock("../../pages/payments/components/mainCashbox", () => ({
  default: () => <p>Asosiy kassa sahifasi</p>,
}));
vi.mock("../../pages/payments/components/MyCashboxPage", () => ({
  default: () => <p>Mening kassam sahifasi</p>,
}));

const signedInAs = (role: string, branchType?: string): Partial<RootState> => ({
  user: {
    user: (branchType ? { id: "1", role, branch: { id: "1", type: branchType } } : null) as never,
    isAuthenticated: true,
    accessToken: "test.token",
    loading: false,
    isAppInitializing: false,
    error: null,
  },
  role: { id: "1", role, region: null, name: null },
});

const renderAt = (route: string, role: string, branchType?: string) =>
  renderWithProviders(
    <Suspense fallback={null}>
      <AppRouter />
    </Suspense>,
    { route, preloadedState: signedInAs(role, branchType) },
  );

const forbidden = () =>
  screen.findByRole(
    "heading",
    { level: 1, name: "Bu sahifaga ruxsatingiz yo'q" },
    { timeout: 5000 },
  );

describe("/payments ↔ /cash-box — aylanib qolmaydi", () => {
  it.each(["registrator", "logist", "market_operator", "investor", "operator"])(
    "%s: /payments → 403 (ikki sahifa orasida aylanmaydi)",
    async (role) => {
      renderAt("/payments", role);
      expect(await forbidden()).toBeInTheDocument();
      expect(screen.queryByText("Mening kassam sahifasi")).not.toBeInTheDocument();
      expect(screen.queryByText("To'lovlar sahifasi")).not.toBeInTheDocument();
    },
  );

  it.each(["registrator", "logist", "market_operator", "investor", "operator"])(
    "%s: /cash-box → 403",
    async (role) => {
      renderAt("/cash-box", role);
      expect(await forbidden()).toBeInTheDocument();
      expect(screen.queryByText("To'lovlar sahifasi")).not.toBeInTheDocument();
    },
  );

  it("registrator: /payments/main-cashbox ham 403", async () => {
    renderAt("/payments/main-cashbox", "registrator", "HQ");
    expect(await forbidden()).toBeInTheDocument();
    expect(screen.queryByText("Asosiy kassa sahifasi")).not.toBeInTheDocument();
  });
});

describe("/payments ↔ /cash-box — ruxsati borlar avvalgidek yo'naltiriladi", () => {
  it.each([
    ["courier", undefined],
    ["market", undefined],
    ["manager", "PICKUP"],
  ])("%s %s: /payments → /cash-box", async (role, branchType) => {
    renderAt("/payments", role, branchType);
    expect(
      await screen.findByText("Mening kassam sahifasi", undefined, { timeout: 5000 }),
    ).toBeInTheDocument();
  });

  it.each(["superadmin", "admin"])("%s: /cash-box → /payments", async (role) => {
    renderAt("/cash-box", role);
    expect(
      await screen.findByText("To'lovlar sahifasi", undefined, { timeout: 5000 }),
    ).toBeInTheDocument();
  });

  it.each([
    ["superadmin", undefined, "/payments", "To'lovlar sahifasi"],
    ["manager", "REGIONAL", "/payments", "To'lovlar sahifasi"],
    ["manager", "REGIONAL", "/cash-box", "Mening kassam sahifasi"],
    ["courier", undefined, "/cash-box", "Mening kassam sahifasi"],
  ])("%s %s: %s o'zi ochiladi", async (role, branchType, route, text) => {
    renderAt(route, role, branchType);
    expect(await screen.findByText(text, undefined, { timeout: 5000 })).toBeInTheDocument();
  });
});
