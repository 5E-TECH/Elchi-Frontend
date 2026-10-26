import { Suspense } from "react";
import { screen } from "@testing-library/react";
import { useParams } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/test-utils";
import type { RootState } from "../config/store";
import AppRouter from "./routes";

/**
 * gWI4gYkw: smena hisoboti bildirishnomasi superadminga `link: /payments/shift-report/:id` bilan keladi — sahifa
 * `/payments/shifts/:id` da; havola yo'naltiriladi (404 emas), smena ID si saqlanadi.
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

vi.mock("../../pages/payments/shiftReport", () => ({
  default: function ShiftReportStub() {
    const { id } = useParams();
    return <p>Smena hisoboti sahifasi #{id}</p>;
  },
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

describe("/payments/shift-report/:id → /payments/shifts/:id (gWI4gYkw)", () => {
  it("bildirishnoma havolasi smena hisobotini ochadi", async () => {
    renderWithProviders(
      <Suspense fallback={null}>
        <AppRouter />
      </Suspense>,
      { route: "/payments/shift-report/31", preloadedState: signedInAs("superadmin") },
    );
    expect(await screen.findByText("Smena hisoboti sahifasi #31", undefined, { timeout: 5000 })).toBeInTheDocument();
  });
});
