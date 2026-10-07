import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test/test-utils";
import { LegacyOrderCreateRedirect } from "../../app/lib/routes";
import NewOrders from "./index";

/**
 * BUYURTMA YARATISH "Qabul va yaratish" sahifasida: sarlavha o'ngidagi tugma
 * `/new-orders/create` ni ochadi, eski `/orders/add` havolasi shu yerga o'tadi.
 */

const LocationProbe = () => {
  const location = useLocation();
  const market = (location.state as { selectedMarket?: { name: string } } | null)?.selectedMarket;
  return (
    <span data-testid="location" data-market={market?.name ?? ""}>
      {location.pathname}
    </span>
  );
};

const stateFor = (role: string, branchType?: string) =>
  ({
    role: { id: `${role}-1`, role, region: null, name: role },
    user: {
      user: {
        id: `${role}-1`,
        role,
        ...(branchType ? { branch: { id: "1", type: branchType } } : {}),
      },
      isAuthenticated: true,
      accessToken: null,
      loading: false,
      isAppInitializing: false,
      error: null,
    },
  }) as never;

const renderPage = (route: string, role: string, branchType?: string) =>
  renderWithProviders(
    <>
      <NewOrders />
      <LocationProbe />
    </>,
    { route, preloadedState: stateFor(role, branchType) },
  );

describe("Qabul va yaratish — Buyurtma yaratish tugmasi", () => {
  it.each([
    ["admin", undefined],
    ["market", undefined],
    ["registrator", "REGIONAL"],
  ])("%s: sarlavhadagi tugma /new-orders/create ni ochadi", async (role, branchType) => {
    const user = userEvent.setup();
    renderPage("/new-orders", role, branchType);

    await user.click(screen.getByRole("button", { name: "Buyurtma yaratish" }));

    expect(screen.getByTestId("location")).toHaveTextContent("/new-orders/create");
  });

  it("tablar o'zgarmagan: 'Buyurtma yaratish' tab emas", () => {
    renderPage("/new-orders", "admin");

    expect(screen.getByText("Marketlar")).toBeInTheDocument();
    expect(screen.getByText("Kiruvchi posilkalar")).toBeInTheDocument();
    expect(screen.getByText("Filial batchlari")).toBeInTheDocument();
    expect(screen.getByText("Bekor qilinganlar")).toBeInTheDocument();
    expect(screen.getAllByText("Buyurtma yaratish")).toHaveLength(1);
  });

  it("forma ochiq bo'lsa tugma va tablar yashirin (forma o'z 'Orqaga'si bilan)", () => {
    renderPage("/new-orders/create", "admin");

    expect(screen.getByText("Qabul va yaratish")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Buyurtma yaratish" })).not.toBeInTheDocument();
    expect(screen.queryByText("Marketlar")).not.toBeInTheDocument();
  });
});

describe("Eski /orders/add havolasi", () => {
  it("/new-orders/create ga o'tadi va tanlangan marketni saqlaydi", () => {
    renderWithProviders(
      <Routes>
        <Route path="/orders/add" element={<LegacyOrderCreateRedirect />} />
        <Route path="/new-orders/create" element={<LocationProbe />} />
      </Routes>,
      {
        route: { pathname: "/orders/add", state: { selectedMarket: { id: "7", name: "TEST Market" } } },
        preloadedState: stateFor("admin"),
      },
    );

    expect(screen.getByTestId("location")).toHaveTextContent("/new-orders/create");
    expect(screen.getByTestId("location")).toHaveAttribute("data-market", "TEST Market");
  });
});
