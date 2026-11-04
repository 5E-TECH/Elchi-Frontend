import { Suspense } from "react";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/test-utils";
import type { RootState } from "../config/store";
import AppRouter from "./routes";

/**
 * lQjt6sKP: «Almashtirish qaytarmalari» — `/replacement-returns` (`canViewReplacementReturns`): backend
 * `GET orders/replacement/returns` `@Roles(SUPERADMIN, ADMIN, MARKET)` bilan bir xil. Qolgan rollar (registrator ham —
 * BeePost'da ko'rardi, Elchi backend'i 403 beradi) — shell ichida 403.
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

vi.mock("../../pages/replacement-returns", () => ({ default: () => <p>Almashtirish qaytarmalari sahifasi</p> }));

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
    { route: "/replacement-returns", preloadedState: signedInAs(role, branchType) },
  );

const forbidden = () =>
  screen.findByRole("heading", { level: 1, name: "Bu sahifaga ruxsatingiz yo'q" }, { timeout: 5000 });

describe("/replacement-returns — route guard (lQjt6sKP)", () => {
  it.each(["superadmin", "admin", "market"])("%s: sahifa ochiladi", async (role) => {
    renderAt(role);
    expect(
      await screen.findByText("Almashtirish qaytarmalari sahifasi", undefined, { timeout: 5000 }),
    ).toBeInTheDocument();
  });

  it.each([
    ["registrator", "HQ"],
    ["manager", "HYBRID"],
    ["courier", "REGIONAL"],
    ["market_operator", undefined],
    ["logist", undefined],
    ["investor", undefined],
  ])("%s %s: shell ichida 403", async (role, branchType) => {
    renderAt(role, branchType);
    expect(await forbidden()).toBeInTheDocument();
    expect(screen.queryByText("Almashtirish qaytarmalari sahifasi")).not.toBeInTheDocument();
  });
});
