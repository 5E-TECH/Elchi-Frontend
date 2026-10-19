import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import i18n, { i18nReady } from "../../../i18n";
import { renderWithProviders } from "../../../test/test-utils";
import { playScanFeedback } from "../../lib/scanner/feedback";
import { isScannerCameraMounted } from "../../lib/scanner/scannerHost";
import type { ScanTarget } from "../../lib/scanner/scanTargets";
import type { CameraErrorKind } from "../../lib/qrScanner";
import { PHONE_QUERY } from "../primitives/date/useIsPhone";
import { ScannerCamera } from "./ScannerCamera";

/**
 * `ScannerCamera` — taxta `tizim-scanner` (§03 anatomiya, §04 holatlar, §06 desktop oynasi). Kamera kutubxonasi
 * soxtalangan: `useCameraQrScanner` holatini test boshqaradi, `onDecode` — kamera «o'qigan» kod.
 */

const camera = vi.hoisted(() => ({
  isActive: false,
  onDecode: null as null | ((value: string) => void),
  state: {
    isStarting: false,
    torchEnabled: false,
    hasTorch: false,
    cameraError: "",
    cameraErrorKind: null as CameraErrorKind | null,
    cameraUnavailable: false,
  },
  restart: vi.fn(),
  toggleTorch: vi.fn(async () => undefined),
}));

vi.mock("../../lib/useCameraQrScanner", () => ({
  useCameraQrScanner: (options: { isActive: boolean; onDecode: (value: string) => void }) => {
    camera.isActive = options.isActive;
    camera.onDecode = options.onDecode;
    return {
      ...camera.state,
      restartScanner: camera.restart,
      toggleTorch: camera.toggleTorch,
      stopScanner: vi.fn(),
      setCameraError: vi.fn(),
    };
  },
}));

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

const setPermission = (state: "granted" | "denied" | "prompt" | null) => {
  if (state === null) Reflect.deleteProperty(navigator, "permissions");
  else Object.defineProperty(navigator, "permissions", { configurable: true, value: { query: vi.fn(async () => ({ state })) } });
};

const makeTarget = (overrides: Partial<ScanTarget> = {}): ScanTarget => ({
  id: "new-orders:market:7",
  title: "Qabul qilish",
  context: "Ipak Yo'li Savdo · 6 ta buyurtma",
  hint: "Buyurtma yorlig'idagi QR kodni ramkaga oling",
  progress: { done: 3, total: 6, label: "ta qabul qilindi" },
  onScan: vi.fn(),
  ...overrides,
});

const originalMatchMedia = window.matchMedia;

/** Tasvir kela boshladi («ishga tushmoqda» → «faol»). */
const feedPlaying = () => {
  const video = document.querySelector("video");
  if (!video) throw new Error("video yo'q");
  fireEvent.playing(video);
};

beforeAll(async () => {
  await i18nReady;
  await i18n.changeLanguage("uz");
});

beforeEach(() => {
  camera.state = {
    isStarting: false,
    torchEnabled: false,
    hasTorch: false,
    cameraError: "",
    cameraErrorKind: null,
    cameraUnavailable: false,
  };
  camera.isActive = false;
  camera.onDecode = null;
  setPhone(false);
  setPermission(null);
});

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  setPermission(null);
  vi.restoreAllMocks();
});

