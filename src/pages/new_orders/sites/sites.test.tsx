import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import ExternalSitesPage from "./index";
import SiteScanPage from "./scan";

const apiGetMock = vi.fn();
const apiPostMock = vi.fn();

vi.mock("../../../shared/api/api", () => ({
  api: {
    get: (...args: unknown[]) => apiGetMock(...args),
    post: (...args: unknown[]) => apiPostMock(...args),
  },
}));

const adminState = { role: { id: "admin-1", role: "admin", region: null, name: "Admin" } } as never;

const adosh = {
  id: "7",
  name: "Adosh",
  slug: "adosh",
  status: "active",
  api_url: "https://adosh.uz/api",
  is_active: true,
  role: "source",
  market_id: "12",
  total_synced_orders: 4,
  last_sync_at: null,
  field_mapping: {},
};

const intakeSettings = (receiveOpen: boolean) => ({
  cutoff_time: null,
  is_open: true,
  closes_at: null,
  reopens_at: null,
  receive_cutoff_time: "16:00",
  receive_is_open: receiveOpen,
  receive_closes_at: receiveOpen ? "2099-11-10T11:00:00.000Z" : null,
  receive_reopens_at: receiveOpen ? null : "2099-11-10T19:00:00.000Z",
  day_change_time: "00:00",
});

describe("«Tashqi saytlar» — sayt tanlash", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
  });

  const renderList = () =>
    renderWithProviders(
      <Routes>
        <Route path="/new-orders/sites" element={<ExternalSitesPage />} />
      </Routes>,
      { route: "/new-orders/sites", preloadedState: adminState },
    );

  it("⭐ faol, marketga bog'langan ulanishlar — market nomi bilan; to'lov tizimi va marketsizi chiqmaydi", async () => {
    apiGetMock.mockImplementation((url: string) => {
      if (url === "integrations") {
        return Promise.resolve({
          data: {
            statusCode: 200,
            data: {
              items: [
                adosh,
                { ...adosh, id: "8", name: "Donoxon", slug: "donoxon", market_id: "13", market: { id: "13", name: "Donoxon market" } },
                { ...adosh, id: "9", name: "Click", slug: "click", role: "payment" },
                { ...adosh, id: "10", name: "Marketsiz", slug: "nomarket", market_id: null },
              ],
              markets: [{ id: "12", name: "Adosh market" }],
              market: null,
              meta: {},
            },
          },
        });
      }
      return Promise.resolve({ data: [] });
    });

    renderList();

    const table = await screen.findByRole("table", { name: "Ulangan saytlar" });
    expect(within(table).getByRole("link", { name: "Adosh" })).toHaveAttribute("href", "/new-orders/sites/7");
    expect(within(table).getByText("Adosh market")).toBeInTheDocument();
    expect(within(table).getByRole("link", { name: "Donoxon" })).toHaveAttribute("href", "/new-orders/sites/8");
    expect(within(table).getByText("Donoxon market")).toBeInTheDocument();
    expect(within(table).queryByText("Click")).not.toBeInTheDocument();
    expect(within(table).queryByText("Marketsiz")).not.toBeInTheDocument();
    expect(apiGetMock).toHaveBeenCalledWith("integrations", { params: { is_active: "true", page: 1, limit: 100 } });
    // Qobiq tablari ichida — «Tashqi saytlar» tabi bor.
    expect(screen.getAllByText("Tashqi saytlar").length).toBeGreaterThan(0);
  });

  it("ulangan sayt yo'q — bo'sh holat va «Integratsiyalarga o'tish»", async () => {
    apiGetMock.mockImplementation((url: string) =>
      url === "integrations"
        ? Promise.resolve({ data: { statusCode: 200, data: { items: [], markets: [], market: null, meta: {} } } })
        : Promise.resolve({ data: [] }),
    );

    renderList();

    expect(await screen.findByText("Ulangan sayt yo'q")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Integratsiyalarga o'tish" })).toBeInTheDocument();
  });
});

