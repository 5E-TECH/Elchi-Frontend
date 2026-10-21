import { Suspense } from "react";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/test-utils";
import type { RootState } from "../config/store";
import AppRouter from "./routes";

/**
 * IN-2: `/investments` va `/profits` — faqat investor (`canViewInvestorCabinet`; backend `@Roles(INVESTOR)`).
 * Boshqa har rol shell ichida 403 ko'radi (sahifa so'rov yubormaydi).
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

vi.mock("../../pages/investor/InvestmentsPage", () => ({ default: () => <p>Investitsiyalar sahifasi</p> }));
vi.mock("../../pages/investor/ProfitsPage", () => ({ default: () => <p>Foyda tarixi sahifasi</p> }));

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

const renderAt = (route: string, role: string) =>
  renderWithProviders(
    <Suspense fallback={null}>
      <AppRouter />
    </Suspense>,
    { route, preloadedState: signedInAs(role) },
  );

describe("investor ro'yxatlari — route guard (IN-2)", () => {
  it.each([
    ["/investments", "Investitsiyalar sahifasi"],
    ["/profits", "Foyda tarixi sahifasi"],
  ])("investor: %s ochiladi", async (route, text) => {
    renderAt(route, "investor");
    expect(await screen.findByText(text, undefined, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByTestId("shell")).toBeInTheDocument();
  });

  it.each(["superadmin", "admin", "market", "courier", "logist", "market_operator"])(
    "%s: /investments va /profits — shell ichida 403",
    async (role) => {
      for (const route of ["/investments", "/profits"]) {
        const { unmount } = renderAt(route, role);
        expect(
          await screen.findByRole("heading", { level: 1, name: "Bu sahifaga ruxsatingiz yo'q" }, { timeout: 5000 }),
        ).toBeInTheDocument();
        expect(screen.queryByText(/sahifasi$/)).not.toBeInTheDocument();
        unmount();
      }
    },
  );
});
