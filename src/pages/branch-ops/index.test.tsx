import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import BranchOpsPage from "./index";
import { renderWithProviders } from "../../test/test-utils";

const apiGetMock = vi.fn();
const apiPostMock = vi.fn();

vi.mock("../../shared/api/api", () => ({
  api: {
    get: (...a: unknown[]) => apiGetMock(...a),
    post: (...a: unknown[]) => apiPostMock(...a),
  },
}));

describe("BranchOps page", () => {
  beforeEach(() => {
    apiGetMock.mockResolvedValue({ data: [] });
    apiPostMock.mockResolvedValue({ data: {} });
  });

  it("renders header \"Filiallar — operatsiyalar\"", () => {
    renderWithProviders(<BranchOpsPage />);
    expect(screen.getByText("Filiallar — operatsiyalar")).toBeInTheDocument();
  });

  it("calls api.get with \"branches/new-orders\" on mount", async () => {
    renderWithProviders(<BranchOpsPage />);
    await waitFor(() =>
      expect(apiGetMock).toHaveBeenCalledWith("branches/new-orders", expect.anything()),
    );
  });

  it("calls api.post with \"transfer-batches/b1/cancel\" when batch-id is b1 and button clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<BranchOpsPage />);

    await user.type(screen.getByLabelText("batch-id"), "b1");
    await user.click(screen.getByRole("button", { name: "Batchni bekor qilish" }));

    await waitFor(() =>
      expect(apiPostMock.mock.calls[0][0]).toBe("transfer-batches/b1/cancel"),
    );
  });
});
