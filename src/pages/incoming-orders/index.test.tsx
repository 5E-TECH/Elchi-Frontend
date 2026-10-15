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

/**
 * QOP (BATCH) SKANI (CbKnJLZO). Andijon E2E: qop tokeni 30d2894f58d3f89170a612c8,
 * qopda 6 posilka (1251162..1251167), har biri o'z QR tokeni bilan.
 */
describe("IncomingOrdersPage — qop (batch) yorlig'i", () => {
  const BATCH = "30d2894f58d3f89170a612c8";
  const member = (n: number, withBatch = true) => ({
    id: `125116${n}`,
    order_number: 1251160 + n,
    qr_code_token: `parcel-${n}`,
    customer: { name: `Andijon mijoz ${n}` },
    ...(withBatch ? { external_batch_token: BATCH, external_batch_size: 6 } : {}),
  });
  const other = { id: "o-9", order_number: 9, qr_code_token: "boshqa-9", customer: { name: "Boshqa qop mijozi" } };

  const mockList = (items: unknown[], scanReply?: (url: string) => unknown) =>
    apiGetMock.mockImplementation((url: string) => {
      if (url === "orders/external") return Promise.resolve({ data: { data: items, total: items.length } });
      if (url.startsWith("scan/") && scanReply) return Promise.resolve({ data: scanReply(url) });
      if (url.startsWith("scan/")) return Promise.reject({ response: { status: 404, data: { message: "Order not found" } } });
      return Promise.resolve({ data: [] });
    });

  const scan = (value: string) => {
    const input = screen.getByPlaceholderText("QR kodni skanerlang yoki kiriting...");
    fireEvent.change(input, { target: { value } });
    fireEvent.submit(input.closest("form")!);
  };
  const scannedRows = () =>
    Array.from(document.querySelectorAll<HTMLElement>('[data-testid="incoming-row"][data-scanned="true"]')).map(
      (row) => row.dataset.orderId,
    );

  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
  });

  it("⭐ qop tokeni — qopdagi 6 qator belgilanadi, \"Qop: 6 posilkadan 6 tasi belgilandi\"; begona qator tegilmaydi", async () => {
    mockList([1, 2, 3, 4, 5, 6].map((n) => member(n)).concat([other] as never));
    apiPostMock.mockResolvedValue({ data: { data: { received: 6, unmatched: [] } } });
    renderPage();
    expect(await screen.findByText("Andijon mijoz 6")).toBeInTheDocument();

    scan(BATCH);

    expect(await screen.findByText("Qop: 6 posilkadan 6 tasi belgilandi")).toBeInTheDocument();
    expect(scannedRows()).toEqual(["1251161", "1251162", "1251163", "1251164", "1251165", "1251166"]);
    expect(screen.getByText("6 / 7")).toBeInTheDocument();
    // Ro'yxatdan topildi — serverga skan so'rovi ketmadi.
    expect(apiGetMock.mock.calls.some(([url]) => String(url).startsWith("scan/"))).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: /QABUL QILISH \(6\)/ }));
    expect(await screen.findByText("6 buyurtma qabul qilindi")).toBeInTheDocument();
    // Serverga har posilkaning O'Z tokeni (qop tokeni emas) — javobgarlik ikkilanmaydi.
    expect(apiPostMock.mock.calls[0][1]).toEqual({
      tokens: ["parcel-1", "parcel-2", "parcel-3", "parcel-4", "parcel-5", "parcel-6"],
    });
  });

  it("⭐ yarim skanerlangan qop: 2 tasi oldin qabul qilingan (ro'yxatda yo'q) — faqat qolgan 4 tasi", async () => {
    mockList([3, 4, 5, 6].map((n) => member(n)));
    renderPage();
    expect(await screen.findByText("Andijon mijoz 6")).toBeInTheDocument();

    scan(BATCH);

    expect(await screen.findByText("Qop: 6 posilkadan 4 tasi belgilandi")).toBeInTheDocument();
    expect(scannedRows()).toEqual(["1251163", "1251164", "1251165", "1251166"]);
    expect(screen.getByRole("button", { name: /QABUL QILISH \(4\)/ })).toBeInTheDocument();
  });

  it("bittalab skanerlangan posilka ikkilanmaydi; qop qayta skanerlansa — \"allaqachon\"", async () => {
    mockList([1, 2, 3, 4, 5, 6].map((n) => member(n)));
    renderPage();
    expect(await screen.findByText("Andijon mijoz 6")).toBeInTheDocument();

    scan("parcel-2");
    expect(await screen.findByText(/1251162 — ro'yxatga qo'shildi/)).toBeInTheDocument();
    scan(BATCH);
    expect(await screen.findByText("Qop: 6 posilkadan 6 tasi belgilandi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /QABUL QILISH \(6\)/ })).toBeInTheDocument();

    scan(BATCH);
    expect(await screen.findByText("Qop: 6 posilkadan 6 tasi allaqachon belgilangan")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /QABUL QILISH \(6\)/ })).toBeInTheDocument();
  });

  it("ro'yxatda qop maydoni yo'q — server `GET /scan/:token` qop javobi bilan belgilanadi", async () => {
    mockList([1, 2, 3].map((n) => member(n, false)), () => ({
      type: "batch",
      data: { token: BATCH, size: 3, orders: [1, 2, 3].map((n) => ({ id: `125116${n}`, qr_code_token: `parcel-${n}` })) },
    }));
    renderPage();
    expect(await screen.findByText("Andijon mijoz 3")).toBeInTheDocument();

    scan(BATCH);

    expect(await screen.findByText("Qop: 3 posilkadan 3 tasi belgilandi")).toBeInTheDocument();
    expect(apiGetMock).toHaveBeenCalledWith(`scan/${BATCH}`);
    expect(scannedRows()).toEqual(["1251161", "1251162", "1251163"]);
  });

  it("na posilka, na qop (server 404) — avvalgidek \"topilmadi\", hech narsa belgilanmaydi", async () => {
    mockList([1, 2].map((n) => member(n)));
    renderPage();
    expect(await screen.findByText("Andijon mijoz 2")).toBeInTheDocument();

    scan("BEGONA-QOP-TOKEN");

    expect(
      await screen.findByText("Bu QR ro'yxatda topilmadi — posilka boshqa hamkordanmi yoki allaqachon qabul qilinganmi?"),
    ).toBeInTheDocument();
    expect(scannedRows()).toEqual([]);
  });
});
