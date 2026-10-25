import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { UserX } from "lucide-react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import i18n, { i18nReady } from "../../../i18n";
import { renderWithProviders } from "../../../test/test-utils";
import { playScanFeedback, playScanSignal } from "../../lib/scanner/feedback";
import { isScannerCameraMounted } from "../../lib/scanner/scannerHost";
import type { ScanTarget } from "../../lib/scanner/scanTargets";
import type { CameraErrorKind } from "../../lib/qrScanner";
import { PHONE_QUERY } from "../primitives/date/useIsPhone";
import { ScannerCamera } from "./ScannerCamera";
import { resetCameraPermissionExplained } from "./useScannerCameraSession";

/**
 * `ScannerCamera` — taxta `tizim-scanner` (§03 anatomiya, §04 holatlar, §06 desktop oynasi). Kamera kutubxonasi
 * soxtalangan: `useCameraQrScanner` holatini test boshqaradi, `onDecode` — kamera «o'qigan» kod.
 */

const camera = vi.hoisted(() => ({
  isActive: false,
  onDecode: null as null | ((value: string) => void),
  onTorchError: null as null | (() => void),
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
  preferredCamera: undefined as string | undefined,
  calculateScanRegion: undefined as unknown,
  formats: undefined as string | undefined,
  canSwitchCamera: false,
  switchCamera: vi.fn(async () => undefined),
  lowLight: false,
  lowLightEnabled: false,
}));

vi.mock("./useLowLight", () => ({
  // Kadr yorqinligi o'lchanmaydi — test boshqaradi; `enabled` (taklif shartlari) yoziladi.
  useLowLight: ({ enabled }: { enabled: boolean }) => {
    camera.lowLightEnabled = enabled;
    return enabled && camera.lowLight;
  },
}));

vi.mock("../../lib/scanner/feedback", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/scanner/feedback")>()),
  // Ovoz / tebranish o'rniga — necha marta chalingani sanaladi.
  playScanSignal: vi.fn(),
}));

