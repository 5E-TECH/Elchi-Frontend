import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import i18n, { i18nReady } from "../../i18n";
import { renderWithProviders } from "../../test/test-utils";
import type { CameraErrorKind } from "../../shared/lib/qrScanner";
import { PHONE_QUERY } from "../../shared/ui/primitives/date/useIsPhone";
import ScanPage from "./index";
import { recordScanHistory } from "./model/scanHistory";

const navigateMock = vi.fn();
const feedbackMock = vi.fn();
const fetchMock = vi.fn();
const assignMock = vi.fn();
const marketsMock = vi.fn();
const invalidateMock = vi.fn();

const camera = vi.hoisted(() => ({
  onDecode: null as null | ((value: string) => void),
  state: {
    isStarting: false,
    torchEnabled: false,
    hasTorch: false,
    cameraError: "",
    cameraErrorKind: null as CameraErrorKind | null,
    cameraUnavailable: false,
  },
}));

vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual<typeof import("react-router-dom")>("react-router-dom")),
  useNavigate: () => navigateMock,
}));

vi.mock("../../shared/lib/scanner/feedback", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../shared/lib/scanner/feedback")>();
  return {
    ...actual,
    // Kamera natija xabari hodisadan keladi — haqiqiy hodisa ham yuborilsin (ovozsiz).
    playScanFeedback: (...args: Parameters<typeof actual.playScanFeedback>) => {
      feedbackMock(...args);
      window.dispatchEvent(
        new CustomEvent(actual.SCAN_FEEDBACK_EVENT, { detail: { type: args[0], message: args[1], source: args[2] } }),
      );
    },
    playScanSignal: vi.fn(),
  };
});

vi.mock("./lib/scanResource", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./lib/scanResource")>()),
  fetchScanDetail: (...args: unknown[]) => fetchMock(...args),
  scanAssignOrder: (...args: unknown[]) => assignMock(...args),
  fetchNewOrderMarkets: () => marketsMock(),
  invalidateAfterScanAction: () => {
    invalidateMock();
    return Promise.resolve();
  },
}));

vi.mock("../../shared/lib/useCameraQrScanner", () => ({
  useCameraQrScanner: ({ onDecode }: { onDecode: (value: string) => void }) => {
    camera.onDecode = onDecode;
    return {
      ...camera.state,
      stopScanner: vi.fn(),
      restartScanner: vi.fn(),
      toggleTorch: vi.fn(async () => undefined),
      setCameraError: vi.fn(),
    };
  },
}));

const ORDER = {
  id: "10226",
  status: "new",
  customer: { name: "Zarina Yo'ldosheva" },
  district: { name: "Qibray tumani" },
  items: [],
};
const TOKEN = "a1b2c3d4e5f60718293a4b5c";

