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
 *
 * F2NzXpMv + bhitm9do («ikki eshik» yopildi): `/investors-ops`, `/system-ops`, `/logs` — `/ops?tab=<k>` ga, ko'chgan
 * `/logistics-ops` — `/returns` ga, `/branch-ops` — `/batches` ga yo'naltiradi; guard o'sha, admin ularga o'tmaydi.
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
vi.mock("../../pages/ops", async () => {
  const { useLocation } = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  const OpsHubStub = () => {
    const { pathname, search } = useLocation();
    return <p>{`Ops sahifasi ${pathname}${search}`}</p>;
  };
  return { default: OpsHubStub };
});
vi.mock("../../pages/returns", () => stub("Ops sahifasi /returns"));
vi.mock("../../pages/batches", () => stub("Ops sahifasi /batches"));
vi.mock("../../pages/finance-operators", () => stub("Ops sahifasi /finance-operators"));
vi.mock("../../pages/integrations", () => stub("Ops sahifasi /integrations"));
vi.mock("../../pages/identity-ops", () => stub("Ops sahifasi /identity-ops"));
vi.mock("../../pages/activity-logs", () => stub("Faoliyat jurnali sahifasi"));

const OPS_PATHS = ["/ops", "/finance-operators", "/identity-ops"];

const OPS_REDIRECTS = [
  ["/integrations-ops", "/integrations"],
  ["/investors-ops", "/ops?tab=investors"],
  ["/logistics-ops", "/returns"],
  ["/branch-ops", "/batches"],
  ["/system-ops", "/ops?tab=system"],
  ["/logs", "/ops?tab=auth"],
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

  it.each(OPS_REDIRECTS)("superadmin: %s → %s (bitta eshik)", async (path, target) => {
    renderAt(path, "superadmin");
    expect(
      await screen.findByText(`Ops sahifasi ${target}`, undefined, { timeout: 5000 }),
    ).toBeInTheDocument();
  });

  it.each([...OPS_PATHS, ...OPS_REDIRECTS.map(([path]) => path)])(
    "admin: %s — 403 (admin menyusida «Ops vositalari» yo'q)",
    async (path) => {
      renderAt(path, "admin");
      expect(await forbidden()).toBeInTheDocument();
      expect(screen.queryByText(/^Ops sahifasi/)).not.toBeInTheDocument();
    },
  );
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
