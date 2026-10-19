import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { vi } from "vitest";
import IncomingOrdersPage from "./index";
import { renderWithProviders } from "../../test/test-utils";
import { getActiveScanTarget, resetScanTargets } from "../../shared/lib/scanner/scanTargets";

const LocationProbe = () => <span data-testid="location">{useLocation().pathname}</span>;

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

/**
 * «Skanerlangan N / M» — maketda son va «/ M» alohida uslubda (ikki element), shu bois hisob
 * `progressbar` dan o'qiladi (ekran o'quvchi ham shuni eshitadi) va ko'rinadigan son bilan solishtiriladi.
 */
const scannedProgress = () => {
  const bar = screen.getByRole("progressbar", { name: "Skanerlangan posilkalar" });
  const visible = screen.getByText("Skanerlangan").nextElementSibling?.textContent?.replace(/\s+/g, " ").trim();
  const aria = `${bar.getAttribute("aria-valuenow")} / ${bar.getAttribute("aria-valuemax")}`;
  expect(visible?.replace(/(\d)\//, "$1 /")).toBe(aria);
  return aria;
};

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
    await user.click(screen.getByRole("button", { name: "Yangilash" }));

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
    expect(scannedProgress()).toBe("0 / 130");
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
    expect(scannedProgress()).toBe("4 / 150");
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

    fireEvent.click(screen.getByRole("button", { name: "Qabul qilish — 250 ta posilka" }));

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
    expect(scannedProgress()).toBe("0 / 3");
  });

  it("takroriy skan hamon ogohlantiradi va qayta qo'shilmaydi", async () => {
    mockSource(3);
    renderPage();
    expect(await screen.findByText("Mijoz 3")).toBeInTheDocument();

    scan(token(2));
    expect(await screen.findByText(/2 — ro'yxatga qo'shildi/)).toBeInTheDocument();
    scan(token(2));

    expect(await screen.findByText(/2 — allaqachon skanerlangan/)).toBeInTheDocument();
    expect(scannedProgress()).toBe("1 / 3");
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
    Array.from(document.querySelectorAll<HTMLElement>('[data-testid="incoming-parcel"][data-scanned="true"]')).map(
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
    expect(scannedProgress()).toBe("6 / 7");
    // Ro'yxatdan topildi — serverga skan so'rovi ketmadi.
    expect(apiGetMock.mock.calls.some(([url]) => String(url).startsWith("scan/"))).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Qabul qilish — 6 ta posilka" }));
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
    expect(screen.getByRole("button", { name: "Qabul qilish — 4 ta posilka" })).toBeEnabled();
  });

  it("bittalab skanerlangan posilka ikkilanmaydi; qop qayta skanerlansa — \"allaqachon\"", async () => {
    mockList([1, 2, 3, 4, 5, 6].map((n) => member(n)));
    renderPage();
    expect(await screen.findByText("Andijon mijoz 6")).toBeInTheDocument();

    scan("parcel-2");
    expect(await screen.findByText(/1251162 — ro'yxatga qo'shildi/)).toBeInTheDocument();
    scan(BATCH);
    expect(await screen.findByText("Qop: 6 posilkadan 6 tasi belgilandi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Qabul qilish — 6 ta posilka" })).toBeEnabled();

    scan(BATCH);
    expect(await screen.findByText("Qop: 6 posilkadan 6 tasi allaqachon belgilangan")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Qabul qilish — 6 ta posilka" })).toBeEnabled();
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

/**
 * DIZAYN v2 (maket `superadmin-neworders-incoming-scan`): o'z sarlavhasi, skaner maydoni fokusda,
 * «Qabul qilish — N ta posilka» yagona asosiy tugma, oxirgi skan natijasi va qisman qabul xabari.
 */
describe("IncomingOrdersPage — dizayn v2", () => {
  const items = [
    { id: "o-1", order_number: 10263, qr_code_token: "tok-1", total_price: 175000, customer: { name: "Rustam Jo'rayev", district: { name: "Olmazor tumani" } } },
    { id: "o-2", order_number: 10264, qr_code_token: "tok-2", total_price: 520000, customer: { name: "Gulchehra Saidova" } },
  ];
  const mockApi = () =>
    apiGetMock.mockImplementation((url: string) => {
      if (url === "orders/external") return Promise.resolve({ data: { data: items, total: items.length } });
      if (url === "orders/external/sources") {
        return Promise.resolve({ data: [{ market_id: "121", orders_count: 2, total_price_sum: 695000, oldest_at: null, market: { name: "BeePost" } }] });
      }
      return Promise.resolve({ data: [] });
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

  it("sarlavha — manba nomi, «← Kiruvchi posilkalar» manbalar ro'yxatiga qaytaradi; skaner maydoni fokusda", async () => {
    mockApi();
    renderPage();

    expect(await screen.findByRole("heading", { level: 1, name: "BeePost" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Kiruvchi posilkalar" })).toHaveAttribute("href", "/new-orders/incoming");
    expect(screen.getByRole("textbox", { name: "QR kod yoki posilka kodi" })).toHaveFocus();
    expect(await screen.findByText("Rustam Jo'rayev")).toBeInTheDocument();
    expect(screen.getByText("USB skaner tayyor")).toHaveAttribute("role", "status");
    // «Kelgan posilkalar» kartasi: jami son va summa.
    expect(screen.getByRole("region", { name: "Kelgan posilkalar" })).toHaveTextContent("2 ta · jami 695 000 so'm");
  });

  it("«Qabul qilish» skanerlanmaguncha o'chiq; skan — №, mijoz va tuman bilan xabar, qator yashil belgilanadi", async () => {
    mockApi();
    renderPage();
    await screen.findByText("Rustam Jo'rayev");

    expect(screen.getByRole("button", { name: "Qabul qilish — 0 ta posilka" })).toBeDisabled();

    scan("tok-1");

    expect(await screen.findByText("№10263 — ro'yxatga qo'shildi")).toBeInTheDocument();
    expect(screen.getByText(/Rustam Jo'rayev, Olmazor tumani/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Qabul qilish — 1 ta posilka" })).toBeEnabled();
    const mark = document.querySelector<HTMLElement>('[data-testid="incoming-parcel"][data-order-id="o-1"]')!;
    expect(mark.dataset.scanned).toBe("true");
    expect(mark).toHaveTextContent("Skanerlandi");
    expect(mark.closest("tr")).toHaveClass("bg-success-soft");
    expect(scannedProgress()).toBe("1 / 2");
  });

  it("server ba'zi tokenni moslay olmasa — nechtasi o'tmagani va sababi ko'rsatiladi, fokus skanerga qaytadi", async () => {
    mockApi();
    apiPostMock.mockResolvedValue({
      data: { data: { received: 1, unmatched: [{ token: "tok-2-abcdefghijk", reason: "allaqachon received" }] } },
    });
    renderPage();
    await screen.findByText("Rustam Jo'rayev");

    scan("tok-1");
    scan("tok-2");
    fireEvent.click(await screen.findByRole("button", { name: "Qabul qilish — 2 ta posilka" }));

    expect(
      await screen.findByText("1 qabul qilindi, 1 o'tmadi: tok-2-abcd… — allaqachon received"),
    ).toBeInTheDocument();
    expect(apiPostMock).toHaveBeenCalledWith("orders/external/receive-by-scan", { tokens: ["tok-1", "tok-2"] });
    await waitFor(() => expect(screen.getByPlaceholderText("QR kodni skanerlang yoki kiriting...")).toHaveFocus());
  });

  it("boshqa manbaga o'tilsa (`:marketId` almashdi) oldingi manbaning posilkalari ko'rsatilmaydi", async () => {
    const user = userEvent.setup();
    apiGetMock.mockImplementation((url: string, config?: { params?: { market_id?: string } }) => {
      if (url === "orders/external") {
        // Ikkinchi manba ro'yxati hali kelmagan.
        if (config?.params?.market_id === "122") return new Promise(() => {});
        return Promise.resolve({ data: { data: items, total: items.length } });
      }
      return Promise.resolve({ data: [] });
    });
    renderWithProviders(
      <Routes>
        <Route
          path="/new-orders/incoming/:marketId"
          element={
            <>
              <IncomingOrdersPage />
              <Link to="/new-orders/incoming/122">Keyingi manba</Link>
            </>
          }
        />
      </Routes>,
      { route: "/new-orders/incoming/121", preloadedState: adminState },
    );
    expect(await screen.findByText("Rustam Jo'rayev")).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Keyingi manba" }));

    await waitFor(() => expect(screen.queryByText("Rustam Jo'rayev")).not.toBeInTheDocument());
    expect(document.querySelector('[data-testid="incoming-parcel"]')).toBeNull();
    // Bo'sh jadval sarlavhasi emas — yangi ro'yxat yuklanayotgani (skelet holati).
    const list = screen.getByRole("region", { name: "Kelgan posilkalar" });
    expect(list.querySelector("[data-query-state]")).toHaveAttribute("data-query-state", "loading");
  });

  it("skaner kodni harf-harf yozib Enter bossa ham (klaviatura emulyatsiyasi) posilka belgilanadi va maydon tozalanadi", async () => {
    const user = userEvent.setup();
    mockApi();
    renderPage();
    await screen.findByText("Rustam Jo'rayev");

    await user.type(screen.getByPlaceholderText("QR kodni skanerlang yoki kiriting..."), "tok-2{Enter}");

    expect(await screen.findByText("№10264 — ro'yxatga qo'shildi")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("QR kodni skanerlang yoki kiriting...")).toHaveValue("");
  });
});

describe("IncomingOrdersPage — kamera (markaziy «Skaner» tugmasi)", () => {
  const items = [
    { id: "o-1", order_number: 10263, qr_code_token: "tok-1", total_price: 175000, customer: { name: "Rustam Jo'rayev", district: { name: "Olmazor tumani" } } },
    { id: "o-2", order_number: 10264, qr_code_token: "tok-2", total_price: 96000, customer: { name: "Akmal Yo'ldoshev" }, external_batch_token: "qop-1", external_batch_size: 3 },
    { id: "o-3", order_number: 10265, qr_code_token: "tok-3", total_price: 145000, customer: { name: "Farrux Ahmedov" }, external_batch_token: "qop-1", external_batch_size: 3 },
  ];
  const sources = [
    { market_id: "121", orders_count: 3, total_price_sum: 416000, oldest_at: null, market: { name: "BeePost" } },
    { market_id: "122", orders_count: 5, total_price_sum: 900000, oldest_at: null, market: { name: "Uzum" } },
  ];
  const mockApi = () =>
    apiGetMock.mockImplementation((url: string) => {
      if (url === "orders/external") return Promise.resolve({ data: { data: items, total: items.length } });
      if (url === "orders/external/sources") return Promise.resolve({ data: sources });
      return Promise.resolve({ data: [] });
    });
  const target = () => getActiveScanTarget()!;

  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
  });

  afterEach(() => {
    act(() => resetScanTargets());
  });

  it("maqsad: «Posilkalarni qabul qilish · BeePost · 3 ta kelgan»; kamera skani `ScanInput` bilan bir handler — faqat belgilaydi", async () => {
    mockApi();
    renderPage();
    await screen.findByText("Rustam Jo'rayev");
    await screen.findByRole("heading", { level: 1, name: "BeePost" });

    expect(target()).toMatchObject({
      id: "incoming:121",
      title: "Posilkalarni qabul qilish",
      context: "BeePost · 3 ta kelgan",
      progress: { done: 0, total: 3, label: "ta skanerlandi" },
      finish: { label: "Tugatish" },
      switcher: { label: "BeePost", value: "121", title: "Manbani tanlang" },
    });

    await act(async () => {
      await target().onScan("tok-1", "camera");
    });

    // Sahifadagi bilan AYNAN bir xil natija: xabar, belgi, «Qabul qilish — 1 ta» — server so'rovi yo'q.
    expect(await screen.findByText("№10263 — ro'yxatga qo'shildi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Qabul qilish — 1 ta posilka" })).toBeEnabled();
    expect(apiPostMock).not.toHaveBeenCalled();
    expect(target().progress).toMatchObject({ done: 1, total: 3 });
    expect(target().list?.[0]).toMatchObject({ key: "o-1", title: "№10263 · Rustam Jo'rayev", tone: "success" });

    // «Bekor qilish» — belgi olinadi (server amali hali yo'q).
    act(() => target().list![0].onUndo!());
    expect(screen.getByRole("button", { name: "Qabul qilish — 0 ta posilka" })).toBeDisabled();
    expect(target().list).toEqual([]);
  });

  it("qop to'liq emas (3 dan 2 tasi) — kamera hisobida ogohlantirish «Qopda yetishmaydi 1»", async () => {
    mockApi();
    renderPage();
    await screen.findByText("Rustam Jo'rayev");

    await act(async () => {
      await target().onScan("qop-1", "camera");
    });

    expect(await screen.findByText("Qop: 3 posilkadan 2 tasi belgilandi")).toBeInTheDocument();
    expect(target().stats).toEqual([{ key: "bag", label: "Qopda yetishmaydi", value: 1, tone: "warning" }]);
    expect(target().progress).toMatchObject({ done: 2, total: 3 });
  });

  it("manba almashtirish: variantlar manbalar ro'yxatidan, tanlansa — `/new-orders/incoming/:id`", async () => {
    mockApi();
    renderWithProviders(
      <>
        <Routes>
          <Route path="/new-orders/incoming/:marketId" element={<IncomingOrdersPage />} />
        </Routes>
        <LocationProbe />
      </>,
      { route: "/new-orders/incoming/121", preloadedState: adminState },
    );
    await screen.findByText("Rustam Jo'rayev");

    const options = target().switcher!.options as () => Promise<ReadonlyArray<{ value: string; label: string; meta?: string }>>;
    await expect(options()).resolves.toEqual([
      { value: "121", label: "BeePost", meta: "3 ta posilka" },
      { value: "122", label: "Uzum", meta: "5 ta posilka" },
    ]);

    act(() => target().switcher!.onSelect("122"));
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/new-orders/incoming/122"));
    await waitFor(() => expect(target().id).toBe("incoming:122"));
  });
});
