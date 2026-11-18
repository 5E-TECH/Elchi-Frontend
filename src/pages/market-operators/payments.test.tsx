import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/test-utils";
import enLocale from "../../locales/en/marketOperators.json";
import ruLocale from "../../locales/ru/marketOperators.json";
import uzLocale from "../../locales/uz/marketOperators.json";
import MarketOperatorsPage from "./index";
import { todayIso, validatePaymentForm } from "./model/operatorPayments";

/**
 * F2qp6FtE (ega qarori 2026-11-16) — market o'z operatoriga O'ZI to'laydi, Elchi kassasiga ta'sir qilmaydi:
 * «Operatorlar → To'lovlar» (`?view=payments`) haqiqiy UI orqali — jami va har operator hisobi, «To'lov yozish»
 * (oyna → tasdiq, `Idempotency-Key`, kassa so'rovlari yo'q), tarix, «Bekor qilish» (sabab majburiy). `notify` /
 * `confirm` mock qilinmaydi.
 */

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock("../../shared/api/api", () => ({ api }));

const OPERATORS = [
  { id: "41", name: "Madina Xoliqova", phone_number: "+998902143658", status: "active", commission_type: "percent", commission_value: 5 },
  { id: "42", name: "Sevara Usmonova", phone_number: "+998935071244", status: "active", commission_type: "fixed", commission_value: 3000 },
];

const BALANCES = {
  items: [
    { operator_id: "41", operator_name: "Madina Xoliqova", status: "active", earned: 1286500, paid: 1100000, balance: 186500, payments_count: 2, last_paid_at: "2026-11-15" },
    { operator_id: "42", operator_name: "Sevara Usmonova", status: "active", earned: 420000, paid: 450000, balance: -30000, payments_count: 1, last_paid_at: "2026-11-10" },
  ],
  totals: { earned: 1706500, paid: 1550000, balance: 156500 },
};

const payment = (extra: Record<string, unknown>) => ({
  id: "305",
  operator_id: "41",
  operator_name: "Madina Xoliqova",
  market_id: "12",
  amount: 300000,
  paid_at: "2026-11-15",
  note: "Noyabr, 1-qism",
  source: "market",
  affects_cashbox: false,
  recorded_by_role: "market",
  created_at: "2026-11-15T09:30:00.000Z",
  status: "active",
  cancelled_at: null,
  cancelled_by_role: null,
  cancel_reason: null,
  can_cancel: true,
  ...extra,
});

const HISTORY = [
  payment({}),
  payment({ id: "303", amount: 200000, note: "Xato summa", status: "cancelled", cancel_reason: "Summa xato kiritildi", can_cancel: false }),
  payment({ id: "301", amount: 800000, paid_at: "2026-10-01", note: "Sentabr", source: "elchi", affects_cashbox: true, market_id: null, recorded_by_role: null, can_cancel: false }),
];

const ok = (data: unknown, statusCode = 200) => Promise.resolve({ data: { statusCode, message: "ok", data } });

const axiosError = (status: number, message = "boom") =>
  Object.assign(new Error(message), { isAxiosError: true, response: { status, data: { message } } });

const marketState = {
  role: { id: "12", role: "market", region: null, name: "Baraka Shop" },
  user: { user: { id: "12", name: "Baraka Shop", role: "market" } },
} as never;

const renderAt = (route: string) => renderWithProviders(<MarketOperatorsPage />, { route, preloadedState: marketState });

