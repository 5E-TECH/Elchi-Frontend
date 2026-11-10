import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { renderWithProviders } from "../../../../test/test-utils";
import { CARD_LIST, OPEN_SHIFT, admin, httpError, money, superadmin } from "../../../../test/cashboxCardFixtures";
import { shiftCheckSettingsKey } from "../../../../entities/payments/shiftAccountCheck";
import { CashboxCardsDialog } from "./CashboxCardsDialog";

/**
 * cards1111 — kartalar oynasidagi yozuvlar: karta qo'shish (POST tanasi; admin formasida smena kalitlari yo'q),
 * kartalararo o'tkazma (POST + `Idempotency-Key`), o'chirish (qoldiq 0 — bo'sh tana; qoldiq bor — `move_to` karta / naqd),
 * backend xatosi oyna ichida aynan.
 */

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));

vi.mock("../../../../shared/api/api", () => ({
  api: http,
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));

const TITLE = "Kartalar va hisob raqamlar";

beforeEach(() => {
  sessionStorage.clear();
  http.get.mockReset();
  http.post.mockReset();
  http.patch.mockReset();
  http.get.mockImplementation(async (url: string) => {
    if (url === "finance/cashbox/cards") return { data: { statusCode: 200, data: CARD_LIST } };
    if (url === "finance/shift/current") return { data: { statusCode: 200, data: OPEN_SHIFT } };
    return { data: { statusCode: 200, message: "success", data: {} } };
  });
  http.post.mockImplementation(async (url: string) => ({
    data: { statusCode: url === "finance/cashbox/cards" ? 201 : 200, message: "ok", data: { idempotent: false } },
  }));
  http.patch.mockImplementation(async () => ({ data: { statusCode: 200, message: "ok", data: {} } }));
});

const renderDialog = async (state: never = superadmin) => {
  renderWithProviders(<CashboxCardsDialog open onClose={() => {}} cashBalance={18_240_000} />, {
    route: "/payments/main-cashbox",
    preloadedState: state,
  });
  const dialog = await screen.findByRole("dialog", { name: TITLE });
  await within(dialog).findByText("Humo virtual");
  return dialog;
};

const openMenuItem = async (user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement, card: string, item: string) => {
  await user.click(within(dialog).getByRole("button", { name: `«${card}» amallari` }));
  const menu = await screen.findByRole("menu", { name: `«${card}» amallari` });
  await user.click(within(menu).getByRole("menuitem", { name: item }));
};

const choose = async (user: ReturnType<typeof userEvent.setup>, scope: HTMLElement, field: RegExp, option: RegExp) => {
  await user.click(within(scope).getByRole("combobox", { name: field }));
  await user.click(await screen.findByRole("option", { name: option }));
};

const postCalls = (url: string) => http.post.mock.calls.filter(([postUrl]) => postUrl === url);
const cardsGets = () => http.get.mock.calls.filter(([url]) => url === "finance/cashbox/cards").length;
const keyOf = (call: unknown[]) => (call[2] as { headers: Record<string, string> }).headers["Idempotency-Key"];
/**
 * `paymentIdempotency` dagi javobsiz kalit (barmoq izi bo'yicha). Ombor xotirada ham nusxa saqlaydi (oldingi testlarning
 * kalitlari qolishi mumkin) — shuning uchun faqat shu amalning izi tekshiriladi.
 */
const pendingKey = (fingerprint: unknown[]): string | undefined =>
  (JSON.parse(sessionStorage.getItem("elchi:pending-courier-payment-keys") ?? "{}") as Record<string, string>)[
    JSON.stringify(fingerprint)
  ];
const TRANSFER_FP = ["card-transfer", "2", "1", 500_000];
const DELETE_EMPTY_FP = ["card-delete", "3", null, null, 0];
const UNCERTAIN = /Javob kelmadi/;

describe("cards1111 — kartalar: yozuvlar", () => {
  it("add card: superadmin form posts the typed fields (and the shift photo flag)", async () => {
    const user = userEvent.setup();
    const dialog = await renderDialog();
    await user.click(within(dialog).getByRole("button", { name: "Karta qo'shish" }));
    const form = await screen.findByRole("dialog", { name: "Karta yoki hisob raqam qo'shish" });

    await user.click(within(form).getByRole("radio", { name: /Plastik karta/ }));
    await user.type(within(form).getByRole("textbox", { name: /Nomi/ }), "Visa virtual");
    await user.type(within(form).getByRole("textbox", { name: /^Bank/ }), "Kapitalbank");
    await user.type(within(form).getByRole("textbox", { name: /Karta tizimi/ }), "Visa");
    // Boshida nol: «0457» (aynan shunday saqlanadi — `mode="number"` nolni yo'qotardi).
    await user.type(within(form).getByRole("textbox", { name: /Oxirgi 4 raqam/ }), "04");
    await user.type(within(form).getByRole("textbox", { name: /Egasi/ }), "Dilnoza Karimova");

    const photo = within(form).getByRole("switch", { name: /Qoldiq rasmini/ });
    const ai = within(form).getByRole("switch", { name: /AI bilan tekshirish/ });
    expect(ai).toBeDisabled();
    await user.click(photo);
    expect(ai).toBeEnabled();

    // Oxirgi 4 raqam — aynan 4 ta yoki bo'sh.
    await user.click(within(form).getByRole("button", { name: "Saqlash" }));
    expect(await within(form).findByText("Aynan 4 ta raqam kiriting yoki bo'sh qoldiring")).toBeInTheDocument();
    expect(postCalls("finance/cashbox/cards")).toHaveLength(0);

    const last4 = within(form).getByRole("textbox", { name: /Oxirgi 4 raqam/ });
    expect(last4).toHaveValue("04");
    expect(last4).toHaveAttribute("inputmode", "numeric");
    await user.type(last4, "57x9");
    expect(last4).toHaveValue("0457");
    await user.click(within(form).getByRole("button", { name: "Saqlash" }));

    await waitFor(() => expect(postCalls("finance/cashbox/cards")).toHaveLength(1));
    expect(postCalls("finance/cashbox/cards")[0][1]).toEqual({
      name: "Visa virtual",
      kind: "plastic_card",
      bank_name: "Kapitalbank",
      card_network: "Visa",
      last4: "0457",
      holder_name: "Dilnoza Karimova",
      require_photo_on_shift_close: true,
    });
    expect(await screen.findByText("Karta qo'shildi")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Karta yoki hisob raqam qo'shish" })).not.toBeInTheDocument());
  });

  it("admin: the form has no shift switches and never sends the shift flags", async () => {
    const user = userEvent.setup();
    const dialog = await renderDialog(admin);
    await user.click(within(dialog).getByRole("button", { name: "Karta qo'shish" }));
    const form = await screen.findByRole("dialog", { name: "Karta yoki hisob raqam qo'shish" });

    expect(within(form).queryByText("Smena yopilganda")).not.toBeInTheDocument();
    expect(within(form).queryByRole("switch", { name: /Qoldiq rasmini/ })).not.toBeInTheDocument();
    expect(within(form).queryByRole("switch", { name: /AI/ })).not.toBeInTheDocument();
    // «Asosiy karta qilish» — bor (yaratishda `make_default`).
    const makeDefault = within(form).getByRole("checkbox", { name: "Asosiy karta qilish" });
    expect(makeDefault).toHaveAccessibleDescription(/Hozir asosiy: «Asosiy karta»/);
    await user.click(makeDefault);

    await user.type(within(form).getByRole("textbox", { name: /Nomi/ }), "Uzcard plastik");
    await user.click(within(form).getByRole("button", { name: "Saqlash" }));
    await waitFor(() => expect(postCalls("finance/cashbox/cards")).toHaveLength(1));
    expect(postCalls("finance/cashbox/cards")[0][1]).toEqual({
      name: "Uzcard plastik",
      kind: "virtual_card",
      make_default: true,
    });
  });

  it("admin edit sends only the changed fields (PATCH), no shift flags", async () => {
    const user = userEvent.setup();
    const dialog = await renderDialog(admin);
    await openMenuItem(user, dialog, "Humo virtual", "Tahrirlash");
    const form = await screen.findByRole("dialog", { name: "Kartani tahrirlash" });
    const holder = within(form).getByRole("textbox", { name: /Egasi/ });
    await user.clear(holder);
    await user.type(within(form).getByRole("textbox", { name: /Izoh/ }), "Kuryer to'lovlari");
    await user.click(within(form).getByRole("button", { name: "Saqlash" }));

    await waitFor(() => expect(http.patch).toHaveBeenCalledTimes(1));
    expect(http.patch).toHaveBeenCalledWith("finance/cashbox/cards/2", { holder_name: "", note: "Kuryer to'lovlari" });
  });

  it("the default card's name field is locked in the edit form", async () => {
    const user = userEvent.setup();
    const dialog = await renderDialog();
    await openMenuItem(user, dialog, "Asosiy karta", "Tahrirlash");
    const form = await screen.findByRole("dialog", { name: "Kartani tahrirlash" });
    expect(within(form).getByRole("textbox", { name: /Nomi/ })).toBeDisabled();
    expect(within(form).queryByRole("checkbox", { name: "Asosiy karta qilish" })).not.toBeInTheDocument();
  });

  it("transfer between cards: confirm → POST body with an Idempotency-Key", async () => {
    const user = userEvent.setup();
    const dialog = await renderDialog();
    await user.click(within(dialog).getByRole("button", { name: "Kartalararo o'tkazma" }));
    const form = await screen.findByRole("dialog", { name: "Kartalararo o'tkazma" });

    await choose(user, form, /Qaysi kartadan/, /Humo virtual/);
    await choose(user, form, /Qaysi kartaga/, /Asosiy karta/);
    await user.type(within(form).getByRole("textbox", { name: /Summa/ }), "2000000");
    await user.type(within(form).getByRole("textbox", { name: /Sabab/ }), "Kun oxiri");
    await user.click(within(form).getByRole("button", { name: "O'tkazish" }));
    // Karta qoldig'idan oshmaydi.
    expect(await within(form).findByText(`Kartada faqat ${money(1_850_000)} bor`)).toBeInTheDocument();

    const amount = within(form).getByRole("textbox", { name: /Summa/ });
    await user.clear(amount);
    await user.type(amount, "500000");
    expect(within(form).getByText(`«Humo virtual» kartasidan «Asosiy karta» kartasiga ${money(500_000)} o'tkaziladi`)).toBeInTheDocument();
    await user.click(within(form).getByRole("button", { name: "O'tkazish" }));

    const confirm = await screen.findByRole("alertdialog", { name: "O'tkazmani tasdiqlang" });
    expect(postCalls("finance/cashbox/cards/transfer")).toHaveLength(0);
    await user.click(within(confirm).getByRole("button", { name: "O'tkazish" }));

    await waitFor(() => expect(postCalls("finance/cashbox/cards/transfer")).toHaveLength(1));
    const [, body, config] = postCalls("finance/cashbox/cards/transfer")[0];
    expect(body).toEqual({ from_card_id: "2", to_card_id: "1", amount: 500_000, comment: "Kun oxiri" });
    expect(config.headers["Idempotency-Key"]).toEqual(expect.any(String));
    expect(config.headers["Idempotency-Key"].length).toBeGreaterThan(8);
    expect(await screen.findByText("O'tkazma bajarildi")).toBeInTheDocument();
  });

  it("convert card → cash: POST body with an Idempotency-Key", async () => {
    const user = userEvent.setup();
    const dialog = await renderDialog();
    await user.click(within(dialog).getByRole("button", { name: "Karta ↔ Naqd" }));
    const form = await screen.findByRole("dialog", { name: "Karta ↔ Naqd" });
    expect(within(form).getByText(`Joriy naqd kassa: ${money(18_240_000)}`)).toBeInTheDocument();

    await user.type(within(form).getByRole("textbox", { name: /Summa/ }), "100000");
    await user.type(within(form).getByRole("textbox", { name: /Sabab/ }), "Bankomat");
    await user.click(within(form).getByRole("button", { name: "O'tkazish" }));
    const confirm = await screen.findByRole("alertdialog", { name: "Konvertatsiyani tasdiqlang" });
    await user.click(within(confirm).getByRole("button", { name: "O'tkazish" }));

    await waitFor(() => expect(postCalls("finance/cashbox/cards/convert")).toHaveLength(1));
    const [, body, config] = postCalls("finance/cashbox/cards/convert")[0];
    expect(body).toEqual({ type: "card_to_cash", card_id: "1", amount: 100_000, comment: "Bankomat" });
    expect(config.headers["Idempotency-Key"]).toEqual(expect.any(String));
  });

  it("delete a zero-balance card: danger confirm → POST {} → «Karta o'chirildi»", async () => {
    const user = userEvent.setup();
    const dialog = await renderDialog();
    await openMenuItem(user, dialog, "Bo'sh karta", "O'chirish");

    const confirm = await screen.findByRole("alertdialog", { name: "«Bo'sh karta» kartasini o'chirish" });
    expect(within(confirm).getByText("Bu amalni qaytarib bo'lmaydi.")).toBeInTheDocument();
    expect(within(confirm).queryByRole("radiogroup")).not.toBeInTheDocument();
    await user.click(within(confirm).getByRole("button", { name: "O'chirish" }));

    await waitFor(() => expect(postCalls("finance/cashbox/cards/3/delete")).toHaveLength(1));
    const [, body, config] = postCalls("finance/cashbox/cards/3/delete")[0];
    expect(body).toEqual({});
    expect(config.headers["Idempotency-Key"]).toEqual(expect.any(String));
    expect(await screen.findByText("Karta o'chirildi")).toBeInTheDocument();
  });

  it("delete a card with balance → move_to card (the default card is preselected) + comment", async () => {
    const user = userEvent.setup();
    const dialog = await renderDialog();
    await openMenuItem(user, dialog, "Humo virtual", "O'chirish");

    const sheet = await screen.findByRole("dialog", { name: "«Humo virtual» kartasini o'chirish" });
    expect(
      within(sheet).getByText(`Kartada ${money(1_850_000)} bor. O'chirishdan oldin qoldiq 0 qilinadi:`),
    ).toBeInTheDocument();
    expect(within(sheet).getByRole("radio", { name: /Boshqa kartaga/ })).toHaveAttribute("aria-checked", "true");
    expect(within(sheet).getByRole("combobox", { name: /Qaysi kartaga/ })).toHaveTextContent("Asosiy karta");
    expect(
      within(sheet).getByText(`${money(1_850_000)} «Asosiy karta» kartasiga o'tkaziladi, keyin karta o'chiriladi`),
    ).toBeInTheDocument();

    await user.type(within(sheet).getByRole("textbox", { name: /Izoh/ }), "Karta yopildi");
    await user.click(within(sheet).getByRole("button", { name: "Qoldiqni o'tkazib, o'chirish" }));

    await waitFor(() => expect(postCalls("finance/cashbox/cards/2/delete")).toHaveLength(1));
    const [, body, config] = postCalls("finance/cashbox/cards/2/delete")[0];
    expect(body).toEqual({ move_to: "card", to_card_id: "1", comment: "Karta yopildi" });
    expect(config.headers["Idempotency-Key"]).toEqual(expect.any(String));
    expect(await screen.findByText("Karta o'chirildi")).toBeInTheDocument();
  });

  it("delete a card with balance → move_to cash", async () => {
    const user = userEvent.setup();
    const dialog = await renderDialog();
    await openMenuItem(user, dialog, "Humo virtual", "O'chirish");
    const sheet = await screen.findByRole("dialog", { name: "«Humo virtual» kartasini o'chirish" });

    await user.click(within(sheet).getByRole("radio", { name: /Naqd kassaga/ }));
    expect(within(sheet).queryByRole("combobox", { name: /Qaysi kartaga/ })).not.toBeInTheDocument();
    expect(within(sheet).getByText(`${money(1_850_000)} naqd kassaga o'tkaziladi, keyin karta o'chiriladi`)).toBeInTheDocument();
    await user.click(within(sheet).getByRole("button", { name: "Qoldiqni o'tkazib, o'chirish" }));

    await waitFor(() => expect(postCalls("finance/cashbox/cards/2/delete")).toHaveLength(1));
    expect(postCalls("finance/cashbox/cards/2/delete")[0][1]).toEqual({ move_to: "cash" });
  });

  it("delete: a backend 400 is shown verbatim inside the dialog; the dialog stays open", async () => {
    const message = "Smena ochilmagan — avval smenani oching";
    http.post.mockImplementation(async () => {
      throw httpError(400, message);
    });
    const user = userEvent.setup();
    const dialog = await renderDialog();
    await openMenuItem(user, dialog, "Humo virtual", "O'chirish");
    const sheet = await screen.findByRole("dialog", { name: "«Humo virtual» kartasini o'chirish" });
    await user.click(within(sheet).getByRole("button", { name: "Qoldiqni o'tkazib, o'chirish" }));

    expect(await within(sheet).findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByRole("dialog", { name: "«Humo virtual» kartasini o'chirish" })).toBeInTheDocument();
  });

  it("shift closed: money moves are locked, a zero-balance delete still works", async () => {
    http.get.mockImplementation(async (url: string) => {
      if (url === "finance/cashbox/cards") return { data: { statusCode: 200, data: CARD_LIST } };
      if (url === "finance/shift/current") return { data: { statusCode: 200, data: { shift: null, required: true } } };
      return { data: { statusCode: 200, data: {} } };
    });
    const user = userEvent.setup();
    const dialog = await renderDialog();
    await openMenuItem(user, dialog, "Humo virtual", "O'chirish");
    const sheet = await screen.findByRole("dialog", { name: "«Humo virtual» kartasini o'chirish" });
    expect(await within(sheet).findByText(/Smena yopiq/)).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: "Qoldiqni o'tkazib, o'chirish" })).toBeDisabled();
    await user.click(within(sheet).getByRole("button", { name: "Bekor qilish" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "«Humo virtual» kartasini o'chirish" })).not.toBeInTheDocument());

    await openMenuItem(user, dialog, "Bo'sh karta", "O'chirish");
    const confirm = await screen.findByRole("alertdialog", { name: "«Bo'sh karta» kartasini o'chirish" });
    await user.click(within(confirm).getByRole("button", { name: "O'chirish" }));
    await waitFor(() => expect(postCalls("finance/cashbox/cards/3/delete")).toHaveLength(1));
  });

  it("transfer: a lost response (504) keeps the Idempotency-Key — the retry sends the SAME key, the list is re-read", async () => {
    let attempt = 0;
    http.post.mockImplementation(async () => {
      attempt += 1;
      if (attempt === 1) throw httpError(504, "Gateway Timeout");
      return { data: { statusCode: 200, message: "ok", data: { idempotent: false } } };
    });
    const user = userEvent.setup();
    const dialog = await renderDialog();
    await user.click(within(dialog).getByRole("button", { name: "Kartalararo o'tkazma" }));
    const form = await screen.findByRole("dialog", { name: "Kartalararo o'tkazma" });
    await choose(user, form, /Qaysi kartadan/, /Humo virtual/);
    await choose(user, form, /Qaysi kartaga/, /Asosiy karta/);
    await user.type(within(form).getByRole("textbox", { name: /Summa/ }), "500000");
    await user.type(within(form).getByRole("textbox", { name: /Sabab/ }), "Kun oxiri");
    await user.click(within(form).getByRole("button", { name: "O'tkazish" }));

    const confirm = await screen.findByRole("alertdialog", { name: "O'tkazmani tasdiqlang" });
    const getsBefore = cardsGets();
    await user.click(within(confirm).getByRole("button", { name: "O'tkazish" }));
    expect(await within(confirm).findByRole("alert")).toHaveTextContent(UNCERTAIN);
    // Natija noma'lum: kalit saqlangan, ro'yxat qayta o'qildi, muvaffaqiyat xabari yo'q.
    expect(pendingKey(TRANSFER_FP)).toBe(keyOf(postCalls("finance/cashbox/cards/transfer")[0]));
    await waitFor(() => expect(cardsGets()).toBeGreaterThan(getsBefore));
    expect(screen.queryByText("O'tkazma bajarildi")).not.toBeInTheDocument();

    await user.click(within(confirm).getByRole("button", { name: "O'tkazish" }));
    await waitFor(() => expect(postCalls("finance/cashbox/cards/transfer")).toHaveLength(2));
    const [first, second] = postCalls("finance/cashbox/cards/transfer");
    expect(keyOf(second)).toBe(keyOf(first));
    expect(await screen.findByText("O'tkazma bajarildi")).toBeInTheDocument();
    // Javob keldi — kalit o'chdi (keyingi o'tkazma yangi kalit oladi).
    expect(pendingKey(TRANSFER_FP)).toBeUndefined();
  });

  it("delete with balance: an idempotent replay is reported as «avval bajarilgan», not as a new success", async () => {
    http.post.mockImplementation(async () => ({
      data: { statusCode: 200, message: "Karta o'chirildi", data: { idempotent: true, movement: { id: "77" } } },
    }));
    const user = userEvent.setup();
    const dialog = await renderDialog();
    await openMenuItem(user, dialog, "Humo virtual", "O'chirish");
    const sheet = await screen.findByRole("dialog", { name: "«Humo virtual» kartasini o'chirish" });
    await user.click(within(sheet).getByRole("button", { name: "Qoldiqni o'tkazib, o'chirish" }));

    expect(await screen.findByText("Bu amal avval bajarilgan edi — qayta o'tkazilmadi")).toBeInTheDocument();
    expect(screen.queryByText("Karta o'chirildi")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "«Humo virtual» kartasini o'chirish" })).not.toBeInTheDocument());
    expect(pendingKey(["card-delete", "2", "card", "1", 1_850_000])).toBeUndefined();
  });

  it("after a successful delete the card list is re-read and the shift-settings card list is invalidated", async () => {
    const user = userEvent.setup();
    const { queryClient } = renderWithProviders(<CashboxCardsDialog open onClose={() => {}} cashBalance={18_240_000} />, {
      route: "/payments/main-cashbox",
      preloadedState: superadmin,
    });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const dialog = await screen.findByRole("dialog", { name: TITLE });
    await within(dialog).findByText("Humo virtual");
    const getsBefore = cardsGets();

    await openMenuItem(user, dialog, "Humo virtual", "O'chirish");
    const sheet = await screen.findByRole("dialog", { name: "«Humo virtual» kartasini o'chirish" });
    await user.click(within(sheet).getByRole("button", { name: "Qoldiqni o'tkazib, o'chirish" }));
    expect(await screen.findByText("Karta o'chirildi")).toBeInTheDocument();

    await waitFor(() => expect(cardsGets()).toBeGreaterThan(getsBefore));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: shiftCheckSettingsKey });
  });

  it("zero-balance delete: 504, then the retry's 404 «Karta topilmadi» means it was already deleted → success", async () => {
    let attempt = 0;
    http.post.mockImplementation(async () => {
      attempt += 1;
      if (attempt === 1) throw httpError(504, "Gateway Timeout");
      throw httpError(404, "Karta topilmadi");
    });
    const user = userEvent.setup();
    const dialog = await renderDialog();
    await openMenuItem(user, dialog, "Bo'sh karta", "O'chirish");
    const confirm = await screen.findByRole("alertdialog", { name: "«Bo'sh karta» kartasini o'chirish" });

    await user.click(within(confirm).getByRole("button", { name: "O'chirish" }));
    expect(await within(confirm).findByRole("alert")).toHaveTextContent("karta o'chirilgan bo'lishi mumkin");
    expect(pendingKey(DELETE_EMPTY_FP)).toBe(keyOf(postCalls("finance/cashbox/cards/3/delete")[0]));

    await user.click(within(confirm).getByRole("button", { name: "O'chirish" }));
    expect(await screen.findByText("Karta o'chirildi")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("alertdialog", { name: "«Bo'sh karta» kartasini o'chirish" })).not.toBeInTheDocument());
    const [first, second] = postCalls("finance/cashbox/cards/3/delete");
    expect(keyOf(second)).toBe(keyOf(first));
    expect(screen.queryByText("Karta topilmadi")).not.toBeInTheDocument();
    expect(pendingKey(DELETE_EMPTY_FP)).toBeUndefined();
  });

  it("zero-balance delete: a 404 WITHOUT an earlier lost response is still shown as an error", async () => {
    http.post.mockImplementation(async () => {
      throw httpError(404, "Karta topilmadi");
    });
    const user = userEvent.setup();
    const dialog = await renderDialog();
    await openMenuItem(user, dialog, "Bo'sh karta", "O'chirish");
    const confirm = await screen.findByRole("alertdialog", { name: "«Bo'sh karta» kartasini o'chirish" });
    await user.click(within(confirm).getByRole("button", { name: "O'chirish" }));
    expect(await within(confirm).findByRole("alert")).toHaveTextContent("Karta topilmadi");
    expect(screen.queryByText("Karta o'chirildi")).not.toBeInTheDocument();
  });
});