/** HID skaner: belgilar juda tez ketma-ket keladi va Enter bilan tugaydi. */
const hidScan = (value: string) =>
  act(() => {
    for (const key of value) window.dispatchEvent(new KeyboardEvent("keydown", { key }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
  });

const setPhone = (phone: boolean) => {
  window.matchMedia = ((query: string) => ({
    matches: phone && query === PHONE_QUERY,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
};

type BranchType = "HQ" | "REGIONAL" | "HYBRID" | "PICKUP";

/** `mode` — qurilmada saqlangan rejim (kuryerda sukut «O'zimga olish»; «Ma'lumot» maketlari uchun `"info"`). */
const renderScan = (role = "manager", { branchType, mode }: { branchType?: BranchType; mode?: string } = {}) => {
  if (mode) window.localStorage.setItem("elchi:scan-mode:v1:u-1", mode);
  return renderWithProviders(<ScanPage />, {
    route: "/scan",
    preloadedState: {
      role: { id: "u-1", role, region: null, name: role },
      user: {
        user: { id: "u-1", role, ...(branchType ? { branch: { id: "b-1", type: branchType } } : {}) },
        isAuthenticated: true,
        accessToken: null,
        loading: false,
        isAppInitializing: false,
        error: null,
      },
    } as never,
  });
};

const notFound = () => Object.assign(new Error("Not found"), { response: { status: 404, data: { message: "Order not found" } } });

const originalMatchMedia = window.matchMedia;

beforeAll(async () => {
  await i18nReady;
  await i18n.changeLanguage("uz");
});

beforeEach(() => {
  navigateMock.mockReset();
  feedbackMock.mockReset();
  fetchMock.mockReset().mockResolvedValue({ type: "order", data: ORDER });
  assignMock.mockReset();
  marketsMock.mockReset();
  invalidateMock.mockReset();
  camera.onDecode = null;
  camera.state = { ...camera.state, isStarting: false, hasTorch: false, cameraErrorKind: null, cameraUnavailable: false };
  window.localStorage.clear();
  Reflect.deleteProperty(navigator, "permissions");
  setPhone(false);
});

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

describe("ScanPage — universal skaner (desktop)", () => {
  it("draws the maket blocks: header, USB card with manual entry and the empty recent list", () => {
    renderScan();

    expect(screen.getByRole("heading", { level: 1, name: "QR skaner" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Orqaga/ })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /Skaner ovozi/ })).toHaveAttribute("href", "/settings");
    expect(screen.getByRole("heading", { name: "USB skaner ham tayyor" })).toBeInTheDocument();
    expect(screen.getByText("Tinglanmoqda")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Kodni qo'lda kiriting" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Oxirgi skanerlar" })).toBeInTheDocument();
    expect(screen.getByText("Hali skan yo'q")).toBeInTheDocument();
  });

  it("resolves a USB scan, announces the found order and opens its page", async () => {
    renderScan();

    hidScan(TOKEN.toUpperCase());

    // Ichki (24 hex) token kichik harfga keltiriladi — Caps Lock yoqiq skaner ham topadi.
    expect(fetchMock).toHaveBeenCalledWith(TOKEN);
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith(`/scan/${TOKEN}`));
    expect(feedbackMock).toHaveBeenCalledWith("success", "№10226 · Buyurtma topildi", "keyboard");
  });

  it("signals a second code scanned while the first one is still opening (not silently lost)", async () => {
    let resolve: (value: unknown) => void = () => undefined;
    fetchMock.mockReturnValueOnce(new Promise((done) => (resolve = done)));
    renderScan();

    hidScan("PARCEL-A");
    hidScan("PARCEL-B");

    expect(feedbackMock).toHaveBeenCalledWith(
      "error",
      "Oldingi kod ochilmoqda — bu skan qabul qilinmadi. Qayta skanerlang.",
      "keyboard",
    );
    await act(async () => resolve({ type: "order", data: ORDER }));
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/scan/PARCEL-A"));
    expect(navigateMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the scanner open on a not-found code and explains it in the result card", async () => {
    fetchMock.mockRejectedValue(notFound());
    renderScan();

    hidScan("PARCEL-404");

    const card = await screen.findByRole("region", { name: "Natija" });
    expect(within(card).getByText("Buyurtma topilmadi")).toBeInTheDocument();
    expect(within(card).getByText("PARCEL-404")).toBeInTheDocument();
    expect(feedbackMock).toHaveBeenCalledWith("missing", "Buyurtma topilmadi", "keyboard");
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("shows the read text of an invalid QR and never asks the server", async () => {
    renderScan();

    hidScan("#!!?#");

    const card = await screen.findByRole("region", { name: "Natija" });
    expect(within(card).getByText("Bu QR kod skaner uchun yaroqsiz")).toBeInTheDocument();
    expect(within(card).getByText("O'qilgan matn")).toBeInTheDocument();
    expect(within(card).getByText("#!!?#")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a foreign site QR (no /scan/) is «yaroqsiz» with its full text — its last path segment is never looked up", async () => {
    const user = userEvent.setup();
    renderScan();

    await user.type(screen.getByRole("textbox", { name: "Kodni qo'lda kiriting" }), "https://barakashop.uz/mahsulot/48213");
    await user.click(screen.getByRole("button", { name: "Ochish" }));

    const card = await screen.findByRole("region", { name: "Natija" });
    expect(within(card).getByText("Bu QR kod skaner uchun yaroqsiz")).toBeInTheDocument();
    expect(within(card).getByText("https://barakashop.uz/mahsulot/48213")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(feedbackMock).toHaveBeenCalledWith("error", "Bu QR kod skaner uchun yaroqsiz", "manual");
  });

  it("never peeks a market QR (MCR-): it is single-use — points to the Cancelled page instead", async () => {
    renderScan("registrator");

    hidScan("MCR-abcDEF123");

    const card = await screen.findByRole("region", { name: "Natija" });
    expect(within(card).getByText("Bu market QR kodi")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(feedbackMock).toHaveBeenCalledWith("error", "Bu market QR kodi", "keyboard");
  });

  it("acknowledges a deliberate repeated HID scan instead of resolving it twice", async () => {
    fetchMock.mockRejectedValue(notFound());
    renderScan();

    hidScan("PARCEL-404");
    await screen.findByRole("region", { name: "Natija" });
    feedbackMock.mockClear();
    hidScan("PARCEL-404");

    expect(feedbackMock).toHaveBeenCalledWith("duplicate", undefined, "keyboard");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("ignores a 1–3 character Enter in the manual field (human typing, not a scan)", () => {
    renderScan();

    hidScan("ab");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(feedbackMock).not.toHaveBeenCalled();
  });

  it("opens a code or /scan/ link typed into the manual entry form", async () => {
    const user = userEvent.setup();
    renderScan();

    await user.type(screen.getByRole("textbox", { name: "Kodni qo'lda kiriting" }), "https://elchi.uz/scan/BTB-a8c3d4e5");
    await user.click(screen.getByRole("button", { name: "Ochish" }));

    expect(fetchMock).toHaveBeenCalledWith("BTB-a8c3d4e5");
  });

  it("asks for a code when the manual form is submitted empty", async () => {
    const user = userEvent.setup();
    renderScan();

    await user.click(screen.getByRole("button", { name: "Ochish" }));

    expect(await screen.findByText("Kodni kiriting")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lists recent scans of this user on this device, each opening its result page", () => {
    recordScanHistory("u-1", {
      token: "BTB-a8c3d4e5",
      kind: "package",
      ref: "B-137",
      name: null,
      place: "Chilonzor qabul punkti",
      count: 8,
      at: Date.now(),
    });
    recordScanHistory("someone-else", {
      token: "tok-other",
      kind: "order",
      ref: "999",
      name: "Boshqa mijoz",
      place: null,
      count: null,
      at: Date.now(),
    });
    renderScan();

    const link = screen.getByRole("link", { name: /Paket B-137/ });
    expect(link).toHaveAttribute("href", "/scan/BTB-a8c3d4e5");
    expect(within(link).getByText("Chilonzor qabul punkti · 8 ta buyurtma")).toBeInTheDocument();
    expect(screen.queryByText(/Boshqa mijoz/)).not.toBeInTheDocument();
  });

  it("rejects a second camera code inside the 700 ms pause with «Juda tez»", async () => {
    let resolve: (value: unknown) => void = () => undefined;
    fetchMock.mockReturnValueOnce(new Promise((done) => (resolve = done)));
    renderScan();
    await waitFor(() => expect(camera.onDecode).not.toBeNull());

    act(() => camera.onDecode!("PARCEL-A"));
    act(() => camera.onDecode!("PARCEL-B"));

    expect(await screen.findByText("Juda tez — skan qabul qilinmadi")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ type: "order", data: ORDER }));
  });
});

describe("ScanPage — telefon (to'liq ekran kamera)", () => {
  it("shows the maket bottom: empty «last» row, manual entry and close", () => {
    setPhone(true);
    renderScan("courier", { mode: "info" });

    expect(screen.getByRole("heading", { name: "QR skaner" })).toBeInTheDocument();
    expect(screen.getByText("Kod topilishi bilan kerakli sahifa o'zi ochiladi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Qo'lda kiritish" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Skanerni yopish" })).toBeInTheDocument();
    // Universal skanerda «Yopish» tepada — pastda ikkinchi «Yopish» yo'q.
    expect(screen.queryByRole("button", { name: "Yopish" })).not.toBeInTheDocument();
  });

  it("puts the torch next to manual entry when the device has one", async () => {
    setPhone(true);
    camera.state = { ...camera.state, hasTorch: true };
    renderScan("courier", { mode: "info" });

    const video = document.querySelector("video");
    act(() => {
      video?.dispatchEvent(new Event("playing"));
    });

    expect(await screen.findByRole("button", { name: "Chiroq", pressed: false })).toBeInTheDocument();
  });

  it("links the last scan row to its result page", () => {
    setPhone(true);
    recordScanHistory("u-1", {
      token: TOKEN,
      kind: "order",
      ref: "10241",
      name: "Dilnoza Karimova",
      place: "Chilonzor tumani",
      count: null,
      at: Date.now(),
    });
    renderScan("courier", { mode: "info" });

    const link = screen.getByRole("link", { name: /Oxirgi: №10241 · Buyurtma/ });
    expect(link).toHaveAttribute("href", `/scan/${TOKEN}`);
    expect(within(link).getByText(/Dilnoza Karimova · Bugun/)).toBeInTheDocument();
  });

  it("opens manual entry as a sheet with «Ochish»", async () => {
    const user = userEvent.setup();
    setPhone(true);
    renderScan("courier", { mode: "info" });

    await user.click(screen.getByRole("button", { name: "Qo'lda kiritish" }));
    const dialog = await screen.findByRole("dialog", { name: "Kodni qo'lda kiriting" });
    await user.type(within(dialog).getByRole("textbox"), "POST-k1x2-ab");
    await user.click(within(dialog).getByRole("button", { name: "Ochish" }));

    expect(fetchMock).toHaveBeenCalledWith("POST-k1x2-ab");
  });
});

describe("ScanPage — market roli", () => {
  it("is not a scanner for the market role", () => {
    renderScan("market");

    expect(screen.getByRole("heading", { level: 1, name: "Skaner market roli uchun emas" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Bosh sahifaga/ })).toHaveAttribute("href", "/");
    expect(document.querySelector("video")).toBeNull();
  });
});

/* ─── 3-bosqich: rejimlar ──────────────────────────────────────────────── */

const MODE_GROUP = { name: "Skaner rejimi" } as const;
const OTHER_TOKEN = "b1b2c3d4e5f60718293a4b5c";

const assignOk = (id: string, name: string, idempotent = false) => ({
  statusCode: 200,
  data: {
    idempotent,
    order_id: id,
    post_id: "p-1",
    post_created: false,
    order: { id, order_number: id, customer: { name }, district: "Yunusobod tumani" },
  },
});

const otherCourier = () =>
  Object.assign(new Error("Bad request"), {
    isAxiosError: true,
    response: { status: 400, data: { message: "Order allaqachon boshqa courierga biriktirilgan" } },
  });

/** Telefonda «Qo'lda kiritish» varag'i orqali kod (kamera skani bilan bitta handler). */
const enterManual = async (user: ReturnType<typeof userEvent.setup>, code: string, submit: string) => {
  await user.click(screen.getAllByRole("button", { name: "Qo'lda kiritish" })[0]);
  const dialog = await screen.findByRole("dialog", { name: "Kodni qo'lda kiriting" });
  await user.type(within(dialog).getByRole("textbox"), code);
  await user.click(within(dialog).getByRole("button", { name: submit }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Kodni qo'lda kiriting" })).not.toBeInTheDocument());
};

describe("ScanPage — rejimlar (3-bosqich)", () => {
  it("superadmin: «Ma'lumot» · «Qabul qilish», «Kuryerga biriktirish» yo'q (backend 403)", () => {
    renderScan("superadmin");

    const group = screen.getByRole("radiogroup", MODE_GROUP);
    expect(within(group).getAllByRole("radio").map((radio) => radio.textContent)).toEqual(["Ma'lumot", "Qabul qilish"]);
    expect(within(group).getByRole("radio", { name: "Ma'lumot" })).toHaveAttribute("aria-checked", "true");
  });

  it("filial turi aniqlanmagan menejer — bitta rejim, segment chizilmaydi", () => {
    renderScan("manager");
    expect(screen.queryByRole("radiogroup", MODE_GROUP)).not.toBeInTheDocument();
  });

  it("menejer HYBRID: «Biriktirish» → /dispatch, kamera ochiq holda; tanlov qurilmada eslab qolinadi", async () => {
    const user = userEvent.setup();
    renderScan("manager", { branchType: "HYBRID" });

    const group = screen.getByRole("radiogroup", MODE_GROUP);
    expect(within(group).getAllByRole("radio").map((radio) => radio.textContent)).toEqual([
      "Ma'lumot",
      "Qabul qilish",
      "Biriktirish",
    ]);
    await user.click(within(group).getByRole("radio", { name: "Biriktirish" }));

    expect(navigateMock).toHaveBeenCalledWith("/dispatch", { state: { openScanner: { targetId: "dispatch" } } });
    expect(window.localStorage.getItem("elchi:scan-mode:v1:u-1")).toBe("dispatch");
  });

  it("«Kuryerga biriktirish» rejimida o'qilgan buyurtma kodi /dispatch ga olib o'tiladi (savat — o'sha sahifa handler'i)", () => {
    renderScan("registrator", { branchType: "REGIONAL", mode: "dispatch" });

    hidScan(TOKEN.toUpperCase());

    expect(navigateMock).toHaveBeenCalledWith("/dispatch", {
      state: { openScanner: { targetId: "dispatch", pendingScan: { raw: TOKEN, source: "keyboard" } } },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("«Kuryerga biriktirish» rejimida paket kodi rad etiladi, sahifa almashmaydi", () => {
    renderScan("manager", { branchType: "REGIONAL", mode: "dispatch" });

    hidScan("BTB-00042");

    expect(navigateMock).not.toHaveBeenCalled();
    expect(feedbackMock).toHaveBeenCalledWith(
      "error",
      "Bu buyurtma QR kodi emas — savatga faqat buyurtma qo'shiladi",
      "keyboard",
    );
  });

  it("«Qabul qilish» → market varag'i (son, qidiruv) → /new-orders/<id>, kamera ochiq holda", async () => {
    const user = userEvent.setup();
    marketsMock.mockResolvedValue({
      data: [
        { market_id: "7", orders_count: 6, total_price_sum: 1, market: { name: "Urgut Savdo", phone_number: "" } },
        { market_id: "8", orders_count: 2, total_price_sum: 1, market: { name: "Baraka Shop", phone_number: "" } },
      ],
    });
    renderScan("manager", { branchType: "HQ" });

    await user.click(within(screen.getByRole("radiogroup", MODE_GROUP)).getByRole("radio", { name: "Qabul qilish" }));
    const sheet = await screen.findByRole("dialog", { name: "Marketni tanlang" });
    expect(await within(sheet).findByText("6 ta yangi buyurtma")).toBeInTheDocument();
    await user.type(within(sheet).getByRole("searchbox"), "baraka");
    expect(within(sheet).queryByText("Urgut Savdo")).not.toBeInTheDocument();
    await user.click(within(sheet).getByRole("button", { name: /Baraka Shop/ }));

    expect(navigateMock).toHaveBeenCalledWith("/new-orders/8", {
      state: { openScanner: { targetId: "new-orders:market:8" } },
    });
  });

  it("«Qabul qilish»da market tanlanmay skanerlansa — «Avval marketni tanlang» va varaq ochiladi", async () => {
    marketsMock.mockResolvedValue({ data: [] });
    renderScan("superadmin", { mode: "receive" });

    expect(screen.getByRole("button", { name: "Marketni tanlang" })).toBeInTheDocument();
    hidScan(TOKEN);

    expect(feedbackMock).toHaveBeenCalledWith("error", "Avval marketni tanlang", "keyboard");
    expect(await screen.findByRole("dialog", { name: "Marketni tanlang" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("ruxsatdan tushgan rejim (menejer HQ da saqlangan «Biriktirish») — sukutga qaytadi", () => {
    renderScan("manager", { branchType: "HQ", mode: "dispatch" });
    expect(within(screen.getByRole("radiogroup", MODE_GROUP)).getByRole("radio", { name: "Ma'lumot" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });
});

describe("ScanPage — kuryer «O'zimga olish» (telefon)", () => {
  it("sukut rejim: ketma-ket skan → har biri `scan-assign`, ro'yxatda natija; kamera yopilmaydi", async () => {
    const user = userEvent.setup();
    setPhone(true);
    assignMock
      .mockResolvedValueOnce(assignOk("10191", "Lobar Yusupova"))
      .mockResolvedValueOnce(assignOk("10172", "Sardor Qodirov", true));
    renderScan("courier");

    expect(screen.getByRole("heading", { name: "O'zimga olish" })).toBeInTheDocument();
    expect(within(screen.getByRole("radiogroup", { name: "O'zimga olish" })).getByRole("radio", { name: "O'zimga olish" })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    await enterManual(user, TOKEN, "Olish");
    await waitFor(() => expect(assignMock).toHaveBeenCalledWith(TOKEN));
    expect(await screen.findByText("№10191 · Lobar Yusupova")).toBeInTheDocument();
    expect(screen.getByText("Sizga biriktirildi · Yunusobod tumani")).toBeInTheDocument();
    expect(feedbackMock).toHaveBeenCalledWith("success", "№10191 sizga biriktirildi");

    await enterManual(user, OTHER_TOKEN, "Olish");
    await waitFor(() => expect(assignMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("№10172 · Sardor Qodirov")).toBeInTheDocument();
    expect(screen.getByText("Allaqachon sizda · Yunusobod tumani")).toBeInTheDocument();
    // Hisoblagich faqat yangi biriktirilganlarni sanaydi.
    expect(screen.getByText("ta biriktirildi")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("boshqa kuryerniki — «Boshqa kuryerda: <ism>» (buyurtma bir marta o'qiladi), so'rov takrorlanmaydi", async () => {
    const user = userEvent.setup();
    setPhone(true);
    assignMock.mockRejectedValueOnce(otherCourier());
    fetchMock.mockResolvedValue({
      type: "order",
      data: { ...ORDER, id: "10251", customer: { name: "Gulnora Tojiboyeva" }, courier: { name: "Sherzod Nazarov" } },
    });
    renderScan("courier");

    await enterManual(user, TOKEN, "Olish");

    expect(await screen.findByText("Boshqa kuryerda: Sherzod Nazarov")).toBeInTheDocument();
    expect(screen.getByText("№10251 · Gulnora Tojiboyeva")).toBeInTheDocument();
    expect(feedbackMock).toHaveBeenCalledWith("error", "Boshqa kuryerga biriktirilgan. Menejerga xabar bering.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("xato sababi qatorda; paket kodi so'rovsiz rad etiladi", async () => {
    const user = userEvent.setup();
    setPhone(true);
    assignMock.mockRejectedValueOnce(
      Object.assign(new Error("Bad request"), {
        isAxiosError: true,
        response: { status: 400, data: { message: "Buyurtma paketga joylangan" } },
      }),
    );
    renderScan("courier");

    await enterManual(user, TOKEN, "Olish");
    // Kamera xabari va ro'yxat qatori — ikkalasida ham backend sababi.
    expect((await screen.findAllByText("Buyurtma paketga joylangan")).length).toBeGreaterThan(0);

    await enterManual(user, "BTB-00042", "Olish");
    expect(feedbackMock).toHaveBeenCalledWith("error", "Bu buyurtma QR kodi emas — uni «Ma'lumot» rejimida oching", "manual");
    expect(assignMock).toHaveBeenCalledTimes(1);
  });

  it("«Tugatish» — kesh yangilanadi va xulosa: N ta biriktirildi", async () => {
    const user = userEvent.setup();
    setPhone(true);
    assignMock.mockResolvedValueOnce(assignOk("10191", "Lobar Yusupova")).mockRejectedValueOnce(otherCourier());
    fetchMock.mockRejectedValue(notFound());
    renderScan("courier");

    await enterManual(user, TOKEN, "Olish");
    await screen.findByText("№10191 · Lobar Yusupova");
    await enterManual(user, OTHER_TOKEN, "Olish");
    await screen.findByText("Boshqa kuryerga biriktirilgan");

    await user.click(screen.getByRole("button", { name: "Tugatish" }));

    const summary = await screen.findByRole("dialog", { name: "Skanerlash yakunlandi" });
    expect(within(summary).getByText("1 ta buyurtma sizga biriktirildi")).toBeInTheDocument();
    expect(within(summary).getByText("Biriktirilmadi").nextSibling).toHaveTextContent("1");
    expect(invalidateMock).toHaveBeenCalledTimes(1);
    // Kamera sahifasi yopilmaydi (xulosa uning ustida).
    expect(navigateMock).not.toHaveBeenCalledWith("/");

    await user.click(within(summary).getByRole("button", { name: "Buyurtmalarimga o'tish" }));
    expect(navigateMock).toHaveBeenCalledWith("/orders");
  });

  it("«Ma'lumot» rejimiga o'tilsa — avvalgi universal skaner (bitta kod → natija sahifasi)", async () => {
    const user = userEvent.setup();
    setPhone(true);
    renderScan("courier");

    await user.click(screen.getByRole("radio", { name: "Ma'lumot" }));
    expect(screen.getByRole("heading", { name: "QR skaner" })).toBeInTheDocument();
    hidScan(TOKEN);
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith(`/scan/${TOKEN}`));
    expect(assignMock).not.toHaveBeenCalled();
  });
});
