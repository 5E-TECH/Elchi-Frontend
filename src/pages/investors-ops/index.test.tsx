import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import InvestorsOpsPage from "./index";
import { renderWithProviders } from "../../test/test-utils";

const apiGetMock = vi.fn();
const apiPostMock = vi.fn();

vi.mock("../../shared/api/api", () => ({
  api: {
    get: (...a: unknown[]) => apiGetMock(...a),
    post: (...a: unknown[]) => apiPostMock(...a),
  },
}));

describe("InvestorsOps page", () => {
  beforeEach(() => {
    apiGetMock.mockResolvedValue({ data: [] });
    apiPostMock.mockResolvedValue({ data: { id: "x" } });
  });

  it("renders header \"Investorlar\"", () => {
    renderWithProviders(<InvestorsOpsPage />);
    expect(screen.getByText("Investorlar")).toBeInTheDocument();
  });

  it("calls api.get with \"investors\" on mount", async () => {
    renderWithProviders(<InvestorsOpsPage />);
    await waitFor(() =>
      expect(apiGetMock).toHaveBeenCalledWith("investors", expect.anything()),
    );
  });

  it("fills form and calls api.post with \"investors\"", async () => {
    const user = userEvent.setup();
    renderWithProviders(<InvestorsOpsPage />);

    await user.type(screen.getByLabelText("investor-name"), "Ali");
    await user.type(screen.getByLabelText("investor-phone"), "+998901112233");
    await user.click(screen.getByRole("button", { name: "Qo'shish" }));

    await waitFor(() =>
      expect(apiPostMock.mock.calls[0][0]).toBe("investors"),
    );
  });
});
