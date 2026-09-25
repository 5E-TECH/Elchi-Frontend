import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import IncomingOrdersPage from "./index";
import { renderWithProviders } from "../../test/test-utils";

const apiGetMock = vi.fn();

vi.mock("../../shared/api/api", () => ({
  api: {
    get: (...args: unknown[]) => apiGetMock(...args),
    post: vi.fn(),
  },
}));

const adminState = {
  role: { id: "admin-1", role: "admin", region: null, name: "Admin" },
} as never;

const ordersCalls = () => apiGetMock.mock.calls.filter(([url]) => url === "orders/external");

const renderPage = () =>
  renderWithProviders(
    <Routes>
      <Route path="/new-orders/incoming/:marketId" element={<IncomingOrdersPage />} />
    </Routes>,
    { route: "/new-orders/incoming/121", preloadedState: adminState },
  );

const serverError = {
  response: { status: 500, data: { statusCode: 500, message: "Buyurtma xizmati javob bermadi" } },
};

describe("IncomingOrdersPage list states", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
  });

  it("shows an error banner — not 'no orders yet' — when the list request fails", async () => {
    apiGetMock.mockImplementation((url: string) =>
      url === "orders/external" ? Promise.reject(serverError) : Promise.resolve({ data: { data: [] } }),
    );

    renderPage();

    expect(await screen.findByText("Buyurtma xizmati javob bermadi")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("Hozircha kelgan buyurtma yo'q")).not.toBeInTheDocument();
    // "Kelgan 0" ham yolg'on bo'lardi — xato paytida son ko'rsatilmaydi.
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
  });

  it("refetches the list when 'Qayta urinish' is clicked", async () => {
    const user = userEvent.setup();
    apiGetMock.mockImplementation((url: string) =>
      url === "orders/external" ? Promise.reject(serverError) : Promise.resolve({ data: { data: [] } }),
    );

    renderPage();
    await screen.findByText("Buyurtma xizmati javob bermadi");
    const callsBefore = ordersCalls().length;

    await user.click(screen.getByRole("button", { name: /Qayta urinish/ }));

    await waitFor(() => expect(ordersCalls().length).toBe(callsBefore + 1));
  });

  it("keeps the already loaded orders and warns when only a refresh fails", async () => {
    const user = userEvent.setup();
    let failOrders = false;
    apiGetMock.mockImplementation((url: string) => {
      if (url !== "orders/external") return Promise.resolve({ data: { data: [] } });
      if (failOrders) return Promise.reject(serverError);
      return Promise.resolve({
        data: { data: { items: [{ id: "o-1", order_number: 1251170, customer: { name: "Ali Valiyev" } }], meta: { total: 1 } } },
      });
    });

    renderPage();
    expect(await screen.findByText("Ali Valiyev")).toBeInTheDocument();

    failOrders = true;
    await user.click(screen.getByTitle("Yangilash"));

    expect(await screen.findByText(/Ro'yxat yangilanmadi/)).toBeInTheDocument();
    expect(screen.getByText("Ali Valiyev")).toBeInTheDocument();
  });

  it("shows the empty state only when the request succeeded with no orders", async () => {
    apiGetMock.mockResolvedValue({ data: { data: { items: [], meta: { total: 0 } } } });

    renderPage();

    expect(await screen.findByText("Hozircha kelgan buyurtma yo'q")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
