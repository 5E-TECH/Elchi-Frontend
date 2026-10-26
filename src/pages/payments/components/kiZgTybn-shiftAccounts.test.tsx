import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { vi } from "vitest";
import MainCashbox from "./mainCashbox";
import { renderWithProviders } from "../../../test/test-utils";
import { handleFinanceEvent } from "../../../app/providers/realtimeFinance";

/**
 * kiZgTybn — smena yopishda har karta / hisob qoldig'ini tasdiqlash (haqiqiy `MainCashbox` + `CloseShiftPopup`,
 * faqat HTTP qatlami almashtirilgan). Backend 400 qoidalarining nusxasi: har karta qoldig'i majburiy, rasm majburiy
 * kartada skrinshot, farq ≠ 0 / AI «mismatch» / kiritilgan ≠ rasm → izoh majburiy. Tasdiqlash o'chiq — oyna avvalgidek.
 */

type Draft = Record<string, unknown>;

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
const exportReport = vi.hoisted(() => vi.fn());
const server = vi.hoisted(() => ({
  settings: null as null | Record<string, unknown>,
  drafts: {} as Record<string, Record<string, unknown>>,
  closeError: null as null | { status: number; message: string },
  uploads: [] as Array<Record<string, unknown>>,
}));

vi.mock("../../../shared/api/api", () => ({
  api: http,
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));
vi.mock("./lib/exportMainCashboxReport", () => ({ exportMainCashboxReport: exportReport }));
vi.mock("../../../entities/markets", () => ({
  useMarkets: () => ({ useGetMarkets: () => ({ data: undefined, isLoading: false }) }),
}));
vi.mock("../../../entities/branch/api/useBranches", () => ({
  useBranches: () => ({ data: undefined, isLoading: false }),
}));
vi.mock("./SalaryPaymentPopup", () => ({ default: () => null }));
vi.mock("./CashboxFormPopup", () => ({ default: () => null }));
vi.mock("./MainCashboxBalanceChart", () => ({ default: () => null }));
vi.mock("../../../shared/components/popupSelect", () => ({ default: () => null }));

const CLOSE_SHIFT = "Smenani yopish";
const SHIFT_ID = "31";

const CARDS = [
  { card_id: "1", name: "Asosiy karta", bank_name: "Agrobank", last4: "1234", is_default: true },
  { card_id: "2", name: "Humo virtual", bank_name: "Hamkorbank", last4: "4417", is_default: false },
  { card_id: "3", name: "Hisob raqam", bank_name: "Ipoteka bank", last4: "2205", is_default: false },
];
const BALANCES: Record<string, number> = { "1": 2_140_000, "2": 1_850_000, "3": 1_450_000 };

/** 1, 2 — rasm majburiy + AI; 3 — rasm ixtiyoriy, AI o'chiq. */
const enabledSettings = (overrides: Record<string, unknown> = {}) => ({
  account_check_enabled: true,
  photo_required: true,
  ai_check_enabled: true,
  cashbox_user_id: "0",
  cashbox_type: "main",
  cards: CARDS.map((card) => {
    const flags = card.card_id === "3" ? false : true;
    return {
      ...card,
      kind: "virtual_card",
      require_photo_on_shift_close: flags,
      ai_check_enabled: flags,
      photo_required: flags,
      ai_enabled: flags,
    };
  }),
  ...overrides,
});

const draftRow = (cardId: string, patch: Draft = {}): Draft => ({
  id: `d${cardId}`,
  shift_id: SHIFT_ID,
  card_id: cardId,
  card: { id: cardId, ...CARDS.find((card) => card.card_id === cardId) },
  expected_balance: BALANCES[cardId],
  entered_balance: null,
  difference: null,
  has_photo: true,
  photo_url: `https://files.example/signed/${cardId}`,
  photo_uploaded_at: "2026-10-26T17:41:00.000Z",
  ai_status: "pending",
  ai_read_balance: null,
  ai_entered_ok: null,
  comment: null,
  comment_required: false,
  ...patch,
});

const httpError = (status: number, message: string) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status, data: { statusCode: status, message } },
  });

