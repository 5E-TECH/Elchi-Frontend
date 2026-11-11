import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, type AxiosResponse } from "axios";
import { Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import ScanDetailPage from "./detail";
import { readScanHistory } from "./model/scanHistory";
import { resetDispatchBaskets } from "../../features/dispatch-basket";
import { renderWithProviders } from "../../test/test-utils";
import { api } from "../../shared/api/api";

const navigateMock = vi.fn();
const feedbackMock = vi.fn();
const assignMock = vi.fn();
const receiveMock = vi.fn();
const invalidateMock = vi.fn(async () => undefined);
const fetchMock = vi.fn();
const batchDetailMock = vi.fn<(...args: unknown[]) => { data: undefined }>(() => ({ data: undefined }));

vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual<typeof import("react-router-dom")>("react-router-dom")),
  useNavigate: () => navigateMock,
}));

vi.mock("../../shared/lib/scanner/feedback", async () => ({
  ...(await vi.importActual<typeof import("../../shared/lib/scanner/feedback")>("../../shared/lib/scanner/feedback")),
  playScanFeedback: (...args: unknown[]) => feedbackMock(...args),
}));

vi.mock("./lib/scanResource", async () => ({
  ...(await vi.importActual<typeof import("./lib/scanResource")>("./lib/scanResource")),
  fetchScanDetail: (...args: unknown[]) => fetchMock(...args),
  scanAssignOrder: (...args: unknown[]) => assignMock(...args),
  receiveScannedPackage: (...args: unknown[]) => receiveMock(...args),
  // Amaldan keyin boshqa ekranlar keshi yangilanadi (6qypMFeT) — chaqirilgani tekshiriladi.
  invalidateAfterScanAction: (...args: unknown[]) => invalidateMock(...(args as [])),
}));

// «Holat tarixi» o'z testlarida (`features/order-tracking`, `widgets/order-tracking`); bu yerda faqat joyi.
vi.mock("./ui/ScanTrackingCard", () => ({ default: () => <div data-testid="scan-tracking" /> }));

// Paket tafsiloti (`GET transfer-batches/:id`) — xodim uchun; testda so'rov yo'q.
vi.mock("../../entities/batch", async () => ({
  ...(await vi.importActual<typeof import("../../entities/batch")>("../../entities/batch")),
  useBatchDetail: (...args: unknown[]) => batchDetailMock(...args),
}));

const ORDER = { id: "1251175", status: "waiting", customer: { name: "Ali Valiyev" }, items: [] };