beforeEach(() => {
  api.get.mockReset().mockImplementation((url: string) => {
    if (url === "market-operators") return ok({ items: OPERATORS, meta: { page: 1, limit: 20, total: 2, totalPages: 1 } });
    if (url === "finance/operator-payments/balances") return ok(BALANCES);
    if (url === "finance/operator-payments") return ok({ items: HISTORY, pagination: { total: 3, page: 1, limit: 20, totalPages: 1 } });
    return ok({});
  });
  api.post.mockReset().mockImplementation((url: string) =>
    url.endsWith("/cancel")
      ? ok(payment({ status: "cancelled", cancel_reason: "Summa xato", can_cancel: false, idempotent: false }))
      : ok(payment({ id: "306", amount: 150000, idempotent: false }), 201),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("«Operatorlar → To'lovlar» (F2qp6FtE)", () => {
  it("tablar: «Operatorlar» ro'yxatida ham «To'lovlar» havolasi; qator menyusida «To'lov yozish»", async () => {
    const user = userEvent.setup();
    renderAt("/market-operators");
    const tabs = await screen.findByRole("navigation", { name: "Operatorlar bo'limlari" });
    expect(within(tabs).getByRole("link", { name: "To'lovlar" })).toHaveAttribute("href", "/market-operators?view=payments");
    expect(within(tabs).getByRole("link", { name: "Operatorlar" })).toHaveAttribute("aria-current", "page");

    await user.click((await screen.findAllByRole("button", { name: "Madina Xoliqova amallari" }))[0]);
    const menu = await screen.findByRole("menu", { name: "Madina Xoliqova amallari" });
    await user.click(within(menu).getByRole("menuitem", { name: "To'lov yozish" }));
    const dialog = await screen.findByRole("dialog", { name: "To'lov yozish" });
    expect(within(dialog).getByText(/Elchi kassasiga ta'sir qilmaydi/)).toBeInTheDocument();
    expect(within(dialog).getByRole("combobox", { name: "Operator" })).toHaveTextContent("Madina Xoliqova");
  });

  it("jami KPI, har operator hisobi (manfiy — «Ortiqcha to'langan») va tarix holatlari", async () => {
    renderAt("/market-operators?view=payments");

    expect(await screen.findByRole("heading", { level: 1, name: "Operatorlar" })).toBeInTheDocument();
    expect(screen.getByText("Baraka Shop operatorlariga bergan to'lovlaringiz hisobi — Elchi kassasiga ta'sir qilmaydi")).toBeInTheDocument();
    expect(
      within(screen.getByRole("navigation", { name: "Operatorlar bo'limlari" })).getByRole("link", { name: "To'lovlar" }),
    ).toHaveAttribute("aria-current", "page");

    const kpi = await screen.findByRole("region", { name: "Operatorlar hisobi, jami" });
    await waitFor(() => expect(kpi).toHaveTextContent("1 706 500"));
    expect(kpi).toHaveTextContent("1 550 000");
    expect(kpi).toHaveTextContent("156 500");

    const balances = await screen.findByRole("table", { name: "Operatorlar hisobi" });
    const madina = within(balances).getByText("Madina Xoliqova").closest("tr")!;
    expect(madina).toHaveTextContent("1 286 500 so'm");
    expect(madina).toHaveTextContent("1 100 000 so'm");
    expect(madina).toHaveTextContent("186 500 so'm");
    expect(madina).toHaveTextContent("15.11.2026");
    const sevara = within(balances).getByText("Sevara Usmonova").closest("tr")!;
    expect(sevara).toHaveTextContent("−30 000 so'm");
    expect(sevara).toHaveTextContent("Ortiqcha to'langan");

    const history = await screen.findByRole("table", { name: "To'lovlar tarixi" });
    const rows = within(history).getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Yozilgan");
    expect(within(rows[0]).getByRole("button", { name: /bekor qilish/i })).toBeInTheDocument();
    expect(rows[1]).toHaveTextContent("Bekor qilingan");
    expect(rows[1]).toHaveTextContent("Sabab: Summa xato kiritildi");
    expect(within(rows[1]).queryByRole("button", { name: /bekor qilish/i })).toBeNull();
    expect(rows[2]).toHaveTextContent("Elchi kassasidan");
    expect(within(rows[2]).queryByRole("button", { name: /bekor qilish/i })).toBeNull();
    expect(screen.getByText("3 ta to'lov")).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("finance/operator-payments", { params: { page: 1, limit: 20 } });
  });

  it("«To'lov yozish»: tekshiruv → tasdiq («Elchi kassasiga ta'sir qilmaydi») → POST + Idempotency-Key; kassa so'ralmaydi", async () => {
    const user = userEvent.setup();
    renderAt("/market-operators?view=payments");
    await screen.findByRole("table", { name: "Operatorlar hisobi" });
    await user.click(screen.getByRole("button", { name: "To'lov yozish" }));
    const dialog = await screen.findByRole("dialog", { name: "To'lov yozish" });

    // Bo'sh forma — maydon xatolari, so'rov yo'q.
    await user.click(within(dialog).getByRole("button", { name: "To'lov yozish" }));
    expect(await within(dialog).findByText("Operator tanlanmagan")).toBeInTheDocument();
    expect(within(dialog).getByText("Summani kiriting")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("combobox", { name: "Operator" }));
    await user.click(await screen.findByRole("option", { name: /Madina Xoliqova/ }));
    await user.type(within(dialog).getByRole("textbox", { name: "Summa" }), "250000");
    // Qoldiqdan ko'p — ogohlantirish (bloklamaydi).
    expect(within(dialog).getByText("Qoldiqdan 63 500 so'm ko'p — ortiqcha to'lov sifatida yoziladi")).toBeInTheDocument();
    await user.type(within(dialog).getByRole("textbox", { name: /Izoh/ }), "  Noyabr  ");
    await user.click(within(dialog).getByRole("button", { name: "To'lov yozish" }));

    const confirm = await screen.findByRole("alertdialog", { name: "To'lovni tasdiqlang" });
    expect(confirm).toHaveTextContent("Elchi kassasiga ta'sir qilmaydi");
    expect(confirm).toHaveTextContent("250 000");
    expect(confirm).toHaveTextContent("Madina Xoliqova");
    expect(confirm).toHaveTextContent("Yozuvdan keyingi qoldiq−63 500 so'm");
    expect(confirm).toHaveTextContent("Noyabr");
    await user.click(within(confirm).getByRole("button", { name: "To'lovni yozish" }));

    expect(await screen.findByText("To'lov yozildi")).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledTimes(1);
    const [url, body, config] = api.post.mock.calls[0];
    expect(url).toBe("finance/operator-payments");
    expect(body).toEqual({ operator_id: "41", amount: 250000, paid_at: todayIso(), note: "Noyabr" });
    expect(config.headers["Idempotency-Key"]).toMatch(/\S{8,}/);
    // Kassa / moliya so'rovlari yo'q — Elchi kassasiga ta'sir yo'q.
    expect(api.get.mock.calls.map(([u]) => u).filter((u: string) => u.includes("cashbox"))).toEqual([]);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "To'lov yozish" })).toBeNull());
  });

  it("xato (504) — tasdiq oynasida; qayta urinish AYNI Idempotency-Key bilan", async () => {
    const user = userEvent.setup();
    api.post.mockReset().mockRejectedValueOnce(axiosError(504)).mockImplementation(() => ok(payment({ idempotent: true })));
    renderAt("/market-operators?view=payments");
    await screen.findByRole("table", { name: "Operatorlar hisobi" });
    const row = within(screen.getByRole("table", { name: "Operatorlar hisobi" })).getByText("Sevara Usmonova").closest("tr")!;
    await user.click(within(row).getByRole("button", { name: "Sevara Usmonova uchun to'lov yozish" }));
    const dialog = await screen.findByRole("dialog", { name: "To'lov yozish" });
    expect(within(dialog).getByText("Ortiqcha to'langan: 30 000 so'm")).toBeInTheDocument();
    await user.type(within(dialog).getByRole("textbox", { name: "Summa" }), "100000");
    await user.click(within(dialog).getByRole("button", { name: "To'lov yozish" }));
    const confirm = await screen.findByRole("alertdialog", { name: "To'lovni tasdiqlang" });
    await user.click(within(confirm).getByRole("button", { name: "To'lovni yozish" }));
    // Natija noma'lum (504) — «yozib bo'lmadi» emas: yozuv bo'lishi mumkin, oynada qayta bosish xavfsiz.
    expect(
      await within(confirm).findByText(
        "Javob kelmadi — to'lov yozilgan bo'lishi mumkin. Oynani yopmasdan «To'lovni yozish» ni qayta bosing: takroriy yozuv bo'lmaydi.",
      ),
    ).toBeInTheDocument();
    await user.click(within(confirm).getByRole("button", { name: "To'lovni yozish" }));

    expect(await screen.findByText("Bu to'lov allaqachon yozilgan edi")).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledTimes(2);
    expect(api.post.mock.calls[0][2].headers["Idempotency-Key"]).toBe(api.post.mock.calls[1][2].headers["Idempotency-Key"]);
  });

  it("400 — backend sababi ko'rinadi («qayta urinib ko'ring» emas)", async () => {
    const user = userEvent.setup();
    api.post.mockReset().mockRejectedValueOnce(axiosError(400, "To'lov sanasi kelajakda bo'lishi mumkin emas"));
    renderAt("/market-operators?view=payments");
    const table = await screen.findByRole("table", { name: "Operatorlar hisobi" });
    const row = within(table).getByText("Sevara Usmonova").closest("tr")!;
    await user.click(within(row).getByRole("button", { name: "Sevara Usmonova uchun to'lov yozish" }));
    const dialog = await screen.findByRole("dialog", { name: "To'lov yozish" });
    await user.type(within(dialog).getByRole("textbox", { name: "Summa" }), "100000");
    await user.click(within(dialog).getByRole("button", { name: "To'lov yozish" }));
    const confirm = await screen.findByRole("alertdialog", { name: "To'lovni tasdiqlang" });
    await user.click(within(confirm).getByRole("button", { name: "To'lovni yozish" }));
    expect(await within(confirm).findByText("To'lov sanasi kelajakda bo'lishi mumkin emas")).toBeInTheDocument();
    expect(within(confirm).queryByText(/Qaytadan urinib ko'ring/)).toBeNull();
  });

  it("oynani yopib qayta ochish — yangi Idempotency-Key (yangi yozuv)", async () => {
    const user = userEvent.setup();
    api.post.mockReset().mockImplementation(() => ok(payment()));
    renderAt("/market-operators?view=payments");
    const table = await screen.findByRole("table", { name: "Operatorlar hisobi" });
    const open = async () => {
      const row = within(screen.getByRole("table", { name: "Operatorlar hisobi" })).getByText("Sevara Usmonova").closest("tr")!;
      await user.click(within(row).getByRole("button", { name: "Sevara Usmonova uchun to'lov yozish" }));
      const dialog = await screen.findByRole("dialog", { name: "To'lov yozish" });
      await user.type(within(dialog).getByRole("textbox", { name: "Summa" }), "1000");
      await user.click(within(dialog).getByRole("button", { name: "To'lov yozish" }));
      const confirm = await screen.findByRole("alertdialog", { name: "To'lovni tasdiqlang" });
      await user.click(within(confirm).getByRole("button", { name: "To'lovni yozish" }));
      await waitFor(() => expect(screen.queryByRole("dialog", { name: "To'lov yozish" })).toBeNull());
    };
    expect(table).toBeInTheDocument();
    await open();
    await open();
    expect(api.post).toHaveBeenCalledTimes(2);
    expect(api.post.mock.calls[0][2].headers["Idempotency-Key"]).not.toBe(api.post.mock.calls[1][2].headers["Idempotency-Key"]);
  });

  it("«Bekor qilish»: sabab majburiy, POST :id/cancel { reason }", async () => {
    const user = userEvent.setup();
    renderAt("/market-operators?view=payments");
    const history = await screen.findByRole("table", { name: "To'lovlar tarixi" });
    await user.click(within(history).getByRole("button", { name: "Madina Xoliqova — 300 000 so'm to'lovini bekor qilish" }));
    const dialog = await screen.findByRole("dialog", { name: "To'lov yozuvini bekor qilish" });
    expect(dialog).toHaveTextContent("Madina Xoliqova · 300 000 so'm · 15.11.2026");
    await user.click(within(dialog).getByRole("button", { name: "Bekor qilish" }));
    expect(await within(dialog).findByText("Sababni yozing (kamida 3 belgi)")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();

    await user.type(within(dialog).getByRole("textbox", { name: /Sabab/ }), "Summa xato");
    await user.click(within(dialog).getByRole("button", { name: "Bekor qilish" }));
    expect(await screen.findByText("To'lov yozuvi bekor qilindi")).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith("finance/operator-payments/305/cancel", { reason: "Summa xato" });
  });

  it("bekor qilishda 409 (eski Elchi yozuvi) — oynada aniq matn", async () => {
    const user = userEvent.setup();
    api.post.mockReset().mockRejectedValue(axiosError(409));
    renderAt("/market-operators?view=payments");
    const history = await screen.findByRole("table", { name: "To'lovlar tarixi" });
    await user.click(within(history).getByRole("button", { name: "Madina Xoliqova — 300 000 so'm to'lovini bekor qilish" }));
    const dialog = await screen.findByRole("dialog", { name: "To'lov yozuvini bekor qilish" });
    await user.type(within(dialog).getByRole("textbox", { name: /Sabab/ }), "Summa xato");
    await user.click(within(dialog).getByRole("button", { name: "Bekor qilish" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Bu to'lov Elchi kassasidan qilingan — uni bekor qilib bo'lmaydi.");
  });

  it("operator filtri — `operator_id` so'rovga ketadi", async () => {
    const user = userEvent.setup();
    renderAt("/market-operators?view=payments");
    await screen.findByRole("table", { name: "To'lovlar tarixi" });
    await user.click(screen.getByRole("combobox", { name: /Operator/ }));
    await user.click(await screen.findByRole("option", { name: "Sevara Usmonova" }));
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith("finance/operator-payments", { params: { page: 1, limit: 20, operator_id: "42" } }),
    );
  });

  it("operator yo'q — bo'sh holat, «To'lov yozish» sarlavhada yo'q", async () => {
    api.get.mockImplementation((url: string) => {
      if (url === "finance/operator-payments/balances") return ok({ items: [], totals: { earned: 0, paid: 0, balance: 0 } });
      if (url === "finance/operator-payments") return ok({ items: [], pagination: { total: 0, page: 1, limit: 20, totalPages: 1 } });
      return ok({});
    });
    renderAt("/market-operators?view=payments");
    expect(await screen.findByText("Hali operator yo'q")).toBeInTheDocument();
    expect(screen.getByText("Hali to'lov yozilmagan")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "To'lov yozish" })).toBeNull();
  });
});

describe("forma tekshiruvi", () => {
  it("operator, summa > 0, sana — bugundan keyin emas", () => {
    expect(validatePaymentForm({ operatorId: "", amount: 0, paidAt: "" }, "2026-11-18")).toEqual({
      operator: "operator",
      amount: "amount",
      date: "date",
    });
    expect(validatePaymentForm({ operatorId: "41", amount: 10, paidAt: "2026-11-19" }, "2026-11-18")).toEqual({ date: "dateFuture" });
    expect(validatePaymentForm({ operatorId: "41", amount: 1e13, paidAt: "2026-11-18" }, "2026-11-18")).toEqual({ amount: "amountTooBig" });
    expect(validatePaymentForm({ operatorId: "41", amount: 1, paidAt: "2026-11-01" }, "2026-11-18")).toEqual({});
    expect(validatePaymentForm({ operatorId: "41", amount: 1, paidAt: "2019-12-31" }, "2026-11-18")).toEqual({ date: "dateTooOld" });
  });

  it("uz/ru/en — `payments` kalitlari bir xil", () => {
    const keys = (tree: unknown, prefix = ""): string[] =>
      Object.entries(tree as Record<string, unknown>).flatMap(([key, value]) =>
        typeof value === "string" ? [`${prefix}${key}`] : keys(value, `${prefix}${key}.`),
      );
    const uz = keys({ payments: uzLocale.payments, tabs: uzLocale.tabs }).sort();
    expect(keys({ payments: ruLocale.payments, tabs: ruLocale.tabs }).sort()).toEqual(uz);
    expect(keys({ payments: enLocale.payments, tabs: enLocale.tabs }).sort()).toEqual(uz);
  });
});

describe("todayIso — Toshkent kuni", () => {
  it("UTC 20:30 (Toshkentda ertasi kun 01:30) — Toshkent sanasi", () => {
    expect(todayIso(new Date("2026-11-18T20:30:00Z"))).toBe("2026-11-19");
    expect(todayIso(new Date("2026-11-18T18:59:00Z"))).toBe("2026-11-18");
  });
});
