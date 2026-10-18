import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MyCashboxPage from "./MyCashboxPage";
import { renderWithProviders } from "../../../test/test-utils";

/**
 * `/cash-box` (dizayn v2): market / kuryer / menejer kassasi — sarlavha, balans kartasi («Bugun» bloki),
 * tarix tablari (`sourceTypes`), jadval, tafsilot oynasi, holatlar. Ega qarori D2 (2026-10-17): market o'z
 * kassasida HQ → market o'tkazmasini (`market_payment`) ro'yxatda ham, tafsilotda ham «Chiqim −» ko'radi.
 */

type Params = Record<string, unknown>;

const api = vi.hoisted(() => ({
  calls: [] as Params[],
  response: undefined as unknown,
  isError: false,
  refetch: vi.fn(),
}));

vi.mock("../../../entities/payments", () => ({
  useCashBox: () => ({
    useGetCashboxMyCashbox: (params: Params = {}) => {
      api.calls.push(params);
      return api.isError
        ? { data: undefined, isLoading: false, isFetching: false, isError: true, error: new Error("boom"), refetch: api.refetch }
        : { data: api.response, isLoading: false, isFetching: false, isError: false, error: null, refetch: api.refetch };
    },
    useGetFinanceHistoryById: () => ({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() }),
  }),
}));

const asRole = (role: string, extra: Record<string, unknown> = {}) =>
  ({ role: { id: "263", role, region: null, name: role === "market" ? "Baraka Shop" : "Jasur Tursunov" }, ...extra }) as never;

/** Mahalliy vaqt (sahifa «Bugun»ni brauzer kalendar kuni bo'yicha aniqlaydi). */
const at = (day: number, hour: number) => new Date(2026, 9, day, hour, 0).toISOString();

const respond = (cashboxType: string, balance: number, rows: Params[]) => {
  api.response = { statusCode: 200, data: { cashbox: { id: "70", cashbox_type: cashboxType, balance }, cashboxHistory: rows } };
};

const MARKET_ROWS: Params[] = [
  {
    id: "501",
    operation_type: "expense",
    source_type: "market_payment",
    amount: 2_000_000,
    payment_method: "click",
    comment: "Oktabr, 1-hafta hisobi",
    balance_after: 2_820_000,
    created_by: "1",
    createdByUser: { id: 1, name: "Aziz Admin", role: "admin" },
    createdAt: at(8, 11),
  },
  {
    id: "502",
    operation_type: "income",
    source_type: "sell",
    source_id: "10234",
    amount: 185_000,
    payment_method: "cash",
    balance_after: 4_820_000,
    createdAt: at(8, 10),
  },
  {
    id: "503",
    operation_type: "expense",
    source_type: "cancel",
    source_id: "10203",
    comment: "Mijoz qaytardi",
    amount: 320_000,
    payment_method: "cash",
    balance_after: 5_670_000,
    createdAt: at(5, 11),
  },
];

const COURIER_ROWS: Params[] = [
  {
    id: "601",
    operation_type: "expense",
    source_type: "courier_payment",
    amount: 2_400_000,
    payment_method: "cash",
    comment: "Kunlik tushum topshirildi",
    balance_after: 640_000,
    created_by: "33",
    created_by_user: { id: 33, name: "Mohira Qodirova", role: "manager", phone_number: "+998901112233" },
    createdAt: at(8, 9),
  },
  {
    id: "602",
    operation_type: "income",
    source_type: "sell",
    source_id: "10250",
    amount: 185_000,
    payment_method: "cash",
    balance_after: 3_040_000,
    createdAt: at(8, 8),
  },
];

const historyTable = () => screen.findByRole("table", { name: "Operatsiyalar tarixi" });

const rowOf = async (title: string) => {
  const table = await historyTable();
  return within(table).getByRole("button", { name: title }).closest("tr") as HTMLTableRowElement;
};