describe("«Tashqi saytlar» — QR skan va qabul", () => {
  const siteOrder = (id: number, overrides: Record<string, unknown> = {}) => ({
    id,
    qr_code: `ADQ-${id}`,
    full_name: id === 501 ? "Rustam Jo'rayev" : "Dilnoza Karimova",
    phone: "+998901234567",
    address: "Toshkent, Chilonzor 9",
    total_price: 150000,
    delivery_price: 20000,
    items: [{ name: "Ko'ylak", quantity: 2 }],
    ...overrides,
  });
  /** Saytning javobi backend `search-by-qr` qobig'ida; sayt o'zi ham `{ success, data }` bilan o'raydi. */
  const found = (order: unknown) => ({
    data: { statusCode: 200, message: "ok", data: { integration: {}, request: {}, raw: {}, data: { success: true, data: order } } },
  });

  let receiveOpen = true;
  let siteOrders: Record<string, unknown> = {};
  let importResult: { created: unknown[]; skipped: unknown[] } = { created: [], skipped: [] };
  let receiveResult: { received: number; unmatched: unknown[] } = { received: 0, unmatched: [] };

  const postCalls = (url: string) => apiPostMock.mock.calls.filter(([called]) => called === url);

  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    receiveOpen = true;
    siteOrders = { "ADQ-501": siteOrder(501), "ADQ-502": siteOrder(502) };
    importResult = { created: [], skipped: [] };
    receiveResult = { received: 0, unmatched: [] };
    apiGetMock.mockImplementation((url: string) => {
      if (url === "integrations/7") {
        return Promise.resolve({
          data: { statusCode: 200, data: { ...adosh, market: { id: "12", name: "Adosh market" } } },
        });
      }
      if (url === "orders/intake-settings") return Promise.resolve({ data: { data: intakeSettings(receiveOpen) } });
      return Promise.resolve({ data: [] });
    });
    apiPostMock.mockImplementation((url: string, body: { qr_code?: string }) => {
      if (url === "integrations/adosh/search-by-qr") {
        const order = siteOrders[String(body.qr_code)];
        return Promise.resolve(order ? found(order) : { data: { statusCode: 200, data: { data: null } } });
      }
      if (url === "orders/external/receive") {
        return Promise.resolve({ data: { statusCode: 200, data: { integration: {}, ...importResult } } });
      }
      if (url === "orders/external/receive-by-scan") return Promise.resolve({ data: { data: receiveResult } });
      return Promise.reject(new Error(`unexpected ${url}`));
    });
  });

  const renderScan = () =>
    renderWithProviders(
      <Routes>
        <Route path="/new-orders/sites/:integrationId" element={<SiteScanPage />} />
      </Routes>,
      { route: "/new-orders/sites/7", preloadedState: adminState },
    );

  const scan = (value: string) => {
    const input = screen.getByPlaceholderText("QR kodni skanerlang yoki kiriting…");
    fireEvent.change(input, { target: { value } });
    fireEvent.submit(input.closest("form")!);
  };

  const acceptButton = () => screen.getByRole("button", { name: /^Qabul qilish — / });

  it("⭐ skan saytdan buyurtmani oladi va ro'yxatga qo'shadi (hali hech narsa yaratilmaydi)", async () => {
    renderScan();
    expect(await screen.findByRole("heading", { level: 1, name: "Adosh" })).toBeInTheDocument();
    expect(screen.getByText(/Market: Adosh market/)).toBeInTheDocument();
    expect(acceptButton()).toBeDisabled();

    scan("ADQ-501");

    expect(await screen.findByText("Rustam Jo'rayev — ro'yxatga qo'shildi")).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Skanerlangan buyurtmalar" });
    expect(within(table).getByText("Rustam Jo'rayev")).toBeInTheDocument();
    expect(within(table).getByText("ADQ-501")).toBeInTheDocument();
    expect(postCalls("integrations/adosh/search-by-qr")[0][1]).toEqual({ qr_code: "ADQ-501", endpoint: "/qrorder/find" });
    expect(postCalls("orders/external/receive")).toHaveLength(0);
    expect(acceptButton()).toBeEnabled();
  });

  it("takror skan — saytga qayta so'ralmaydi, ogohlantirish; topilmagan QR — xato", async () => {
    renderScan();
    await screen.findByRole("heading", { level: 1, name: "Adosh" });

    scan("ADQ-501");
    await screen.findByText("Rustam Jo'rayev — ro'yxatga qo'shildi");
    scan("ADQ-501");
    expect(await screen.findByText("Rustam Jo'rayev — allaqachon ro'yxatda")).toBeInTheDocument();
    expect(postCalls("integrations/adosh/search-by-qr")).toHaveLength(1);

    scan("ADQ-404");
    expect(await screen.findByText("Saytda bu QR bo'yicha buyurtma topilmadi")).toBeInTheDocument();
    expect(within(screen.getByRole("table", { name: "Skanerlangan buyurtmalar" })).getAllByRole("row")).toHaveLength(2);
  });

  it("qatorni olib tashlash — ro'yxatdan chiqadi", async () => {
    const user = userEvent.setup();
    renderScan();
    await screen.findByRole("heading", { level: 1, name: "Adosh" });
    scan("ADQ-501");
    await screen.findByText("Rustam Jo'rayev — ro'yxatga qo'shildi");

    await user.click(screen.getByRole("button", { name: "Rustam Jo'rayev ni ro'yxatdan olib tashlash" }));

    expect(await screen.findByText("Skanerlangan buyurtmalar yo'q")).toBeInTheDocument();
    expect(acceptButton()).toBeDisabled();
  });

  it("⭐ «Qabul qilish» — tasdiq, so'ng yaratish va QR bo'yicha qabul; qabul qilingan qator ro'yxatdan chiqadi", async () => {
    const user = userEvent.setup();
    importResult = { created: [{ id: "o-1", external_id: "501", status: "new" }], skipped: [] };
    receiveResult = { received: 1, unmatched: [] };
    renderScan();
    await screen.findByRole("heading", { level: 1, name: "Adosh" });
    scan("ADQ-501");
    await screen.findByText("Rustam Jo'rayev — ro'yxatga qo'shildi");

    await user.click(acceptButton());
    const dialog = await screen.findByRole("alertdialog", { name: "1 ta buyurtmani qabul qilasizmi?" });
    expect(within(dialog).getByText(/«Adosh market» marketi nomidan yaratiladi/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Qabul qilish" }));

    expect(await screen.findByText("Skanerlangan buyurtmalar yo'q")).toBeInTheDocument();
    expect(postCalls("orders/external/receive")[0][1]).toEqual({ integration_id: "7", orders: [siteOrder(501)] });
    expect(postCalls("orders/external/receive-by-scan")[0][1]).toEqual({ tokens: ["ADQ-501"] });
    expect(screen.getAllByText("1 ta buyurtma qabul qilindi").length).toBeGreaterThan(0);
  });

  it("⭐ yaratilmagan buyurtma sababi bilan qoladi va qabulga yuborilmaydi; «allaqachon bor» — qabul qilinadi", async () => {
    const user = userEvent.setup();
    siteOrders["ADQ-503"] = siteOrder(503, { full_name: "Aziz Rahimov" });
    importResult = {
      created: [{ id: "o-1", external_id: "501", status: "new" }],
      skipped: [
        { external_id: "502", reason: "phone_missing" },
        { external_id: "503", reason: "already_exists" },
      ],
    };
    receiveResult = { received: 2, unmatched: [] };
    renderScan();
    await screen.findByRole("heading", { level: 1, name: "Adosh" });
    scan("ADQ-501");
    await screen.findByText("Rustam Jo'rayev — ro'yxatga qo'shildi");
    scan("ADQ-502");
    await screen.findByText("Dilnoza Karimova — ro'yxatga qo'shildi");
    scan("ADQ-503");
    await screen.findByText("Aziz Rahimov — ro'yxatga qo'shildi");

    await user.click(acceptButton());
    const dialog = await screen.findByRole("alertdialog", { name: "3 ta buyurtmani qabul qilasizmi?" });
    await user.click(within(dialog).getByRole("button", { name: "Qabul qilish" }));

    expect(await screen.findByText("2 ta qabul qilindi, 1 tasi o'tmadi")).toBeInTheDocument();
    expect(postCalls("orders/external/receive-by-scan")[0][1]).toEqual({ tokens: ["ADQ-503", "ADQ-501"] });
    const table = screen.getByRole("table", { name: "Skanerlangan buyurtmalar" });
    expect(within(table).getByText("Dilnoza Karimova")).toBeInTheDocument();
    expect(within(table).getByText("Mijoz telefoni yo'q")).toBeInTheDocument();
    expect(within(table).queryByText("Rustam Jo'rayev")).not.toBeInTheDocument();
    expect(within(table).queryByText("Aziz Rahimov")).not.toBeInTheDocument();
  });

  it("qabul serverda o'tmasa — qatorlar sababi bilan qoladi", async () => {
    const user = userEvent.setup();
    importResult = { created: [{ id: "o-1", external_id: "501", status: "new" }], skipped: [] };
    receiveResult = { received: 0, unmatched: [{ token: "ADQ-501", reason: "Boshqa filial buyurtmasi" }] };
    renderScan();
    await screen.findByRole("heading", { level: 1, name: "Adosh" });
    scan("ADQ-501");
    await screen.findByText("Rustam Jo'rayev — ro'yxatga qo'shildi");

    await user.click(acceptButton());
    await user.click(
      within(await screen.findByRole("alertdialog", { name: "1 ta buyurtmani qabul qilasizmi?" })).getByRole("button", {
        name: "Qabul qilish",
      }),
    );

    expect(await screen.findByText("0 ta qabul qilindi, 1 tasi o'tmadi")).toBeInTheDocument();
    expect(within(screen.getByRole("table", { name: "Skanerlangan buyurtmalar" })).getByText("Boshqa filial buyurtmasi")).toBeInTheDocument();
  });

  it("kun tartibi bo'yicha qabul yopiq — ogohlantirish, skan ishlaydi, «Qabul qilish» o'chiq", async () => {
    receiveOpen = false;
    renderScan();
    expect(await screen.findByTestId("sites-receive-closed")).toBeInTheDocument();

    scan("ADQ-501");
    await screen.findByText("Rustam Jo'rayev — ro'yxatga qo'shildi");
    await waitFor(() => expect(acceptButton()).toBeDisabled());
  });

  it("sayt topilmadi (404) — xato holati", async () => {
    apiGetMock.mockImplementation((url: string) =>
      url === "integrations/7"
        ? Promise.reject({ response: { status: 404, data: { statusCode: 404, message: "Integration not found" } } })
        : Promise.resolve({ data: { data: intakeSettings(true) } }),
    );
    renderScan();

    expect(await screen.findByText("Sayt topilmadi")).toBeInTheDocument();
  });
});
