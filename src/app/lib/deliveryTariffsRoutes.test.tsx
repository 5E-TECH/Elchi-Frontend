import { Suspense } from "react";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/test-utils";
import type { RootState } from "../config/store";
import AppRouter from "./routes";

/**
 * 47WFHzlx: `/delivery-tariffs` — faqat superadmin va admin (`canManageDeliveryTariffs`; backend tarif va
 * sozlama endpointlari ham SUPERADMIN, ADMIN). Registrator, menejer va boshqa rollar shell ichida 403 ko'radi.
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

vi.mock("../../pages/delivery-tariffs", () => ({ default: () => <p>Yetkazish tariflari sahifasi</p> }));

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

const renderAt = (role: string) =>
  renderWithProviders(
    <Suspense fallback={null}>
      <AppRouter />
    </Suspense>,
    { route: "/delivery-tariffs", preloadedState: signedInAs(role) },
  );

describe("/delivery-tariffs — route guard (47WFHzlx)", () => {
  it.each(["superadmin", "admin"])("%s: sahifa ochiladi", async (role) => {
    renderAt(role);
    expect(await screen.findByText("Yetkazish tariflari sahifasi", undefined, { timeout: 5000 })).toBeInTheDocument();
  });

  it.each(["registrator", "manager", "market", "courier", "logist"])("%s: shell ichida 403", async (role) => {
    renderAt(role);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Bu sahifaga ruxsatingiz yo'q" }, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Yetkazish tariflari sahifasi")).not.toBeInTheDocument();
  });
});
