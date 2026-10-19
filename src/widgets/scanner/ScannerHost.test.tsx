import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useState } from "react";
import { Route, Routes, useLocation, useNavigate, type NavigateFunction } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import i18n, { i18nReady } from "../../i18n";
import { renderWithProviders } from "../../test/test-utils";
import { isScannerOverlayOpen, openScanner, resetScannerHost } from "../../shared/lib/scanner/scannerHost";
import { resetScanTargets, useScanTarget } from "../../shared/lib/scanner/scanTargets";
import ScannerHost from "./ScannerHost";

/** Kontekstli skaner oynasi (shell): maqsad bor — sahifa ustida kamera; yo'q — `/scan`. */

const camera = vi.hoisted(() => ({ onDecode: null as null | ((value: string) => void) }));

vi.mock("../../shared/lib/useCameraQrScanner", () => ({
  useCameraQrScanner: ({ onDecode }: { onDecode: (value: string) => void }) => {
    camera.onDecode = onDecode;
    return {
    isStarting: false,
    torchEnabled: false,
    hasTorch: false,
    cameraError: "",
    cameraErrorKind: null,
    cameraUnavailable: false,
    restartScanner: vi.fn(),
    toggleTorch: vi.fn(),
    stopScanner: vi.fn(),
    setCameraError: vi.fn(),
    };
  },
}));

const onScan = vi.fn();

const MARKETS: Record<string, string> = { "7": "Urgut Savdo", "8": "Baraka Shop" };

