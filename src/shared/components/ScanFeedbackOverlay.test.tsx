import { act, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import i18n, { i18nReady } from "../../i18n";
import { renderWithProviders } from "../../test/test-utils";
import { SCAN_FEEDBACK_EVENT, type ScanFeedbackDetail } from "../lib/scanner/feedback";
import { markScannerCameraMounted } from "../lib/scanner/scannerHost";
import ScanFeedbackOverlay from "./ScanFeedbackOverlay";

const emit = (detail: ScanFeedbackDetail) =>
  act(() => {
    window.dispatchEvent(new CustomEvent(SCAN_FEEDBACK_EVENT, { detail }));
  });

beforeAll(async () => {
  await i18nReady;
  await i18n.changeLanguage("uz");
});

afterEach(() => vi.useRealTimers());

describe("ScanFeedbackOverlay (dizayn v2)", () => {
  it("shows the result with a tone icon and text, then hides it", () => {
    vi.useFakeTimers();
    renderWithProviders(<ScanFeedbackOverlay />);

    emit({ type: "missing", message: "Bu pochtada yo'q" });

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Bu pochtada yo'q");
    expect(status.querySelector(".bg-danger")).not.toBeNull();

    act(() => vi.advanceTimersByTime(1400));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("falls back to the default label per type", () => {
    renderWithProviders(<ScanFeedbackOverlay />);

    emit({ type: "duplicate" });

    expect(screen.getByRole("status")).toHaveTextContent("Allaqachon topilgan");
  });

  it("stays hidden while a camera is open — the camera shows the result itself", () => {
    renderWithProviders(<ScanFeedbackOverlay />);
    const unmount = markScannerCameraMounted();

    emit({ type: "success", message: "Skanerlandi" });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    unmount();
    emit({ type: "success", message: "Skanerlandi" });
    expect(screen.getByRole("status")).toHaveTextContent("Skanerlandi");
  });
});
