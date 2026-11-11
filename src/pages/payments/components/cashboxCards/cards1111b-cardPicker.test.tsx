import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import uz from "../../../../locales/uz/payments.json";
import ru from "../../../../locales/ru/payments.json";
import en from "../../../../locales/en/payments.json";
import { renderWithProviders } from "../../../../test/test-utils";
import { CARD_LIST, CARD_ROWS, manager, superadmin } from "../../../../test/cashboxCardFixtures";
import CashboxFormPopup, { type CashboxFormPayload } from "../CashboxFormPopup";

/**
 * cards1111b — BeePost kabi: «Karta (Click)» to'lovida pul QAYSI KARTAGA tushadi / QAYSI KARTADAN chiqadi.
 * Kirim / chiqim oynasi (`CashboxFormPopup withCards`): ro'yxat oyna ochilganda o'qiladi, faqat faol kartalar,
 * sukut — Asosiy karta (so'rovga `card_id` ketmaydi), nomli karta — `card_id`, tasdiqda «Karta» qatori; naqdda
 * maydon yo'q; faqat Asosiy karta bo'lsa maydon yo'q; nomli kartada yetmasa ogohlantirish; ro'yxat o'qilmasa —
 * sabab + «Qayta urinish», to'lov bloklanmaydi.
 */

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));

