import { act, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import ScanPage from "./index";
import { renderWithProviders } from "../../test/test-utils";

const navigateMock = vi.fn();
const feedbackMock = vi.fn();
const camera = vi.hoisted(() => ({ onDecode: null as null | ((value: string) => void) }));

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
  fetchScanDetail: () => Promise.resolve({ type: "order", data: {} }),
}));

vi.mock("../../shared/lib/useCameraQrScanner", () => ({
  useCameraQrScanner: ({ onDecode }: { onDecode: (value: string) => void }) => {
    camera.onDecode = onDecode;
    return {
      isStarting: false,
      torchEnabled: false,
      hasTorch: false,
      cameraError: "",
      cameraUnavailable: false,
      stopScanner: vi.fn(),
      restartScanner: vi.fn(),
      toggleTorch: vi.fn(),
    };
  },
}));

/** HID skaner: belgilar juda tez ketma-ket keladi va Enter bilan tugaydi. */
const hidScan = (value: string) =>
  act(() => {
    for (const key of value) window.dispatchEvent(new KeyboardEvent("keydown", { key }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
  });

const TOO_FAST = "Juda tez — bu skan qabul qilinmadi. Posilkani qayta skanerlang.";
const PREVIOUS_OPENING = "Oldingi posilka ochilmoqda — bu skan qabul qilinmadi. Posilkani qayta skanerlang.";

describe("ScanPage scan gate", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    feedbackMock.mockReset();
  });

  it("tells the operator when a camera scan arrives during the cooldown instead of dropping it silently", async () => {
    renderWithProviders(<ScanPage />);

    // Noto'g'ri QR kamera pauzasini boshlaydi; darhol kelgan boshqa posilka rad etiladi.
    act(() => camera.onDecode!("#!!"));
    act(() => camera.onDecode!("PARCEL-B"));

    expect(await screen.findByText(TOO_FAST)).toBeInTheDocument();
    expect(feedbackMock).toHaveBeenLastCalledWith("error", TOO_FAST);
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("does not make a HID scanner wait out the camera cooldown", async () => {
    renderWithProviders(<ScanPage />);

    hidScan("#!!");
    hidScan("PARCEL-B");

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/scan/PARCEL-B"));
    expect(screen.queryByText(TOO_FAST)).not.toBeInTheDocument();
  });

  it("signals a second parcel scanned while the first one is still opening (not silently lost)", async () => {
    renderWithProviders(<ScanPage />);

    hidScan("PARCEL-A");
    hidScan("PARCEL-B");

    // Xabar ilova overlay'ida (playScanFeedback) — u navigatsiyadan keyin ham turadi.
    expect(feedbackMock).toHaveBeenCalledWith("error", PREVIOUS_OPENING);
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/scan/PARCEL-A"));
    expect(navigateMock).toHaveBeenCalledTimes(1);
  });

  it("stays quiet when the camera keeps reading the same QR", () => {
    renderWithProviders(<ScanPage />);

    act(() => camera.onDecode!("#!!"));
    feedbackMock.mockClear();
    act(() => camera.onDecode!("#!!"));
    act(() => camera.onDecode!("#!!"));

    expect(feedbackMock).not.toHaveBeenCalled();
    expect(screen.queryByText(TOO_FAST)).not.toBeInTheDocument();
  });

  it("acknowledges a deliberate repeated HID scan instead of ignoring it", () => {
    renderWithProviders(<ScanPage />);

    hidScan("#!!");
    feedbackMock.mockClear();
    hidScan("#!!");

    expect(feedbackMock).toHaveBeenCalledWith("duplicate");
  });
});