const hidScan = (value: string) =>
  act(() => {
    for (const key of value) window.dispatchEvent(new KeyboardEvent("keydown", { key }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
  });

const renderDetail = (
  role = "admin",
  { route = "/scan/PARCEL-A", user = {} as Record<string, unknown> } = {},
) =>
  renderWithProviders(
    <Routes>
      <Route path="/scan/:token" element={<ScanDetailPage />} />
    </Routes>,
    {
      route,
      preloadedState: {
        role: { id: `${role}-1`, role, region: null, name: role },
        user: {
          user: { id: `${role}-1`, role, ...user },
          isAuthenticated: true,
          accessToken: null,
          loading: false,
          isAppInitializing: false,
          error: null,
        },
      } as never,
    },
  );

const orderHeading = () => screen.findByRole("heading", { level: 1, name: "Buyurtma №1251175" });

beforeEach(() => {
  window.localStorage.clear();
  resetDispatchBaskets();
  navigateMock.mockReset();
  feedbackMock.mockReset();
  assignMock.mockReset();
  receiveMock.mockReset();
  invalidateMock.mockClear();
  batchDetailMock.mockClear();
  fetchMock.mockReset().mockResolvedValue({ type: "order", data: ORDER });
});

describe("ScanDetailPage — next scan from the detail page", () => {
  it("opens the next scanned parcel instead of losing the scan silently", async () => {
    renderDetail();
    await orderHeading();

    hidScan("PARCEL-B");

    expect(navigateMock).toHaveBeenCalledWith("/scan/PARCEL-B");
    expect(feedbackMock).toHaveBeenCalledWith("success", undefined, undefined, { voice: false });
  });

  it("treats a re-scan of the open parcel as a duplicate, not a navigation", async () => {
    renderDetail();
    await orderHeading();

    hidScan("PARCEL-A");

    expect(navigateMock).not.toHaveBeenCalled();
    expect(feedbackMock).toHaveBeenCalledWith("duplicate");
  });

  it("asks to wait while the courier's 'take it' request is still running", async () => {
    const user = userEvent.setup();
    assignMock.mockReturnValue(new Promise(() => undefined));
    renderDetail("courier");

    await user.click(await screen.findByRole("button", { name: /O'zimga olish/ }));
    hidScan("PARCEL-B");

    expect(navigateMock).not.toHaveBeenCalled();
    expect(feedbackMock).toHaveBeenCalledWith("error", "Amal tugashini kuting, keyin keyingi posilkani skanerlang.");
  });

  it("shows an inline alert for an invalid USB scan until the next valid scan", async () => {
    renderDetail();
    await orderHeading();

    hidScan("https://example.com/");

    expect(feedbackMock).toHaveBeenCalledWith("error", "Bu QR kod skaner uchun yaroqsiz");
    expect(await screen.findByTestId("scan-invalid-qr")).toHaveTextContent("Yorliqdagi QR kodni qayta o'qing.");
    expect(navigateMock).not.toHaveBeenCalled();

    hidScan("PARCEL-A");
    await waitFor(() => expect(screen.queryByTestId("scan-invalid-qr")).not.toBeInTheDocument());
  });
});

// Item 5: HQ kuryeri faqat HQ qabul qilgan buyurtmani oladi. Rad etish sababini
// backend aytadi — sahifa uni SO'ZMA-SO'Z ko'rsatishi shart (umumiy xabar
// kuryerni ko'r qoldirardi). Frontend kodi o'zgarmagan, bu regressiya qulfi.
describe("ScanDetailPage — O'ZIMGA OLISH rad etilganda", () => {
  it("shows the backend reason when scan-assign is rejected", async () => {
    const user = userEvent.setup();
    const backendMessage =
      "Buyurtma hali HQ da qabul qilinmagan (holati: yangi) — uni kuryerga berib bo'lmaydi. Avval HQ registratori buyurtmani qabul qilishi kerak.";
    assignMock.mockRejectedValue({
      response: { status: 400, data: { statusCode: 400, message: backendMessage } },
    });
    renderDetail("courier");

    const button = await screen.findByRole("button", { name: /O'zimga olish/ });
    await user.click(button);

    expect(await screen.findByText(backendMessage)).toBeInTheDocument();
    expect(feedbackMock).toHaveBeenCalledWith("error");
    expect(navigateMock).not.toHaveBeenCalled();
    // Muvaffaqiyatsizlikdan keyin kuryer qayta urina oladi.
    expect(screen.getByRole("button", { name: /O'zimga olish/ })).toBeEnabled();
  });

  it("falls back to the translated error when the backend sends no message", async () => {
    const user = userEvent.setup();
    assignMock.mockRejectedValue({ response: { status: 500, data: {} } });
    renderDetail("courier");

    await user.click(await screen.findByRole("button", { name: /O'zimga olish/ }));

    expect(
      await screen.findByText("Buyurtmani o'zingizga olishda xatolik yuz berdi"),
    ).toBeInTheDocument();
    expect(feedbackMock).toHaveBeenCalledWith("error");
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("sends the scanned token, locks the button and returns to the scanner after success", async () => {
    const user = userEvent.setup();
    assignMock.mockResolvedValue({ statusCode: 200 });
    renderDetail("courier");

    await user.click(await screen.findByRole("button", { name: /O'zimga olish/ }));

    expect(assignMock).toHaveBeenCalledWith("PARCEL-A");
    expect(await screen.findByText("Buyurtma sizga biriktirildi")).toBeInTheDocument();
    expect(feedbackMock).toHaveBeenCalledWith("success", undefined, undefined, { voice: "assigned" });
    expect(invalidateMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /O'zimga olish/ })).toBeDisabled();
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/scan"), { timeout: 3000 });
  });
});

// 6qypMFeT: qayta skanda eski holat yo'q — buyurtma allaqachon shu kuryerda yoki boshqa kuryerda bo'lsa
// «O'zimga olish» faol emas (backend `scanAssignOrder` qoidasi), sababi yonida.
describe("ScanDetailPage — kuryer: buyurtma kimda (6qypMFeT)", () => {
  it("already mine (courier_id = me, on the road): «Bu buyurtma allaqachon sizda», button disabled, no request", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue({ type: "order", data: { ...ORDER, status: "on_the_road", courier_id: "courier-1" } });
    renderDetail("courier");

    expect(await screen.findByText("Bu buyurtma allaqachon sizda")).toBeInTheDocument();
    expect(screen.getByText("Qayta olish shart emas — u buyurtmalaringiz ro'yxatida.")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: /O'zimga olish/ });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(assignMock).not.toHaveBeenCalled();
  });

  it("another courier: maket text with the courier name, button disabled", async () => {
    fetchMock.mockResolvedValue({
      type: "order",
      data: { ...ORDER, status: "on_the_road", courier_id: "93", courier: { id: "93", name: "Bekzod Normurodov" } },
    });
    renderDetail("courier");

    expect(await screen.findByText("Boshqa kuryerga biriktirilgan: Bekzod Normurodov")).toBeInTheDocument();
    expect(screen.getByText(/Bu buyurtmani o'zingizga ololmaysiz/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /O'zimga olish/ })).toBeDisabled();
  });

  it("free order (no courier, «0» sentinel ham): button enabled, no notice", async () => {
    fetchMock.mockResolvedValue({ type: "order", data: { ...ORDER, status: "received", courier_id: "0" } });
    renderDetail("courier");

    expect(await screen.findByRole("button", { name: /O'zimga olish/ })).toBeEnabled();
    expect(screen.queryByTestId("courier-take-mine")).not.toBeInTheDocument();
    expect(screen.queryByTestId("courier-take-other")).not.toBeInTheDocument();
  });
});

// 2026-11-07 (BeePost kuryer skan sahifasi): o'z yo'ldagi buyurtmasi — «Qabul qilish» (faqat shu buyurtma,
// `scan: true`); qabul qilingani (WAITING) — «Sotish» / «Bekor qilish», keyin skanerga «Qabul qilish» rejimida qaytadi.
describe("ScanDetailPage — kuryer: qabul qilish, sotish va bekor qilish", () => {
  const COURIER_ROAD = { ...ORDER, status: "on_the_road", courier_id: "courier-1", post_id: "p-7", where_deliver: "address" };
  const COURIER_WAITING = { ...COURIER_ROAD, status: "waiting", total_price: 245000 };
  const patchOk = (body: unknown) =>
    vi.spyOn(api, "patch").mockResolvedValue({ data: body } as AxiosResponse);

  afterEach(() => vi.restoreAllMocks());

  it("o'z yo'ldagi buyurtmasi: «Qabul qilish» (O'zimga olish yo'q) → PATCH post/receive/:post_id {order_ids, scan} → sotish/bekor", async () => {
    const user = userEvent.setup();
    const patch = patchOk({ statusCode: 200, data: [], received_order_ids: ["1251175"], post_status: "sent" });
    fetchMock.mockResolvedValueOnce({ type: "order", data: COURIER_ROAD });
    fetchMock.mockResolvedValue({ type: "order", data: COURIER_WAITING });
    renderDetail("courier");

    const receive = await screen.findByRole("button", { name: "Qabul qilish" });
    expect(screen.queryByRole("button", { name: /O'zimga olish/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sotish" })).not.toBeInTheDocument();
    await user.click(receive);

    expect(patch).toHaveBeenCalledWith(expect.stringMatching(/post\/receive\/p-7$/), { order_ids: ["1251175"], scan: true });
    expect(await screen.findByText("Buyurtma qabul qilindi")).toBeInTheDocument();
    expect(feedbackMock).toHaveBeenCalledWith("success", undefined, undefined, { voice: "received" });
    // Skan so'rovi qayta olindi — buyurtma «kutilmoqda»: sotish va bekor ochildi, sahifa almashmadi.
    expect(await screen.findByRole("button", { name: "Sotish" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bekor qilish" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Qabul qilish" })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("qabul rad etilsa — backend sababi, tugma qayta bosiladi, sahifa almashmaydi", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "patch").mockRejectedValue(
      new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
        status: 400,
        data: { message: "Buyurtma yo'lda emas — qabul qilib bo'lmaydi" },
      } as AxiosResponse),
    );
    fetchMock.mockResolvedValue({ type: "order", data: COURIER_ROAD });
    renderDetail("courier");

    await user.click(await screen.findByRole("button", { name: "Qabul qilish" }));

    expect(await screen.findByText("Buyurtma yo'lda emas — qabul qilib bo'lmaydi")).toBeInTheDocument();
    expect(feedbackMock).toHaveBeenCalledWith("error");
    expect(screen.getByRole("button", { name: "Qabul qilish" })).toBeEnabled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("pochtasi noma'lum yo'ldagi buyurtma — avvalgidek «allaqachon sizda» (qabul so'rovi yuborib bo'lmaydi)", async () => {
    fetchMock.mockResolvedValue({ type: "order", data: { ...COURIER_ROAD, post_id: null } });
    renderDetail("courier");

    expect(await screen.findByText("Bu buyurtma allaqachon sizda")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Qabul qilish" })).not.toBeInTheDocument();
  });

  it("qabul qilingan (WAITING) buyurtma: «Sotish» kuryer oynasi → sotildi → /scan «Qabul qilish» rejimida", async () => {
    const user = userEvent.setup();
    const post = vi
      .spyOn(api, "post")
      .mockResolvedValue({ data: { statusCode: 200, data: { id: "1251175", status: "sold" } } } as AxiosResponse);
    fetchMock.mockResolvedValue({ type: "order", data: COURIER_WAITING });
    renderDetail("courier");

    expect(await screen.findByRole("button", { name: "Bekor qilish" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /O'zimga olish/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sotish" }));

    // Kuryer varianti (ro'yxatdagi oyna): sarlavha «Sotish», «Qisman sotish» kaliti bor.
    const dialog = await screen.findByRole("dialog", { name: "Sotish" });
    expect(within(dialog).getByRole("switch")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Sotish" }));

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith("/scan", { state: { scanMode: "courierReceive" } }),
    );
    expect(post).toHaveBeenCalledWith(expect.stringContaining("orders/sell/1251175"), expect.anything());
  });

  it("«Bekor qilish» — kuryer bekor oynasi ochiladi", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue({ type: "order", data: COURIER_WAITING });
    renderDetail("courier");

    await user.click(await screen.findByRole("button", { name: "Bekor qilish" }));

    expect(await screen.findByRole("dialog", { name: "Buyurtmani bekor qilish" })).toBeInTheDocument();
  });

  it("202 «tasdiq kutilmoqda» — oyna yopilgach shu sessiyada sotish / bekor yashirin, holat ko'rinadi", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "post").mockResolvedValue({
      data: { statusCode: 202, data: { approval_required: true, approval: { id: "a1", action: "sell", amount: 15000 } } },
    } as AxiosResponse);
    fetchMock.mockResolvedValue({ type: "order", data: COURIER_WAITING });
    renderDetail("courier");

    await user.click(await screen.findByRole("button", { name: "Sotish" }));
    const dialog = await screen.findByRole("dialog", { name: "Sotish" });
    await user.click(within(dialog).getByRole("button", { name: "Sotish" }));

    expect(await screen.findByTestId("courier-approval-pending")).toHaveTextContent("Market tasdig'i kutilmoqda");
    expect(navigateMock).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Sotish" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bekor qilish" })).not.toBeInTheDocument();
    expect(screen.getByTestId("courier-approval-pending")).toBeInTheDocument();
  });

  it("⭐ SPEC v2: xarajat alohida (deferred) — sotildi: skanerga qaytadi, «xarajat kutmoqda» xabari, tasdiq holati yo'q", async () => {
    const user = userEvent.setup();
    const post = vi.spyOn(api, "post").mockResolvedValue({
      data: {
        statusCode: 201,
        data: {
          id: "1251175",
          status: "sold",
          extra_cost_request: {
            id: "xc-9",
            status: "pending",
            mode: "deferred",
            action: "sell",
            amount: 15000,
            items: [{ order_item_id: "i-1", product_id: "p-1", product_name: "Zaryadka", quantity: 2 }],
            auto_approve_at: null,
            created_at: new Date().toISOString(),
          },
        },
      },
    } as AxiosResponse);
    fetchMock.mockResolvedValue({ type: "order", data: { ...COURIER_WAITING, where_deliver: "center" } });
    renderDetail("courier");

    await user.click(await screen.findByRole("button", { name: "Sotish" }));
    const dialog = await screen.findByRole("dialog", { name: "Sotish" });
    await user.type(within(dialog).getByLabelText("Qo'shimcha xarajat"), "15000");
    expect(within(dialog).getByText(/^Buyurtma darhol sotiladi\./)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Sotish" }));

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith("/scan", { state: { scanMode: "courierReceive" } }),
    );
    expect(post).toHaveBeenCalledWith(
      expect.stringContaining("orders/sell/1251175"),
      expect.objectContaining({ extraCost: 15000 }),
    );
    expect(await screen.findByText(/^15\D000 so'm qo'shimcha xarajat market tasdig'ini kutmoqda$/)).toBeInTheDocument();
    expect(screen.getByText(/^Mahsulotlar: Zaryadka ×2\./)).toBeInTheDocument();
    expect(screen.queryByTestId("courier-approval-pending")).not.toBeInTheDocument();
  });
});

describe("ScanDetailPage — qo'shimcha xarajat belgisi (SPEC v2)", () => {
  const SOLD = {
    ...ORDER,
    status: "sold",
    pending_extra_cost_approval: null,
    extra_cost_request: {
      id: "xc-3",
      status: "pending",
      mode: "deferred",
      action: "sell",
      amount: 20000,
      items: [{ order_item_id: "i-1", product_id: "p-1", product_name: "Telefon g'ilofi", quantity: 1 }],
    },
  };

  it("sotilgan buyurtma — holat yonida «Xarajat kutilmoqda · 20 000 so'm», maslahatda tovar", async () => {
    fetchMock.mockResolvedValue({ type: "order", data: SOLD });
    renderDetail("admin");

    const tag = await screen.findByTestId("extra-cost-request-tag");
    expect(tag).toHaveTextContent(/^Xarajat kutilmoqda · 20\D000 so'm$/);
    expect(tag).toHaveAttribute("title", "Qaysi mahsulot uchun: Telefon g'ilofi ×1");
  });

  it("rad etilgan so'rov — «Xarajat rad etildi»", async () => {
    fetchMock.mockResolvedValue({
      type: "order",
      data: { ...SOLD, extra_cost_request: { ...SOLD.extra_cost_request, status: "rejected" } },
    });
    renderDetail("admin");

    expect(await screen.findByTestId("extra-cost-request-tag")).toHaveTextContent("Xarajat rad etildi");
  });
});

describe("ScanDetailPage — rol bo'yicha mazmun (spec G3 §2.3)", () => {
  it("staff: «Holat tarixi» and the order page link, no courier action", async () => {
    renderDetail("registrator");
    await orderHeading();

    expect(await screen.findByTestId("scan-tracking")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Buyurtma sahifasi" })).toHaveAttribute("href", "/orders/edit/1251175");
    expect(screen.getByRole("link", { name: "Yana skanerlash" })).toHaveAttribute("href", "/scan");
    expect(screen.queryByRole("button", { name: /O'zimga olish/ })).not.toBeInTheDocument();
  });

  it("courier: no «Qabul qilish», no tracking", async () => {
    renderDetail("courier");
    expect(await screen.findByRole("button", { name: /O'zimga olish/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Qabul qilish/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId("scan-tracking")).not.toBeInTheDocument();
  });

  it("market: read-only — no actions, no tracking, no order page link", async () => {
    renderDetail("market");
    await orderHeading();

    expect(screen.queryByRole("button", { name: /O'zimga olish/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Buyurtma sahifasi" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("scan-tracking")).not.toBeInTheDocument();
  });

  it("shows the not-found card with retry and back to scanner when the order has no data", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue({ type: "order", data: {} });
    renderDetail();

    expect(await screen.findByRole("heading", { level: 1, name: "Buyurtma topilmadi" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Skanerga qaytish" })).toHaveAttribute("href", "/scan");
    await user.click(screen.getByRole("button", { name: "Qayta urinish" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});

const MANAGER_ORDER = {
  ...ORDER,
  post_id: "78",
  where_deliver: "address",
  total_price: 245000,
  customer: { id: "c1", name: "Gulnora Ismoilova", phone_number: "+998913452760" },
};
const REGIONAL_MANAGER = { branch: { id: "15", type: "REGIONAL" }, can_sell_cancel: true };

describe("ScanDetailPage — menejer amallari", () => {
  it("REGIONAL manager with permission: Sotish, Kuryerga biriktirish, Bekor qilish", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue({ type: "order", data: MANAGER_ORDER });
    renderDetail("manager", { user: REGIONAL_MANAGER });

    expect(await screen.findByRole("button", { name: "Sotish" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bekor qilish" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Kuryerga biriktirish" }));

    expect(navigateMock).toHaveBeenCalledWith("/dispatch");
    // Savat qurilmada (ega D2): buyurtma `/dispatch` savatiga skanerlangan token bilan qo'shildi va tanlandi.
    const [basket] = Object.keys(window.localStorage)
      .filter((key) => key.startsWith("elchi:dispatch-basket:v1:"))
      .map((key) => JSON.parse(window.localStorage.getItem(key) ?? "{}") as { items: { order: { id: string; token: string }; selected: boolean }[] });
    expect(basket.items).toEqual([expect.objectContaining({ selected: true, order: expect.objectContaining({ token: "PARCEL-A" }) })]);
  });

  it("opens the same sell dialog as order detail", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue({ type: "order", data: MANAGER_ORDER });
    renderDetail("manager", { user: REGIONAL_MANAGER });

    await user.click(await screen.findByRole("button", { name: "Sotish" }));

    expect(await screen.findByRole("dialog", { name: "Buyurtmani sotish" })).toBeInTheDocument();
  });

  it("2KisY7DL: sotish 400 — sabab oyna ichida bir marta, oyna ochiq qoladi", async () => {
    const user = userEvent.setup();
    const reason = "Uyga yetkaziladigan buyurtmalarda qo'shimcha xarajat yozish mumkin emas";
    const post = vi.spyOn(api, "post").mockRejectedValueOnce(
      new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
        status: 400,
        data: { message: reason },
      } as AxiosResponse),
    );
    fetchMock.mockResolvedValue({ type: "order", data: MANAGER_ORDER });
    renderDetail("manager", { user: REGIONAL_MANAGER });

    await user.click(await screen.findByRole("button", { name: "Sotish" }));
    const dialog = await screen.findByRole("dialog", { name: "Buyurtmani sotish" });
    await user.click(within(dialog).getByRole("button", { name: "Sotish" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(reason);
    expect(screen.getAllByText(reason)).toHaveLength(1);
    expect(post).toHaveBeenCalledWith(expect.stringContaining("orders/sell/"), expect.anything());
    post.mockRestore();
  });

  it("courier-held order: info alert and no action buttons", async () => {
    fetchMock.mockResolvedValue({
      type: "order",
      data: { ...MANAGER_ORDER, holder_type: "COURIER", courier_id: "93", courier: { id: "93", name: "Bekzod Normurodov" } },
    });
    renderDetail("manager", { user: REGIONAL_MANAGER });

    expect(await screen.findByText("Kuryerda: Bekzod Normurodov")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sotish" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bekor qilish" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Kuryerga biriktirish" })).not.toBeInTheDocument();
  });

  it("manager without the permission keeps only «Kuryerga biriktirish» with the admin hint", async () => {
    fetchMock.mockResolvedValue({ type: "order", data: MANAGER_ORDER });
    renderDetail("manager", { user: { branch: { id: "15", type: "REGIONAL" } } });

    expect(await screen.findByRole("button", { name: "Kuryerga biriktirish" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sotish" })).not.toBeInTheDocument();
    expect(screen.getByText(/ruxsatini admin beradi/)).toBeInTheDocument();
  });

  it("HQ manager: no sell / cancel / assign — read-only with the order page link", async () => {
    fetchMock.mockResolvedValue({ type: "order", data: MANAGER_ORDER });
    renderDetail("manager", { user: { branch: { id: "1", type: "HQ" }, can_sell_cancel: true } });
    await orderHeading();

    // Menejer qoidalari moduli kech yuklanadi (bir lahza «pending») — havolani KUTAMIZ, keyin amallar yo'qligini
    // tekshiramiz (aks holda sekin CI'da `getByRole` yuklanishdan oldin ishlab, test tasodifan yiqilardi).
    expect(await screen.findByRole("link", { name: "Buyurtma sahifasi" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sotish" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Kuryerga biriktirish" })).not.toBeInTheDocument();
  });
});

const PACKAGE = {
  type: "package",
  data: {
    type: "batch",
    data: {
      id: "137",
      qr_code_token: "BTB-137",
      status: "SENT",
      order_count: 1,
      total_price: 310000,
      driver_name: "Sardor Aliyev",
      vehicle_plate: "01 A 345 KA",
      items: [{ id: "i1", order_id: "10184", snapshot_price: 310000 }],
    },
  },
};

describe("ScanDetailPage — paket va pochta", () => {
  it("staff receives a scanned package (POST by package id)", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(PACKAGE);
    receiveMock.mockResolvedValue({ statusCode: 200 });
    renderDetail("registrator", { route: "/scan/BTB-137" });

    expect(await screen.findByRole("heading", { level: 1, name: "Paket B-137" })).toBeInTheDocument();
    expect(screen.getByText("Yo'lda")).toBeInTheDocument();
    expect(screen.getByText("Sardor Aliyev")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Qabul qilish" }));

    expect(receiveMock).toHaveBeenCalledWith("137");
    expect(await screen.findByText("Paket qabul qilindi")).toBeInTheDocument();
    expect(invalidateMock).toHaveBeenCalledTimes(1);
    // Ixtiyoriy nom to'ldirish (`GET transfer-batches/:id`) xatosi global xabar bermaydi.
    expect(batchDetailMock).toHaveBeenCalledWith("137", { silentError: true });
  });

  it("courier sees the package read-only (backend forbids couriers to receive)", async () => {
    fetchMock.mockResolvedValue(PACKAGE);
    renderDetail("courier", { route: "/scan/BTB-137" });

    expect(await screen.findByRole("heading", { level: 1, name: "Paket B-137" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Qabul qilish" })).not.toBeInTheDocument();
    // Kuryerga tafsilot so'ralmaydi (backend 403).
    expect(batchDetailMock).not.toHaveBeenCalledWith("137", expect.anything());
  });

  it("maps a «wrong branch» receive error to a clear message", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(PACKAGE);
    receiveMock.mockRejectedValue({ response: { status: 403, data: { message: "Boshqa filial paketi" } } });
    renderDetail("manager", { route: "/scan/BTB-137", user: REGIONAL_MANAGER });

    await user.click(await screen.findByRole("button", { name: "Qabul qilish" }));

    expect(
      await screen.findByText("Bu paketni qabul qila olmaysiz — boshqa filialga tegishli"),
    ).toBeInTheDocument();
  });

  it("post: «Pochtani ochish» only for roles that can open /mails", async () => {
    fetchMock.mockResolvedValue({
      type: "post",
      data: { statusCode: 200, data: { id: "2493", order_quantity: 6, post_total_price: 1411000 } },
    });
    const view = renderDetail("courier", { route: "/scan/PST-2493" });

    expect(await screen.findByRole("heading", { level: 1, name: "Pochta №2493" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pochtani ochish" })).toHaveAttribute("href", "/mails/2493");
    view.unmount();

    renderDetail("market", { route: "/scan/PST-2493" });
    expect(await screen.findByRole("heading", { level: 1, name: "Pochta №2493" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Pochtani ochish" })).not.toBeInTheDocument();
  });
});

describe("ScanDetailPage — yangi kod turlari (skaner 1-bosqich)", () => {
  it("opens a POST- mail token as a post (backend creates POST-…, not PST-)", async () => {
    fetchMock.mockResolvedValue({ type: "post", data: { data: { id: "2493", order_quantity: 6 } } });
    renderDetail("courier", { route: "/scan/POST-k1x2-ab" });

    expect(await screen.findByRole("heading", { level: 1, name: "Pochta №2493" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("POST-k1x2-ab");
  });

  it("external bag: parcel count, members and «Kiruvchi posilkalarda ochish» for intake roles", async () => {
    fetchMock.mockResolvedValue({
      type: "external-bag",
      data: {
        external_batch_token: "BAG-77",
        is_external_batch: true,
        count: 2,
        members: [
          { id: "501", qr_code_token: "P-501", status: "new" },
          { id: "502", qr_code_token: "P-502", status: "received" },
        ],
      },
    });
    renderDetail("admin", { route: "/scan/BAG-77" });

    expect(await screen.findByRole("heading", { level: 1, name: "Tashqi posilkalar qopi" })).toBeInTheDocument();
    expect(screen.getByText("2 ta posilka")).toBeInTheDocument();
    expect(screen.getByText("1 tasi qabul qilinmagan")).toBeInTheDocument();
    expect(screen.getByText("№501")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Kiruvchi posilkalarda ochish" })).toHaveAttribute(
      "href",
      "/new-orders/incoming",
    );
  });

  it("external bag: no intake link for a courier", async () => {
    fetchMock.mockResolvedValue({
      type: "external-bag",
      data: { is_external_batch: true, count: 1, members: [{ id: "501", qr_code_token: "P-501", status: "new" }] },
    });
    renderDetail("courier", { route: "/scan/BAG-77" });

    expect(await screen.findByRole("heading", { level: 1, name: "Tashqi posilkalar qopi" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Kiruvchi posilkalarda ochish" })).not.toBeInTheDocument();
  });

  it("market QR: explains it and links to the Cancelled page (the code is never sent anywhere)", async () => {
    fetchMock.mockResolvedValue({ type: "market-qr", data: null });
    renderDetail("admin", { route: "/scan/MCR-eyJtIjo3fQ" });

    expect(await screen.findByRole("heading", { level: 1, name: "Bu market QR kodi" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Bekor qilinganlarni ochish/ })).toHaveAttribute(
      "href",
      "/new-orders/cancelled",
    );
    expect(screen.getByRole("link", { name: /Skanerga qaytish/ })).toHaveAttribute("href", "/scan");
  });

  it("market QR: a courier gets no handover link", async () => {
    fetchMock.mockResolvedValue({ type: "market-qr", data: null });
    renderDetail("courier", { route: "/scan/MCR-eyJtIjo3fQ" });

    expect(await screen.findByRole("heading", { level: 1, name: "Bu market QR kodi" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Bekor qilinganlarni ochish/ })).not.toBeInTheDocument();
  });

  it("records the opened object in this user's «Oxirgi skanerlar» history", async () => {
    window.localStorage.clear();
    renderDetail("admin");
    await orderHeading();

    await waitFor(() =>
      expect(readScanHistory("admin-1")[0]).toMatchObject({ token: "PARCEL-A", kind: "order", ref: "1251175", name: "Ali Valiyev" }),
    );
  });

  it("treats a Caps Lock re-scan of the open internal token as the same parcel", async () => {
    renderDetail("admin", { route: "/scan/a1b2c3d4e5f60718293a4b5c" });
    await orderHeading();

    hidScan("A1B2C3D4E5F60718293A4B5C");

    expect(navigateMock).not.toHaveBeenCalled();
    expect(feedbackMock).toHaveBeenCalledWith("duplicate");
  });
});

/** Gateway rad javobi (#620): `{ statusCode, message, data: { reason } }` — buyurtma ma'lumotisiz. */
const scopeError = (status: number, reason: string | null, message: string) =>
  new AxiosError(message, String(status), undefined, undefined, {
    status,
    statusText: "",
    headers: {},
    config: {} as never,
    data: { statusCode: status, message, ...(reason ? { data: { reason } } : {}) },
  } as AxiosResponse);

describe("ScanDetailPage — begona QR (anKpzwxk, backend #620)", () => {
  it("403 order_not_in_your_branch: kulrang «filialingizda emas», faqat «Skanerga qaytish», ma'lumot va «Qayta urinish» yo'q", async () => {
    fetchMock.mockRejectedValue(scopeError(403, "order_not_in_your_branch", "Bu buyurtma sizning filialingizda emas"));
    renderDetail("manager", { route: "/scan/ORD-77031", user: { branch: { id: "3", type: "REGIONAL" } } });

    const heading = await screen.findByRole("heading", { level: 1, name: "Bu buyurtma sizning filialingizda emas" });
    const card = screen.getByTestId("scan-forbidden");
    expect(card).toContainElement(heading);
    expect(card).toHaveAttribute("role", "status");
    expect(screen.getByRole("link", { name: "Skanerga qaytish" })).toHaveAttribute("href", "/scan");
    expect(screen.queryByRole("button", { name: "Qayta urinish" })).not.toBeInTheDocument();
    expect(screen.queryByText("Buyurtma topilmadi")).not.toBeInTheDocument();
    expect(screen.queryByText(/№/)).not.toBeInTheDocument();
    expect(screen.queryByText("ORD-77031")).not.toBeInTheDocument();
    await waitFor(() => expect(feedbackMock).toHaveBeenCalledWith("error", "Bu buyurtma sizning filialingizda emas"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("403 branch_not_assigned — o'z matni", async () => {
    fetchMock.mockRejectedValue(scopeError(403, "branch_not_assigned", "Siz hech qaysi filialga biriktirilmagansiz — administratorga murojaat qiling"));
    renderDetail("courier");

    expect(await screen.findByRole("heading", { level: 1, name: "Siz hech qaysi filialga biriktirilmagansiz" })).toBeInTheDocument();
    expect(screen.getByText("Administratorga murojaat qiling.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Qayta urinish" })).not.toBeInTheDocument();
  });

  it("kuryer pochta QR'i 403 post_not_visible_to_courier — «Pochta hali filialga qabul qilinmagan», ma'lumotsiz", async () => {
    fetchMock.mockRejectedValue(
      scopeError(403, "post_not_visible_to_courier", "Bu pochta hali filialga qabul qilinmagan — kuryerga ko'rinmaydi"),
    );
    renderDetail("courier", { route: "/scan/POST-2493" });

    expect(await screen.findByRole("heading", { level: 1, name: "Pochta hali filialga qabul qilinmagan" })).toBeInTheDocument();
    expect(screen.getByText("Filial menejeri qabul qilgach, pochta sizga ko'rinadi.")).toBeInTheDocument();
    expect(screen.queryByText("Pochta topilmadi")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Qayta urinish" })).not.toBeInTheDocument();
  });

  it("sababsiz 403 ham — ma'lumotsiz, qayta urinishsiz (umumiy «ruxsat yo'q» sarlavhasi, backend matni izohda)", async () => {
    fetchMock.mockRejectedValue(scopeError(403, null, "Ruxsat yo'q"));
    renderDetail();

    expect(await screen.findByRole("heading", { level: 1, name: "Bu ma'lumotni ko'rishga ruxsatingiz yo'q" })).toBeInTheDocument();
    expect(screen.getByText("Ruxsat yo'q")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Qayta urinish" })).not.toBeInTheDocument();
  });

  it("503 branch_scope_unavailable — «Filialingizni aniqlab bo'lmadi» + «Qayta urinish» (qayta so'raydi)", async () => {
    const user = userEvent.setup();
    fetchMock.mockRejectedValue(
      scopeError(503, "branch_scope_unavailable", "Filialingizni aniqlab bo'lmadi — birozdan so'ng qayta urinib ko'ring"),
    );
    renderDetail("manager", { route: "/scan/ORD-77031", user: { branch: { id: "3", type: "REGIONAL" } } });

    expect(await screen.findByRole("heading", { level: 1, name: "Filialingizni aniqlab bo'lmadi" })).toBeInTheDocument();
    expect(screen.getByText("Birozdan so'ng qayta urinib ko'ring.")).toBeInTheDocument();
    fetchMock.mockResolvedValue({ type: "order", data: ORDER });
    await user.click(screen.getByRole("button", { name: "Qayta urinish" }));
    expect(await orderHeading()).toBeInTheDocument();
  });

  it("404 — avvalgidek «Buyurtma topilmadi» + «Qayta urinish»", async () => {
    fetchMock.mockRejectedValue(scopeError(404, null, "Not found"));
    renderDetail();

    expect(await screen.findByRole("heading", { level: 1, name: "Buyurtma topilmadi" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Qayta urinish" })).toBeInTheDocument();
    expect(screen.queryByTestId("scan-forbidden")).not.toBeInTheDocument();
  });
});
