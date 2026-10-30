import { Suspense } from "react";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/test-utils";
import type { RootState } from "../config/store";
import AppRouter from "./routes";

/**
 * F2NzXpMv (ruxsat — hujjat va guard bir xil): Ops vositalari (`/ops`, to'g'ridan-to'g'ri `*-ops`, `/finance-operators`)
 * va «Kirish diagnostikasi» (`/logs`) — FAQAT superadmin; «Faoliyat jurnali» (`/activity-logs`) — superadmin va admin.
 * Boshqa rol — shell ichida 403.
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

const stub = (text: string) => ({ default: () => <p>{text}</p> });
vi.mock("../../pages/ops", () => stub("Ops sahifasi /ops"));
vi.mock("../../pages/finance-operators", () => stub("Ops sahifasi /finance-operators"));
vi.mock("../../pages/integrations-ops", () => stub("Ops sahifasi /integrations-ops"));
vi.mock("../../pages/investors-ops", () => stub("Ops sahifasi /investors-ops"));
vi.mock("../../pages/logistics-ops", () => stub("Ops sahifasi /logistics-ops"));
vi.mock("../../pages/branch-ops", () => stub("Ops sahifasi /branch-ops"));
vi.mock("../../pages/identity-ops", () => stub("Ops sahifasi /identity-ops"));
vi.mock("../../pages/system-ops", () => stub("Ops sahifasi /system-ops"));
vi.mock("../../pages/logs/index", () => stub("Ops sahifasi /logs"));
vi.mock("../../pages/activity-logs", () => stub("Faoliyat jurnali sahifasi"));

const OPS_PATHS = [
  "/ops",
  "/finance-operators",
  "/integrations-ops",
  "/investors-ops",
  "/logistics-ops",
  "/branch-ops",
  "/identity-ops",
  "/system-ops",
  "/logs",
];

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

const forbidden = () =>
  screen.findByRole(
    "heading",
    { level: 1, name: "Bu sahifaga ruxsatingiz yo'q" },
    { timeout: 5000 },
  );

describe("Ops vositalari — faqat superadmin (F2NzXpMv)", () => {
  it.each(OPS_PATHS)("superadmin: %s ochiladi", async (path) => {
    renderAt(path, "superadmin");
    expect(
      await screen.findByText(`Ops sahifasi ${path}`, undefined, { timeout: 5000 }),
    ).toBeInTheDocument();
  });

  it.each(OPS_PATHS)("admin: %s — 403 (admin menyusida «Ops vositalari» yo'q)", async (path) => {
    renderAt(path, "admin");
    expect(await forbidden()).toBeInTheDocument();
    expect(screen.queryByText(`Ops sahifasi ${path}`)).not.toBeInTheDocument();
  });
});

describe("«Faoliyat jurnali» — superadmin va admin", () => {
  it.each(["superadmin", "admin"])("%s: /activity-logs ochiladi", async (role) => {
    renderAt("/activity-logs", role);
    expect(
      await screen.findByText("Faoliyat jurnali sahifasi", undefined, { timeout: 5000 }),
    ).toBeInTheDocument();
  });

  it("menejer: /activity-logs — 403", async () => {
    renderAt("/activity-logs", "manager");
    expect(await forbidden()).toBeInTheDocument();
  });
});
