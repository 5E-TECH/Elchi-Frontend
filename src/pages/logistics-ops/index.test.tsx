import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import LogisticsOpsPage from "./index";
import { renderWithProviders } from "../../test/test-utils";

const apiGetMock = vi.fn();
const apiPostMock = vi.fn();

vi.mock("../../shared/api/api", () => ({
  api: {
    get: (...a: unknown[]) => apiGetMock(...a),
    post: (...a: unknown[]) => apiPostMock(...a),
  },
}));

describe("LogisticsOps page", () => {
  beforeEach(() => {
    apiGetMock.mockResolvedValue({ data: [] });
    apiPostMock.mockResolvedValue({ data: {} });
  });

  it("renders header \"Logistika — qaytarish so'rovlari\"", () => {
    renderWithProviders(<LogisticsOpsPage />);
    expect(
      screen.getByText("Logistika — qaytarish so'rovlari"),
    ).toBeInTheDocument();
  });

  it("calls api.get with \"post/return-requests/list\" on mount", async () => {
    renderWithProviders(<LogisticsOpsPage />);
    await waitFor(() =>
      expect(apiGetMock).toHaveBeenCalledWith(
        "post/return-requests/list",
        expect.anything(),
      ),
    );
  });

  it("calls api.post with \"post/return-requests/approve\" when Tasdiqlash is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LogisticsOpsPage />);

    await user.click(screen.getByRole("button", { name: "Tasdiqlash" }));

    await waitFor(() => {
      expect(apiPostMock.mock.calls[0][0]).toBe("post/return-requests/approve");
    });
  });
});
