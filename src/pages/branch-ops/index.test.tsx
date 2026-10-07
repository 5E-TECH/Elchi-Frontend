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

  it("keeps the cancel button disabled and sends nothing while the reason is empty", async () => {
    const user = userEvent.setup();
    renderWithProviders(<BranchOpsPage />);

    await user.type(screen.getByLabelText("batch-id"), "b1");
    const button = screen.getByRole("button", { name: "Batchni bekor qilish" });
    expect(button).toBeDisabled();

    await user.click(button);
    expect(apiPostMock).not.toHaveBeenCalled();
  });

  it("warns on the client when the reason is shorter than 10 characters", async () => {
    const user = userEvent.setup();
    renderWithProviders(<BranchOpsPage />);

    await user.type(screen.getByLabelText("batch-id"), "b1");
    await user.type(screen.getByLabelText("Bekor qilish sababi"), "qisqa");

    expect(screen.getByText(/kamida 10 ta belgidan iborat/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Batchni bekor qilish" })).toBeDisabled();
    expect(apiPostMock).not.toHaveBeenCalled();
  });

  it("posts {reason} to \"transfer-batches/b1/cancel\" after the confirmation", async () => {
    const user = userEvent.setup();
    renderWithProviders(<BranchOpsPage />);

    await user.type(screen.getByLabelText("batch-id"), "b1");
    await user.type(screen.getByLabelText("Bekor qilish sababi"), "Noto'g'ri viloyatga yuborilgan");
    await user.click(screen.getByRole("button", { name: "Batchni bekor qilish" }));

    expect(
      await screen.findByText("Partiya va undagi barcha buyurtmalar bog'lanishdan chiqariladi"),
    ).toBeInTheDocument();
    expect(apiPostMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Ha, bekor qilish" }));

    await waitFor(() =>
      expect(apiPostMock).toHaveBeenCalledWith("transfer-batches/b1/cancel", {
        reason: "Noto'g'ri viloyatga yuborilgan",
      }),
    );
    expect(await screen.findByText("Partiya muvaffaqiyatli bekor qilindi")).toBeInTheDocument();
  });

  it("shows the backend message when the cancel request fails with 400", async () => {
    apiPostMock.mockRejectedValue({
      response: { status: 400, data: { message: "Partiya allaqachon bekor qilingan" } },
    });
    const user = userEvent.setup();
    renderWithProviders(<BranchOpsPage />);

    await user.type(screen.getByLabelText("batch-id"), "b1");
    await user.type(screen.getByLabelText("Bekor qilish sababi"), "Noto'g'ri viloyatga yuborilgan");
    await user.click(screen.getByRole("button", { name: "Batchni bekor qilish" }));
    await user.click(await screen.findByRole("button", { name: "Ha, bekor qilish" }));

    expect(await screen.findByText("Partiya allaqachon bekor qilingan")).toBeInTheDocument();
  });
});
