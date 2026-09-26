import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import IncomingOrdersPage from "./index";
import { renderWithProviders } from "../../test/test-utils";

const apiGetMock = vi.fn();
const apiPostMock = vi.fn();

vi.mock("../../shared/api/api", () => ({
  api: {
    get: (...args: unknown[]) => apiGetMock(...args),
    post: (...args: unknown[]) => apiPostMock(...args),
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

/**
 * KATTA MANBA: 100 tadan ko'p kutayotgan posilka.
 *
 * ⚠️ Backend `limit` ni faqat 10/25/50/100 qabul qiladi, qabul qilishda esa
 * bir so'rovda 200 tadan ortiq tokenni rad etadi (hT7E05R9, V74wNugv).
 */
describe("IncomingOrdersPage large sources", () => {
  const token = (n: number) => `token-${String(n).padStart(4, "0")}`;
  const mockSource = (total: number) =>
    apiGetMock.mockImplementation((url: string, config?: { params?: { page?: number; limit?: number } }) => {
      if (url !== "orders/external") return Promise.resolve({ data: [] });
      if (config?.params?.limit !== 100) {
        return Promise.reject({ response: { status: 400, data: { message: "limit faqat 10, 25, 50, 100 bo'lishi mumkin" } } });
      }
      const page = config.params.page ?? 1;
      const from = (page - 1) * 100;
      const count = Math.max(0, Math.min(100, total - from));
      const data = Array.from({ length: count }, (_, i) => ({
        id: `o-${from + i + 1}`,
        order_number: from + i + 1,
        qr_code_token: token(from + i + 1),
        customer: { name: `Mijoz ${from + i + 1}` },
      }));
      return Promise.resolve({ data: { data, total, page, limit: 100 } });
    });

  const scan = (value: string) => {
    const input = screen.getByPlaceholderText("QR kodni skanerlang yoki kiriting...");
    fireEvent.change(input, { target: { value } });
    fireEvent.submit(input.closest("form")!);
  };

  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
  });

  it("150 ta posilkaning hammasi (sahifalar chegarasidagilari ham) skanerlanadi", async () => {
    mockSource(150);
    renderPage();
    expect(await screen.findByText("Mijoz 150")).toBeInTheDocument();

    for (const n of [1, 100, 101, 150]) {
      scan(token(n));
      expect(await screen.findByText(new RegExp(`${n} — ro'yxatga qo'shildi`))).toBeInTheDocument();
    }
    expect(screen.getByText("4 / 150")).toBeInTheDocument();
  });

  it("250 ta skanerlangan posilka 200 + 50 bo'lib qabul qilinadi (bitta 400 emas)", async () => {
    mockSource(250);
    apiPostMock.mockImplementation((_url: string, body: { tokens: string[] }) =>
      body.tokens.length > 200
        ? Promise.reject({ response: { status: 400, data: { message: "bir so'rovda 200 tadan ko'p token yuborib bo'lmaydi" } } })
        : Promise.resolve({ data: { data: { received: body.tokens.length, unmatched: [] } } }),
    );
    renderPage();
    expect(await screen.findByText("Mijoz 250")).toBeInTheDocument();

    for (let n = 1; n <= 250; n += 1) scan(token(n));
    expect(await screen.findByText(/250 — ro'yxatga qo'shildi/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /QABUL QILISH \(250\)/ }));

    expect(await screen.findByText("250 buyurtma qabul qilindi")).toBeInTheDocument();
    expect(apiPostMock.mock.calls.map(([, body]) => (body as { tokens: string[] }).tokens.length)).toEqual([200, 50]);
    expect((apiPostMock.mock.calls[1][1] as { tokens: string[] }).tokens.at(-1)).toBe(token(250));
    // 250 ta skan har safar 250 qatorli ro'yxatni qayta chizadi — sekin, lekin real senariy.
  }, 60_000);

  it("begona token hamon rad etiladi va sababi ko'rsatiladi", async () => {
    mockSource(3);
    renderPage();
    expect(await screen.findByText("Mijoz 3")).toBeInTheDocument();

    scan("BEGONA-TOKEN-9999");

    expect(
      await screen.findByText("Bu QR ro'yxatda topilmadi — posilka boshqa hamkordanmi yoki allaqachon qabul qilinganmi?"),
    ).toBeInTheDocument();
    expect(screen.getByText("0 / 3")).toBeInTheDocument();
  });

  it("takroriy skan hamon ogohlantiradi va qayta qo'shilmaydi", async () => {
    mockSource(3);
    renderPage();
    expect(await screen.findByText("Mijoz 3")).toBeInTheDocument();

    scan(token(2));
    expect(await screen.findByText(/2 — ro'yxatga qo'shildi/)).toBeInTheDocument();
    scan(token(2));

    expect(await screen.findByText(/2 — allaqachon skanerlangan/)).toBeInTheDocument();
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });
});
