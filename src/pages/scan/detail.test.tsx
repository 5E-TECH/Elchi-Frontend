import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import ScanDetailPage from "./detail";
import { renderWithProviders } from "../../test/test-utils";

const navigateMock = vi.fn();
const feedbackMock = vi.fn();
const assignMock = vi.fn();

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
  fetchScanDetail: () =>
    Promise.resolve({
      type: "order",
      data: { id: "1251175", status: "waiting", customer: { name: "Ali Valiyev" }, items: [] },
    }),
  scanAssignOrder: (...args: unknown[]) => assignMock(...args),
}));

const hidScan = (value: string) =>
  act(() => {
    for (const key of value) window.dispatchEvent(new KeyboardEvent("keydown", { key }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
  });

const renderDetail = (role = "admin") =>
  renderWithProviders(
    <Routes>
      <Route path="/scan/:token" element={<ScanDetailPage />} />
    </Routes>,
    {
      route: "/scan/PARCEL-A",
      preloadedState: { role: { id: `${role}-1`, role, region: null, name: role } } as never,
    },
  );

describe("ScanDetailPage — next scan from the detail page", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    feedbackMock.mockReset();
    assignMock.mockReset();
  });

  it("opens the next scanned parcel instead of losing the scan silently", async () => {
    renderDetail();
    await screen.findByText("Skanerlangan buyurtma");

    hidScan("PARCEL-B");

    expect(navigateMock).toHaveBeenCalledWith("/scan/PARCEL-B");
    expect(feedbackMock).toHaveBeenCalledWith("success");
  });

  it("treats a re-scan of the open parcel as a duplicate, not a navigation", async () => {
    renderDetail();
    await screen.findByText("Skanerlangan buyurtma");

    hidScan("PARCEL-A");

    expect(navigateMock).not.toHaveBeenCalled();
    expect(feedbackMock).toHaveBeenCalledWith("duplicate");
  });

  it("asks to wait while the courier's 'take it' request is still running", async () => {
    const user = userEvent.setup();
    assignMock.mockReturnValue(new Promise(() => undefined));
    renderDetail("courier");

    await user.click(await screen.findByRole("button", { name: /O'ZIMGA OLISH/ }));
    hidScan("PARCEL-B");

    expect(navigateMock).not.toHaveBeenCalled();
    expect(feedbackMock).toHaveBeenCalledWith("error", "Amal tugashini kuting, keyin keyingi posilkani skanerlang.");
  });
});
