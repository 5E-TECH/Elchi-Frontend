import { Suspense } from "react";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/test-utils";
import type { RootState } from "../config/store";
import AppRouter from "./routes";

/**
 * MO-3: market operatori — `/orders` va `/orders/edit/:orderId` (o'z marketi, faqat ko'rish) ochiq; «Qabul va
 * yaratish» qobig'idan faqat `/new-orders/create` («AI bilan»): `/new-orders` → yaratishga, qolgan bolalar → 403.
 * Boshqa rollarning qobiq yo'llari o'zgarmaydi (market — o'z yangi buyurtmalari).
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

vi.mock("../../pages/orders", () => ({ default: () => <p>Buyurtmalar sahifasi</p> }));
vi.mock("../../pages/orders/create", () => ({ default: () => <p>Yaratish sahifasi</p> }));
vi.mock("../../pages/new_orders/components/new_orderUpdate", () => ({ default: () => <p>Tafsilot sahifasi</p> }));
vi.mock("../../pages/new_orders/components/new_orderDetail", () => ({ default: () => <p>Market yangi buyurtmalari</p> }));
vi.mock("../../pages/new_orders/markets", () => ({ default: () => <p>Marketlar sahifasi</p> }));
vi.mock("../../pages/new_orders/cancelled/detail", () => ({ default: () => <p>Bekorlar sahifasi</p> }));
vi.mock("../../pages/users/detail/UserDetailPage", () => ({ default: () => <p>Foydalanuvchi sahifasi</p> }));

const signedInAs = (role: string): Partial<RootState> => ({
  user: {
    user: null,
    isAuthenticated: true,
    accessToken: "test.token",
    loading: false,
    isAppInitializing: false,
    error: null,
  },
  role: { id: "7", role, region: null, name: null },
});

const renderAt = (route: string, role: string) =>
  renderWithProviders(
    <Suspense fallback={null}>
      <AppRouter />
    </Suspense>,
    { route, preloadedState: signedInAs(role) },
  );

const forbidden = () =>
  screen.findByRole("heading", { level: 1, name: "Bu sahifaga ruxsatingiz yo'q" }, { timeout: 5000 });

describe("market operatori — buyurtmalar route'lari (MO-3)", () => {
  it.each([
    ["/orders", "Buyurtmalar sahifasi"],
    ["/orders/edit/12", "Tafsilot sahifasi"],
    ["/new-orders/create", "Yaratish sahifasi"],
  ])("%s ochiladi", async (route, text) => {
    renderAt(route, "market_operator");
    expect(await screen.findByText(text, undefined, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByTestId("shell")).toBeInTheDocument();
  });

  it("`/new-orders` (menyu bandi) → yaratish sahifasi", async () => {
    renderAt("/new-orders", "market_operator");
    expect(await screen.findByText("Yaratish sahifasi", undefined, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.queryByText("Marketlar sahifasi")).not.toBeInTheDocument();
  });

  it.each(["/new-orders/7", "/new-orders/7/edit/12", "/new-orders/cancelled/7", "/new-orders/userDetail/9", "/new-orders/incoming"])(
    "%s — 403 (sahifa chizilmaydi)",
    async (route) => {
      renderAt(route, "market_operator");
      expect(await forbidden()).toBeInTheDocument();
      expect(screen.queryByText(/sahifasi$|buyurtmalari$/)).not.toBeInTheDocument();
    },
  );

  it("market egasi o'zgarmagan: o'z yangi buyurtmasi tafsiloti va yaratish ochiq (qobiq cheklovi faqat operatorda)", async () => {
    const { unmount } = renderAt("/new-orders/7/edit/12", "market");
    expect(await screen.findByText("Tafsilot sahifasi", undefined, { timeout: 5000 })).toBeInTheDocument();
    unmount();
    renderAt("/new-orders/create", "market");
    expect(await screen.findByText("Yaratish sahifasi", undefined, { timeout: 5000 })).toBeInTheDocument();
  });

  it("logist va investor uchun buyurtmalar hali yopiq (403)", async () => {
    for (const role of ["logist", "investor"]) {
      const { unmount } = renderAt("/orders", role);
      expect(await forbidden()).toBeInTheDocument();
      unmount();
    }
  });
});
