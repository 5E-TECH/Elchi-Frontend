import { Suspense } from "react";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/test-utils";
import type { RootState } from "../config/store";
import AppRouter from "./routes";

/**
 * yXC91RRx: «Ombor» — `/warehouses`, `/warehouses/:id` (`canViewWarehouses`): superadmin va admin; filial menejeri —
 * faqat viloyat filiali (REGIONAL, HYBRID; ombor faqat shu turdagi filialda ochiladi). XtcEyQjb (ega 2026-10-24):
 * registrator — hamma omborlar, faqat ko'rish (filial turidan qat'i nazar). Qolgan rollar (kuryer, market, market
 * operatori, logist, investor) — shell ichida 403 (backend `WAREHOUSE_READ_ROLES` bilan bir xil).
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

vi.mock("../../pages/warehouses", () => ({ default: () => <p>Omborlar sahifasi</p> }));
vi.mock("../../pages/warehouses/detail", () => ({ default: () => <p>Ombor tafsiloti sahifasi</p> }));

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
  screen.findByRole("heading", { level: 1, name: "Bu sahifaga ruxsatingiz yo'q" }, { timeout: 5000 });

describe("/warehouses — route guard (yXC91RRx, XtcEyQjb)", () => {
  it.each([
    ["superadmin", undefined],
    ["admin", undefined],
    ["manager", "REGIONAL"],
    ["manager", "HYBRID"],
    ["registrator", "HQ"],
    ["registrator", "REGIONAL"],
    ["registrator", undefined],
  ])("%s %s: ro'yxat va tafsilot ochiladi", async (role, branchType) => {
    renderAt("/warehouses", role, branchType);
    expect(await screen.findByText("Omborlar sahifasi", undefined, { timeout: 5000 })).toBeInTheDocument();
  });

  it.each([
    ["superadmin", undefined],
    ["manager", "REGIONAL"],
    ["registrator", "HQ"],
  ])("%s %s: /warehouses/:id", async (role, branchType) => {
    renderAt("/warehouses/3", role, branchType);
    expect(await screen.findByText("Ombor tafsiloti sahifasi", undefined, { timeout: 5000 })).toBeInTheDocument();
  });

  it.each([
    ["manager", "HQ"],
    ["manager", "PICKUP"],
    ["manager", undefined],
    ["market", undefined],
    ["market_operator", undefined],
    ["courier", "REGIONAL"],
    ["logist", undefined],
    ["investor", undefined],
  ])("%s %s: shell ichida 403", async (role, branchType) => {
    renderAt("/warehouses", role, branchType);
    expect(await forbidden()).toBeInTheDocument();
    expect(screen.queryByText("Omborlar sahifasi")).not.toBeInTheDocument();
  });

  it("market: tafsilot ham 403", async () => {
    renderAt("/warehouses/3", "market");
    expect(await forbidden()).toBeInTheDocument();
  });
});