const superadmin = {
  role: { id: "1", role: "superadmin", region: null, name: "Shodiyor Ergashev" },
  user: {
    user: { id: "1", name: "Shodiyor Ergashev", role: "superadmin" },
    isAuthenticated: true,
    accessToken: "token",
    loading: false,
    isAppInitializing: false,
    error: null,
  },
} as never;
const admin = {
  role: { id: "7", role: "admin", region: null, name: "Admin 7" },
  user: {
    user: { id: "7", name: "Admin 7", role: "admin" },
    isAuthenticated: true,
    accessToken: "token",
    loading: false,
    isAppInitializing: false,
    error: null,
  },
} as never;

const postsTo = (url: string) => http.post.mock.calls.filter(([postUrl]) => postUrl === url).map(([, body]) => body);

beforeEach(() => {
  server.settings = null;
  server.drafts = {};
  server.closeError = null;
  server.uploads = [];
  exportReport.mockReset();
  http.get.mockReset();
  http.post.mockReset();
  http.patch.mockReset();

  http.get.mockImplementation(async (url: string) => {
    if (url === "finance/shift/current") {
      return {
        data: {
          statusCode: 200,
          data: {
            shift: { id: SHIFT_ID, opened_by: "1", opened_at: "2026-10-26T09:05:00.000Z", status: "open", closed_by: null },
            required: true,
            cashbox_user_id: "0",
          },
        },
      };
    }
    if (url === "finance/cashbox/main") {
      return {
        data: {
          statusCode: 200,
          data: { cashbox: { balance: 23_680_000, balance_cash: 18_240_000, balance_card: 5_440_000 }, cashboxHistory: [] },
        },
      };
    }
    if (url === "finance/shift/settings") {
      return { data: { statusCode: 200, data: server.settings ?? { account_check_enabled: false, cards: [] } } };
    }
    if (url === "finance/cashbox/cards") {
      return {
        data: {
          statusCode: 200,
          data: { cards: CARDS.map((card) => ({ id: card.card_id, name: card.name, balance: BALANCES[card.card_id] })) },
        },
      };
    }
    if (url === `finance/shift/${SHIFT_ID}/report`) {
      return {
        data: {
          statusCode: 200,
          data: {
            shift: { id: SHIFT_ID, status: "open", opened_at: "2026-10-26T09:05:00.000Z" },
            cash: {},
            card: {},
            accounts: Object.values(server.drafts),
            operations: [],
          },
        },
      };
    }
    return { data: { statusCode: 200, message: "success", data: {} } };
  });

  http.post.mockImplementation(async (url: string, body: unknown) => {
    if (url === "finance/shift/account-photo") {
      const form = body as FormData;
      const cardId = String(form.get("card_id"));
      server.uploads.push({
        card_id: cardId,
        shift_id: form.get("shift_id"),
        entered_balance: form.get("entered_balance"),
        photo: form.get("photo"),
      });
      server.drafts[cardId] = draftRow(cardId, {
        ai_status: cardId === "3" ? "not_required" : "pending",
        entered_balance: form.get("entered_balance") === null ? null : Number(form.get("entered_balance")),
      });
      return { data: { statusCode: 201, data: { check: server.drafts[cardId], ai_enabled: cardId !== "3" } } };
    }
    if (url === "finance/shift/close") {
      if (server.closeError) throw httpError(server.closeError.status, server.closeError.message);
      const payload = body as Record<string, unknown>;
      return {
        data: {
          statusCode: 200,
          message: "Shift closed",
          data: {
            id: SHIFT_ID,
            opened_by: "1",
            closed_by: "1",
            status: "closed",
            opened_at: "2026-10-26T09:05:00.000Z",
            closed_at: "2026-10-26T18:00:00.000Z",
            closing_balance_cash: payload.closing_balance_cash,
            closing_balance_card: payload.closing_balance_card ?? 0,
            expected_balance_cash: 18_240_000,
            expected_balance_card: 5_440_000,
            discrepancy_cash: 0,
            discrepancy_card: null,
            ...(payload.accounts ? { accounts_check: { total: (payload.accounts as unknown[]).length } } : {}),
          },
        },
      };
    }
    throw new Error(`unexpected POST ${url}`);
  });
});