beforeEach(() => {
  api.calls.length = 0;
  api.isError = false;
  api.refetch.mockClear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 8, 18, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("MyCashboxPage — market (ega qarori D2)", () => {
  it("HQ → market o'tkazmasi ro'yxatda «Chiqim −2 000 000 so'm», tafsilotda «Chiqim operatsiyasi»", async () => {
    respond("markets", 2_820_000, MARKET_ROWS);
    const user = userEvent.setup();
    renderWithProviders(<MyCashboxPage />, { route: "/cash-box", preloadedState: asRole("market") });

    const row = await rowOf("HQ'dan marketga o'tkazma");
    expect(within(row).getByText("Chiqim")).toBeInTheDocument();
    expect(row).toHaveTextContent("−2 000 000 so'm");
    expect(row).not.toHaveTextContent("+2 000 000");
    expect(row).toHaveTextContent("Oktabr, 1-hafta hisobi");

    await user.click(within(row).getByRole("button", { name: "HQ'dan marketga o'tkazma" }));
    const dialog = await screen.findByRole("dialog", { name: "Chiqim operatsiyasi" });
    expect(dialog).toHaveTextContent("−2 000 000");
    expect(dialog).not.toHaveTextContent("+2 000 000");
    // Market maketida «Kassa turi» bor.
    expect(within(dialog).getByText("Kassa turi")).toBeInTheDocument();
  });

  it("sarlavha, balans kartasi («Qarshi tomon: Elchi HQ»), ko'z tugmasi va «Bugun» bloki", async () => {
    respond("markets", 2_820_000, MARKET_ROWS);
    const user = userEvent.setup();
    renderWithProviders(<MyCashboxPage />, { route: "/cash-box", preloadedState: asRole("market") });

    expect(screen.getByRole("heading", { level: 1, name: "To'lovlar" })).toBeInTheDocument();
    expect(screen.getByText("Market kassasi: balans va Elchi bilan operatsiyalar tarixi")).toBeInTheDocument();

    const card = await screen.findByRole("region", { name: "Umumiy balans" });
    expect(card).toHaveTextContent("2 820 000so'm");
    expect(within(card).getByText("Qarshi tomon")).toBeInTheDocument();
    expect(within(card).getByText("Elchi HQ")).toBeInTheDocument();
    expect(within(card).getByText("Baraka Shop")).toBeInTheDocument();
    // Bugungi qatorlar: sotuv +185 000, HQ → market o'tkazmasi — chiqim (D2).
    expect(
      within(card).getByRole("img", { name: "Bugun: kirim +185 000 so'm, chiqim −2 000 000 so'm" }),
    ).toBeInTheDocument();

    const hide = within(card).getByRole("button", { name: "Balansni yashirish" });
    expect(hide).toHaveAttribute("aria-pressed", "false");
    await user.click(hide);
    expect(card).not.toHaveTextContent("2 820 000");
    expect(within(card).getByRole("button", { name: "Balansni ko'rsatish" })).toHaveAttribute("aria-pressed", "true");
  });

  it("bekor qilish qatori: «Tuzatish» badge'i va «Buyurtma №10203 · Mijoz qaytardi»", async () => {
    respond("markets", 2_820_000, MARKET_ROWS);
    renderWithProviders(<MyCashboxPage />, { route: "/cash-box", preloadedState: asRole("market") });

    const row = await rowOf("Bekor qilish");
    expect(within(row).getByText("Tuzatish")).toBeInTheDocument();
    expect(row).toHaveTextContent("Buyurtma №10203 · Mijoz qaytardi");
    // Planshetda (`max-lg`) to'lov turi «Manba» ostida (market maketi), sana ostida emas (kuryer maketi).
    expect(row).toHaveTextContent("Mijoz qaytardi · Naqd");
    expect(row.querySelectorAll("td")[0]).not.toHaveTextContent("Naqd");
    expect(row).toHaveTextContent("−320 000 so'm");
    expect(row).toHaveTextContent("5 670 000 so'm");
  });
});

describe("MyCashboxPage — kuryer", () => {
  it("«Kassa», ustunlar «Operatsiya»/«Turi», «Qabul qildi: …», tafsilotda «Kassa turi» yo'q", async () => {
    respond("couriers", 1_245_000, COURIER_ROWS);
    const user = userEvent.setup();
    renderWithProviders(<MyCashboxPage />, { route: "/cash-box", preloadedState: asRole("courier") });

    expect(screen.getByRole("heading", { level: 1, name: "Kassa" })).toBeInTheDocument();
    const table = await historyTable();
    expect(within(table).getByRole("columnheader", { name: "Operatsiya" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Turi" })).toBeInTheDocument();

    const row = await rowOf("Kuryerdan filialga o'tkazma");
    expect(row).toHaveTextContent("Qabul qildi: Mohira Qodirova · Kunlik tushum topshirildi");
    expect(row).toHaveTextContent("−2 400 000 so'm");

    const card = screen.getByRole("region", { name: "Umumiy balans" });
    expect(within(card).getByText("Kuryer kassasi")).toBeInTheDocument();
    expect(
      within(card).getByRole("img", { name: "Bugun: kirim +185 000 so'm, chiqim −2 400 000 so'm" }),
    ).toBeInTheDocument();

    await user.click(within(row).getByRole("button", { name: /tafsilotini ochish$/ }));
    const dialog = await screen.findByRole("dialog", { name: "Chiqim operatsiyasi" });
    expect(within(dialog).queryByText("Kassa turi")).not.toBeInTheDocument();
  });

  it("«To'lov o'tkazmalari» tabi `sourceTypes` yuboradi; «Bugun» bloki filtrdan mustaqil", async () => {
    respond("couriers", 1_245_000, COURIER_ROWS);
    const user = userEvent.setup();
    renderWithProviders(<MyCashboxPage />, { route: "/cash-box", preloadedState: asRole("courier") });

    await historyTable();
    // Boshlang'ich holat: ikkala so'rov bir xil kalit — bitta so'rov (sana va tursiz).
    expect(api.calls.every((params) => Object.keys(params).length === 0)).toBe(true);

    await user.click(screen.getByRole("tab", { name: "To'lov o'tkazmalari" }));
    await waitFor(() =>
      expect(api.calls).toContainEqual({ sourceTypes: "courier_payment,market_payment,branch_to_main" }),
    );
    // Tab o'zgarsa ham «Bugun» — bugungi barcha qatorlar (sourceTypes'siz).
    expect(api.calls).toContainEqual({ fromDate: "2026-10-08", toDate: "2026-10-08" });
    expect(screen.getByRole("tab", { name: "To'lov o'tkazmalari" })).toHaveAttribute("aria-selected", "true");

    await user.click(screen.getByRole("tab", { name: "Barchasi" }));
    await waitFor(() => expect(api.calls.slice(-2)).toEqual([{}, {}]));
  });
});

describe("MyCashboxPage — menejer (maket yo'q, eng yaqini market-cashbox-my)", () => {
  it("«Kassa» · «Filial kassasi», kassa egasi — profildagi filial nomi", async () => {
    respond("branch", 3_785_000, [
      {
        id: "701",
        operation_type: "income",
        source_type: "courier_payment",
        amount: 1_500_000,
        payment_method: "cash",
        balance_after: 3_785_000,
        createdAt: at(7, 10),
      },
    ]);
    renderWithProviders(<MyCashboxPage />, {
      route: "/cash-box",
      preloadedState: asRole("manager", {
        user: {
          user: { id: "5", name: "Menejer", role: "manager", branch: { id: "9", name: "Urgut filiali" } },
          isAuthenticated: true,
          accessToken: "t",
          loading: false,
          isAppInitializing: false,
          error: null,
        },
      }),
    });

    expect(screen.getByRole("heading", { level: 1, name: "Kassa" })).toBeInTheDocument();
    expect(screen.getByText("Filial kassasi: balans va operatsiyalar tarixi")).toBeInTheDocument();
    const card = await screen.findByRole("region", { name: "Umumiy balans" });
    expect(within(card).getByText("Urgut filiali")).toBeInTheDocument();
    expect(within(card).getByText("Filial kassasi")).toBeInTheDocument();
    expect(within(card).queryByText(/Sotuvlar balansni oshiradi/)).not.toBeInTheDocument();

    const row = await rowOf("Kuryerdan filialga o'tkazma");
    expect(within(row).getByText("Kirim")).toBeInTheDocument();
    expect(row).toHaveTextContent("+1 500 000 so'm");
  });
});

describe("MyCashboxPage — holatlar", () => {
  it("xato: «Kassa ma'lumotini yuklab bo'lmadi» + «Qayta urinish» → refetch", async () => {
    api.isError = true;
    const user = userEvent.setup();
    renderWithProviders(<MyCashboxPage />, { route: "/cash-box", preloadedState: asRole("courier") });

    expect(await screen.findByText("Kassa ma'lumotini yuklab bo'lmadi")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Qayta urinish" }));
    expect(api.refetch).toHaveBeenCalled();
  });

  it("bo'sh: «Operatsiyalar topilmadi»", async () => {
    respond("couriers", 0, []);
    renderWithProviders(<MyCashboxPage />, { route: "/cash-box", preloadedState: asRole("courier") });

    expect(await screen.findByText("Operatsiyalar topilmadi")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("10 tadan ko'p — sahifalash «1–10 / 12 ta operatsiya»; kam bo'lsa «Jami N ta operatsiya»", async () => {
    const rows = Array.from({ length: 12 }, (_, index) => ({
      id: String(800 + index),
      operation_type: "income",
      source_type: "sell",
      source_id: String(10_300 + index),
      amount: 1000 * (index + 1),
      payment_method: "cash",
      createdAt: at(7, 8 + (index % 10)),
    }));
    respond("couriers", 0, rows);
    const user = userEvent.setup();
    const view = renderWithProviders(<MyCashboxPage />, { route: "/cash-box", preloadedState: asRole("courier") });

    const table = await historyTable();
    expect(within(table).getAllByRole("row")).toHaveLength(11);
    expect(screen.getByText("1–10 / 12 ta operatsiya")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "2" }));
    expect(within(await historyTable()).getAllByRole("row")).toHaveLength(3);

    view.unmount();
    respond("couriers", 0, rows.slice(0, 3));
    renderWithProviders(<MyCashboxPage />, { route: "/cash-box", preloadedState: asRole("courier") });
    expect(await screen.findByText("Jami 3 ta operatsiya")).toBeInTheDocument();
  });

  it("⭐ D-03: sahifa almashganda shell skrolli tarix kartasining boshiga qaytadi (pastda qolib ketmaydi)", async () => {
    const rows = Array.from({ length: 12 }, (_, index) => ({
      id: String(900 + index),
      operation_type: "income",
      source_type: "sell",
      source_id: String(10_400 + index),
      amount: 1000 * (index + 1),
      payment_method: "cash",
      createdAt: at(7, 8 + (index % 10)),
    }));
    respond("couriers", 0, rows);
    const user = userEvent.setup();
    renderWithProviders(
      <main>
        <div data-shell-slot="content">
          <MyCashboxPage />
        </div>
      </main>,
      { route: "/cash-box", preloadedState: asRole("courier") },
    );
    await historyTable();
    const main = document.querySelector("main") as HTMLElement;
    const card = screen.getByRole("region", { name: "Operatsiyalar tarixi" });
    main.scrollTop = 900;
    main.getBoundingClientRect = () => ({ top: 64 }) as DOMRect;
    card.getBoundingClientRect = () => ({ top: 64 - 400 }) as DOMRect;

    await user.click(screen.getByRole("button", { name: "2" }));

    expect(main.scrollTop).toBe(900 - 400 - 16);
  });

  it("«Summa» bo'yicha saralash — mijoz tomonida", async () => {
    respond("couriers", 0, [
      { id: "1", operation_type: "income", source_type: "sell", source_id: "1", amount: 5_000, createdAt: at(8, 9) },
      { id: "2", operation_type: "income", source_type: "sell", source_id: "2", amount: 90_000, createdAt: at(8, 8) },
      { id: "3", operation_type: "expense", source_type: "cancel", source_id: "3", amount: 40_000, createdAt: at(8, 7) },
    ]);
    const user = userEvent.setup();
    renderWithProviders(<MyCashboxPage />, { route: "/cash-box", preloadedState: asRole("courier") });

    const table = await historyTable();
    const amounts = () =>
      within(table)
        .getAllByRole("row")
        .slice(1)
        .map((row) => row.querySelectorAll("td")[4]?.textContent);
    expect(amounts()).toEqual(["+5 000 so'm", "+90 000 so'm", "−40 000 so'm"]);

    await user.click(within(table).getByRole("button", { name: /^Summa/ }));
    expect(amounts()).toEqual(["+90 000 so'm", "+5 000 so'm", "−40 000 so'm"]);
  });
});

/**
 * 2crjWf7v — kuryerning `/cash-box` sahifasi: `GET finance/cashbox/my-cashbox` javobidagi
 * `payment_ack` qatorga o'tadi va tarixda «Noto'g'ri» / «Tasdiqlangan» belgisi chiqadi.
 */
describe("MyCashboxPage — courier receipt answer (2crjWf7v)", () => {
  const courierPayment = (id: string, hour: number, extra: Params) => ({
    id,
    amount: -1_650_000,
    operation_type: "expense",
    source_type: "courier_payment",
    payment_method: "cash",
    cashbox_type: "couriers",
    createdByUser: { name: `Menejer ${id}` },
    createdAt: at(8, hour),
    ...extra,
  });

  const rows = () => [
    courierPayment("11", 9, { payment_ack: "disputed" }),
    courierPayment("12", 10, { payment_ack: "confirmed" }),
    courierPayment("13", 11, { payment_ack: null }),
    { id: "14", amount: 420_000, operation_type: "income", source_type: "sell", cashbox_type: "couriers", createdAt: at(8, 12) },
  ];

  it("carries payment_ack from the my-cashbox history into the rows", async () => {
    respond("couriers", 640_000, rows());
    renderWithProviders(<MyCashboxPage />, { route: "/cash-box", preloadedState: asRole("courier") });

    const table = await historyTable();
    const rowByReceiver = (name: string) => within(table).getByText(name).closest("tr") as HTMLTableRowElement;
    const disputed = rowByReceiver("Menejer 11");
    const confirmed = rowByReceiver("Menejer 12");
    const unanswered = rowByReceiver("Menejer 13");

    expect(within(disputed).getByText("Noto'g'ri")).toHaveAttribute("data-payment-ack", "disputed");
    expect(within(confirmed).getByText("Tasdiqlangan")).toHaveAttribute("data-payment-ack", "confirmed");
    expect(unanswered.querySelector("[data-payment-ack]")).toBeNull();
    expect(document.querySelectorAll("[data-payment-ack]")).toHaveLength(2);
  });

  it("phone cards show the badge and say it in the card name", async () => {
    const matchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes("max-width"),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    try {
      respond("couriers", 640_000, rows());
      renderWithProviders(<MyCashboxPage />, { route: "/cash-box", preloadedState: asRole("courier") });

      const card = await screen.findByRole("button", { name: /\(Noto'g'ri · Qabul qildi: Menejer 11\)/ });
      expect(within(card).getByText("Noto'g'ri")).toHaveAttribute("data-payment-ack", "disputed");
      expect(screen.getByRole("button", { name: /\(Tasdiqlangan · Qabul qildi: Menejer 12\)/ })).toBeInTheDocument();
      expect(document.querySelectorAll("[data-payment-ack]")).toHaveLength(2);
    } finally {
      window.matchMedia = matchMedia;
    }
  });
});
