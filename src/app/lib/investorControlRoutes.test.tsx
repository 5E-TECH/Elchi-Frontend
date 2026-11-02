import { Suspense } from "react";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/test-utils";
import type { RootState } from "../config/store";
import AppRouter from "./routes";

/**
 * vpKijXce — `/investor`: investor o'z kabinetiga (`/`), superadmin investorlar ro'yxatiga; `/investor/:id` —
 * kabinet nazorat uchun, faqat superadmin. Boshqa rol — shell ichida 403.
 */

vi.mock("../../widgets/layout/dashboardLayout", async () => {
  const { Outlet } = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { default: () => <main><Outlet /></main> };
});
vi.mock("../../pages/ops", async () => {
  const { useLocation } = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  const OpsStub = () => {
    const { pathname, search } = useLocation();
    return <p>{`Ops ${pathname}${search}`}</p>;
  };
  return { default: OpsStub };
});
vi.mock("../../pages/investor/InvestorControlPage", async () => {
  const { useParams } = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  const ControlStub = () => <p>{`Nazorat ${useParams().investorId}`}</p>;
  return { default: ControlStub };
});
vi.mock("../../pages/investor/InvestorDashboardPage", () => ({ default: () => <p>Investorning o'z kabineti</p> }));

const signedInAs = (role: string): Partial<RootState> => ({
  user: { user: null, isAuthenticated: true, accessToken: "test.token", loading: false, isAppInitializing: false, error: null },
  role: { id: "1", role, region: null, name: null },
});

const renderAt = (route: string, role: string) =>
  renderWithProviders(
    <Suspense fallback={null}>
      <AppRouter />
    </Suspense>,
    { route, preloadedState: signedInAs(role) },
  );

const forbidden = () => screen.findByRole("heading", { level: 1, name: "Bu sahifaga ruxsatingiz yo'q" }, { timeout: 5000 });

describe("/investor (vpKijXce)", () => {
  it("⭐ superadmin: /investor → Ops investorlar ro'yxati", async () => {
    renderAt("/investor", "superadmin");
    expect(await screen.findByText("Ops /ops?tab=investors", undefined, { timeout: 5000 })).toBeInTheDocument();
  });

  it("⭐ superadmin: /investor/7 — kabinet nazorati", async () => {
    renderAt("/investor/7", "superadmin");
    expect(await screen.findByText("Nazorat 7", undefined, { timeout: 5000 })).toBeInTheDocument();
  });

  it("⭐ investor: /investor → o'z kabineti, /investor/7 — 403", async () => {
    const own = renderAt("/investor", "investor");
    expect(await screen.findByText("Investorning o'z kabineti", undefined, { timeout: 5000 })).toBeInTheDocument();
    own.unmount();

    renderAt("/investor/7", "investor");
    expect(await forbidden()).toBeInTheDocument();
    expect(screen.queryByText(/^Nazorat/)).toBeNull();
  });

  it.each(["admin", "manager", "market", "courier"])("%s: /investor va /investor/7 — 403", async (role) => {
    const first = renderAt("/investor", role);
    expect(await forbidden()).toBeInTheDocument();
    expect(screen.queryByText(/^Ops /)).toBeNull();
    first.unmount();

    renderAt("/investor/7", role);
    expect(await forbidden()).toBeInTheDocument();
    expect(screen.queryByText(/^Nazorat/)).toBeNull();
  });
});
