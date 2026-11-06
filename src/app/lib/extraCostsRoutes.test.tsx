import { Suspense } from "react";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/test-utils";
import type { RootState } from "../config/store";
import AppRouter from "./routes";

/**
 * GykuOz8f: «Qo'shimcha xarajatli buyurtmalar» — `/extra-costs` (`canViewExtraCosts`): backend `GET orders/extra-costs`
 * `@Roles(COURIER, MANAGER, MARKET, MARKET_OPERATOR)` bilan bir xil. Admin va superadmin (karta: ularga sahifa yo'q)
 * hamda qolgan rollar — shell ichida 403.
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

vi.mock("../../pages/extra-costs", () => ({ default: () => <p>Qo'shimcha xarajatlar sahifasi</p> }));

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

const renderAt = (role: string, branchType?: string) =>
  renderWithProviders(
    <Suspense fallback={null}>
      <AppRouter />
    </Suspense>,
    { route: "/extra-costs?tab=cancelled", preloadedState: signedInAs(role, branchType) },
  );

const forbidden = () =>
  screen.findByRole("heading", { level: 1, name: "Bu sahifaga ruxsatingiz yo'q" }, { timeout: 5000 });

describe("/extra-costs — route guard (GykuOz8f)", () => {
  it.each([
    ["courier", "REGIONAL"],
    ["manager", "HQ"],
    ["manager", "PICKUP"],
    ["market", undefined],
    ["market_operator", undefined],
  ])("%s %s: sahifa ochiladi", async (role, branchType) => {
    renderAt(role, branchType);
    expect(await screen.findByText("Qo'shimcha xarajatlar sahifasi", undefined, { timeout: 5000 })).toBeInTheDocument();
  });

  it.each([
    ["superadmin", undefined],
    ["admin", undefined],
    ["registrator", "HQ"],
    ["logist", undefined],
    ["investor", undefined],
  ])("%s %s: shell ichida 403", async (role, branchType) => {
    renderAt(role, branchType);
    expect(await forbidden()).toBeInTheDocument();
    expect(screen.queryByText("Qo'shimcha xarajatlar sahifasi")).not.toBeInTheDocument();
  });
});
