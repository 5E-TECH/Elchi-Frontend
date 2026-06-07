import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import SystemOpsPage from "./index";
import { renderWithProviders } from "../../test/test-utils";

const apiGetMock = vi.fn();

vi.mock("../../shared/api/api", () => ({
  api: { get: (...a: unknown[]) => apiGetMock(...a) },
}));

describe("SystemOps page", () => {
  beforeEach(() => {
    apiGetMock.mockResolvedValue({ data: {} });
  });

  it("renders header \"Tizim — analitika va xizmatlar\"", () => {
    renderWithProviders(<SystemOpsPage />);
    expect(
      screen.getByText("Tizim — analitika va xizmatlar"),
    ).toBeInTheDocument();
  });

  it("calls api.get with \"analytics/kpi\" on mount", async () => {
    renderWithProviders(<SystemOpsPage />);
    await waitFor(() =>
      expect(apiGetMock).toHaveBeenCalledWith("analytics/kpi", expect.anything()),
    );
  });

  it("types scan token and clicks Tekshirish — calls api.get with scan/t1", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SystemOpsPage />);

    await user.type(screen.getByLabelText("scan-token"), "t1");
    await user.click(screen.getByRole("button", { name: "Tekshirish" }));

    await waitFor(() =>
      expect(apiGetMock).toHaveBeenCalledWith("scan/t1"),
    );
  });
});
