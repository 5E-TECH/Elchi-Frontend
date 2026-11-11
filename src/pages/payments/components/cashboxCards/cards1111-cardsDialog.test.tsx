import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import uz from "../../../../locales/uz/payments.json";
import ru from "../../../../locales/ru/payments.json";
import en from "../../../../locales/en/payments.json";
import { renderWithProviders } from "../../../../test/test-utils";
import { CARD_LIST, OPEN_SHIFT, admin, httpError, manager, money, superadmin } from "../../../../test/cashboxCardFixtures";
import MainCashbox from "../mainCashbox";
import { CashboxCardsDialog } from "./CashboxCardsDialog";

/**
 * cards1111 — «Kassa balansi» → «Karta (Click)» → «Kartalar va hisob raqamlar» oynasi: ochilish (ro'yxat faqat oyna
 * ochilganda o'qiladi), ro'yxat, Asosiy kartani o'chirib bo'lmaydi, menejer faqat ko'radi, tarjimalar.
 */

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));

vi.mock("../../../../shared/api/api", () => ({
  api: http,
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));
vi.mock("../lib/exportMainCashboxReport", () => ({ exportMainCashboxReport: vi.fn() }));
vi.mock("../../../../entities/markets", () => ({
  useMarkets: () => ({ useGetMarkets: () => ({ data: undefined, isLoading: false }) }),
}));
vi.mock("../../../../entities/branch/api/useBranches", () => ({
  useBranches: () => ({ data: undefined, isLoading: false }),
}));
vi.mock("../SalaryPaymentPopup", () => ({ default: () => null }));
vi.mock("../CashboxFormPopup", () => ({ default: () => null }));
vi.mock("../MainCashboxBalanceChart", () => ({ default: () => null }));
vi.mock("../../../../shared/components/popupSelect", () => ({ default: () => null }));

const TITLE = "Kartalar va hisob raqamlar";
const cardsCalls = () => http.get.mock.calls.filter(([url]) => url === "finance/cashbox/cards");

beforeEach(() => {
  http.get.mockReset();
  http.post.mockReset();
  http.patch.mockReset();
  http.get.mockImplementation(async (url: string) => {
    if (url === "finance/cashbox/cards") return { data: { statusCode: 200, data: CARD_LIST } };
    if (url === "finance/shift/current") return { data: { statusCode: 200, data: OPEN_SHIFT } };
    if (url === "finance/cashbox/main") {
      return {
        data: {
          statusCode: 200,
          data: { cashbox: { balance: 22_230_000, balance_cash: 18_240_000, balance_card: 3_990_000 }, cashboxHistory: [] },
        },
      };
    }
    return { data: { statusCode: 200, message: "success", data: {} } };
  });
});

const renderDialog = (state: never = superadmin) =>
  renderWithProviders(<CashboxCardsDialog open onClose={() => {}} cashBalance={18_240_000} />, {
    route: "/payments/main-cashbox",
    preloadedState: state,
  });

const cardItem = (dialog: HTMLElement, name: string) => {
  const item = within(dialog).getByText(name).closest("li");
  if (!item) throw new Error(`no row for ${name}`);
  return item as HTMLElement;
};

describe("cards1111 — Kartalar oynasi", () => {
  it("opens from the «Karta (Click)» row; the list is fetched only after opening", async () => {
    const user = userEvent.setup();
    renderWithProviders(<MainCashbox />, { route: "/payments/main-cashbox", preloadedState: superadmin });

    const row = await screen.findByRole("button", { name: /Kartalarni ko'rish/ }, { timeout: 5000 });
    expect(row).toHaveTextContent("Karta (Click)");
    // «Naqd» qatori bosilmaydi.
    expect(screen.queryByRole("button", { name: /^Naqd/ })).not.toBeInTheDocument();
    expect(cardsCalls()).toHaveLength(0);

    await user.click(row);
    const dialog = await screen.findByRole("dialog", { name: TITLE });
    expect(await within(dialog).findByText("Humo virtual")).toBeInTheDocument();
    expect(cardsCalls()[0]?.[1]).toEqual({ params: { include_inactive: true } });
  });

  it("lists cards with balance, default badge, bank subtitle, owner and the sync line", async () => {
    renderDialog();
    const dialog = await screen.findByRole("dialog", { name: TITLE });
    await within(dialog).findByText("Humo virtual");

    expect(within(dialog).getByText(/3 ta faol/)).toBeInTheDocument();
    const main = cardItem(dialog, "Asosiy karta");
    // «Asosiy» — neytral belgi (maket `el-tone-neutral`), holat rangi emas.
    expect(within(main).getByText("Asosiy")).toHaveClass("bg-sunken");
    expect(within(main).getByText("Asosiy")).not.toHaveClass("bg-info-soft");
    expect(within(main).getByText("Agrobank · ··1234")).toBeInTheDocument();
    expect(within(main).getByText(money(2_140_000))).toBeInTheDocument();
    expect(within(main).getByText("Karta tanlanmagan to'lovlar shu yerga tushadi")).toBeInTheDocument();
    expect(within(main).getByText("Rasm talab qilinadi")).toBeInTheDocument();
    expect(within(main).getByText("AI tekshiruvi")).toBeInTheDocument();

    const humo = cardItem(dialog, "Humo virtual");
    expect(within(humo).getByText("Hamkorbank · ··4417")).toBeInTheDocument();
    expect(within(humo).getByText("Virtual karta · Humo · Egasi: Aziz Rahimov")).toBeInTheDocument();
    expect(within(humo).getByText(money(1_850_000))).toBeInTheDocument();

    expect(
      within(dialog).getByText(`Kartalar yig'indisi ${money(3_990_000)} = kassadagi karta qoldig'i ${money(3_990_000)}`),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("Mos keladi")).toBeInTheDocument();

    // Arxivlanganlar yopiq bo'limda.
    expect(within(dialog).queryByText("Eski karta")).not.toBeInTheDocument();
    const user = userEvent.setup();
    const toggle = within(dialog).getByRole("button", { name: /Arxivlangan kartalar · 1 ta/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    const archived = cardItem(dialog, "Eski karta");
    expect(within(archived).getByText("Arxivlangan")).toBeInTheDocument();
    await user.click(within(archived).getByRole("button", { name: "«Eski karta» amallari" }));
    const menu = await screen.findByRole("menu", { name: "«Eski karta» amallari" });
    expect(within(menu).getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Faollashtirish", "O'chirish"]);
  });

  it("warns when the cards are out of sync", async () => {
    http.get.mockImplementation(async (url: string) => {
      if (url === "finance/cashbox/cards") {
        return { data: { statusCode: 200, data: { ...CARD_LIST, default_balance: -50_000, in_sync: false } } };
      }
      return { data: { statusCode: 200, data: OPEN_SHIFT } };
    });
    renderDialog();
    const dialog = await screen.findByRole("dialog", { name: TITLE });
    expect(await within(dialog).findByText("Mos kelmaydi")).toBeInTheDocument();
    // Tuzatish yo'li — kartalararo o'tkazma (Asosiy kartaga), «Karta ↔ Naqd» emas.
    const hint = within(dialog).getByText(/Asosiy karta qoldig'i manfiy/);
    expect(hint).toHaveTextContent("«Kartalararo o'tkazma»");
    expect(hint).not.toHaveTextContent("Karta ↔ Naqd");

    const user = userEvent.setup();
    await user.click(within(dialog).getByRole("button", { name: "Asosiy kartaga o'tkazish" }));
    const transfer = await screen.findByRole("dialog", { name: "Kartalararo o'tkazma" });
    expect(within(transfer).getByRole("combobox", { name: /Qaysi kartaga/ })).toHaveTextContent("Asosiy karta");
  });

  it("manager: the out-of-sync box has no fix button (read-only)", async () => {
    http.get.mockImplementation(async (url: string) => {
      if (url === "finance/cashbox/cards") {
        return { data: { statusCode: 200, data: { ...CARD_LIST, default_balance: -50_000, in_sync: false } } };
      }
      return { data: { statusCode: 200, data: OPEN_SHIFT } };
    });
    renderDialog(manager);
    const dialog = await screen.findByRole("dialog", { name: TITLE });
    expect(await within(dialog).findByText("Mos kelmaydi")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Asosiy kartaga o'tkazish" })).not.toBeInTheDocument();
  });

  it("the default card has no delete: the menu item is disabled with the reason, no «Asosiy qilish»", async () => {
    const user = userEvent.setup();
    renderDialog();
    const dialog = await screen.findByRole("dialog", { name: TITLE });
    await within(dialog).findByText("Humo virtual");

    await user.click(within(dialog).getByRole("button", { name: "«Asosiy karta» amallari" }));
    const menu = await screen.findByRole("menu", { name: "«Asosiy karta» amallari" });
    expect(within(menu).queryByRole("menuitem", { name: /Asosiy qilish/ })).not.toBeInTheDocument();
    const remove = within(menu).getByRole("menuitem", { name: /O'chirish/ });
    expect(remove).toHaveAttribute("aria-disabled", "true");
    expect(remove).toHaveAccessibleDescription("Asosiy kartani o'chirib bo'lmaydi");
    await user.click(remove);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(http.post).not.toHaveBeenCalled();

    await user.keyboard("{Escape}");
    await user.click(within(dialog).getByRole("button", { name: "«Humo virtual» amallari" }));
    const humoMenu = await screen.findByRole("menu", { name: "«Humo virtual» amallari" });
    expect(within(humoMenu).getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Tahrirlash",
      "Asosiy qilish",
      "O'chirish",
    ]);
    expect(within(humoMenu).getByRole("menuitem", { name: "O'chirish" })).not.toHaveAttribute("aria-disabled");
  });

  it("admin manages cards (toolbar and row menus)", async () => {
    renderDialog(admin);
    const dialog = await screen.findByRole("dialog", { name: TITLE });
    await within(dialog).findByText("Humo virtual");
    expect(within(dialog).getByRole("button", { name: "Karta qo'shish" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Kartalararo o'tkazma" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Karta ↔ Naqd" })).toBeInTheDocument();
    expect(within(dialog).getAllByRole("button", { name: /amallari$/ })).toHaveLength(3);
  });

  it("manager: read-only — balances and «Ko'chirma», no write buttons", async () => {
    renderDialog(manager);
    const dialog = await screen.findByRole("dialog", { name: TITLE });
    await within(dialog).findByText("Humo virtual");

    expect(within(dialog).getByText(/Kartalarni superadmin yoki admin boshqaradi/)).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Karta qo'shish" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Kartalararo o'tkazma" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Karta ↔ Naqd" })).not.toBeInTheDocument();
    expect(within(dialog).queryAllByRole("button", { name: /amallari$/ })).toHaveLength(0);
    expect(within(dialog).getAllByRole("button", { name: /ko'chirmasi$/ })).toHaveLength(3);
    expect(within(cardItem(dialog, "Humo virtual")).getByText(money(1_850_000))).toBeInTheDocument();
    // Menejerga smena so'rovi ham kerak emas (yozish yo'q).
    await waitFor(() => expect(cardsCalls()).toHaveLength(1));
    expect(http.get.mock.calls.some(([url]) => url === "finance/shift/current")).toBe(false);
  });

  it("opens the ledger («Ko'chirma») for a card", async () => {
    http.get.mockImplementation(async (url: string, config?: { params?: Record<string, unknown> }) => {
      if (url === "finance/cashbox/cards") return { data: { statusCode: 200, data: CARD_LIST } };
      if (url === "finance/cashbox/cards/2/ledger") {
        return {
          data: {
            statusCode: 200,
            data: {
              card: CARD_LIST.cards[1],
              items: [
                {
                  kind: "transfer_out",
                  source: "movement",
                  id: "9",
                  created_at: "2026-11-11T07:30:00.000Z",
                  amount: 150_000,
                  delta: -150_000,
                  balance_after: 1_850_000,
                  comment: "Kun oxiri",
                  created_by: "1",
                  counterparty_card_id: "1",
                },
              ],
              summary: { opening_balance: 2_000_000, closing_balance: 1_850_000, total_in: 0, total_out: 150_000, current_balance: 1_850_000 },
              pagination: { total: 1, page: config?.params?.page ?? 1, limit: 20, totalPages: 1 },
            },
          },
        };
      }
      return { data: { statusCode: 200, data: OPEN_SHIFT } };
    });
    const user = userEvent.setup();
    renderDialog();
    const dialog = await screen.findByRole("dialog", { name: TITLE });
    await within(dialog).findByText("Humo virtual");
    await user.click(within(dialog).getByRole("button", { name: "«Humo virtual» ko'chirmasi" }));

    const ledger = await screen.findByRole("dialog", { name: "Ko'chirma" });
    expect(await within(ledger).findByText("Kun oxiri")).toBeInTheDocument();
    expect(within(ledger).getByText("O'tkazma (chiqim)")).toBeInTheDocument();
    expect(within(ledger).getByText("Karta: Asosiy karta")).toBeInTheDocument();
    expect(within(ledger).getByText(`Qoldiq: ${money(1_850_000)}`)).toBeInTheDocument();
    expect(within(ledger).getByRole("button", { name: "Excelga yuklash" })).toBeInTheDocument();
    // Sukut davr — «Bu oy»: `from_date` doim boriladi (backend davrsiz 2000 dan ortiq yozuvni rad etadi).
    const ledgerCalls = http.get.mock.calls.filter(([url]) => url === "finance/cashbox/cards/2/ledger");
    expect(ledgerCalls[0][1]).toEqual({
      params: {
        from_date: expect.stringMatching(/^\d{4}-\d{2}-01T00:00:00\+05:00$/),
        to_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T23:59:59\.999\+05:00$/),
        page: 1,
        limit: 20,
      },
    });
    // Turi belgisi neytral (rangni summa oladi).
    const badge = within(ledger).getByText("O'tkazma (chiqim)");
    expect(badge).toHaveClass("bg-sunken");
    expect(badge).not.toHaveClass("bg-warning-soft");
  });

  it("ledger without a period: the backend «2000 dan ortiq» 400 shows a localized hint, not a retry loop", async () => {
    http.get.mockImplementation(async (url: string, config?: { params?: Record<string, unknown> }) => {
      if (url === "finance/cashbox/cards") return { data: { statusCode: 200, data: CARD_LIST } };
      if (url === "finance/cashbox/cards/1/ledger") {
        if (!config?.params?.from_date) throw httpError(400, "Oraliqda 2000 dan ortiq yozuv — from_date bilan qisqartiring");
        return {
          data: {
            statusCode: 200,
            data: {
              items: [],
              summary: { opening_balance: 0, closing_balance: 0, total_in: 0, total_out: 0, current_balance: 2_140_000 },
              pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
            },
          },
        };
      }
      return { data: { statusCode: 200, data: OPEN_SHIFT } };
    });
    const user = userEvent.setup();
    renderDialog();
    const dialog = await screen.findByRole("dialog", { name: TITLE });
    await within(dialog).findByText("Humo virtual");
    await user.click(within(dialog).getByRole("button", { name: "«Asosiy karta» ko'chirmasi" }));
    const ledger = await screen.findByRole("dialog", { name: "Ko'chirma" });
    expect(await within(ledger).findByText("Tanlangan davrda harakat topilmadi")).toBeInTheDocument();

    // Davrni tozalash («Barchasi») — backend rad etadi; texnik `from_date` matni emas, izoh chiqadi.
    await user.click(within(ledger).getByRole("button", { name: "Sanalar oralig'ini tozalash" }));
    expect(
      await within(ledger).findByText("Bu davrda yozuvlar juda ko'p — boshlanish sanasini tanlab, davrni qisqartiring."),
    ).toBeInTheDocument();
    expect(within(ledger).queryByText(/from_date/)).not.toBeInTheDocument();
    expect(within(ledger).queryByRole("button", { name: "Qayta urinish" })).not.toBeInTheDocument();
  });

  it("i18n: the cashboxCards block exists in uz/ru/en with the same keys and no empty values", () => {
    const flatten = (tree: unknown, prefix = ""): Record<string, unknown> =>
      Object.entries(tree as Record<string, unknown>).reduce<Record<string, unknown>>((out, [key, value]) => {
        if (value && typeof value === "object") Object.assign(out, flatten(value, `${prefix}${key}.`));
        else out[`${prefix}${key}`] = value;
        return out;
      }, {});
    const [uzKeys, ruKeys, enKeys] = [uz, ru, en].map((locale) => flatten((locale as Record<string, unknown>).cashboxCards));
    expect(Object.keys(uzKeys).length).toBeGreaterThan(100);
    expect(Object.keys(ruKeys).sort()).toEqual(Object.keys(uzKeys).sort());
    expect(Object.keys(enKeys).sort()).toEqual(Object.keys(uzKeys).sort());
    for (const keys of [uzKeys, ruKeys, enKeys]) {
      for (const [key, value] of Object.entries(keys)) expect([key, typeof value === "string" && value.trim() !== ""]).toEqual([key, true]);
    }
    for (const key of [
      "open",
      "title",
      "actions.add",
      "actions.transfer",
      "actions.convert",
      "actions.ledger",
      "actions.defaultNoDelete",
      "delete.title",
      "delete.confirmMove",
      "delete.done",
      "ledger.kind.card_to_cash",
    ]) {
      expect(uzKeys).toHaveProperty([key]);
    }
    expect(uzKeys["delete.done"]).toBe("Karta o'chirildi");
  });
});
