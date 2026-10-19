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

const renderScan = (role = "manager") =>
  renderWithProviders(<ScanPage />, {
    route: "/scan",
    preloadedState: {
      role: { id: "u-1", role, region: null, name: role },
      user: {
        user: { id: "u-1", role },
        isAuthenticated: true,
        accessToken: null,
        loading: false,
        isAppInitializing: false,
        error: null,
      },
    } as never,
  });

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
    renderScan("courier");

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
    renderScan("courier");

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
    renderScan("courier");

    const link = screen.getByRole("link", { name: /Oxirgi: №10241 · Buyurtma/ });
    expect(link).toHaveAttribute("href", `/scan/${TOKEN}`);
    expect(within(link).getByText(/Dilnoza Karimova · Bugun/)).toBeInTheDocument();
  });

  it("opens manual entry as a sheet with «Ochish»", async () => {
    const user = userEvent.setup();
    setPhone(true);
    renderScan("courier");

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
