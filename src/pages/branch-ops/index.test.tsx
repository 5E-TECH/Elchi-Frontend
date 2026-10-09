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
    // Haqiqiy javob konverti: axios `res.data` = { statusCode, message, data: [...] }.
    apiGetMock.mockResolvedValue({ data: { statusCode: 200, message: "Branches with NEW orders", data: [] } });
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

  it("⭐ jadval konvert ichidagi `data` massivini ko'rsatadi (\"Ma'lumot topilmadi\" emas)", async () => {
    apiGetMock.mockResolvedValue({
      data: {
        statusCode: 200,
        message: "Branches with NEW orders",
        data: [
          { id: "12", name: "Urganch filiali", type: "REGIONAL", new_orders_count: 7 },
          { id: "15", name: "Xiva filiali", type: "PICKUP", new_orders_count: 2 },
        ],
      },
    });
    renderWithProviders(<BranchOpsPage />);

    expect(await screen.findByText("Urganch filiali")).toBeInTheDocument();
    expect(screen.getByText("Xiva filiali")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(document.querySelectorAll(".ant-table-tbody tr.ant-table-row")).toHaveLength(2);
    expect(screen.queryByText(/Ma'lumot topilmadi|No data/)).not.toBeInTheDocument();
  });

  it("bo'sh konvert — bo'sh jadval, xato emas", async () => {
    renderWithProviders(<BranchOpsPage />);
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled());
    expect(document.querySelectorAll(".ant-table-tbody tr.ant-table-row")).toHaveLength(0);
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

  describe("qabul mezonlari", () => {
    const cancelButton = () => screen.getByRole("button", { name: "Batchni bekor qilish" });
    const fillCancelForm = async (user: ReturnType<typeof userEvent.setup>, reason: string) => {
      await user.type(screen.getByLabelText("batch-id"), "18");
      await user.type(screen.getByLabelText("Bekor qilish sababi"), reason);
    };

    it("⭐ render: sabab 10 belgidan qisqa bo'lsa \"Bekor qilish\" tugmasi disabled (chegara 9/10, bo'sh joy sanalmaydi)", async () => {
      const user = userEvent.setup();
      renderWithProviders(<BranchOpsPage />);
      await fillCancelForm(user, "123456789");
      expect(cancelButton()).toBeDisabled();

      await user.type(screen.getByLabelText("Bekor qilish sababi"), "0");
      expect(cancelButton()).toBeEnabled();

      await user.clear(screen.getByLabelText("Bekor qilish sababi"));
      await user.type(screen.getByLabelText("Bekor qilish sababi"), "   qisqa      ");
      expect(cancelButton()).toBeDisabled();
      expect(apiPostMock).not.toHaveBeenCalled();
    });

    it.each([
      ["satr", "reason must be longer than or equal to 10 characters", "reason must be longer than or equal to 10 characters"],
      ["massiv (class-validator)", ["reason must be a string", "reason must be longer than or equal to 10 characters"], "reason must be a string, reason must be longer than or equal to 10 characters"],
    ])("⭐ integratsiya: 400 javobda xato Alert'i, matni serverdan kelgan message (%s)", async (_kind, message, expected) => {
      apiPostMock.mockRejectedValue({ isAxiosError: true, response: { status: 400, data: { statusCode: 400, message } } });
      const user = userEvent.setup();
      renderWithProviders(<BranchOpsPage />);
      await fillCancelForm(user, "Noto'g'ri viloyatga yuborilgan");
      await user.click(cancelButton());
      await user.click(await screen.findByRole("button", { name: "Ha, bekor qilish" }));

      await waitFor(() => expect(document.querySelector(".ant-alert-error")).not.toBeNull());
      const alert = document.querySelector<HTMLElement>(".ant-alert-error")!;
      expect(alert).toHaveTextContent("Partiyani bekor qilib bo'lmadi");
      expect(alert).toHaveTextContent(expected);
      expect(document.querySelector(".ant-alert-success")).toBeNull();
    });

    it("⭐ integratsiya: {statusCode,message,data:[{id,name,new_orders_count}]} — jadvalda 1 qator", async () => {
      apiGetMock.mockResolvedValue({
        data: {
          statusCode: 200,
          message: "Branches with NEW orders",
          data: [{ id: "12", name: "Urganch filiali", new_orders_count: 7 }],
        },
      });
      renderWithProviders(<BranchOpsPage />);

      await waitFor(() =>
        expect(document.querySelectorAll(".ant-table-tbody tr.ant-table-row")).toHaveLength(1),
      );
      const cells = Array.from(
        document.querySelectorAll(".ant-table-tbody tr.ant-table-row td"),
        (cell) => cell.textContent,
      );
      expect(cells).toEqual(["12", "Urganch filiali", "7"]);
    });
  });
});