/** `delayMs` — sahifa maqsadini kechikib ro'yxatdan o'tkazadi (ro'yxat yuklanmoqda, lazy route). */
const FlowPage = ({ marketId, delayMs = 0, scan = onScan }: { marketId: string; delayMs?: number; scan?: typeof onScan }) => {
  const [enabled, setEnabled] = useState(true);
  const [ready, setReady] = useState(delayMs === 0);
  const navigate = useNavigate();
  useEffect(() => {
    if (delayMs === 0) return undefined;
    const timer = window.setTimeout(() => setReady(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs]);
  useScanTarget(
    enabled && ready
      ? {
          id: `new-orders:market:${marketId}`,
          title: "Qabul qilish",
          context: MARKETS[marketId],
          onScan: scan,
          switcher: {
            label: MARKETS[marketId],
            value: marketId,
            title: "Marketni tanlang",
            options: Object.entries(MARKETS).map(([value, label]) => ({ value, label })),
            onSelect: (value) => navigate(`/new-orders/${value}`),
          },
        }
      : null,
  );
  return (
    <button type="button" onClick={() => setEnabled(false)}>
      Oqimni yopish
    </button>
  );
};

const router: { navigate: NavigateFunction | null } = { navigate: null };
const Path = () => {
  const navigate = useNavigate();
  useEffect(() => {
    router.navigate = navigate;
  }, [navigate]);
  return <span data-testid="path">{useLocation().pathname}</span>;
};

const onScanB = vi.fn();

const renderShell = (route = "/new-orders/7", { delayB = 0 }: { delayB?: number } = {}) =>
  renderWithProviders(
    <>
      <Routes>
        {/* `key` — har market alohida sahifa nusxasi (B o'z ro'yxatini noldan yuklaydi). */}
        <Route path="/new-orders/7" element={<FlowPage key="7" marketId="7" />} />
        <Route path="/new-orders/8" element={<FlowPage key="8" marketId="8" delayMs={delayB} scan={onScanB} />} />
        <Route path="*" element={null} />
      </Routes>
      <ScannerHost />
      <Path />
    </>,
    { route },
  );

beforeAll(async () => {
  await i18nReady;
  await i18n.changeLanguage("uz");
});

afterEach(() => {
  resetScanTargets();
  resetScannerHost();
  onScan.mockReset();
  onScanB.mockReset();
  camera.onDecode = null;
});

const switchToB = async (user: ReturnType<typeof userEvent.setup>) => {
  const dialog = await screen.findByRole("dialog", { name: "Qabul qilish" });
  await user.click(within(dialog).getByRole("button", { name: "Urgut Savdo — almashtirish" }));
  const sheet = await screen.findByRole("dialog", { name: "Marketni tanlang" });
  await user.click(within(sheet).getByRole("button", { name: /Baraka Shop/ }));
  await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/new-orders/8"));
};

describe("ScannerHost", () => {
  it("faol maqsad — kamera sahifa ustida, navigatsiyasiz; «Skanerni yopish» yopadi", async () => {
    const user = userEvent.setup();
    renderShell();
    act(() => {
      openScanner();
    });
    expect(await screen.findByRole("dialog", { name: "Qabul qilish" })).toBeInTheDocument();
    expect(screen.getByTestId("path")).toHaveTextContent("/new-orders/7");

    await user.click(screen.getByRole("button", { name: "Skanerni yopish" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(isScannerOverlayOpen()).toBe(false);
  });

  it("maqsad yo'q — ro'yxatdan o'tgan router navigatsiyasi bilan /scan", async () => {
    renderShell("/dashboard");
    act(() => {
      openScanner();
    });
    await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/scan"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("maqsad umuman yo'qolsa — qisqa kutishdan keyin oyna yopiladi", async () => {
    renderShell();
    act(() => {
      openScanner();
    });
    await screen.findByRole("dialog", { name: "Qabul qilish" });
    // Orqa sahifa `inert` — tugmani to'g'ridan-to'g'ri bosamiz (oqim o'zi tugadi).
    act(() => screen.getByRole("button", { name: "Oqimni yopish", hidden: true }).click());
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument(), { timeout: 3000 });
    expect(isScannerOverlayOpen()).toBe(false);
  });

  it("maqsad almashsa (kamera ichida market tanlandi → boshqa sahifa) — kamera ochiq qoladi, yangi maqsad bilan", async () => {
    const user = userEvent.setup();
    renderShell();
    act(() => {
      openScanner();
    });
    const dialog = await screen.findByRole("dialog", { name: "Qabul qilish" });
    expect(within(dialog).getAllByText("Urgut Savdo").length).toBeGreaterThan(0);

    await user.click(within(dialog).getByRole("button", { name: "Urgut Savdo — almashtirish" }));
    const sheet = await screen.findByRole("dialog", { name: "Marketni tanlang" });
    await user.click(within(sheet).getByRole("button", { name: /Baraka Shop/ }));

    await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/new-orders/8"));
    const next = await screen.findByRole("dialog", { name: "Qabul qilish" });
    expect(within(next).getAllByText("Baraka Shop").length).toBeGreaterThan(0);
    expect(isScannerOverlayOpen()).toBe(true);
  });

  it("bo'lim almashsa va yangi sahifada maqsad yo'q — oyna yopiladi", async () => {
    renderShell();
    act(() => {
      openScanner();
    });
    await screen.findByRole("dialog", { name: "Qabul qilish" });
    act(() => {
      void router.navigate?.("/dashboard");
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument(), { timeout: 3000 });
    expect(isScannerOverlayOpen()).toBe(false);
  });

  it("almashish oralig'ida (yangi sahifa maqsadi hali yo'q) — kamera ochiq, lekin skan eski sahifaga yetmaydi", async () => {
    const user = userEvent.setup();
    renderShell("/new-orders/7", { delayB: 400 });
    act(() => {
      openScanner();
    });
    await switchToB(user);

    const dialog = await screen.findByRole("dialog", { name: "Qabul qilish" });
    expect(within(dialog).getByText("Yuklanmoqda")).toBeInTheDocument();
    act(() => camera.onDecode?.("65f0c1aa22bb33cc44dd55ee"));
    await new Promise((done) => setTimeout(done, 0));
    expect(onScan).not.toHaveBeenCalled();
    expect(onScanB).not.toHaveBeenCalled();

    // Yangi sahifa maqsadini ro'yxatdan o'tkazdi (< 1 s) — kamera yopilmagan, skan endi B ga.
    await waitFor(() => expect(within(screen.getByRole("dialog", { name: "Qabul qilish" })).queryByText("Yuklanmoqda")).not.toBeInTheDocument());
    expect(isScannerOverlayOpen()).toBe(true);
    act(() => camera.onDecode?.("ffffffffffffffffffffffff"));
    await waitFor(() => expect(onScanB).toHaveBeenCalledWith("ffffffffffffffffffffffff", "camera"));
    expect(onScan).not.toHaveBeenCalled();
  });

  it("yangi sahifa maqsadi 1 s dan kech kelsa — oyna yopiladi", async () => {
    const user = userEvent.setup();
    renderShell("/new-orders/7", { delayB: 1600 });
    act(() => {
      openScanner();
    });
    await switchToB(user);
    await waitFor(() => expect(isScannerOverlayOpen()).toBe(false), { timeout: 3000 });
    expect(screen.queryByRole("dialog", { name: "Qabul qilish" })).not.toBeInTheDocument();
  });
});