vi.mock("../../lib/useCameraQrScanner", () => ({
  useCameraQrScanner: (options: {
    isActive: boolean;
    onDecode: (value: string) => void;
    onTorchError?: () => void;
    preferredCamera?: string;
    calculateScanRegion?: unknown;
    formats?: string;
  }) => {
    camera.isActive = options.isActive;
    camera.preferredCamera = options.preferredCamera;
    camera.formats = options.formats;
    camera.calculateScanRegion = options.calculateScanRegion;
    camera.onDecode = options.onDecode;
    camera.onTorchError = options.onTorchError ?? null;
    return {
      ...camera.state,
      restartScanner: camera.restart,
      toggleTorch: camera.toggleTorch,
      canSwitchCamera: camera.canSwitchCamera,
      switchCamera: camera.switchCamera,
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
  camera.restart.mockClear();
  camera.toggleTorch.mockClear();
  camera.switchCamera.mockClear();
  camera.canSwitchCamera = false;
  camera.lowLight = false;
  camera.lowLightEnabled = false;
  window.localStorage.clear();
  resetCameraPermissionExplained();
  vi.mocked(playScanSignal).mockClear();
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

  it("o'ng panelda ko'pi bilan 4 qator, qolgani — «Yana N ta ro'yxatda» → «Ro'yxat» varag'ida hammasi", async () => {
    const user = userEvent.setup();
    const list = Array.from({ length: 6 }, (_, index) => ({
      key: String(index),
      title: `№${10250 + index}`,
      tone: "success" as const,
    }));
    renderWithProviders(<ScannerCamera target={makeTarget({ list, listTitle: "Qabul qilinganlar" })} onClose={vi.fn()} />);
    const dialog = await screen.findByRole("dialog", { name: "Qabul qilish" });
    const panel = within(dialog).getByText("Qabul qilinganlar").parentElement!;
    // Panel ro'yxati siqilmaydi (pastki chip va tugmalar ustiga chiqmaydi) — skroll yon panelning o'zida.
    expect(panel).toHaveClass("shrink-0");
    expect(within(panel).getAllByRole("listitem")).toHaveLength(4);
    expect(within(panel).getByText("Yana 2 ta ro'yxatda")).toBeInTheDocument();

    await user.click(within(panel).getByRole("button", { name: "Ro'yxat" }));
    const sheet = await screen.findByRole("dialog", { name: "Qabul qilinganlar" });
    expect(within(sheet).getAllByRole("listitem")).toHaveLength(6);
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

  it("izoh kartasi sahifa yuklanishida bir marta: «Kamerani yoqish» dan keyin qayta ochilganda brauzer o'zi so'raydi", async () => {
    setPermission("prompt");
    const user = userEvent.setup();
    const { unmount } = renderWithProviders(<ScannerCamera target={makeTarget()} onClose={vi.fn()} />);
    await user.click(await screen.findByRole("button", { name: "Kamerani yoqish" }));
    unmount();

    renderWithProviders(<ScannerCamera target={makeTarget()} onClose={vi.fn()} />);
    await waitFor(() => expect(camera.isActive).toBe(true));
    expect(screen.queryByText("Kameraga ruxsat bering")).not.toBeInTheDocument();
  });

  it("ruxsat rad etilgan — 3 qadam (desktop: qulf belgisi), «Qayta urinish» va «Kodni qo'lda kiritish» (maket)", async () => {
    setPermission("denied");
    renderWithProviders(<ScannerCamera target={makeTarget()} onClose={vi.fn()} />);
    const card = await screen.findByRole("alert");
    expect(within(card).getByText("Kameraga ruxsat berilmagan")).toBeInTheDocument();
    expect(within(card).getByText("Manzil satridagi qulf belgisini bosing")).toBeInTheDocument();
    expect(within(card).getByText("«Kamera» bandida «Ruxsat berish»ni tanlang")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Qayta urinish" })).toBeInTheDocument();
    // Maket `courier-scan-permission-denied`: «Kodni qo'lda kiritish» (kkDkrAIz).
    expect(within(card).getByRole("button", { name: "Kodni qo'lda kiritish" })).toBeInTheDocument();
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

  it("«Ro'yxat» varag'i: maqsad izohi («4 / 7 · 2 ta bekor, 2 ta ertaga») va ostidagi eslatma", async () => {
    setPhone(true);
    const user = userEvent.setup();
    renderWithProviders(
      <ScannerCamera
        target={makeTarget({
          list: [{ key: "1", title: "№10233 · Feruza Mirzayeva", subtitle: "Bekor · Toshkent tumani", tone: "danger" }],
          listDescription: "4 / 7 · 2 ta bekor, 2 ta ertaga",
          listNote: "Skanerlanmagan 3 ta buyurtma sotilgan deb belgilanadi.",
        })}
        onClose={vi.fn()}
      />,
    );
    const dialog = await screen.findByRole("dialog", { name: "Qabul qilish" });
    await user.click(within(dialog).getByRole("button", { name: "Ro'yxat" }));
    const sheet = await screen.findByRole("dialog", { name: "Skanerlanganlar" });
    expect(within(sheet).getByText("4 / 7 · 2 ta bekor, 2 ta ertaga")).toBeInTheDocument();
    expect(within(sheet).getByRole("note")).toHaveTextContent("Skanerlanmagan 3 ta buyurtma sotilgan deb belgilanadi.");
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

/** Ekran kengligi test davomida o'zgaradigan `matchMedia` (telefonni burish, oyna o'lchami). */
const liveViewport = (initialPhone: boolean) => {
  let phone = initialPhone;
  const listeners = new Set<() => void>();
  window.matchMedia = ((query: string) => ({
    get matches() {
      return phone && query === PHONE_QUERY;
    },
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
  return (next: boolean) => {
    phone = next;
    act(() => listeners.forEach((listener) => listener()));
  };
};

describe("ScannerCamera — uzluksiz skan va review tuzatishlari", () => {
  it("«Juda tez» bir kod uchun bir marta: B kodining ketma-ket kadrlari 700 ms ichida — bitta ovoz, bitta xabar", async () => {
    const target = makeTarget();
    renderWithProviders(<ScannerCamera target={target} onClose={vi.fn()} />);
    await waitFor(() => expect(camera.isActive).toBe(true));
    feedPlaying();

    act(() => camera.onDecode?.("65f0c1aa22bb33cc44dd55ee"));
    await waitFor(() => expect(target.onScan).toHaveBeenCalledTimes(1));
    // Kamera sekundiga ~25 kadr o'qiydi: A ham, B ham kadrda.
    act(() => {
      for (let frame = 0; frame < 8; frame += 1) {
        camera.onDecode?.("65f0c1aa22bb33cc44dd55ee");
        camera.onDecode?.("ffffffffffffffffffffffff");
      }
    });
    expect(await screen.findByText("Juda tez — skan qabul qilinmadi")).toBeInTheDocument();
    expect(vi.mocked(playScanSignal).mock.calls.filter(([type]) => type === "error")).toHaveLength(1);
    expect(screen.getAllByText("Juda tez — skan qabul qilinmadi")).toHaveLength(1);
    expect(target.onScan).toHaveBeenCalledTimes(1);
  });

  it("kadrda turgan kod 1,8 s dan keyin ham qayta yuborilmaydi (takror oynasi suriladi)", async () => {
    const target = makeTarget();
    renderWithProviders(<ScannerCamera target={target} onClose={vi.fn()} />);
    await waitFor(() => expect(camera.isActive).toBe(true));
    feedPlaying();

    const now = vi.spyOn(Date, "now");
    let clock = 1_000_000;
    now.mockImplementation(() => clock);
    act(() => {
      for (; clock < 1_005_000; clock += 200) camera.onDecode?.("65f0c1aa22bb33cc44dd55ee");
    });
    await waitFor(() => expect(target.onScan).toHaveBeenCalledTimes(1));
    await new Promise((done) => setTimeout(done, 0));
    expect(target.onScan).toHaveBeenCalledTimes(1);
  });

  it("768 px chegarasi kesib o'tilsa (oyna rejimi) — skaner yangi <video> da qayta ishga tushadi", async () => {
    const setViewport = liveViewport(false);
    renderWithProviders(<ScannerCamera target={makeTarget()} onClose={vi.fn()} />);
    await waitFor(() => expect(camera.isActive).toBe(true));
    const before = document.querySelector("video");
    expect(camera.restart).not.toHaveBeenCalled();

    setViewport(true);
    await waitFor(() => expect(camera.restart).toHaveBeenCalledTimes(1));
    expect(document.querySelector("video")).not.toBe(before);
    expect(await screen.findByText("Kamera ishga tushmoqda")).toBeInTheDocument();
  });

  it("suspended (maqsad almashmoqda) — kamera ochiq, lekin skan va qo'lda kiritish yuborilmaydi", async () => {
    const target = makeTarget();
    const user = userEvent.setup();
    renderWithProviders(<ScannerCamera target={target} suspended onClose={vi.fn()} />);
    const dialog = await screen.findByRole("dialog", { name: "Qabul qilish" });
    await waitFor(() => expect(camera.isActive).toBe(true));
    expect(within(dialog).getByText("Yuklanmoqda")).toBeInTheDocument();

    act(() => camera.onDecode?.("65f0c1aa22bb33cc44dd55ee"));
    await user.click(within(dialog).getByRole("button", { name: "Qo'lda kiritish" }));
    const sheet = await screen.findByRole("dialog", { name: "Kodni qo'lda kiriting" });
    await user.type(within(sheet).getByLabelText("Buyurtma raqami yoki yorliqdagi kod"), "P-0412");
    await user.click(within(sheet).getByRole("button", { name: "Qo'shish" }));
    await new Promise((done) => setTimeout(done, 0));
    expect(target.onScan).not.toHaveBeenCalled();
  });

  it("chiroq yoqilmadi — kamera ishlayveradi, «Kamera ochilmadi» kartasi emas, qisqa xabar", async () => {
    camera.state.hasTorch = true;
    renderWithProviders(<ScannerCamera target={makeTarget()} onClose={vi.fn()} />);
    await waitFor(() => expect(camera.isActive).toBe(true));
    feedPlaying();

    act(() => camera.onTorchError?.());
    expect(await screen.findByText("Chiroqni yoqib bo'lmadi")).toBeInTheDocument();
    expect(screen.queryByText("Kamera ochilmadi")).not.toBeInTheDocument();
    expect(camera.isActive).toBe(true);
  });

  it("kamera band — xato ovozi bir marta", async () => {
    camera.state.cameraErrorKind = "busy";
    renderWithProviders(<ScannerCamera target={makeTarget()} onClose={vi.fn()} />);
    expect(await screen.findByText("Kamera band")).toBeInTheDocument();
    expect(vi.mocked(playScanSignal).mock.calls.filter(([type]) => type === "error")).toHaveLength(1);
  });

  it("Esc ichki varaqda (qo'lda kiritish) — faqat varaq yopiladi, kamera ochiq qoladi", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<ScannerCamera target={makeTarget()} onClose={onClose} />);
    const dialog = await screen.findByRole("dialog", { name: "Qabul qilish" });
    await user.click(within(dialog).getByRole("button", { name: "Qo'lda kiritish" }));
    await screen.findByRole("dialog", { name: "Kodni qo'lda kiriting" });

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Kodni qo'lda kiriting" })).not.toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Qabul qilish" })).toBeInTheDocument();
  });
});

describe("ScannerCamera — telefon pastki paneli karta holatiga qarab (04.1, 04.2, 04.14)", () => {
  it("ruxsat rad etilgan — pastki panel yo'q: bitta «Kodni qo'lda kiritish», bitta asosiy amal", async () => {
    setPhone(true);
    setPermission("denied");
    renderWithProviders(<ScannerCamera target={makeTarget({ finish: { label: "Tugatish", onFinish: vi.fn() } })} onClose={vi.fn()} />);
    await screen.findByText("Kameraga ruxsat berilmagan");
    expect(screen.getAllByRole("button", { name: "Kodni qo'lda kiritish" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Tugatish" })).not.toBeInTheDocument();
  });

  it("ruxsat izohi — pastki panel yo'q", async () => {
    setPhone(true);
    setPermission("prompt");
    renderWithProviders(<ScannerCamera target={makeTarget()} onClose={vi.fn()} />);
    await screen.findByText("Kameraga ruxsat bering");
    expect(screen.getAllByRole("button", { name: "Qo'lda kiritish" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Yopish" })).not.toBeInTheDocument();
  });

  it("kamera band — faqat hisoblagich qatori qoladi, amallar qatori yo'q", async () => {
    setPhone(true);
    camera.state.cameraErrorKind = "busy";
    renderWithProviders(
      <ScannerCamera
        target={makeTarget({ list: [{ key: "1", title: "№10254 · Sanjar Mirzayev" }], finish: { label: "Tugatish", onFinish: vi.fn() } })}
        onClose={vi.fn()}
      />,
    );
    const dialog = await screen.findByRole("dialog", { name: "Qabul qilish" });
    await within(dialog).findByText("Kamera band");
    expect(within(dialog).getByText("/ 6")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Ro'yxat" })).toBeInTheDocument();
    expect(within(dialog).getAllByRole("button", { name: "Qo'lda kiritish" })).toHaveLength(1);
    expect(within(dialog).queryByRole("button", { name: "Tugatish" })).not.toBeInTheDocument();
  });
});

describe("ScannerCamera — presentation=page, telefon (§08)", () => {
  it("fokus «Skanerni yopish» da, Esc yopadi; varaq ochiq bo'lsa Esc faqat varaqni yopadi", async () => {
    setPhone(true);
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<ScannerCamera presentation="page" target={makeTarget()} onClose={onClose} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Skanerni yopish" })).toHaveFocus());

    await user.click(screen.getByRole("button", { name: "Qo'lda kiritish" }));
    await screen.findByRole("dialog", { name: "Kodni qo'lda kiriting" });
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Kodni qo'lda kiriting" })).not.toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("ScannerCamera — universal skaner rejimlari (3-bosqich)", () => {
  const MODES = [
    { value: "take", label: "O'zimga olish" },
    { value: "info", label: "Ma'lumot" },
  ];

  it("«Tugatish» `keepOpen` — onFinish chaqiriladi, kamera yopilmaydi (xulosa uning ustida)", async () => {
    const onFinish = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <ScannerCamera target={makeTarget({ finish: { label: "Tugatish", onFinish, keepOpen: true } })} onClose={onClose} />,
    );
    const dialog = await screen.findByRole("dialog", { name: "Qabul qilish" });
    await user.click(within(dialog).getByRole("button", { name: "Tugatish" }));
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("`switcherOpenKey` o'zgarsa — almashtirish varag'i ochiladi (keng `page` ko'rinishida chip yo'q)", async () => {
    const target = makeTarget({
      switcher: {
        label: "Marketni tanlang",
        value: "",
        title: "Marketni tanlang",
        options: [{ value: "7", label: "Urgut Savdo", meta: "6 ta yangi buyurtma" }],
        onSelect: vi.fn(),
      },
    });
    // Sahifaning yon panelidagi «Marketni tanlang» tugmasi kabi: kalit oshiriladi.
    const Host = () => {
      const [key, setKey] = useState(0);
      return (
        <>
          <button type="button" onClick={() => setKey((value) => value + 1)}>
            Tashqi tugma
          </button>
          <ScannerCamera presentation="page" target={target} switcherOpenKey={key} />
        </>
      );
    };
    const user = userEvent.setup();
    renderWithProviders(<Host />);
    expect(screen.queryByRole("dialog", { name: "Marketni tanlang" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Tashqi tugma" }));
    const sheet = await screen.findByRole("dialog", { name: "Marketni tanlang" });
    expect(within(sheet).getByText("6 ta yangi buyurtma")).toBeInTheDocument();
  });

  it("telefon: rejim segmenti pastki panelda; ruxsat izohi holatida ham qoladi (kamerasiz rejim tanlanadi)", async () => {
    setPhone(true);
    setPermission("prompt");
    const onModeChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <ScannerCamera
        presentation="page"
        target={makeTarget({ title: "O'zimga olish", modes: MODES, mode: "take", onModeChange })}
        onClose={vi.fn()}
      />,
    );
    await screen.findByText("Kameraga ruxsat bering");
    const group = screen.getByRole("radiogroup", { name: "O'zimga olish" });
    await user.click(within(group).getByRole("radio", { name: "Ma'lumot" }));
    expect(onModeChange).toHaveBeenCalledWith("info");
  });
});

describe("ScannerCamera — ko'p rejim va bo'sh tanlov (vNcGDnNh)", () => {
  const MANY = [
    { value: "info", label: "Ma'lumot" },
    { value: "receive", label: "Qabul qilish" },
    { value: "sendMail", label: "Pochtani jo'natish" },
    { value: "refusedMail", label: "Rad etilgan pochta" },
    { value: "handover", label: "Marketga topshirish" },
  ];

  it("telefon: 3 tadan ko'p rejim — segment o'rniga «Rejim: …» → varaq (radio), tanlansa onModeChange, kamera to'xtaydi", async () => {
    setPhone(true);
    const onModeChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <ScannerCamera
        presentation="page"
        target={makeTarget({ title: "QR skaner", modes: MANY, mode: "info", onModeChange })}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByRole("radiogroup", { name: "QR skaner" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Rejim: Ma'lumot" }));

    const sheet = await screen.findByRole("dialog", { name: "Skaner rejimi" });
    expect(camera.isActive).toBe(false);
    const group = within(sheet).getByRole("radiogroup", { name: "Skaner rejimi" });
    expect(within(group).getAllByRole("radio")).toHaveLength(5);
    expect(within(group).getByRole("radio", { name: "Ma'lumot" })).toHaveAttribute("aria-checked", "true");

    // Klaviatura: fokus tanlangan rejimda (yagona Tab to'xtash joyi), ↓ / End — keyingi qatorlar.
    expect(within(group).getByRole("radio", { name: "Ma'lumot" })).toHaveAttribute("tabindex", "0");
    expect(within(group).getByRole("radio", { name: "Qabul qilish" })).toHaveAttribute("tabindex", "-1");
    within(group).getByRole("radio", { name: "Ma'lumot" }).focus();
    await user.keyboard("{ArrowDown}");
    expect(within(group).getByRole("radio", { name: "Qabul qilish" })).toHaveFocus();
    await user.keyboard("{End}");
    expect(within(group).getByRole("radio", { name: "Marketga topshirish" })).toHaveFocus();

    // Joriy rejim — o'zgarish yo'q, varaq yopiladi.
    await user.click(within(group).getByRole("radio", { name: "Ma'lumot" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Skaner rejimi" })).not.toBeInTheDocument());
    expect(onModeChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Rejim: Ma'lumot" }));
    const again = await screen.findByRole("dialog", { name: "Skaner rejimi" });
    await user.click(within(again).getByRole("radio", { name: "Marketga topshirish" }));
    expect(onModeChange).toHaveBeenCalledWith("handover");
  });

  it("3 ta rejim — segment o'zgarmagan", async () => {
    setPhone(true);
    renderWithProviders(
      <ScannerCamera
        presentation="page"
        target={makeTarget({ title: "QR skaner", modes: MANY.slice(0, 3), mode: "info", onModeChange: vi.fn() })}
        onClose={vi.fn()}
      />,
    );
    expect(within(screen.getByRole("radiogroup", { name: "QR skaner" })).getAllByRole("radio")).toHaveLength(3);
    expect(screen.queryByRole("button", { name: /^Rejim:/ })).not.toBeInTheDocument();
  });

  it("tanlov ro'yxati bo'sh — `emptyText`; qidiruvda topilmasa — umumiy «Hech narsa topilmadi»", async () => {
    setPhone(true);
    const user = userEvent.setup();
    renderWithProviders(
      <ScannerCamera
        target={makeTarget({
          switcher: {
            label: "Pochtani tanlang",
            value: "",
            title: "Pochtani tanlang",
            options: async () => [],
            onSelect: vi.fn(),
            emptyText: "Jo'natiladigan yangi pochta yo'q",
          },
        })}
        onClose={vi.fn()}
      />,
    );
    await user.click(await screen.findByRole("button", { name: "Pochtani tanlang — almashtirish" }));
    const sheet = await screen.findByRole("dialog", { name: "Pochtani tanlang" });
    expect(await within(sheet).findByText("Jo'natiladigan yangi pochta yo'q")).toBeInTheDocument();
    await user.type(within(sheet).getByRole("searchbox"), "abc");
    expect(within(sheet).getByText("Hech narsa topilmadi")).toBeInTheDocument();
  });
});

describe("ScannerCamera — Sozlamalar → Skaner → «Kamera» (4-bosqich)", () => {
  const finder = () => document.querySelector("[data-finder-size]");

  it("sukut: orqa kamera, o'rta ramka, skan hududi ramkaga bog'langan", async () => {
    renderWithProviders(<ScannerCamera target={makeTarget()} onClose={vi.fn()} />);
    await waitFor(() => expect(camera.isActive).toBe(true));
    expect(camera.preferredCamera).toBe("environment");
    expect(typeof camera.calculateScanRegion).toBe("function");
    expect(finder()).toHaveAttribute("data-finder-size", "md");
  });

  it("saqlangan sozlama: old kamera va katta ramka (ramka va maslahat o'lchami)", async () => {
    window.localStorage.setItem("scanner-camera-facing", "user");
    window.localStorage.setItem("scanner-frame-size", "lg");
    renderWithProviders(<ScannerCamera target={makeTarget()} onClose={vi.fn()} />);
    await waitFor(() => expect(camera.isActive).toBe(true));
    expect(camera.preferredCamera).toBe("user");
    expect(finder()).toHaveAttribute("data-finder-size", "lg");
    expect(finder()).toHaveClass("size-[288px]");
    feedPlaying();
    expect(await screen.findByText("Buyurtma yorlig'idagi QR kodni ramkaga oling")).toHaveClass("top-[calc(50%+160px)]");
  });

  it("bir nechta kamera — «Kamerani almashtirish» (shu ochilish uchun)", async () => {
    camera.canSwitchCamera = true;
    const user = userEvent.setup();
    renderWithProviders(<ScannerCamera target={makeTarget()} onClose={vi.fn()} />);
    await waitFor(() => expect(camera.isActive).toBe(true));
    feedPlaying();
    await user.click(await screen.findByRole("button", { name: "Kamerani almashtirish" }));
    expect(camera.switchCamera).toHaveBeenCalledTimes(1);
  });

  it("bitta kamera — almashtirish tugmasi yo'q", async () => {
    renderWithProviders(<ScannerCamera target={makeTarget()} onClose={vi.fn()} />);
    await waitFor(() => expect(camera.isActive).toBe(true));
    feedPlaying();
    await screen.findByText("Skanerlash faol");
    expect(screen.queryByRole("button", { name: "Kamerani almashtirish" })).not.toBeInTheDocument();
  });

  it("«Uzluksiz skanerlash» o'chiq: xato — ochiq qoladi; muvaffaqiyatli koddan keyin oyna yopiladi", async () => {
    window.localStorage.setItem("scanner-continuous", "false");
    const onClose = vi.fn();
    const target = makeTarget();
    renderWithProviders(<ScannerCamera target={target} onClose={onClose} />);
    await waitFor(() => expect(camera.isActive).toBe(true));
    feedPlaying();

    // USB skan natijasi (kamera hech narsa yubormagan) — yopmaydi.
    act(() => playScanFeedback("success", "Qabul qilindi", "keyboard"));
    await new Promise((resolve) => setTimeout(resolve, 800));
    expect(onClose).not.toHaveBeenCalled();

    act(() => camera.onDecode?.("65f0c1aa22bb33cc44dd55ee"));
    await waitFor(() => expect(target.onScan).toHaveBeenCalledTimes(1));
    act(() => playScanFeedback("error", "Bu marketniki emas"));
    await new Promise((resolve) => setTimeout(resolve, 800));
    expect(onClose).not.toHaveBeenCalled();

    await new Promise((resolve) => setTimeout(resolve, 1900));
    act(() => camera.onDecode?.("ffffffffffffffffffffffff"));
    await waitFor(() => expect(target.onScan).toHaveBeenCalledTimes(2));
    act(() => playScanFeedback("success", "Qabul qilindi"));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("«Uzluksiz skanerlash» o'chiq: oraliq qadam (`step`, market QR) yopmaydi; javobsiz skan eskiradi", async () => {
    window.localStorage.setItem("scanner-continuous", "false");
    const onClose = vi.fn();
    const target = makeTarget();
    renderWithProviders(<ScannerCamera target={target} onClose={onClose} />);
    await waitFor(() => expect(camera.isActive).toBe(true));
    feedPlaying();

    act(() => camera.onDecode?.("65f0c1aa22bb33cc44dd55ee"));
    await waitFor(() => expect(target.onScan).toHaveBeenCalledTimes(1));
    act(() => playScanFeedback("success", "Market QR qabul qilindi", undefined, { step: true }));
    await new Promise((resolve) => setTimeout(resolve, 800));
    expect(onClose).not.toHaveBeenCalled();

    // Sahifa skanni jim tashladi (natija yo'q) — 5 s dan keyin kelgan USB natijasi kamerani yopmaydi.
    await new Promise((resolve) => setTimeout(resolve, 1900));
    const start = Date.now();
    act(() => camera.onDecode?.("ffffffffffffffffffffffff"));
    await waitFor(() => expect(target.onScan).toHaveBeenCalledTimes(2));
    const now = vi.spyOn(Date, "now").mockReturnValue(start + 10_000);
    act(() => playScanFeedback("success", "Qabul qilindi", "keyboard"));
    await new Promise((resolve) => setTimeout(resolve, 800));
    expect(onClose).not.toHaveBeenCalled();
    now.mockRestore();
  });

  it("`paused` — kamera to'xtaydi, chipda «Kamera to'xtatildi» (skanlar jim yo'qolmaydi)", async () => {
    const { rerender } = renderWithProviders(<ScannerCamera target={makeTarget()} presentation="page" />);
    await waitFor(() => expect(camera.isActive).toBe(true));
    rerender(<ScannerCamera target={makeTarget()} presentation="page" paused />);
    await waitFor(() => expect(camera.isActive).toBe(false));
    expect(screen.getByText("Kamera to'xtatildi")).toBeInTheDocument();
    expect(screen.queryByText("Skanerlash faol")).not.toBeInTheDocument();
  });

  it("natija izohi (`text`) xabar ostida; qator ikonkasi `item.icon` bilan almashadi", async () => {
    renderWithProviders(
      <ScannerCamera
        target={makeTarget({
          list: [{ key: "a", title: "№10251", subtitle: "Boshqa kuryerda: Sherzod Nazarov", tone: "danger", icon: UserX }],
        })}
        onClose={vi.fn()}
      />,
    );
    const dialog = await screen.findByRole("dialog", { name: "Qabul qilish" });
    await waitFor(() => expect(camera.isActive).toBe(true));
    feedPlaying();
    act(() =>
      playScanFeedback("error", "Boshqa kuryerga biriktirilgan", undefined, {
        text: "№10251 · Sherzod Nazarov. Menejerga xabar bering.",
      }),
    );
    expect(await within(dialog).findByText("№10251 · Sherzod Nazarov. Menejerga xabar bering.")).toBeInTheDocument();
    expect(dialog.querySelector(".lucide-user-x")).not.toBeNull();
  });

  it("«Uzluksiz skanerlash» yoqiq (sukut) — muvaffaqiyatdan keyin ham ochiq", async () => {
    const onClose = vi.fn();
    const target = makeTarget();
    renderWithProviders(<ScannerCamera target={target} onClose={onClose} />);
    await waitFor(() => expect(camera.isActive).toBe(true));
    feedPlaying();
    act(() => camera.onDecode?.("65f0c1aa22bb33cc44dd55ee"));
    await waitFor(() => expect(target.onScan).toHaveBeenCalledTimes(1));
    act(() => playScanFeedback("success", "Qabul qilindi"));
    await new Promise((resolve) => setTimeout(resolve, 800));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("«Chiroq — avtomatik»: yorug'lik kam — maslahat o'rnida «Chiroqni yoqish» taklifi; bosilsa chiroq yoqiladi", async () => {
    camera.state.hasTorch = true;
    camera.lowLight = true;
    const user = userEvent.setup();
    renderWithProviders(<ScannerCamera target={makeTarget()} onClose={vi.fn()} />);
    await waitFor(() => expect(camera.isActive).toBe(true));
    feedPlaying();
    expect(await screen.findByText("Yorug'lik kam")).toBeInTheDocument();
    expect(screen.queryByText("Buyurtma yorlig'idagi QR kodni ramkaga oling")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Chiroqni yoqish" }));
    expect(camera.toggleTorch).toHaveBeenCalledTimes(1);
    // Bir marta bosilgach shu ochilishda taklif qaytmaydi.
    expect(camera.lowLightEnabled).toBe(false);
    expect(screen.queryByText("Yorug'lik kam")).not.toBeInTheDocument();
  });

  it("taklif yo'q: sozlama o'chiq yoki qurilmada chiroq yo'q", async () => {
    window.localStorage.setItem("scanner-torch-auto", "false");
    camera.state.hasTorch = true;
    camera.lowLight = true;
    const first = renderWithProviders(<ScannerCamera target={makeTarget()} onClose={vi.fn()} />);
    await waitFor(() => expect(camera.isActive).toBe(true));
    feedPlaying();
    await screen.findByText("Skanerlash faol");
    expect(camera.lowLightEnabled).toBe(false);
    expect(screen.queryByText("Yorug'lik kam")).not.toBeInTheDocument();
    first.unmount();

    window.localStorage.removeItem("scanner-torch-auto");
    camera.state.hasTorch = false;
    renderWithProviders(<ScannerCamera target={makeTarget()} onClose={vi.fn()} />);
    await waitFor(() => expect(camera.isActive).toBe(true));
    feedPlaying();
    await screen.findByText("Skanerlash faol");
    expect(camera.lowLightEnabled).toBe(false);
    expect(screen.queryByText("Yorug'lik kam")).not.toBeInTheDocument();
  });
});

describe("ScannerCamera — shtrix kod rejimi (CO66kcoB)", () => {
  const finder = () => document.querySelector("[data-finder-size]");

  it("sukut (`formats` yo'q) — QR: kvadrat ramka, QR yo'riqnomasi, kamera `qr` rejimida", async () => {
    renderWithProviders(<ScannerCamera target={makeTarget({ hint: undefined })} onClose={vi.fn()} />);
    await waitFor(() => expect(camera.isActive).toBe(true));
    expect(camera.formats).toBe("qr");
    expect(finder()).toHaveAttribute("data-finder-shape", "square");
    expect(finder()).toHaveClass("size-[248px]");
    feedPlaying();
    expect(await screen.findByText("QR kodni ramka ichiga olib keling")).toBeInTheDocument();
  });

  it("`formats: \"barcodes\"` — keng ramka, shtrix kod yo'riqnomasi (ramka ostida), kamera `barcodes` rejimida", async () => {
    renderWithProviders(<ScannerCamera target={makeTarget({ formats: "barcodes", hint: undefined })} onClose={vi.fn()} />);
    await waitFor(() => expect(camera.isActive).toBe(true));
    expect(camera.formats).toBe("barcodes");
    expect(finder()).toHaveAttribute("data-finder-shape", "wide");
    expect(finder()).toHaveClass("h-[168px]");
    feedPlaying();
    expect(await screen.findByText("Shtrix kod yoki QR kodni ramka ichiga olib keling")).toHaveClass(
      "top-[calc(50%+100px)]",
    );
    // Skan hududi ham keng (jsdom'da ramka o'lchami 0 — keng sukut hudud, tahlil kadri 640).
    const video = document.createElement("video");
    Object.defineProperties(video, { videoWidth: { value: 1280 }, videoHeight: { value: 720 } });
    const region = (camera.calculateScanRegion as (element: HTMLVideoElement) => Record<string, number>)(video);
    expect(region).toMatchObject({ width: 1024, height: 563, downScaledWidth: 640 });
  });

  it("«Ramka o'lchami» shtrix kod rejimida ham: katta — keng ramka kattaroq", async () => {
    window.localStorage.setItem("scanner-frame-size", "lg");
    renderWithProviders(<ScannerCamera target={makeTarget({ formats: "barcodes" })} onClose={vi.fn()} />);
    await waitFor(() => expect(camera.isActive).toBe(true));
    expect(finder()).toHaveAttribute("data-finder-size", "lg");
    expect(finder()).toHaveClass("h-[184px]");
  });

  it("`closeOnSuccess` — «Uzluksiz skanerlash» yoqiq bo'lsa ham birinchi muvaffaqiyatli koddan keyin yopiladi", async () => {
    const onClose = vi.fn();
    const target = makeTarget({ formats: "barcodes", closeOnSuccess: true });
    renderWithProviders(<ScannerCamera target={target} onClose={onClose} />);
    await waitFor(() => expect(camera.isActive).toBe(true));
    feedPlaying();
    act(() => camera.onDecode?.("4780123450017"));
    await waitFor(() => expect(target.onScan).toHaveBeenCalledWith("4780123450017", "camera"));
    act(() => playScanFeedback("error", "Bu Elchi kodi"));
    await new Promise((resolve) => setTimeout(resolve, 800));
    expect(onClose).not.toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, 1900));
    act(() => camera.onDecode?.("8806095467894"));
    await waitFor(() => expect(target.onScan).toHaveBeenCalledTimes(2));
    act(() => playScanFeedback("success", "Shtrix kod yozildi"));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});
