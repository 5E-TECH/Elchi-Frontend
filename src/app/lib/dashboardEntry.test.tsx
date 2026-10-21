import { Suspense } from "react";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/test-utils";
import type { RootState } from "../config/store";
import AppRouter from "./routes";

/**
 * Bosh sahifa (`/`) rolga qarab — `DashboardEntry` (ROL-0, sizish mDfjKeQi).
 *
 * Avval qolgan har rol admin `DashboardPage` ga tushardi: logist kirsa `RegionOverviewCard` kompaniya tushumini
 * viloyatlar bo'yicha ko'rsatardi (`region/stats/all` logistga ochiq). Endi admin sahifasi faqat
 * `canViewAdminDashboard` rollarida; yangi rollar o'z bosh sahifasi kelguncha 403 ni shell ichida ko'radi.
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

vi.mock("../../pages/dashboard/DashboardPage", () => ({
  default: () => <p>Admin bosh sahifasi</p>,
}));

vi.mock("../../pages/dashboard/MarketDashboardPage", () => ({
  default: () => <p>Market bosh sahifasi</p>,
}));

vi.mock("../../pages/dashboard/LogistDashboardPage", () => ({
  default: () => <p>Logist bosh sahifasi</p>,
}));

vi.mock("../../pages/branch-dashboard", () => ({
  default: () => <p>Filial bosh sahifasi</p>,
}));

vi.mock("../../pages/investor/InvestorDashboardPage", () => ({
  default: () => <p>Investor kabineti</p>,
}));

const signedInAs = (role: string): Partial<RootState> => ({
  user: {
    user: null,
    isAuthenticated: true,
    accessToken: "test.token",
    loading: false,
    isAppInitializing: false,
    error: null,
  },
  role: { id: "1", role, region: null, name: null },
});

const renderHome = (role: string) =>
  renderWithProviders(
    <Suspense fallback={null}>
      <AppRouter />
    </Suspense>,
    { route: "/", preloadedState: signedInAs(role) },
  );

describe("DashboardEntry — `/` rolga qarab", () => {
  it.each(["market_operator"])(
    "%s: admin bosh sahifasiga tushmaydi — shell ichida 403",
    async (role) => {
      renderHome(role);
      expect(
        await screen.findByRole("heading", { level: 1, name: "Bu sahifaga ruxsatingiz yo'q" }, { timeout: 5000 }),
      ).toBeInTheDocument();
      expect(screen.getByTestId("shell")).toBeInTheDocument();
      expect(screen.queryByText("Admin bosh sahifasi")).not.toBeInTheDocument();
    },
  );

  it.each(["superadmin", "admin", "registrator", "courier"])("%s: admin bosh sahifasi (avvalgidek)", async (role) => {
    renderHome(role);
    expect(await screen.findByText("Admin bosh sahifasi", undefined, { timeout: 5000 })).toBeInTheDocument();
  });

  it("market — o'z bosh sahifasi", async () => {
    renderHome("market");
    expect(await screen.findByText("Market bosh sahifasi", undefined, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.queryByText("Admin bosh sahifasi")).not.toBeInTheDocument();
  });

  it("menejer — filial bosh sahifasiga yo'naltiriladi", async () => {
    renderHome("manager");
    expect(await screen.findByText("Filial bosh sahifasi", undefined, { timeout: 5000 })).toBeInTheDocument();
  });
});

describe("DashboardEntry — logist (LG-1)", () => {
  it("logist — o'z bosh sahifasi (admin sahifasi va 403 emas)", async () => {
    renderHome("logist");
    expect(await screen.findByText("Logist bosh sahifasi", undefined, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByTestId("shell")).toBeInTheDocument();
    expect(screen.queryByText("Admin bosh sahifasi")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Bu sahifaga ruxsatingiz yo'q" })).not.toBeInTheDocument();
  });
});

describe("DashboardEntry — investor (IN-1)", () => {
  it("investor — o'z kabineti (`canViewInvestorCabinet`), admin sahifasi va 403 emas", async () => {
    renderHome("investor");
    expect(await screen.findByText("Investor kabineti", undefined, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByTestId("shell")).toBeInTheDocument();
    expect(screen.queryByText("Admin bosh sahifasi")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Bu sahifaga ruxsatingiz yo'q" })).not.toBeInTheDocument();
  });

  it.each([
    ["superadmin", "Admin bosh sahifasi"],
    ["market", "Market bosh sahifasi"],
    ["logist", "Logist bosh sahifasi"],
  ])("%s — investor kabinetiga tushmaydi", async (role, expected) => {
    renderHome(role);
    expect(await screen.findByText(expected, undefined, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.queryByText("Investor kabineti")).not.toBeInTheDocument();
  });
});
