import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import FinanceOperatorsPage from "./index";
import { renderWithProviders } from "../../test/test-utils";

const apiGetMock = vi.fn();
const apiPostMock = vi.fn();

vi.mock("../../shared/api/api", () => ({
  api: {
    get: (...args: unknown[]) => apiGetMock(...args),
    post: (...args: unknown[]) => apiPostMock(...args),
  },
}));

/** Backend `origin/main` konverti: `{ statusCode, message, data }`; ro'yxatlar — `{ rows, total, limit, offset }`. */
const envelope = (data: unknown) => ({ data: { statusCode: 200, message: "ok", data } });

const loadOperator = async (user: ReturnType<typeof userEvent.setup>, id = "1042") => {
  await user.type(screen.getByRole("textbox", { name: "Operator ID" }), id);
  await user.click(screen.getByRole("button", { name: "Yuklash" }));
};

describe("Finance operators page (dizayn v2)", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    apiGetMock.mockImplementation((url: string) => {
      if (url.endsWith("/balance")) return Promise.resolve(envelope({ operator_id: "1042", earned: 1484000, paid: 1200000, balance: 284000 }));
      if (url.endsWith("/earnings"))
        return Promise.resolve(
          envelope({ rows: [{ id: "e1", order_id: "10241", amount: 18000, createdAt: "2026-10-06T14:40:00Z" }], total: 82, limit: 5, offset: 0 }),
        );
      if (url.endsWith("/payments"))
        return Promise.resolve(
          envelope({ rows: [{ id: "p1", amount: 200000, note: "Oktabr, 1-qism", createdAt: "2026-10-06T14:20:00Z" }], total: 1, limit: 10, offset: 0 }),
        );
      return Promise.resolve({ data: {} });
    });
    apiPostMock.mockResolvedValue({ data: { statusCode: 201, data: { id: "pay1" } } });
  });

  it("kirish kartasi: sarlavha va operator qidiruvi", () => {
    renderWithProviders(<FinanceOperatorsPage />);
    expect(screen.getByRole("heading", { name: "Operator hisob-kitobi" })).toBeInTheDocument();
    expect(screen.getByRole("search", { name: "Operatorni yuklash" })).toBeInTheDocument();
  });

  it("to'g'ridan-to'g'ri yo'lda — sarlavha va «← Ops vositalari»; hub ichida (`embedded`) — sarlavhasiz", () => {
    const { unmount } = renderWithProviders(<FinanceOperatorsPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Moliya operatorlari" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ops vositalari/ })).toHaveAttribute("href", "/ops?tab=finance");
    unmount();

    renderWithProviders(<FinanceOperatorsPage embedded />);
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    expect(screen.queryByRole("link", { name: /Ops vositalari/ })).toBeNull();
  });

  it("raqam bo'lmagan ID so'rov yubormaydi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<FinanceOperatorsPage />);
    await user.type(screen.getByRole("textbox", { name: "Operator ID" }), " ");
    await user.click(screen.getByRole("button", { name: "Yuklash" }));
    expect(await screen.findByText("Operator ID faqat raqamlardan iborat bo'lishi kerak")).toBeInTheDocument();
    expect(apiGetMock).not.toHaveBeenCalled();
  });

  it("operator balansi GET orqali yuklanadi: qoldiq, ishlab topgan, to'langan va to'langan ulushi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<FinanceOperatorsPage />);
    await loadOperator(user);

    await waitFor(() => expect(apiGetMock).toHaveBeenCalledWith("finance/operators/1042/balance"));
    const card = (await screen.findByRole("heading", { name: "Operator 1042 balansi" })).closest("section") as HTMLElement;
    expect(within(card).getByText("Operatorga to'lanishi kerak")).toBeInTheDocument();
    expect(within(card).getByText("1 484 000 so'm")).toBeInTheDocument();
    expect(within(card).getByText("−1 200 000 so'm")).toBeInTheDocument();
    expect(within(card).getByText("284 000 so'm")).toBeInTheDocument();
    expect(within(card).getByRole("meter", { name: "Ishlab topilganning 80,9% to'langan" })).toBeInTheDocument();

    // Daromadlar sahifalab (5 tadan, offset), to'lovlar tarixi (izoh — `note`).
    expect(apiGetMock).toHaveBeenCalledWith("finance/operators/1042/earnings", { params: { limit: 5, offset: 0 } });
    expect(await screen.findByRole("link", { name: "№10241" })).toHaveAttribute("href", "/orders/edit/10241");
    expect(screen.getByText("1–5 / 82 ta")).toBeInTheDocument();
    expect(await screen.findByText("Oktabr, 1-qism")).toBeInTheDocument();
    expect(screen.getByText("1 ta to'lov")).toBeInTheDocument();
  });

  it("to'lov tasdiqsiz yuborilmaydi; tasdiqdan keyin `{ operator_id, amount, note }` + Idempotency-Key", async () => {
    const user = userEvent.setup();
    renderWithProviders(<FinanceOperatorsPage />);
    await loadOperator(user);

    await user.type(await screen.findByRole("textbox", { name: /Summa \(so'm\)/ }), "50000");
    await user.type(screen.getByRole("textbox", { name: "Izoh" }), "oylik avans");
    await user.click(screen.getByRole("button", { name: "To'lovni saqlash" }));

    const dialog = await screen.findByRole("alertdialog", { name: "To'lovni qayd qilasizmi?" });
    expect(dialog).toHaveTextContent("50 000");
    expect(apiPostMock).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "To'lovni saqlash" }));

    await waitFor(() =>
      expect(apiPostMock).toHaveBeenCalledWith(
        "finance/operator-payments",
        { operator_id: "1042", amount: 50000, note: "oylik avans" },
        { headers: { "Idempotency-Key": expect.any(String) } },
      ),
    );
    expect(await screen.findByText("To'lov qayd qilindi")).toBeInTheDocument();
  });

  it("tasdiq oynasida «Bekor qilish» — so'rov ketmaydi; bo'sh summa — xato, oyna ochilmaydi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<FinanceOperatorsPage />);
    await loadOperator(user);

    await user.click(await screen.findByRole("button", { name: "To'lovni saqlash" }));
    expect(await screen.findByText("Summani kiriting")).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).toBeNull();

    await user.type(screen.getByRole("textbox", { name: /Summa \(so'm\)/ }), "1000");
    await user.click(screen.getByRole("button", { name: "To'lovni saqlash" }));
    const dialog = await screen.findByRole("alertdialog", { name: "To'lovni qayd qilasizmi?" });
    await user.click(within(dialog).getByRole("button", { name: "Bekor qilish" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(apiPostMock).not.toHaveBeenCalled();
  });

  it("xato bo'lsa qayta urinishda o'sha Idempotency-Key ishlatiladi (ikki marta yozilmaydi)", async () => {
    const user = userEvent.setup();
    apiPostMock.mockRejectedValueOnce({ response: { status: 504, data: { message: "Finance service response timeout" } } });
    renderWithProviders(<FinanceOperatorsPage />);
    await loadOperator(user);

    await user.type(await screen.findByRole("textbox", { name: /Summa \(so'm\)/ }), "1000");
    await user.click(screen.getByRole("button", { name: "To'lovni saqlash" }));
    const dialog = await screen.findByRole("alertdialog", { name: "To'lovni qayd qilasizmi?" });
    await user.click(within(dialog).getByRole("button", { name: "To'lovni saqlash" }));
    await waitFor(() => expect(apiPostMock).toHaveBeenCalledTimes(1));
    // Xato oyna ichida — qayta bosish o'sha kalit bilan.
    await user.click(await within(dialog).findByRole("button", { name: "To'lovni saqlash" }));
    await waitFor(() => expect(apiPostMock).toHaveBeenCalledTimes(2));

    const [first, second] = apiPostMock.mock.calls.map((call) => (call[2] as { headers: Record<string, string> }).headers["Idempotency-Key"]);
    expect(first).toBe(second);
  });
});