describe("ScannerCamera — desktop/planshet oynasi (§06)", () => {
  it("markazda oyna: o'ng panelda sarlavha, kontekst, hisoblagich, «USB skaner ham tayyor», amallar; fokus «Yopish» da", async () => {
    const onClose = vi.fn();
    renderWithProviders(<ScannerCamera target={makeTarget()} onClose={onClose} />);

    const dialog = await screen.findByRole("dialog", { name: "Qabul qilish" });
    expect(within(dialog).getByText("Ipak Yo'li Savdo · 6 ta buyurtma")).toBeInTheDocument();
    expect(within(dialog).getByText("ta qabul qilindi")).toBeInTheDocument();
    expect(within(dialog).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "3");
    expect(within(dialog).getByText("USB skaner ham tayyor")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Qo'lda kiritish" })).toBeInTheDocument();
    const close = within(dialog).getByRole("button", { name: "Skanerni yopish" });
    await waitFor(() => expect(close).toHaveFocus());
    expect(isScannerCameraMounted()).toBe(true);

    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("holatlar: ishga tushmoqda → faol (yo'riqnoma maqsaddan)", async () => {
    renderWithProviders(<ScannerCamera target={makeTarget()} onClose={vi.fn()} />);
    expect(await screen.findByText("Kamera ishga tushmoqda")).toBeInTheDocument();
    expect(screen.getByText("Bir lahza — kamera ochilmoqda")).toBeInTheDocument();
    await waitFor(() => expect(camera.isActive).toBe(true));

    feedPlaying();
    expect(await screen.findByText("Skanerlash faol")).toBeInTheDocument();
    expect(screen.getByText("Buyurtma yorlig'idagi QR kodni ramkaga oling")).toBeInTheDocument();
  });

  it("kamera skani → target.onScan(raw, \"camera\"); takror jim; boshqa kod 700 ms ichida — «Juda tez»", async () => {
    const target = makeTarget();
    renderWithProviders(<ScannerCamera target={target} onClose={vi.fn()} />);
    await waitFor(() => expect(camera.isActive).toBe(true));
    feedPlaying();

    act(() => camera.onDecode?.("65f0c1aa22bb33cc44dd55ee"));
    await waitFor(() => expect(target.onScan).toHaveBeenCalledWith("65f0c1aa22bb33cc44dd55ee", "camera"));
    act(() => camera.onDecode?.("65f0c1aa22bb33cc44dd55ee"));
    act(() => camera.onDecode?.("ffffffffffffffffffffffff"));
    expect(await screen.findByText("Juda tez — skan qabul qilinmadi")).toBeInTheDocument();
    expect(screen.getByText("Posilkani qayta skanerlang")).toBeInTheDocument();
    expect(target.onScan).toHaveBeenCalledTimes(1);
  });

  it("natija xabari sahifaning playScanFeedback hodisasidan (role=status), ramka chipi «QR topildi»", async () => {
    renderWithProviders(<ScannerCamera target={makeTarget()} onClose={vi.fn()} />);
    await waitFor(() => expect(camera.isActive).toBe(true));
    feedPlaying();

    act(() => playScanFeedback("success", "Qabul qilindi", "camera"));
    const status = screen.getAllByRole("status").find((region) => within(region).queryByText("Qabul qilindi"));
    expect(status).toBeDefined();
    expect(screen.getByText("QR topildi")).toBeInTheDocument();

    act(() => playScanFeedback("missing"));
    expect(await screen.findByText("Topilmadi")).toBeInTheDocument();
  });

  it("ro'yxat: o'ng panelda qatorlar, «Bekor qilish» onUndo ni chaqiradi; «Tugatish» — onFinish + yopish", async () => {
    const onUndo = vi.fn();
    const onFinish = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <ScannerCamera
        target={makeTarget({
          list: [
            { key: "1", title: "№10254 · Sanjar Mirzayev", subtitle: "Farg'ona sh.", tone: "success", onUndo },
            { key: "2", title: "№10253 · Gulnoza Hamidova", tone: "success" },
          ],
          listTitle: "Qabul qilinganlar",
          finish: { label: "Tugatish", onFinish },
        })}
        onClose={onClose}
      />,
    );
    const dialog = await screen.findByRole("dialog", { name: "Qabul qilish" });
    expect(within(dialog).getByText("Qabul qilinganlar")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Bekor qilish — №10254 · Sanjar Mirzayev" }));
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(within(dialog).queryByRole("button", { name: "Bekor qilish — №10253 · Gulnoza Hamidova" })).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Tugatish" }));
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("`finish` yo'q — asosiy amal «Yopish»", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<ScannerCamera target={makeTarget()} onClose={onClose} />);
    const dialog = await screen.findByRole("dialog", { name: "Qabul qilish" });
    await user.click(within(dialog).getByRole("button", { name: "Yopish" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("qo'lda kiritish: kamera to'xtaydi, bo'sh kod — xato, kod → onScan(code, \"manual\")", async () => {
    const target = makeTarget();
    const user = userEvent.setup();
    renderWithProviders(<ScannerCamera target={target} onClose={vi.fn()} />);
    const dialog = await screen.findByRole("dialog", { name: "Qabul qilish" });
    await user.click(within(dialog).getByRole("button", { name: "Qo'lda kiritish" }));

    const sheet = await screen.findByRole("dialog", { name: "Kodni qo'lda kiriting" });
    expect(camera.isActive).toBe(false);
    await user.click(within(sheet).getByRole("button", { name: "Qo'shish" }));
    expect(within(sheet).getByText("Kodni kiriting")).toBeInTheDocument();

    await user.type(within(sheet).getByLabelText("Buyurtma raqami yoki yorliqdagi kod"), " P-0412 ");
    await user.click(within(sheet).getByRole("button", { name: "Qo'shish" }));
    await waitFor(() => expect(target.onScan).toHaveBeenCalledWith("P-0412", "manual"));
    await waitFor(() => expect(camera.isActive).toBe(true));
  });

  it("chiroq faqat qurilmada bo'lsa; bosilgan holat aria-pressed", async () => {
    camera.state.hasTorch = true;
    camera.state.torchEnabled = true;
    const user = userEvent.setup();
    renderWithProviders(<ScannerCamera target={makeTarget()} onClose={vi.fn()} />);
    await waitFor(() => expect(camera.isActive).toBe(true));
    const torch = await screen.findByRole("button", { name: "Chiroq" });
    expect(torch).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Chiroq yoqilgan")).toBeInTheDocument();
    await user.click(torch);
    expect(camera.toggleTorch).toHaveBeenCalled();
  });
});

describe("ScannerCamera — ruxsat va xato holatlari (§04.1, 04.2, 04.14)", () => {
  it("ruxsat hali so'ralmagan — izoh kartasi; «Kamerani yoqish» dan keyin kamera yoqiladi", async () => {
    setPermission("prompt");
    const user = userEvent.setup();
    renderWithProviders(<ScannerCamera target={makeTarget()} onClose={vi.fn()} />);
    expect(await screen.findByText("Kameraga ruxsat bering")).toBeInTheDocument();
    expect(screen.getByText(/Tasvir saqlanmaydi va hech qayerga yuborilmaydi/)).toBeInTheDocument();
    expect(camera.isActive).toBe(false);
    await user.click(screen.getByRole("button", { name: "Kamerani yoqish" }));
    await waitFor(() => expect(camera.isActive).toBe(true));
  });

  it("ruxsat rad etilgan — 3 qadam (desktop: qulf belgisi), «Qayta urinish» va «Qo'lda kiritish»", async () => {
    setPermission("denied");
    renderWithProviders(<ScannerCamera target={makeTarget()} onClose={vi.fn()} />);
    const card = await screen.findByRole("alert");
    expect(within(card).getByText("Kameraga ruxsat berilmagan")).toBeInTheDocument();
    expect(within(card).getByText("Manzil satridagi qulf belgisini bosing")).toBeInTheDocument();
    expect(within(card).getByText("«Kamera» bandida «Ruxsat berish»ni tanlang")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Qayta urinish" })).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Qo'lda kiritish" })).toBeInTheDocument();
    expect(camera.isActive).toBe(false);
  });

  it("iOS — Sozlamalar → Safari → Kamera; Telegram — «Brauzerda ochish»", async () => {
    setPermission("denied");
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)");
    const { unmount } = renderWithProviders(<ScannerCamera target={makeTarget()} onClose={vi.fn()} />);
    expect(await screen.findByText("«Safari» → «Kamera» → «Ruxsat berish»")).toBeInTheDocument();
    unmount();

    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (Linux; Android 14) Telegram-Android/11.2.0");
    renderWithProviders(<ScannerCamera target={makeTarget()} onClose={vi.fn()} />);
    expect(await screen.findByText("«Brauzerda ochish»ni tanlang")).toBeInTheDocument();
  });

  it("ishga tushishda rad etildi (NotAllowedError) — rad etilgan kartasi; «Qayta urinish» kamerani qayta ochadi", async () => {
    camera.state.cameraErrorKind = "denied";
    camera.state.cameraError = "Kameraga ruxsat berilmagan";
    const user = userEvent.setup();
    renderWithProviders(<ScannerCamera target={makeTarget()} onClose={vi.fn()} />);
    const card = await screen.findByRole("alert");
    await user.click(within(card).getByRole("button", { name: "Qayta urinish" }));
    expect(camera.restart).toHaveBeenCalled();
  });

  it("kamera band — «Kamera band»; kamera yo'q — «qo'llab-quvvatlanmaydi», qayta urinishsiz", async () => {
    camera.state.cameraErrorKind = "busy";
    const { unmount } = renderWithProviders(<ScannerCamera target={makeTarget()} onClose={vi.fn()} />);
    expect(await screen.findByText("Kamera band")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Qayta urinish" })).toBeInTheDocument();
    unmount();

    camera.state.cameraErrorKind = "unsupported";
    camera.state.cameraUnavailable = true;
    renderWithProviders(<ScannerCamera target={makeTarget()} onClose={vi.fn()} />);
    expect(await screen.findByText("Bu qurilmada kamera qo'llab-quvvatlanmaydi")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Qayta urinish" })).not.toBeInTheDocument();
  });

  it("oflayn — «Internet yo'q» chipi", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    renderWithProviders(<ScannerCamera target={makeTarget()} onClose={vi.fn()} />);
    expect(await screen.findByText("Internet yo'q")).toBeInTheDocument();
  });
});

describe("ScannerCamera — telefon (to'liq ekran) va sahifa ko'rinishi", () => {
  it("telefon: yopish tepada chapda, pastda hisoblagich + oxirgi skan + amallar; «Ro'yxat» varag'i", async () => {
    setPhone(true);
    const onUndo = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <ScannerCamera
        target={makeTarget({
          list: [{ key: "1", title: "№10254 · Sanjar Mirzayev", subtitle: "Farg'ona sh. · 96 000 so'm", tone: "success", onUndo }],
        })}
        onClose={vi.fn()}
      />,
    );
    const dialog = await screen.findByRole("dialog", { name: "Qabul qilish" });
    expect(within(dialog).getByRole("heading", { name: "Qabul qilish" })).toBeInTheDocument();
    expect(within(dialog).getByText("/ 6")).toBeInTheDocument();
    expect(within(dialog).getByText("Farg'ona sh. · 96 000 so'm")).toBeInTheDocument();
    expect(within(dialog).queryByText("USB skaner ham tayyor")).not.toBeInTheDocument();
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Skanerni yopish" })).toHaveFocus());

    await user.click(within(dialog).getByRole("button", { name: "Ro'yxat" }));
    const sheet = await screen.findByRole("dialog", { name: "Skanerlanganlar" });
    expect(camera.isActive).toBe(false);
    await user.click(within(sheet).getByRole("button", { name: "Bekor qilish — №10254 · Sanjar Mirzayev" }));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it("presentation=page (desktop) — oyna emas, faqat kamera bloki (yon panelsiz)", async () => {
    renderWithProviders(<ScannerCamera presentation="page" target={makeTarget()} />);
    expect(await screen.findByRole("region", { name: "Kamera skaneri" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("USB skaner ham tayyor")).not.toBeInTheDocument();
  });
});

describe("ScannerCamera — kontekstni almashtirish va hisoblagich qatori (ega, «F»)", () => {
  it("«Qabul qilindi 3 · Qoldi 3 · Topilmadi 1» — kamera ichida doim", async () => {
    setPhone(true);
    renderWithProviders(
      <ScannerCamera
        target={makeTarget({
          stats: [
            { key: "accepted", label: "Qabul qilindi", value: 3, tone: "success" },
            { key: "left", label: "Qoldi", value: 3 },
            { key: "missing", label: "Topilmadi", value: 1, tone: "danger" },
          ],
        })}
        onClose={vi.fn()}
      />,
    );
    const dialog = await screen.findByRole("dialog", { name: "Qabul qilish" });
    expect(within(dialog).getByText("Qabul qilindi")).toBeInTheDocument();
    expect(within(dialog).getByText("Qoldi")).toBeInTheDocument();
    const missing = within(dialog).getByText("Topilmadi").nextElementSibling;
    expect(missing).toHaveTextContent("1");
    expect(missing).toHaveClass("text-danger-fg");
  });

  it("telefon: sarlavhadagi chip «Urgut Savdo ▾» → qidiruvli ro'yxat (yuklovchi), tanlansa onSelect, kamera yopilmaydi", async () => {
    setPhone(true);
    const onSelect = vi.fn();
    const onClose = vi.fn();
    const loader = vi.fn(async () => [
      { value: "7", label: "Urgut Savdo", meta: "6 ta buyurtma" },
      { value: "9", label: "Baraka Shop", meta: "2 ta buyurtma" },
      { value: "12", label: "Ipak Yo'li Savdo" },
    ]);
    const user = userEvent.setup();
    renderWithProviders(
      <ScannerCamera
        target={makeTarget({ switcher: { label: "Urgut Savdo", value: "7", title: "Marketni tanlang", options: loader, onSelect } })}
        onClose={onClose}
      />,
    );
    const dialog = await screen.findByRole("dialog", { name: "Qabul qilish" });
    const chip = within(dialog).getByRole("button", { name: "Urgut Savdo — almashtirish" });
    expect(chip).toHaveAttribute("aria-haspopup", "dialog");
    await user.click(chip);

    const sheet = await screen.findByRole("dialog", { name: "Marketni tanlang" });
    expect(camera.isActive).toBe(false);
    expect(await within(sheet).findByRole("button", { name: /Baraka Shop/ })).toBeInTheDocument();
    expect(loader).toHaveBeenCalledTimes(1);
    expect(within(sheet).getByRole("button", { name: /Urgut Savdo/ })).toHaveAttribute("aria-current", "true");

    await user.type(within(sheet).getByRole("searchbox", { name: "Qidirish" }), "ipak");
    expect(within(sheet).queryByRole("button", { name: /Baraka Shop/ })).not.toBeInTheDocument();
    await user.click(within(sheet).getByRole("button", { name: /Ipak Yo'li Savdo/ }));

    expect(onSelect).toHaveBeenCalledWith("12");
    expect(onClose).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Marketni tanlang" })).not.toBeInTheDocument());
    await waitFor(() => expect(camera.isActive).toBe(true));
  });

  it("ro'yxat yuklanmasa — xabar va «Qayta urinish»; joriy qiymat tanlansa onSelect chaqirilmaydi", async () => {
    const onSelect = vi.fn();
    const loader = vi
      .fn<() => Promise<{ value: string; label: string }[]>>()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValue([{ value: "7", label: "Urgut Savdo" }]);
    const user = userEvent.setup();
    renderWithProviders(
      <ScannerCamera
        target={makeTarget({ switcher: { label: "Urgut Savdo", value: "7", title: "Marketni tanlang", options: loader, onSelect } })}
        onClose={vi.fn()}
      />,
    );
    const dialog = await screen.findByRole("dialog", { name: "Qabul qilish" });
    await user.click(within(dialog).getByRole("button", { name: "Urgut Savdo — almashtirish" }));
    const sheet = await screen.findByRole("dialog", { name: "Marketni tanlang" });
    expect(await within(sheet).findByText("Ro'yxat yuklanmadi")).toBeInTheDocument();
    await user.click(within(sheet).getByRole("button", { name: "Qayta urinish" }));
    await user.click(await within(sheet).findByRole("button", { name: /Urgut Savdo/ }));
    expect(onSelect).not.toHaveBeenCalled();
  });
});

