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

  it("shows a readable message instead of axios' raw 'Network Error' when the server is unreachable", async () => {
    apiGetMock.mockImplementation((url: string) =>
      url === "orders/external"
        ? Promise.reject(Object.assign(new Error("Network Error"), { code: "ERR_NETWORK" }))
        : Promise.resolve({ data: [] }),
    );

    renderPage();

    expect(await screen.findByText("Buyurtmalar ro'yxatini yuklab bo'lmadi")).toBeInTheDocument();
    expect(screen.queryByText("Network Error")).not.toBeInTheDocument();
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

  it("asks only for a limit the backend accepts and loads every page of a large source", async () => {
    // Backend faqat 10/25/50/100 ni qabul qiladi — boshqasiga 400.
    const buildPage = (page: number, count: number) =>
      Array.from({ length: count }, (_, i) => ({
        id: `o-${page}-${i}`,
        order_number: page * 1000 + i,
        qr_code_token: `token-${page}-${i}`,
        customer: { name: `Mijoz ${page}-${i}` },
      }));
    apiGetMock.mockImplementation((url: string, config?: { params?: { page?: number; limit?: number } }) => {
      if (url !== "orders/external") return Promise.resolve({ data: [] });
      if (config?.params?.limit !== 100) {
        return Promise.reject({ response: { status: 400, data: { message: "limit faqat 10, 25, 50, 100 bo'lishi mumkin" } } });
      }
      const page = config.params.page ?? 1;
      return Promise.resolve({ data: { data: buildPage(page, page === 1 ? 100 : 30), total: 130, page, limit: 100 } });
    });

    renderPage();

    expect(await screen.findByText("Mijoz 2-29")).toBeInTheDocument();
    expect(screen.getByText("Mijoz 1-0")).toBeInTheDocument();
    expect(screen.getByText("0 / 130")).toBeInTheDocument();
    expect(ordersCalls().map(([, config]) => config.params)).toEqual([
      expect.objectContaining({ page: 1, limit: 100, market_id: "121", status: "new" }),
      expect.objectContaining({ page: 2, limit: 100, market_id: "121", status: "new" }),
    ]);
  });

  it("does not claim a scanned parcel is missing when the list never loaded", async () => {
    const user = userEvent.setup();
    apiGetMock.mockImplementation((url: string) =>
      url === "orders/external" ? Promise.reject(serverError) : Promise.resolve({ data: [] }),
    );

    renderPage();
    await screen.findByText("Buyurtma xizmati javob bermadi");

    await user.type(screen.getByPlaceholderText("QR kodni skanerlang yoki kiriting..."), "some-token{Enter}");

    expect(await screen.findByText(/Ro'yxat hali yuklanmagan/)).toBeInTheDocument();
    expect(screen.queryByText(/Bu QR ro'yxatda topilmadi/)).not.toBeInTheDocument();
  });

  it("shows the empty state only when the request succeeded with no orders", async () => {
    apiGetMock.mockResolvedValue({ data: { data: { items: [], meta: { total: 0 } } } });

    renderPage();

    expect(await screen.findByText("Hozircha kelgan buyurtma yo'q")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
