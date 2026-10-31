import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { vi } from "vitest";
import IncomingOrdersPage from "./index";
import { renderWithProviders } from "../../test/test-utils";
import { getActiveScanTarget, resetScanTargets } from "../../shared/lib/scanner/scanTargets";
import { toastStore } from "../../shared/lib/notify";
import { SCAN_FEEDBACK_EVENT } from "../../shared/lib/scanner/feedback";

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
 * TOKEN REGISTRI VA TARTIBI (rQX8TqRV): skanerda Caps Lock yoqiq, yorliq katta harfli yoki OS da kirill tartibi —
 * posilka baribir topiladi, serverga esa asl token ketadi (backend tokenni aniq solishtiradi).
 */
describe("IncomingOrdersPage — token normallashtirish", () => {
  const TOKEN = "c9f6d82e571cc6f19d6f2d26";
  /** Rus tartibida skanerlangan token: harf — o'sha tugmaning kirill belgisi. */
  const CYRILLIC = "с9а6в82у571сс6а19в6а2в26";
  const BAG = "3733ff7bd1e2c4a5b6c7d8e9";

  const mockList = () =>
    apiGetMock.mockImplementation((url: string) => {
      if (url !== "orders/external") return Promise.resolve({ data: [] });
      return Promise.resolve({
        data: {
          data: [
            { id: "o-1", order_number: 1251133, qr_code_token: TOKEN, customer: { name: "Birinchi mijoz" } },
            { id: "o-2", order_number: 1251134, qr_code_token: "aaaa1111", external_batch_token: BAG, external_batch_size: 2, customer: { name: "Qop mijoz 1" } },
            { id: "o-3", order_number: 1251135, qr_code_token: "bbbb2222", external_batch_token: BAG, external_batch_size: 2, customer: { name: "Qop mijoz 2" } },
          ],
          total: 3,
        },
      });
    });
  const scan = (value: string) => {
    const input = screen.getByPlaceholderText("QR kodni skanerlang yoki kiriting...");
    fireEvent.change(input, { target: { value } });
    fireEvent.submit(input.closest("form")!);
  };
  const scanLookups = () => apiGetMock.mock.calls.filter(([url]) => String(url).startsWith("scan/"));

  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    mockList();
  });

  it.each([
    ["KATTA harf", TOKEN.toUpperCase()],
    ["aralash registr", "C9f6D82e571CC6f19d6F2d26"],
    ["kirill tartibi", CYRILLIC],
    ["kirill tartibi + Caps Lock", CYRILLIC.toUpperCase()],
    ["KATTA harfli havola", `https://elchi.uz/scan/${TOKEN.toUpperCase()}`],
  ])("⭐ %s — posilka topiladi, serverga asl token ketadi", async (_name, value) => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Birinchi mijoz");

    scan(value);

    expect(await screen.findByText(/1251133 — ro'yxatga qo'shildi/)).toBeInTheDocument();
    expect(scannedProgress()).toBe("1 / 3");
    expect(scanLookups()).toEqual([]);

    apiPostMock.mockResolvedValue({ data: { data: { received: 1, unmatched: [] } } });
    await user.click(screen.getByRole("button", { name: "Qabul qilish — 1 ta posilka" }));
    await waitFor(() => expect(apiPostMock).toHaveBeenCalledWith("orders/external/receive-by-scan", { tokens: [TOKEN] }));
  });

  it("boshqa yozuvdagi takroriy skan — «allaqachon», hisob o'zgarmaydi", async () => {
    renderPage();
    await screen.findByText("Birinchi mijoz");

    scan(TOKEN);
    await screen.findByText(/1251133 — ro'yxatga qo'shildi/);
    scan(TOKEN.toUpperCase());

    expect(await screen.findByText(/1251133 — allaqachon skanerlangan/)).toBeInTheDocument();
    expect(scannedProgress()).toBe("1 / 3");
  });

  it.each([
    ["KATTA harfda", BAG.toUpperCase()],
    ["kirill tartibida", "3733аа7ив1у2с4ф5и6с7в8у9"],
  ])("qop tokeni %s ham ro'yxatning o'zidan topiladi", async (_name, value) => {
    renderPage();
    await screen.findByText("Qop mijoz 2");

    scan(value);
    expect(await screen.findByText("Qop: 2 posilkadan 2 tasi belgilandi")).toBeInTheDocument();
    expect(scannedProgress()).toBe("2 / 3");
    expect(scanLookups()).toEqual([]);
  });

  it("ro'yxatda yo'q qop: avval skanerlangan yozuv, keyin kichik harflisi so'raladi", async () => {
    renderPage();
    await screen.findByText("Birinchi mijoz");

    scan("BEGONA9999");

    expect(
      await screen.findByText("Bu QR ro'yxatda topilmadi — posilka boshqa hamkordanmi yoki allaqachon qabul qilinganmi?"),
    ).toBeInTheDocument();
    expect(scanLookups().map(([url]) => url)).toEqual(["scan/BEGONA9999", "scan/begona9999"]);
  });

  it("kamera ro'yxati token bo'yicha posilkani topadi (kirill tartibda skanerlangan bo'lsa ham)", async () => {
    renderPage();
    await screen.findByText("Birinchi mijoz");

    scan(CYRILLIC);

    await waitFor(() => expect(getActiveScanTarget()?.list?.map((item) => item.key)).toEqual(["o-1"]));
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
    // r8EGkLrP: qabul xabari qop bo'yicha qabul qilinganini aytadi.
    expect(await screen.findByText("Qop bo'yicha qabul qilindi: 6 ta posilka (jami 6 ta buyurtma)")).toBeInTheDocument();
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

    // r8EGkLrP: bittalab skanerlangan 1 tasi «qop bo'yicha» sanalmaydi — qop skani belgilagan 5 tasi.
    apiPostMock.mockResolvedValue({ data: { data: { received: 6, unmatched: [] } } });
    fireEvent.click(screen.getByRole("button", { name: "Qabul qilish — 6 ta posilka" }));
    expect(await screen.findByText("Qop bo'yicha qabul qilindi: 5 ta posilka (jami 6 ta buyurtma)")).toBeInTheDocument();
  });

  it("r8EGkLrP: qop skanisiz qabul — avvalgi xabar («N buyurtma qabul qilindi»), qop haqida gap yo'q", async () => {
    mockList([1, 2, 3].map((n) => member(n)));
    apiPostMock.mockResolvedValue({ data: { data: { received: 1, unmatched: [] } } });
    renderPage();
    expect(await screen.findByText("Andijon mijoz 3")).toBeInTheDocument();

    scan("parcel-1");
    fireEvent.click(await screen.findByRole("button", { name: "Qabul qilish — 1 ta posilka" }));
    expect(await screen.findByText("1 buyurtma qabul qilindi")).toBeInTheDocument();
    expect(screen.queryByText(/Qop bo'yicha qabul qilindi/)).not.toBeInTheDocument();
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
  // Belgi faqat brauzer oynasi faol bo'lganda chiqadi; jsdom da `document.hasFocus()` doim `false`.
  beforeEach(() => {
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

    // Qopdagi posilka kamerada «Bekor qilish» bilan olinsa — yetishmovchilik qayta hisoblanadi.
    act(() => target().list![0].onUndo!());
    expect(target().progress).toMatchObject({ done: 1, total: 3 });
    expect(target().stats).toEqual([{ key: "bag", label: "Qopda yetishmaydi", value: 2, tone: "warning" }]);
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

/**
 * eo3eeJxs: USB skaner fokusdan qat'i nazar tinglaydi (`tizim-scanner`), F5 skanlarni o'chirmaydi va «USB skaner
 * tayyor» belgisi faqat ekran haqiqatan tinglayotganda ko'rinadi.
 */
describe("IncomingOrdersPage — USB skaner fokussiz, F5, «tayyor» belgisi", () => {
  const items = ["tok-11", "tok-22", "tok-33"].map((qr_code_token, index) => ({
    id: `o-${index + 1}`,
    order_number: 2000 + index,
    qr_code_token,
    customer: { name: `Mijoz ${index + 1}` },
  }));
  let list = items;
  const DRAFT_KEY = "elchi:incoming-scan:v1:user-1:121";
  const userState = {
    role: { id: "user-1", role: "admin", region: null, name: "Admin" },
    user: { user: { id: "user-1", role: "admin" }, isAuthenticated: true, accessToken: null, loading: false, isAppInitializing: false, error: null },
  } as never;
  const otherUserState = {
    role: { id: "user-2", role: "admin", region: null, name: "Admin" },
    user: { user: { id: "user-2", role: "admin" }, isAuthenticated: true, accessToken: null, loading: false, isAppInitializing: false, error: null },
  } as never;

  const render = (state: never = userState) =>
    renderWithProviders(
      <Routes>
        <Route path="/new-orders/incoming/:marketId" element={<IncomingOrdersPage />} />
      </Routes>,
      { route: "/new-orders/incoming/121", preloadedState: state },
    );
  const field = () => screen.getByPlaceholderText("QR kodni skanerlang yoki kiriting...");
  const scanInField = (value: string) => {
    fireEvent.change(field(), { target: { value } });
    fireEvent.submit(field().closest("form")!);
  };
  /** Skaner: harflar pauzasiz + Enter. Qaytgan qiymat `false` — Enter ushlangan (`preventDefault`). */
  const usbScan = (value: string, target: Element = document.activeElement ?? document.body) => {
    for (const key of value) fireEvent.keyDown(target, { key });
    return fireEvent.keyDown(target, { key: "Enter", code: "Enter" });
  };
  const badge = () => screen.queryByText("USB skaner tayyor");

  beforeEach(() => {
    list = items;
    window.localStorage.clear();
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    apiGetMock.mockImplementation((url: string) =>
      Promise.resolve(url === "orders/external" ? { data: { data: list, total: list.length } } : { data: [] }),
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    document.querySelectorAll("[data-test-extra]").forEach((element) => element.remove());
  });

  it("⭐ fokus bo'sh joyda: skan tutiladi, posilka belgilanadi, xabar chiqadi", async () => {
    render();
    await screen.findByText("Mijoz 3");
    act(() => field().blur());
    expect(document.activeElement).toBe(document.body);

    act(() => void usbScan("tok-22"));

    expect(await screen.findByText(/2001 — ro'yxatga qo'shildi/)).toBeInTheDocument();
    expect(scannedProgress()).toBe("1 / 3");
  });

  it("⭐ fokus tugmada: Enter tugmani bosmaydi, skan belgilanadi", async () => {
    const user = userEvent.setup();
    render();
    await screen.findByText("Mijoz 3");
    const refresh = screen.getByRole("button", { name: "Yangilash" });
    await user.click(refresh);
    await waitFor(() => expect(field()).toHaveFocus());
    await waitFor(() => expect(ordersCalls().length).toBe(2));
    act(() => refresh.focus());

    let notPrevented = true;
    act(() => {
      notPrevented = usbScan("tok-11", refresh);
    });

    expect(notPrevented).toBe(false);
    expect(await screen.findByText(/2000 — ro'yxatga qo'shildi/)).toBeInTheDocument();
    expect(ordersCalls().length).toBe(2);
  });

  it("fokus maydonda: skan bir marta tushadi (ikki yo'l ustma-ust emas)", async () => {
    render();
    await screen.findByText("Mijoz 3");

    act(() => void usbScan("tok-11", field()));
    expect(scannedProgress()).toBe("0 / 3");

    scanInField("tok-11");
    expect(await screen.findByText(/2000 — ro'yxatga qo'shildi/)).toBeInTheDocument();
    expect(scannedProgress()).toBe("1 / 3");
  });

  it("qisqa qiymat skan emas: Enter ushlanmaydi, xabar chiqmaydi", async () => {
    render();
    await screen.findByText("Mijoz 3");
    act(() => field().blur());

    let notPrevented = false;
    act(() => {
      notPrevented = usbScan("ab");
    });

    expect(notPrevented).toBe(true);
    expect(screen.queryByText(/Bu QR ro'yxatda topilmadi/)).not.toBeInTheDocument();
    expect(scannedProgress()).toBe("0 / 3");
  });

  it("⭐ modal ochiq: skaner ushlamaydi, belgi yo'q; yopilgach yana tinglaydi", async () => {
    render();
    await screen.findByText("Mijoz 3");
    act(() => field().blur());
    expect(badge()).toBeInTheDocument();

    const modal = document.createElement("div");
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("data-test-extra", "");
    act(() => document.body.append(modal));
    await waitFor(() => expect(badge()).not.toBeInTheDocument());

    act(() => void usbScan("tok-11"));
    expect(scannedProgress()).toBe("0 / 3");

    act(() => modal.remove());
    await waitFor(() => expect(badge()).toBeInTheDocument());
    act(() => void usbScan("tok-11"));
    expect(await screen.findByText(/2000 — ro'yxatga qo'shildi/)).toBeInTheDocument();
  });

  it("⭐ boshqa maydonga matn yozilmoqda: skaner ushlamaydi, belgi yo'q", async () => {
    render();
    await screen.findByText("Mijoz 3");
    const other = document.createElement("input");
    other.setAttribute("data-test-extra", "");
    document.body.append(other);

    act(() => other.focus());
    expect(badge()).not.toBeInTheDocument();
    act(() => void usbScan("tok-11", other));
    expect(scannedProgress()).toBe("0 / 3");

    act(() => field().focus());
    expect(badge()).toBeInTheDocument();
  });

  it("⭐ kamera ochiq: oyna skanerni to'smaydi, belgi turadi", async () => {
    render();
    await screen.findByText("Mijoz 3");
    const camera = document.createElement("div");
    camera.setAttribute("data-scanner-camera", "");
    camera.setAttribute("data-test-extra", "");
    camera.innerHTML = '<div role="dialog" aria-modal="true"></div>';
    act(() => document.body.append(camera));
    act(() => field().blur());

    expect(badge()).toBeInTheDocument();
    act(() => void usbScan("tok-11"));
    expect(await screen.findByText(/2000 — ro'yxatga qo'shildi/)).toBeInTheDocument();
  });

  it("⭐ brauzer oynasi faol emas: belgi yo'q, qaytganda chiqadi", async () => {
    render();
    await screen.findByText("Mijoz 3");
    expect(badge()).toBeInTheDocument();

    vi.mocked(document.hasFocus).mockReturnValue(false);
    act(() => void window.dispatchEvent(new Event("blur")));
    expect(badge()).not.toBeInTheDocument();

    vi.mocked(document.hasFocus).mockReturnValue(true);
    act(() => void window.dispatchEvent(new Event("focus")));
    expect(badge()).toBeInTheDocument();
  });

  it("ro'yxat tayyor bo'lmasa belgi yo'q, lekin fokussiz skan jim yo'qolmaydi", async () => {
    apiGetMock.mockImplementation((url: string) =>
      url === "orders/external" ? Promise.reject(serverError) : Promise.resolve({ data: [] }),
    );
    render();
    await screen.findByText("Buyurtma xizmati javob bermadi");
    act(() => field().blur());
    expect(badge()).not.toBeInTheDocument();

    act(() => void usbScan("tok-11"));

    expect(await screen.findByText(/Ro'yxat hali yuklanmagan/)).toBeInTheDocument();
  });

  it("⭐ F5: skanlar tiklanadi, qabul faqat ro'yxatda hali bor tokenlar bilan, keyin qoralama o'chadi", async () => {
    const user = userEvent.setup();
    const first = render();
    await screen.findByText("Mijoz 3");
    scanInField("tok-11");
    scanInField("tok-22");
    await waitFor(() => expect(scannedProgress()).toBe("2 / 3"));
    await waitFor(() => expect(window.localStorage.getItem(DRAFT_KEY)).toContain("tok-22"));
    first.unmount();

    // Sahifa ochilguncha o-2 boshqa joyda qabul qilindi.
    list = items.filter((order) => order.id !== "o-2");
    render();
    await screen.findByText("Mijoz 3");

    await waitFor(() => expect(scannedProgress()).toBe("1 / 2"));
    apiPostMock.mockResolvedValue({ data: { data: { received: 1, unmatched: [] } } });
    await user.click(screen.getByRole("button", { name: "Qabul qilish — 1 ta posilka" }));

    await waitFor(() => expect(apiPostMock).toHaveBeenCalledWith("orders/external/receive-by-scan", { tokens: ["tok-11"] }));
    await waitFor(() => expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull());
  });

  it("F5: «Olib tashlash» qoralamaga ham yoziladi", async () => {
    const user = userEvent.setup();
    const first = render();
    await screen.findByText("Mijoz 3");
    scanInField("tok-11");
    scanInField("tok-33");
    await waitFor(() => expect(scannedProgress()).toBe("2 / 3"));
    await user.click(screen.getByRole("button", { name: "№2000 ni ro'yxatdan olib tashlash" }));
    await waitFor(() => expect(scannedProgress()).toBe("1 / 3"));
    first.unmount();

    render();
    await screen.findByText("Mijoz 3");

    await waitFor(() => expect(scannedProgress()).toBe("1 / 3"));
  });

  it("boshqa foydalanuvchi qurilmadagi qoralamani ko'rmaydi", async () => {
    const first = render();
    await screen.findByText("Mijoz 3");
    scanInField("tok-11");
    await waitFor(() => expect(window.localStorage.getItem(DRAFT_KEY)).toContain("tok-11"));
    first.unmount();

    render(otherUserState);
    await screen.findByText("Mijoz 3");

    expect(scannedProgress()).toBe("0 / 3");
    expect(window.localStorage.getItem(DRAFT_KEY)).toContain("tok-11");
  });

  it("ro'yxat yuklanguncha qoralama o'chirilmaydi: xato bo'lsa, qayta urinishdan keyin tiklanadi", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ tokens: ["tok-33"], bagTokens: [], at: Date.now() }));
    let failing = true;
    apiGetMock.mockImplementation((url: string) => {
      if (url !== "orders/external") return Promise.resolve({ data: [] });
      return failing ? Promise.reject(serverError) : Promise.resolve({ data: { data: items, total: items.length } });
    });

    render();
    await screen.findByText("Buyurtma xizmati javob bermadi");
    expect(window.localStorage.getItem(DRAFT_KEY)).toContain("tok-33");

    failing = false;
    await user.click(screen.getByRole("button", { name: /Qayta urinish/ }));

    await screen.findByText("Mijoz 3");
    await waitFor(() => expect(scannedProgress()).toBe("1 / 3"));
  });
});

describe("IncomingOrdersPage — «Qop» ustuni, skanni olib tashlash, yangilashda belgilar (IP-1)", () => {
  const BAG_A = "a1b2c3d4e5f6a7b8c9d0e1f2";
  const BAG_B = "3733ff7bd1e2c4a5b6c7d8e9";
  const baseItems = [
    { id: "o-1", order_number: 10268, qr_code_token: "tok-1", total_price: 210000, external_batch_token: BAG_A, external_batch_ref: "BP-24817", external_batch_size: 3, customer: { name: "Nigora Tursunova" } },
    { id: "o-2", order_number: 10267, qr_code_token: "tok-2", total_price: 145000, external_batch_token: BAG_A, external_batch_ref: "BP-24817", external_batch_size: 3, customer: { name: "Farrux Ahmedov" } },
    { id: "o-5", order_number: 10266, qr_code_token: "tok-5", total_price: 389000, external_batch_token: BAG_A, external_batch_ref: "BP-24817", external_batch_size: 3, customer: { name: "Lola Karimova" } },
    { id: "o-3", order_number: 10265, qr_code_token: "tok-3", total_price: 96000, external_batch_token: BAG_B, external_batch_size: 1, customer: { name: "Akmal Yo'ldoshev" } },
    { id: "o-4", order_number: 10262, qr_code_token: "tok-4", total_price: 310000, customer: { name: "Mohira Islomova" } },
  ];
  let items = baseItems;
  const mockApi = () =>
    apiGetMock.mockImplementation((url: string) => {
      if (url === "orders/external") return Promise.resolve({ data: { data: items, total: items.length } });
      if (url === "orders/external/sources") {
        return Promise.resolve({ data: [{ market_id: "121", orders_count: items.length, total_price_sum: 1, oldest_at: null, market: { name: "BeePost" } }] });
      }
      return Promise.resolve({ data: [] });
    });
  const scan = (value: string) => {
    const input = screen.getByPlaceholderText("QR kodni skanerlang yoki kiriting...");
    fireEvent.change(input, { target: { value } });
    fireEvent.submit(input.closest("form")!);
  };
  const scannedIds = () =>
    [...document.querySelectorAll<HTMLElement>('[data-testid="incoming-parcel"][data-scanned="true"]')].map(
      (mark) => mark.dataset.orderId,
    );
  const scanner = () => screen.getByRole("textbox", { name: "QR kod yoki posilka kodi" });
  const stateFor = (role: string, branchType?: string) =>
    ({
      role: { id: `${role}-1`, role, region: null, name: role },
      user: {
        user: { id: `${role}-1`, role, ...(branchType ? { branch: { id: "1", type: branchType } } : {}) },
        isAuthenticated: true,
        accessToken: null,
        loading: false,
        isAppInitializing: false,
        error: null,
      },
    }) as never;

  beforeEach(() => {
    items = baseItems;
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    mockApi();
  });
  afterEach(() => {
    act(() => toastStore.reset());
  });

  it("⭐ «Qop» ustuni: hamkor qop id'si, bo'lmasa token boshi «…», qopsiz «—»; xulosa «N ta · M ta qop · jami»", async () => {
    renderPage();
    await screen.findByText("Nigora Tursunova");

    expect(screen.getByRole("columnheader", { name: "Qop" })).toBeInTheDocument();
    const rowOf = (name: string) => screen.getByText(name).closest("tr")!;
    expect(rowOf("Nigora Tursunova")).toHaveTextContent("BP-24817");
    expect(rowOf("Akmal Yo'ldoshev")).toHaveTextContent("3733ff7b…");
    expect(rowOf("Akmal Yo'ldoshev")).not.toHaveTextContent(BAG_B);
    expect(rowOf("Mohira Islomova")).toHaveTextContent("—");
    expect(screen.getByRole("region", { name: "Kelgan posilkalar" })).toHaveTextContent(
      "5 ta · 2 ta qop · jami 1 150 000 so'm",
    );
  });

  it("⭐ qatordagi «Olib tashlash»: belgi olinadi, 5 soniyalik «Olib tashlandi» + «Qaytarish», fokus skanerga", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Nigora Tursunova");

    // Skanerlanmagan qatorda tugma yo'q.
    expect(screen.queryByRole("button", { name: /ro'yxatdan olib tashlash/ })).not.toBeInTheDocument();
    scan("tok-1");
    scan("tok-3");
    expect(scannedIds()).toEqual(["o-1", "o-3"]);

    const row = screen.getByText("Akmal Yo'ldoshev").closest("tr")!;
    await user.click(within(row).getByRole("button", { name: "№10265 ni ro'yxatdan olib tashlash" }));

    expect(scannedIds()).toEqual(["o-1"]);
    expect(scannedProgress()).toBe("1 / 5");
    expect(screen.getByRole("button", { name: "Qabul qilish — 1 ta posilka" })).toBeEnabled();
    expect(await screen.findByText("Olib tashlandi")).toBeInTheDocument();
    expect(screen.getByText("№10265 · 1 / 5")).toBeInTheDocument();
    expect(toastStore.getSnapshot()).toEqual([
      expect.objectContaining({ id: "incoming-unscan", tone: "info", duration: 5000 }),
    ]);
    expect(scanner()).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Qaytarish" }));

    expect(scannedIds()).toEqual(["o-1", "o-3"]);
    expect(scannedProgress()).toBe("2 / 5");
    expect(scanner()).toHaveFocus();
    // Qabulda ikkala token ham ketadi (server so'rovi faqat «Qabul qilish» da).
    apiPostMock.mockResolvedValue({ data: { data: { received: 2, unmatched: [] } } });
    await user.click(screen.getByRole("button", { name: "Qabul qilish — 2 ta posilka" }));
    await waitFor(() =>
      expect(apiPostMock).toHaveBeenCalledWith("orders/external/receive-by-scan", { tokens: ["tok-1", "tok-3"] }),
    );
  });

  it("oxirgi skan xabaridagi «Olib tashlash»: bittalab skan — shu posilka", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Nigora Tursunova");

    scan("tok-4");
    expect(await screen.findByText("№10262 — ro'yxatga qo'shildi")).toBeInTheDocument();
    await user.click(
      within(screen.getByRole("region", { name: "Skanerlash" })).getByRole("button", {
        name: "№10262 ni ro'yxatdan olib tashlash",
      }),
    );

    expect(scannedIds()).toEqual([]);
    // Belgi olingach xabardagi tugma yo'qoladi (olib tashlaydigan narsa qolmadi).
    expect(
      within(screen.getByRole("region", { name: "Skanerlash" })).queryByRole("button", { name: /olib tashlash/ }),
    ).not.toBeInTheDocument();
  });

  it("⭐ qop skani xabaridagi «Olib tashlash» — faqat shu skan belgilagan a'zolar (oldin bittalab skanerlangani qoladi)", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Nigora Tursunova");

    scan("tok-1");
    scan(BAG_A);
    expect(await screen.findByText("Qop: 3 posilkadan 3 tasi belgilandi")).toBeInTheDocument();
    expect(scannedIds()).toEqual(["o-1", "o-2", "o-5"]);

    await user.click(
      within(screen.getByRole("region", { name: "Skanerlash" })).getByRole("button", {
        name: "2 ta posilkani ro'yxatdan olib tashlash",
      }),
    );

    expect(scannedIds()).toEqual(["o-1"]);
    expect(await screen.findByText("2 ta posilka · 1 / 5")).toBeInTheDocument();
  });

  it("⭐ «Yangilash» belgilarni saqlaydi (ro'yxatda qolganlarini), fokus skanerga qaytadi; qabulda faqat qolgan tokenlar", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Nigora Tursunova");

    scan("tok-1");
    scan("tok-3");
    // Boshqa joyda o-3 qabul qilindi — yangi ro'yxatda yo'q.
    items = baseItems.filter((order) => order.id !== "o-3");
    await user.click(screen.getByRole("button", { name: "Yangilash" }));

    await waitFor(() => expect(screen.queryByText("Akmal Yo'ldoshev")).not.toBeInTheDocument());
    expect(scannedIds()).toEqual(["o-1"]);
    expect(scannedProgress()).toBe("1 / 4");
    expect(scanner()).toHaveFocus();

    apiPostMock.mockResolvedValue({ data: { data: { received: 1, unmatched: [] } } });
    await user.click(screen.getByRole("button", { name: "Qabul qilish — 1 ta posilka" }));
    await waitFor(() => expect(apiPostMock).toHaveBeenCalledWith("orders/external/receive-by-scan", { tokens: ["tok-1"] }));
  });

  it("telefon kartasida «Qop …» va skanerlangan kartada 44 px «Olib tashlash»", async () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes("max-width: 767px"),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    try {
      const user = userEvent.setup();
      renderPage();
      await screen.findByText("Nigora Tursunova");
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
      const card = screen.getByText("Nigora Tursunova").closest("li")!;
      expect(card).toHaveTextContent("Qop BP-24817");
      expect(screen.getByText("Mohira Islomova").closest("li")).not.toHaveTextContent("Qop");

      scan("tok-1");
      const undo = within(screen.getByText("Nigora Tursunova").closest("li")!).getByRole("button", {
        name: "№10268 ni ro'yxatdan olib tashlash",
      });
      expect(undo).toHaveClass("max-md:size-11");
      await user.click(undo);
      expect(scannedIds()).toEqual([]);
    } finally {
      window.matchMedia = original;
    }
  });

  it.each([
    ["manager", "HQ"],
    ["registrator", "REGIONAL"],
  ])("%s (%s) — skanerlash sahifasi ochiladi", async (role, branchType) => {
    renderWithProviders(
      <Routes>
        <Route path="/new-orders/incoming/:marketId" element={<IncomingOrdersPage />} />
      </Routes>,
      { route: "/new-orders/incoming/121", preloadedState: stateFor(role, branchType) },
    );
    expect(await screen.findByRole("heading", { level: 1, name: "BeePost" })).toBeInTheDocument();
  });

  it("qabul qilmaydigan menejer (REGIONAL) — ruxsat yo'q", async () => {
    renderWithProviders(
      <Routes>
        <Route path="/new-orders/incoming/:marketId" element={<IncomingOrdersPage />} />
      </Routes>,
      { route: "/new-orders/incoming/121", preloadedState: stateFor("manager", "REGIONAL") },
    );
    expect(await screen.findByText("Bu sahifaga kirish huquqingiz yo'q")).toBeInTheDocument();
  });
});

/** Chala qop (DamKku7C, ega S2 · S3 · S5, maketlar `*-incoming-scan-partial`, `*-partial-confirm-dialog`). */
describe("IncomingOrdersPage — chala qop", () => {
  const BAG = "3733ff7bd1e2c4a5b6c7d8e9";
  const FULL = "aaaa7bd1e2c4a5b6c7d8e9ff";
  const parcel = (n: number, extra: Record<string, unknown> = {}) => ({
    id: `o-${n}`,
    order_number: 10260 + n,
    qr_code_token: `tok-${n}`,
    total_price: 100000,
    customer: { name: `Mijoz ${n}` },
    ...extra,
  });
  const partialBag = { external_batch_token: BAG, external_batch_ref: "BP-24817", external_batch_size: 3 };
  const fullBag = { external_batch_token: FULL, external_batch_size: 2 };
  const partialMeta = { ...partialBag, received_count: 0, pending_count: 2 };
  const fullMeta = { ...fullBag, external_batch_ref: null, received_count: 0, pending_count: 2 };

  const mockList = (items: unknown[], batches?: unknown[]) =>
    apiGetMock.mockImplementation((url: string) =>
      url === "orders/external"
        ? Promise.resolve({ data: { data: items, total: items.length, ...(batches ? { meta: { batches } } : {}) } })
        : Promise.resolve({ data: [] }),
    );

  const scan = (value: string) => {
    const input = screen.getByPlaceholderText("QR kodni skanerlang yoki kiriting...");
    fireEvent.change(input, { target: { value } });
    fireEvent.submit(input.closest("form")!);
  };

  const sounds: string[] = [];
  const onSound = (event: Event) => sounds.push((event as CustomEvent<{ type: string }>).detail.type);

  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    apiPostMock.mockResolvedValue({ data: { data: { received: 2, unmatched: [] } } });
    sounds.length = 0;
    window.addEventListener(SCAN_FEEDBACK_EVENT, onSound);
  });
  afterEach(() => window.removeEventListener(SCAN_FEEDBACK_EVENT, onSound));

  it("⭐ hamkor 3 ta dedi, 2 tasi keldi — ogohlantirishda qop nomi va sonlar, qatorda «2/3»", async () => {
    mockList([parcel(1, partialBag), parcel(2, partialBag)], [partialMeta]);
    renderPage();

    const alert = await screen.findByRole("region", { name: "1 ta qop chala keldi" });
    expect(alert).toHaveTextContent("hamkor aytgan posilkalarning hammasi yetib kelmagan");
    expect(alert).toHaveTextContent("Qop BP-24817 — hamkor 3 ta dedi, 2 tasi keldi");
    expect(alert).toHaveTextContent("Yetishmagan posilka hali mashinada bo'lishi mumkin — qabul qilishdan oldin tekshiring.");
    // Ekran o'quvchi uchun izoh bilan: faqat «2/3» emas.
    expect(screen.getAllByText("2/3", { exact: false })[0]).toHaveTextContent("Chala qop: hamkor 3 ta dedi, 2 tasi keldi — 2/3");
  });

  it("ogohlantirish «Kelgan posilkalar» kartasidan oldin turadi", async () => {
    mockList([parcel(1, partialBag), parcel(2, partialBag)], [partialMeta]);
    renderPage();
    const alert = await screen.findByRole("region", { name: "1 ta qop chala keldi" });
    const list = screen.getByRole("heading", { name: "Kelgan posilkalar" });
    expect(alert.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("qop to'liq — ogohlantirish yo'q, belgi neytral «2/2»", async () => {
    mockList([parcel(1, fullBag), parcel(2, fullBag)], [fullMeta]);
    renderPage();
    expect(await screen.findByText("Mijoz 1")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /qop chala keldi/ })).toBeNull();
    expect(screen.getAllByText("2/2", { exact: false })[0]).toHaveTextContent("To'liq qop: 2/2");
  });

  it("hamkor hajmni aytmagan (`null`) — ogohlantirish ham, belgi ham yo'q", async () => {
    const bag = { external_batch_token: BAG, external_batch_size: null };
    mockList([parcel(1, bag)], [{ ...bag, received_count: 0, pending_count: 1 }]);
    renderPage();
    expect(await screen.findByText("Mijoz 1")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /qop chala keldi/ })).toBeNull();
    expect(screen.queryByText(/\d\/\d/)).toBeNull();
  });

  it("⭐ backend son bermasa frontend o'zi sanamaydi: ogohlantirish yo'q, tasdiqsiz qabul", async () => {
    mockList([parcel(1, partialBag), parcel(2, partialBag)]);
    renderPage();
    expect(await screen.findByText("Mijoz 1")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /qop chala keldi/ })).toBeNull();

    scan("tok-1");
    await userEvent.click(screen.getByRole("button", { name: /Qabul qilish — 1 ta/ }));
    await waitFor(() => expect(apiPostMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("⭐ ilgari qabul qilingan a'zo kamomad emas: 1 + 2 = 3/3, qop QR'i yashil", async () => {
    mockList([parcel(1, partialBag), parcel(2, partialBag)], [{ ...partialMeta, received_count: 1 }]);
    renderPage();
    expect(await screen.findByText("Mijoz 1")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /qop chala keldi/ })).toBeNull();

    scan(BAG);

    const message = await screen.findByText("Qop: 2 posilkadan 2 tasi belgilandi");
    expect(message.closest("[data-tone]")).toHaveAttribute("data-tone", "success");
    expect(sounds).toEqual(["success"]);
  });

  it("⭐ chala qop QR'i — sariq «Qop BP-24817: 2/3 keldi» va xato ovozi; to'liq qop — yashil", async () => {
    mockList(
      [parcel(1, partialBag), parcel(2, partialBag), parcel(3, fullBag), parcel(4, fullBag)],
      [partialMeta, fullMeta],
    );
    renderPage();
    expect(await screen.findByText("Mijoz 1")).toBeInTheDocument();

    scan(BAG);
    const message = await screen.findByText("Qop BP-24817: 2/3 keldi");
    expect(message.closest("[data-tone]")).toHaveAttribute("data-tone", "warning");
    expect(message.closest("[data-tone]")).toHaveTextContent("2 ta posilka belgilandi, 1 tasi yetishmaydi");
    expect(sounds).toEqual(["error"]);

    scan(FULL);
    const full = await screen.findByText("Qop: 2 posilkadan 2 tasi belgilandi");
    expect(full.closest("[data-tone]")).toHaveAttribute("data-tone", "success");
    expect(sounds).toEqual(["error", "success"]);
  });

  it("⭐ chala qopni qabul qilish — tasdiq; «Bekor qilish» so'rov yubormaydi, «Baribir qabul qilish» yuboradi", async () => {
    const user = userEvent.setup();
    mockList([parcel(1, partialBag), parcel(2, partialBag), parcel(3, fullBag), parcel(4, fullBag)], [partialMeta, fullMeta]);
    renderPage();
    expect(await screen.findByText("Mijoz 1")).toBeInTheDocument();
    scan(BAG);
    await screen.findByText("Qop BP-24817: 2/3 keldi");

    await user.click(screen.getByRole("button", { name: /Qabul qilish — 2 ta/ }));
    const dialog = await screen.findByRole("alertdialog", { name: "1 ta qop chala — baribir qabul qilinsinmi?" });
    expect(dialog).toHaveTextContent("Market #121 · 2 ta posilka skanerlangan");
    expect(dialog).toHaveTextContent("Qabul qilinayotgan posilkalarning 1 ta qopi chala. Yetishmagani hali mashinada bo'lishi mumkin.");
    expect(dialog).toHaveTextContent("Qop BP-24817");
    expect(dialog).toHaveTextContent("Hamkor 3 ta dedi, 2 tasi keldi · 2 tasi skanerlangan");
    expect(dialog).toHaveTextContent("1 ta yetishmaydi");
    expect(dialog).toHaveTextContent(
      "Skanerlangan 2 ta posilka qabul qilinadi. Yetishmagan 1 ta posilka kutilayotgan bo'lib qoladi — yetib kelganda shu sahifada qabul qilinadi.",
    );
    expect(dialog).toHaveTextContent("2 ta posilka skanerlanmagan — ro'yxatda qoladi.");

    await user.click(within(dialog).getByRole("button", { name: "Bekor qilish" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(apiPostMock).not.toHaveBeenCalled();
    expect(scannedProgress()).toBe("2 / 4");

    await user.click(screen.getByRole("button", { name: /Qabul qilish — 2 ta/ }));
    await user.click(await screen.findByRole("button", { name: "Baribir qabul qilish" }));
    await waitFor(() => expect(apiPostMock).toHaveBeenCalledTimes(1));
    expect(apiPostMock.mock.calls[0][1]).toEqual({ tokens: ["tok-1", "tok-2"] });
  });

  it("chala qopdan posilka skanerlanmagan bo'lsa tasdiq chiqmaydi", async () => {
    const user = userEvent.setup();
    mockList([parcel(1, partialBag), parcel(3, fullBag), parcel(4, fullBag)], [partialMeta, fullMeta]);
    renderPage();
    expect(await screen.findByRole("region", { name: "1 ta qop chala keldi" })).toBeInTheDocument();

    scan(FULL);
    await screen.findByText("Qop: 2 posilkadan 2 tasi belgilandi");
    await user.click(screen.getByRole("button", { name: /Qabul qilish — 2 ta/ }));

    await waitFor(() => expect(apiPostMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});
