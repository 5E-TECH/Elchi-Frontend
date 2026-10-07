import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import OpsPage from "./index";
import { renderWithProviders } from "../../test/test-utils";

vi.mock("../identity-ops", () => ({
  default: () => {
    throw new Error("identity-ops crashed");
  },
}));

vi.mock("../branch-ops", () => ({
  default: () => <p>Filiallar tabi ishlayapti</p>,
}));

describe("Ops page — per-tab error boundary", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the error only in place of the crashed tab and keeps the hub usable", async () => {
    const replaceSpy = vi.fn();
    vi.stubGlobal("location", { ...window.location, replace: replaceSpy });
    const user = userEvent.setup();

    renderWithProviders(<OpsPage />, { route: "/ops?tab=identity" });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Bu bo'limni ochishda xatolik yuz berdi",
    );
    expect(screen.getByText("Ops vositalari")).toBeInTheDocument();
    expect(replaceSpy).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /Filiallar/ }));

    expect(await screen.findByText("Filiallar tabi ishlayapti")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});
