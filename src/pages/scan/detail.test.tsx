import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import ScanDetailPage from "./detail";
import { renderWithProviders } from "../../test/test-utils";

const navigateMock = vi.fn();
const feedbackMock = vi.fn();
const assignMock = vi.fn();
const receiveMock = vi.fn();
const fetchMock = vi.fn();
const batchDetailMock = vi.fn<(...args: unknown[]) => { data: undefined }>(() => ({ data: undefined }));

vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual<typeof import("react-router-dom")>("react-router-dom")),
  useNavigate: () => navigateMock,
}));

vi.mock("./lib/scanShared", async () => ({
  ...(await vi.importActual<typeof import("./lib/scanShared")>("./lib/scanShared")),
  playScanFeedback: (...args: unknown[]) => feedbackMock(...args),
}));

vi.mock("./lib/scanResource", async () => ({
  ...(await vi.importActual<typeof import("./lib/scanResource")>("./lib/scanResource")),
  fetchScanDetail: (...args: unknown[]) => fetchMock(...args),
  scanAssignOrder: (...args: unknown[]) => assignMock(...args),
  receiveScannedPackage: (...args: unknown[]) => receiveMock(...args),
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
  navigateMock.mockReset();
  feedbackMock.mockReset();
  assignMock.mockReset();
  receiveMock.mockReset();
  batchDetailMock.mockClear();
  fetchMock.mockReset().mockResolvedValue({ type: "order", data: ORDER });
});

describe("ScanDetailPage — next scan from the detail page", () => {
  it("opens the next scanned parcel instead of losing the scan silently", async () => {
    renderDetail();
    await orderHeading();

    hidScan("PARCEL-B");

    expect(navigateMock).toHaveBeenCalledWith("/scan/PARCEL-B");
    expect(feedbackMock).toHaveBeenCalledWith("success");
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
    expect(feedbackMock).toHaveBeenCalledWith("success");
    expect(screen.getByRole("button", { name: /O'zimga olish/ })).toBeDisabled();
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/scan"), { timeout: 3000 });
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

    expect(navigateMock).toHaveBeenCalledWith("/dispatch", { state: { scanToken: "PARCEL-A" } });
  });

  it("opens the same sell dialog as order detail", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue({ type: "order", data: MANAGER_ORDER });
    renderDetail("manager", { user: REGIONAL_MANAGER });

    await user.click(await screen.findByRole("button", { name: "Sotish" }));

    expect(await screen.findByRole("dialog", { name: "Buyurtmani sotish" })).toBeInTheDocument();
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

    expect(screen.queryByRole("button", { name: "Sotish" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Kuryerga biriktirish" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Buyurtma sahifasi" })).toBeInTheDocument();
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