const open = (state: never = superadmin) =>
  renderWithProviders(<MainCashbox />, { route: "/payments/main-cashbox", preloadedState: state });

const openCloseDialog = async (user: ReturnType<typeof userEvent.setup>) => {
  // Birinchi chizish (lazy modullar) yuklangan mashinada 1 s dan oshishi mumkin.
  await user.click(await screen.findByRole("button", { name: CLOSE_SHIFT }, { timeout: 5000 }));
  return screen.findByRole("dialog", { name: CLOSE_SHIFT }, { timeout: 5000 });
};

const row = (dialog: HTMLElement, cardId: string) => within(dialog).getByTestId(`shift-account-${cardId}`);
const png = (name = "IMG_2210.png") => new File([new Uint8Array([137, 80, 78, 71])], name, { type: "image/png" });

describe("CloseShiftPopup — kartalar qoldig'ini tasdiqlash (kiZgTybn)", () => {
  it("disabled in settings: the dialog stays unchanged and posts no accounts[]", async () => {
    server.settings = { account_check_enabled: false, photo_required: true, ai_check_enabled: false, cards: [] };
    const user = userEvent.setup();
    open();
    const dialog = await openCloseDialog(user);
    expect(within(dialog).getByLabelText(/^Sanalgan karta/)).toBeInTheDocument();
    expect(within(dialog).queryByTestId("shift-accounts-section")).not.toBeInTheDocument();

    await user.type(within(dialog).getByLabelText(/^Sanalgan naqd/), "18240000");
    await user.click(within(dialog).getByRole("button", { name: CLOSE_SHIFT }));
    await waitFor(() => expect(postsTo("finance/shift/close")).toHaveLength(1));
    expect(postsTo("finance/shift/close")[0]).toEqual({ shift_id: SHIFT_ID, closing_balance_cash: 18_240_000 });
    // Kartalar tekshirilmagan — natija oynasida hisobot havolasi yo'q.
    const result = await screen.findByRole("dialog", { name: "Smena yopildi" });
    expect(within(result).queryByRole("link", { name: /Smena hisoboti/ })).not.toBeInTheDocument();
  });

  it("enabled: per-card rows replace «Sanalgan karta»; balance and required photos are validated before posting", async () => {
    server.settings = enabledSettings();
    const user = userEvent.setup();
    open();
    const dialog = await openCloseDialog(user);
    const section = await within(dialog).findByTestId("shift-accounts-section", {}, { timeout: 5000 });
    expect(within(dialog).queryByLabelText(/^Sanalgan karta/)).not.toBeInTheDocument();
    expect(within(section).getByText("Agrobank · ··1234")).toBeInTheDocument();
    // Tizim bo'yicha — jonli karta qoldig'i (GET finance/cashbox/cards).
    expect(await within(row(dialog, "2")).findByText("1 850 000 so'm")).toBeInTheDocument();
    // AI o'chiq karta — qo'lda tasdiqlanadi, rasm ixtiyoriy.
    expect(within(row(dialog, "3")).getByText("AI tekshiruvi o'chirilgan — qoldiq qo'lda tasdiqlanadi")).toBeInTheDocument();
    // (izoh maydonidagi «(ixtiyoriy)» — yorliq ichida; bu yerda skrinshot maydoni tekshiriladi)
    expect(within(row(dialog, "3")).getByText("(ixtiyoriy)", { ignore: "label span, script, style" })).toBeInTheDocument();
    // Superadmin — «Sozlamalar» havolasi.
    expect(within(section).getByRole("link", { name: /Sozlamalar/ })).toHaveAttribute("href", "/payments/shift-settings");

    await user.type(within(dialog).getByLabelText(/^Sanalgan naqd/), "18240000");
    await user.click(within(dialog).getByRole("button", { name: CLOSE_SHIFT }));
    expect(within(dialog).getAllByText("Ilovadagi qoldiqni kiriting")).toHaveLength(3);
    expect(within(dialog).getAllByText("Skrinshot majburiy — avval rasm yuklang")).toHaveLength(2);
    expect(within(row(dialog, "3")).queryByText("Skrinshot majburiy — avval rasm yuklang")).not.toBeInTheDocument();
    expect(postsTo("finance/shift/close")).toHaveLength(0);
  });

  it("uploads the screenshot with the entered balance; AI status goes pending → match via realtime", async () => {
    server.settings = enabledSettings();
    const user = userEvent.setup();
    const { queryClient } = open();
    const dialog = await openCloseDialog(user);
    await within(dialog).findByTestId("shift-accounts-section", {}, { timeout: 5000 });

    await user.type(within(row(dialog, "1")).getByLabelText(/^Ilovadagi qoldiq/), "2140000");
    await user.upload(within(dialog).getByTestId("shift-photo-input-1"), png());
    await waitFor(() => expect(server.uploads).toHaveLength(1));
    expect(server.uploads[0]).toMatchObject({ card_id: "1", shift_id: SHIFT_ID, entered_balance: "2140000" });
    expect(await within(row(dialog, "1")).findByText("AI rasmni tekshirmoqda…")).toBeInTheDocument();
    expect(within(row(dialog, "1")).getByText("Tekshirilmoqda")).toBeInTheDocument();
    expect(within(row(dialog, "1")).getByText("IMG_2210.png")).toBeInTheDocument();
    expect(within(dialog).getByText("1 ta karta rasmi hali tekshirilmoqda.")).toBeInTheDocument();

    // Realtime `finance.shift.account_checked` → [shift] so'rovlari qayta o'qiladi.
    server.drafts["1"] = draftRow("1", { ai_status: "match", ai_read_balance: 2_140_000, ai_entered_ok: true });
    await act(async () => {
      handleFinanceEvent(queryClient, i18n.t.bind(i18n), "finance.shift.account_checked", {
        shift_id: SHIFT_ID,
        card_id: "1",
        ai_status: "match",
      });
    });
    expect(await within(row(dialog, "1")).findByText("AI rasmdan 2 140 000 so'm o'qidi")).toBeInTheDocument();
    expect(within(row(dialog, "1")).getByText("Mos keldi")).toBeInTheDocument();
  });

  it("AI mismatch and a difference require a comment; then accounts[] and Σ card balance are posted", async () => {
    server.settings = enabledSettings();
    server.drafts = {
      "1": draftRow("1", { ai_status: "match", ai_read_balance: 2_140_000, entered_balance: 2_140_000 }),
      "2": draftRow("2", { ai_status: "mismatch", ai_read_balance: 1_760_000, entered_balance: 1_760_000 }),
    };
    const user = userEvent.setup();
    open();
    const dialog = await openCloseDialog(user);
    await within(dialog).findByTestId("shift-accounts-section", {}, { timeout: 5000 });
    // Qoralamadagi kiritilgan qiymat tiklanadi.
    await waitFor(() => expect(within(row(dialog, "2")).getByLabelText(/^Ilovadagi qoldiq/)).toHaveValue("1 760 000"));
    const humo = row(dialog, "2");
    expect(within(humo).getByText("Rasmda 1 760 000 so'm, tizimda 1 850 000 so'm")).toBeInTheDocument();
    expect(within(humo).getByText("−90 000 so'm")).toBeInTheDocument();
    expect(within(humo).getByText("Mos kelmadi")).toBeInTheDocument();
    expect(within(dialog).getByText("1 ta kartada farq bor — izoh majburiy")).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText(/^Sanalgan naqd/), "18240000");
    await user.type(within(row(dialog, "3")).getByLabelText(/^Ilovadagi qoldiq/), "1450000");
    await user.click(within(dialog).getByRole("button", { name: CLOSE_SHIFT }));
    expect(within(humo).getByText("Farq bor yoki AI natijasi mos emas — izoh yozing")).toBeInTheDocument();
    expect(postsTo("finance/shift/close")).toHaveLength(0);

    await user.type(within(humo).getByLabelText(/^Izoh/), "Bank komissiyasi yechildi");
    await user.click(within(dialog).getByRole("button", { name: CLOSE_SHIFT }));
    await waitFor(() => expect(postsTo("finance/shift/close")).toHaveLength(1));
    expect(postsTo("finance/shift/close")[0]).toEqual({
      shift_id: SHIFT_ID,
      closing_balance_cash: 18_240_000,
      closing_balance_card: 2_140_000 + 1_760_000 + 1_450_000,
      accounts: [
        { card_id: "1", entered_balance: 2_140_000 },
        { card_id: "2", entered_balance: 1_760_000, comment: "Bank komissiyasi yechildi" },
        { card_id: "3", entered_balance: 1_450_000 },
      ],
    });
    // Kartalar tekshirildi — natija oynasida «Smena hisoboti».
    const result = await screen.findByRole("dialog", { name: "Smena yopildi" });
    expect(within(result).getByRole("link", { name: /Smena hisoboti/ })).toHaveAttribute("href", `/payments/shifts/${SHIFT_ID}`);
  });

  it("entered ≠ image (ai_entered_ok) requires a comment even when AI matched the system", async () => {
    server.settings = enabledSettings();
    server.drafts = { "1": draftRow("1", { ai_status: "match", ai_read_balance: 2_140_000 }) };
    const user = userEvent.setup();
    open();
    const dialog = await openCloseDialog(user);
    await within(dialog).findByTestId("shift-accounts-section", {}, { timeout: 5000 });
    const main = row(dialog, "1");
    await user.type(within(main).getByLabelText(/^Ilovadagi qoldiq/), "2100000");
    expect(within(main).getByText("Kiritilgan qoldiq rasmdagidan (2 140 000 so'm) farq qiladi")).toBeInTheDocument();
    expect(within(main).getByText("Kiritilgan ≠ rasm")).toBeInTheDocument();
    expect(within(main).getByLabelText(/^Izoh/)).toBeInTheDocument();
  });

  it("rejects a wrong file type on the client and shows the backend 400 text on close", async () => {
    server.settings = enabledSettings({ photo_required: false, ai_check_enabled: false });
    server.settings.cards = (server.settings.cards as Array<Record<string, unknown>>).map((card) => ({
      ...card,
      photo_required: false,
      ai_enabled: false,
    }));
    server.closeError = { status: 400, message: "«Humo virtual»: farq bor yoki AI natijasi mos emas — izoh majburiy" };
    const user = userEvent.setup({ applyAccept: false });
    open(admin);
    const dialog = await openCloseDialog(user);
    await within(dialog).findByTestId("shift-accounts-section", {}, { timeout: 5000 });
    // Admin — «Sozlamalar» havolasi yo'q (faqat superadmin).
    expect(within(dialog).queryByRole("link", { name: /Sozlamalar/ })).not.toBeInTheDocument();

    await user.upload(
      within(dialog).getByTestId("shift-photo-input-2"),
      new File(["GIF89a"], "anim.gif", { type: "image/gif" }),
    );
    expect(await within(row(dialog, "2")).findByText("Faqat jpeg, png yoki webp rasm yuklang")).toBeInTheDocument();
    expect(server.uploads).toHaveLength(0);

    await user.type(within(dialog).getByLabelText(/^Sanalgan naqd/), "18240000");
    for (const [cardId, value] of [["1", "2140000"], ["2", "1850000"], ["3", "1450000"]] as const) {
      await user.type(within(row(dialog, cardId)).getByLabelText(/^Ilovadagi qoldiq/), value);
    }
    await user.click(within(dialog).getByRole("button", { name: CLOSE_SHIFT }));
    await waitFor(() => expect(postsTo("finance/shift/close")).toHaveLength(1));
    expect(await screen.findByText("«Humo virtual»: farq bor yoki AI natijasi mos emas — izoh majburiy")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: CLOSE_SHIFT })).toBeInTheDocument();
  });

  it("review: the comment box is always there; a 400 «izoh majburiy» re-reads balances, highlights the card and asks for the comment", async () => {
    server.settings = enabledSettings({ photo_required: false, ai_check_enabled: false });
    server.settings.cards = (server.settings.cards as Array<Record<string, unknown>>).map((card) => ({
      ...card,
      photo_required: false,
      ai_enabled: false,
    }));
    // Mijoz hisobida farq yo'q (kiritilgan = jonli qoldiq), lekin yopish paytida backend snapshot'i boshqa.
    server.closeError = { status: 400, message: "«Humo virtual»: farq bor yoki AI natijasi mos emas — izoh majburiy" };
    const user = userEvent.setup();
    open();
    const dialog = await openCloseDialog(user);
    await within(dialog).findByTestId("shift-accounts-section", {}, { timeout: 5000 });
    // Izoh maydoni har kartada — farq bo'lmasa ixtiyoriy.
    for (const cardId of ["1", "2", "3"]) {
      expect(within(row(dialog, cardId)).getByLabelText(/^Izoh/)).toBeInTheDocument();
      expect(within(row(dialog, cardId)).getByText(/\(ixtiyoriy\)/, { selector: "label span" })).toBeInTheDocument();
    }

    await user.type(within(dialog).getByLabelText(/^Sanalgan naqd/), "18240000");
    for (const [cardId, value] of [["1", "2140000"], ["2", "1850000"], ["3", "1450000"]] as const) {
      await user.type(within(row(dialog, cardId)).getByLabelText(/^Ilovadagi qoldiq/), value);
    }
    const balanceReads = () => http.get.mock.calls.filter(([url]) => url === "finance/cashbox/cards").length;
    const before = balanceReads();
    await user.click(within(dialog).getByRole("button", { name: CLOSE_SHIFT }));
    await waitFor(() => expect(postsTo("finance/shift/close")).toHaveLength(1));

    const humo = row(dialog, "2");
    await waitFor(() => expect(humo).toHaveAttribute("data-highlighted", "true"));
    expect(row(dialog, "1")).not.toHaveAttribute("data-highlighted");
    await waitFor(() => expect(balanceReads()).toBeGreaterThan(before));
    expect(within(humo).getByText("Farq bor yoki AI natijasi mos emas — izoh yozing")).toBeInTheDocument();
    // Endi izoh majburiy — «(ixtiyoriy)» yo'q.
    expect(within(humo).queryByText(/\(ixtiyoriy\)/, { selector: "label span" })).not.toBeInTheDocument();

    // Izohsiz qayta yuborilmaydi; izoh bilan — yuboriladi.
    await user.click(within(dialog).getByRole("button", { name: CLOSE_SHIFT }));
    expect(postsTo("finance/shift/close")).toHaveLength(1);
    server.closeError = null;
    await user.type(within(humo).getByLabelText(/^Izoh/), "Yopish paytida karta to'ldirildi");
    await user.click(within(dialog).getByRole("button", { name: CLOSE_SHIFT }));
    await waitFor(() => expect(postsTo("finance/shift/close")).toHaveLength(2));
    expect((postsTo("finance/shift/close")[1] as { accounts: unknown[] }).accounts).toContainEqual({
      card_id: "2",
      entered_balance: 1_850_000,
      comment: "Yopish paytida karta to'ldirildi",
    });
  });
});