vi.mock("../../../../shared/api/api", () => ({
  api: http,
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));
vi.mock("../../../../entities/expense-category", () => ({
  useExpenseCategories: () => ({
    data: [{ id: "5", name: "Yoqilg'i", description: null }],
    isSuccess: true,
    isError: false,
    isLoading: false,
    refetch: vi.fn(),
  }),
}));

let cardList: unknown = CARD_LIST;
let cardsFail = false;

beforeEach(() => {
  cardList = CARD_LIST;
  cardsFail = false;
  http.get.mockReset();
  http.post.mockReset();
  http.patch.mockReset();
  http.get.mockImplementation(async (url: string) => {
    if (url === "finance/cashbox/cards") {
      if (cardsFail) throw Object.assign(new Error("Network Error"), { isAxiosError: true });
      return { data: { statusCode: 200, data: cardList } };
    }
    // Chek rasmi bu testlarda o'chiq (sukut — yoqiq).
    if (url === "finance/receipt-settings") {
      return {
        data: {
          statusCode: 200,
          data: {
            manual_expense: { photo_required: false, ai_enabled: false },
            hq_transfer: { photo_required: false, ai_enabled: false },
          },
        },
      };
    }
    return { data: { statusCode: 200, message: "success", data: {} } };
  });
});

const SOURCE_TYPES = [
  { id: "cash", name: "Naqd" },
  { id: "click", name: "Karta (Click)" },
];

const renderPopup = ({
  variant = "fill",
  onSubmit = vi.fn<(data: CashboxFormPayload) => void>(),
  state = superadmin,
  balanceVisible = true,
}: {
  variant?: "fill" | "spend";
  onSubmit?: ReturnType<typeof vi.fn<(data: CashboxFormPayload) => void>>;
  state?: never;
  balanceVisible?: boolean;
} = {}) => {
  renderWithProviders(
    <CashboxFormPopup
      isOpen
      onClose={() => {}}
      variant={variant}
      title={variant === "fill" ? "Kassani to'ldirish" : "Kassadan xarajat"}
      description="Asosiy kassa"
      submitLabel={variant === "fill" ? "Kirimni saqlash" : "Xarajatni saqlash"}
      sourceTypes={SOURCE_TYPES}
      requireType
      confirm={{ title: "Tasdiqlang", cashboxLabel: "Asosiy kassa" }}
      onSubmit={onSubmit}
      withCards
      balanceVisible={balanceVisible}
    />,
    { route: "/payments/main-cashbox", preloadedState: state },
  );
  return onSubmit;
};

const cardsGets = () => http.get.mock.calls.filter(([url]) => url === "finance/cashbox/cards");

const fillAmount = async (user: ReturnType<typeof userEvent.setup>, value: string) => {
  const dialog = await screen.findByRole("dialog");
  await user.type(within(dialog).getByRole("textbox", { name: /Summa/ }), value);
  return dialog;
};

const choosePayment = async (user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement, name: string) => {
  await user.click(within(dialog).getByRole("radio", { name }));
};

const chooseCard = async (user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement, field: RegExp, option: RegExp) => {
  await user.click(await within(dialog).findByRole("combobox", { name: field }));
  await user.click(await screen.findByRole("option", { name: option }));
};

describe("cards1111b — kirim / chiqimda karta tanlash", () => {
  it("reads only ACTIVE cards when the dialog opens; «Naqd» shows no card field", async () => {
    const user = userEvent.setup();
    renderPopup();
    const dialog = await fillAmount(user, "100000");

    await waitFor(() => expect(cardsGets()).toHaveLength(1));
    // Faqat faol kartalar (`include_inactive` yuborilmaydi), asosiy kassa doirasi (branch_id yo'q).
    expect(cardsGets()[0][1]).toEqual({ params: undefined });

    await choosePayment(user, dialog, "Naqd");
    expect(within(dialog).queryByRole("combobox", { name: /Qaysi kartaga/ })).not.toBeInTheDocument();
  });

  it("«Karta (Click)»: Asosiy karta is the default — no card_id is sent (backend default, behaviour unchanged)", async () => {
    const user = userEvent.setup();
    const onSubmit = renderPopup();
    const dialog = await fillAmount(user, "100000");
    await choosePayment(user, dialog, "Karta (Click)");

    const select = await within(dialog).findByRole("combobox", { name: /Qaysi kartaga/ });
    expect(select).toHaveTextContent("Asosiy karta (asosiy)");

    await user.type(within(dialog).getByRole("textbox", { name: /Izoh/ }), "Kirim");
    await user.click(within(dialog).getByRole("button", { name: "Kirimni saqlash" }));
    const confirm = await screen.findByRole("alertdialog", { name: "Tasdiqlang" });
    expect(within(confirm).getByText("Karta")).toBeInTheDocument();
    expect(within(confirm).getByText("Asosiy karta")).toBeInTheDocument();
    await user.click(within(confirm).getByRole("button", { name: "Tasdiqlash" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toEqual({ amount: 100_000, type: "click", comment: "Kirim" });
  });

  it("a named card is sent as card_id and shown in the confirm; archived cards are not offered", async () => {
    const user = userEvent.setup();
    const onSubmit = renderPopup();
    const dialog = await fillAmount(user, "250000");
    await choosePayment(user, dialog, "Karta (Click)");

    await user.click(await within(dialog).findByRole("combobox", { name: /Qaysi kartaga/ }));
    const list = await screen.findByRole("listbox");
    expect(within(list).getAllByRole("option").map((option) => option.textContent)).toEqual([
      expect.stringContaining("Asosiy karta (asosiy)"),
      expect.stringContaining("Humo virtual"),
      expect.stringContaining("Bo'sh karta"),
    ]);
    expect(within(list).getByRole("option", { name: /Humo virtual/ })).toHaveTextContent("•••• 4417");
    expect(within(list).queryByRole("option", { name: /Eski karta/ })).not.toBeInTheDocument();
    await user.click(within(list).getByRole("option", { name: /Humo virtual/ }));

    await user.type(within(dialog).getByRole("textbox", { name: /Izoh/ }), "Kirim");
    await user.click(within(dialog).getByRole("button", { name: "Kirimni saqlash" }));
    const confirm = await screen.findByRole("alertdialog", { name: "Tasdiqlang" });
    expect(within(confirm).getByText("Humo virtual")).toBeInTheDocument();
    await user.click(within(confirm).getByRole("button", { name: "Tasdiqlash" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toEqual({ amount: 250_000, type: "click", comment: "Kirim", card_id: "2" });
  });

  it("switching back to «Naqd» drops the chosen card from the payload", async () => {
    const user = userEvent.setup();
    const onSubmit = renderPopup();
    const dialog = await fillAmount(user, "50000");
    await choosePayment(user, dialog, "Karta (Click)");
    await chooseCard(user, dialog, /Qaysi kartaga/, /Humo virtual/);
    await choosePayment(user, dialog, "Naqd");

    await user.type(within(dialog).getByRole("textbox", { name: /Izoh/ }), "Naqd kirim");
    await user.click(within(dialog).getByRole("button", { name: "Kirimni saqlash" }));
    const confirm = await screen.findByRole("alertdialog", { name: "Tasdiqlang" });
    expect(within(confirm).queryByText("Karta")).not.toBeInTheDocument();
    await user.click(within(confirm).getByRole("button", { name: "Tasdiqlash" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toEqual({ amount: 50_000, type: "cash", comment: "Naqd kirim" });
  });

  it("spend: «Qaysi kartadan»; more than the named card holds — warned under the field", async () => {
    const user = userEvent.setup();
    const onSubmit = renderPopup({ variant: "spend" });
    const dialog = await fillAmount(user, "2000000");
    await choosePayment(user, dialog, "Karta (Click)");
    await chooseCard(user, dialog, /Qaysi kartadan/, /Humo virtual/);

    expect(within(dialog).getByText(/«Humo virtual» kartasida faqat 1\s850\s000/)).toBeInTheDocument();
    // Xato turibdi — saqlash tasdiq oynasini ochmaydi, so'rov ketmaydi, fokus karta maydonida.
    await user.click(within(dialog).getByRole("combobox", { name: /Xarajat kategoriyasi/ }));
    await user.click(await screen.findByRole("option", { name: /Yoqilg'i/ }));
    await user.click(within(dialog).getByRole("button", { name: "Xarajatni saqlash" }));
    await waitFor(() => expect(within(dialog).getByRole("combobox", { name: /Qaysi kartadan/ })).toHaveFocus());
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    // Asosiy karta — backend tekshirmaydi (card_id ketmaydi), ogohlantirish ham yo'q.
    await chooseCard(user, dialog, /Qaysi kartadan/, /Asosiy karta/);
    expect(within(dialog).queryByText(/kartasida faqat/)).not.toBeInTheDocument();

    await chooseCard(user, dialog, /Qaysi kartadan/, /Humo virtual/);
    const amount = within(dialog).getByRole("textbox", { name: /Summa/ });
    await user.clear(amount);
    await user.type(amount, "300000");
    expect(within(dialog).queryByText(/kartasida faqat/)).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Xarajatni saqlash" }));
    const confirm = await screen.findByRole("alertdialog", { name: "Tasdiqlang" });
    await user.click(within(confirm).getByRole("button", { name: "Tasdiqlash" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toEqual({
      amount: 300_000,
      type: "click",
      expense_category_id: "5",
      card_id: "2",
    });
  });

  it("only the Asosiy karta is active — no card field, payload unchanged", async () => {
    cardList = { ...CARD_LIST, cards: [CARD_ROWS[0], CARD_ROWS[3]] };
    const user = userEvent.setup();
    const onSubmit = renderPopup();
    const dialog = await fillAmount(user, "100000");
    await choosePayment(user, dialog, "Karta (Click)");
    await waitFor(() => expect(cardsGets()).toHaveLength(1));
    expect(within(dialog).queryByRole("combobox", { name: /Qaysi kartaga/ })).not.toBeInTheDocument();

    await user.type(within(dialog).getByRole("textbox", { name: /Izoh/ }), "Kirim");
    await user.click(within(dialog).getByRole("button", { name: "Kirimni saqlash" }));
    const confirm = await screen.findByRole("alertdialog", { name: "Tasdiqlang" });
    expect(within(confirm).queryByText("Karta")).not.toBeInTheDocument();
    await user.click(within(confirm).getByRole("button", { name: "Tasdiqlash" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty("card_id");
  });

  it("the card list fails — a reason with «Qayta urinish»; the payment is not blocked (goes to the Asosiy karta)", async () => {
    cardsFail = true;
    const user = userEvent.setup();
    const onSubmit = renderPopup();
    const dialog = await fillAmount(user, "100000");
    await choosePayment(user, dialog, "Karta (Click)");

    expect(await within(dialog).findByText("Kartalar yuklanmadi — pul asosiy kartaga yoziladi")).toBeInTheDocument();
    cardsFail = false;
    await user.click(within(dialog).getByRole("button", { name: "Qayta urinish" }));
    expect(await within(dialog).findByRole("combobox", { name: /Qaysi kartaga/ })).toHaveTextContent("Asosiy karta");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("hidden balances: card balances are masked in the options", async () => {
    const user = userEvent.setup();
    renderPopup({ balanceVisible: false });
    const dialog = await fillAmount(user, "100000");
    await choosePayment(user, dialog, "Karta (Click)");
    await user.click(await within(dialog).findByRole("combobox", { name: /Qaysi kartaga/ }));
    const option = await screen.findByRole("option", { name: /Humo virtual/ });
    expect(option).toHaveTextContent("Qoldiq: ••••••");
    expect(option).not.toHaveTextContent("1 850 000");
  });

  it("manager: the same field (own branch cards — JWT scope, no branch_id param)", async () => {
    const user = userEvent.setup();
    renderPopup({ state: manager });
    const dialog = await fillAmount(user, "100000");
    await choosePayment(user, dialog, "Karta (Click)");
    expect(await within(dialog).findByRole("combobox", { name: /Qaysi kartaga/ })).toBeInTheDocument();
    expect(cardsGets()[0][1]).toEqual({ params: undefined });
  });
});

describe("cards1111b — tarjimalar", () => {
  it("has the same picker keys in uz / ru / en", () => {
    const keys = (locale: { cashboxCards: { picker: Record<string, string> } }) =>
      Object.keys(locale.cashboxCards.picker).sort();
    expect(keys(ru)).toEqual(keys(uz));
    expect(keys(en)).toEqual(keys(uz));
    expect(uz.cashboxCards.picker.labelIn).toBe("Qaysi kartaga");
    expect(uz.cashboxCards.picker.labelOut).toBe("Qaysi kartadan");
  });
});
