import { screen, waitFor, within } from "@testing-library/react";
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

const batchInput = () => screen.getByRole("textbox", { name: /Paket ID/ });
const reasonInput = () => screen.getByRole("textbox", { name: /Bekor qilish sababi/ });
const cancelButton = () => screen.getByRole("button", { name: "Paketni bekor qilish" });
const bodyRows = () => within(screen.getByRole("table", { name: "Yangi buyurtmali filiallar" })).getAllByRole("row").slice(1);

/** Tasdiq — `useConfirm` (`alertdialog`), maket matnlari: «Paketni bekor qilasizmi?» · «Yo'q» / «Ha, bekor qilish». */
const confirmCancel = async (user: ReturnType<typeof userEvent.setup>) => {
  const dialog = await screen.findByRole("alertdialog", { name: "Paketni bekor qilasizmi?" });
  expect(dialog).toHaveTextContent("Paket bekor qilinadi, undagi barcha buyurtmalar paketdan ajratiladi.");
  expect(within(dialog).getByRole("button", { name: "Yo'q" })).toBeInTheDocument();
  await user.click(within(dialog).getByRole("button", { name: "Ha, bekor qilish" }));
};

describe("BranchOps page", () => {
  beforeEach(() => {
    // Haqiqiy javob konverti: axios `res.data` = { statusCode, message, data: [...] }.
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    apiGetMock.mockResolvedValue({ data: { statusCode: 200, message: "Branches with NEW orders", data: [] } });
    apiPostMock.mockResolvedValue({ data: {} });
  });

  it("renders the intro \"Filiallar — operatsiyalar\" and the «← Ops vositalari» link on the direct route", () => {
    renderWithProviders(<BranchOpsPage />);
    expect(screen.getByRole("heading", { name: "Filiallar — operatsiyalar" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Filiallar" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ops vositalari/ })).toHaveAttribute("href", "/ops?tab=branches");
  });

  it("calls api.get with \"branches/new-orders\" on mount", async () => {
    renderWithProviders(<BranchOpsPage />);
    await waitFor(() =>
      expect(apiGetMock).toHaveBeenCalledWith("branches/new-orders", expect.anything()),
    );
  });

  it("⭐ jadval konvert ichidagi `data` massivini ko'rsatadi (bo'sh holat emas)", async () => {
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
    expect(screen.getByText("7 ta")).toBeInTheDocument();
    expect(bodyRows()).toHaveLength(2);
    expect(screen.queryByText("Yangi buyurtmali filial yo'q")).not.toBeInTheDocument();
  });

  it("bo'sh konvert — bo'sh holat, xato emas", async () => {
    renderWithProviders(<BranchOpsPage />);
    expect(await screen.findByText("Yangi buyurtmali filial yo'q")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps the cancel button disabled and sends nothing while the reason is empty", async () => {
    const user = userEvent.setup();
    renderWithProviders(<BranchOpsPage />);

    await user.type(batchInput(), "b1");
    expect(cancelButton()).toBeDisabled();

    await user.click(cancelButton());
    expect(apiPostMock).not.toHaveBeenCalled();
  });

  it("warns on the client when the reason is shorter than 10 characters; shows the counter otherwise", async () => {
    const user = userEvent.setup();
    renderWithProviders(<BranchOpsPage />);

    await user.type(batchInput(), "b1");
    await user.type(reasonInput(), "qisqa");

    expect(screen.getByText(/kamida 10 ta belgidan iborat/)).toBeInTheDocument();
    expect(cancelButton()).toBeDisabled();
    expect(apiPostMock).not.toHaveBeenCalled();

    await user.type(reasonInput(), " emas, yetarli");
    expect(screen.getByText("19 ta belgi · kamida 10 ta")).toBeInTheDocument();
  });

  it("posts {reason} to \"transfer-batches/b1/cancel\" only after the confirmation", async () => {
    const user = userEvent.setup();
    renderWithProviders(<BranchOpsPage />);

    await user.type(batchInput(), "b1");
    await user.type(reasonInput(), "Noto'g'ri viloyatga yuborilgan");
    await user.click(cancelButton());

    expect(await screen.findByRole("alertdialog", { name: "Paketni bekor qilasizmi?" })).toBeInTheDocument();
    expect(apiPostMock).not.toHaveBeenCalled();

    await confirmCancel(user);

    await waitFor(() =>
      expect(apiPostMock).toHaveBeenCalledWith("transfer-batches/b1/cancel", {
        reason: "Noto'g'ri viloyatga yuborilgan",
      }),
    );
    expect(await screen.findByText("Paket muvaffaqiyatli bekor qilindi")).toBeInTheDocument();
  });

  it("«Yo'q» — nothing is sent", async () => {
    const user = userEvent.setup();
    renderWithProviders(<BranchOpsPage />);

    await user.type(batchInput(), "b1");
    await user.type(reasonInput(), "Noto'g'ri viloyatga yuborilgan");
    await user.click(cancelButton());
    const dialog = await screen.findByRole("alertdialog", { name: "Paketni bekor qilasizmi?" });
    await user.click(within(dialog).getByRole("button", { name: "Yo'q" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(apiPostMock).not.toHaveBeenCalled();
  });

  it("shows the backend message when the cancel request fails with 400", async () => {
    apiPostMock.mockRejectedValue({
      response: { status: 400, data: { message: "Partiya allaqachon bekor qilingan" } },
    });
    const user = userEvent.setup();
    renderWithProviders(<BranchOpsPage />);

    await user.type(batchInput(), "b1");
    await user.type(reasonInput(), "Noto'g'ri viloyatga yuborilgan");
    await user.click(cancelButton());
    await confirmCancel(user);

    expect(await screen.findByText("Partiya allaqachon bekor qilingan")).toBeInTheDocument();
  });

  describe("qabul mezonlari", () => {
    const fillCancelForm = async (user: ReturnType<typeof userEvent.setup>, reason: string) => {
      await user.type(batchInput(), "18");
      await user.type(reasonInput(), reason);
    };

    it("⭐ render: sabab 10 belgidan qisqa bo'lsa \"Bekor qilish\" tugmasi disabled (chegara 9/10, bo'sh joy sanalmaydi)", async () => {
      const user = userEvent.setup();
      renderWithProviders(<BranchOpsPage />);
      await fillCancelForm(user, "123456789");
      expect(cancelButton()).toBeDisabled();

      await user.type(reasonInput(), "0");
      expect(cancelButton()).toBeEnabled();

      await user.clear(reasonInput());
      await user.type(reasonInput(), "   qisqa      ");
      expect(cancelButton()).toBeDisabled();
      expect(apiPostMock).not.toHaveBeenCalled();
    });

    it.each([
      ["satr", "reason must be longer than or equal to 10 characters", "reason must be longer than or equal to 10 characters"],
      ["massiv (class-validator)", ["reason must be a string", "reason must be longer than or equal to 10 characters"], "reason must be a string, reason must be longer than or equal to 10 characters"],
    ])("⭐ integratsiya: 400 javobda xato ogohlantirishi, matni serverdan kelgan message (%s)", async (_kind, message, expected) => {
      apiPostMock.mockRejectedValue({ isAxiosError: true, response: { status: 400, data: { statusCode: 400, message } } });
      const user = userEvent.setup();
      renderWithProviders(<BranchOpsPage />);
      await fillCancelForm(user, "Noto'g'ri viloyatga yuborilgan");
      await user.click(cancelButton());
      await confirmCancel(user);

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("Paketni bekor qilib bo'lmadi");
      expect(alert).toHaveTextContent(expected);
      expect(screen.queryByText("Paket muvaffaqiyatli bekor qilindi")).toBeNull();
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

      await screen.findByText("Urganch filiali");
      const rows = bodyRows();
      expect(rows).toHaveLength(1);
      expect(within(rows[0]).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["12", "Urganch filiali", "7 ta"]);
    });
  });
});
