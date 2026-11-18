import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/test-utils";
import i18n from "../../i18n";
import uzSidebar from "../../locales/uz/sidebar.json";
import ruSidebar from "../../locales/ru/sidebar.json";
import enSidebar from "../../locales/en/sidebar.json";
import uzPage from "../../locales/uz/myEarnings.json";
import ruPage from "../../locales/ru/myEarnings.json";
import enPage from "../../locales/en/myEarnings.json";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../../shared/api/api", () => ({
  api: { get: mocks.get, patch: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

import MyEarningsPage from "./index";

/**
 * «Daromadim» (`/my-earnings`, MO-2; maketlar `market_operator-earnings`, `-earnings-no-commission`):
 * «Stavkam» kartasi `GET auth/my-profile` dan, stavka yo'q — ogohlantirish; F2qp6FtE / 37vonCdg — «Hisob»
 * (`finance/operators/me/balance`) va «To'lovlar» (`/me/payments`, faqat o'qish). «Daromadlar» hali chizilmaydi.
 */

const profile = (extra: Record<string, unknown>) => ({
  statusCode: 200,
  message: "ok",
  data: { id: "9", name: "Dilnoza Karimova", role: "market_operator", status: "active", market_id: "1", ...extra },
});

const operatorState = {
  role: { id: "9", role: "market_operator", region: null, name: "Dilnoza Karimova" },
} as never;

const renderPage = () => renderWithProviders(<MyEarningsPage />, { route: "/my-earnings", preloadedState: operatorState });

/** «Stavkam» kartasi — profil yuklangach (yuklanish skeletida ham shu sarlavha bor). */
const rateCard = async () => {
  await waitFor(() => expect(document.querySelector('[data-query-state="loading"]')).toBeNull());
  return screen.getByRole("heading", { level: 2, name: "Stavkam" }).closest("section") as HTMLElement;
};

const httpError = (status: number, message: string) =>
  Object.assign(new Error(message), { isAxiosError: true, response: { status, data: { message } } });

/** `/me/*` — hisob va to'lovlar (profil har testda alohida beriladi). */
const ME_BALANCE = { statusCode: 200, data: { operator_id: "9", earned: 1286500, paid: 1100000, balance: 186500 } };
const ME_PAYMENTS = {
  statusCode: 200,
  data: {
    rows: [
      { id: "3", operator_id: "9", amount: 300000, note: "Sentabr, 2-qism", paid_at: "2026-10-01", status: "active", createdAt: "2026-10-01T05:05:00.000Z" },
      { id: "2", operator_id: "9", amount: 200000, note: "Xato", paid_at: "2026-09-20", status: "cancelled", cancelled_at: "2026-09-21T05:00:00.000Z", cancel_reason: "Summa xato" },
    ],
    total: 2,
    limit: 10,
    offset: 0,
  },
};
const ME_EARNINGS = { statusCode: 200, data: { rows: [], total: 82, limit: 1, offset: 0 } };

/** Profil javobi (yoki ketma-ket javoblar) + `/me/*` doimiy javoblari. */
const mockApi = (...profiles: unknown[]) => {
  const queue = [...profiles];
  mocks.get.mockImplementation((url: string) => {
    if (url === "finance/operators/me/balance") return Promise.resolve({ data: ME_BALANCE });
    if (url === "finance/operators/me/payments") return Promise.resolve({ data: ME_PAYMENTS });
    if (url === "finance/operators/me/earnings") return Promise.resolve({ data: ME_EARNINGS });
    const next = queue.length > 1 ? queue.shift() : queue[0];
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  });
};

beforeEach(() => {
  mocks.get.mockReset();
});

describe("MyEarningsPage — «Daromadim»", () => {
  it("foiz stavkasi: qiymat, turi, belgilovchi, namuna va izoh; ogohlantirish yo'q", async () => {
    mockApi(profile({ commission_type: "percent", commission_value: "5.00" }));
    renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "Daromadim" })).toBeInTheDocument();
    expect(screen.getByText("Sotilgan buyurtmalaringiz uchun komissiya")).toBeInTheDocument();
    const card = await rateCard();
    expect(within(card).getByTestId("operator-rate-value")).toHaveTextContent("5%");
    expect(card).toHaveTextContent("har sotilgan buyurtma narxidan");
    expect(card).toHaveTextContent("TuriFoiz");
    expect(card).toHaveTextContent("BelgilaydiMarket egasi");
    expect(card).toHaveTextContent("Namuna250 000 so'm → 12 500 so'm");
    expect(card).toHaveTextContent("Stavka o'zgarsa, faqat keyingi sotuvlarga qo'llanadi.");
    expect(screen.queryByText("Komissiya belgilanmagan — daromad yozilmaydi")).not.toBeInTheDocument();

    // F2qp6FtE: faqat o'z `/me/*` yo'llari (operator_id — token), boshqa operator yoki market yo'llari yo'q.
    const urls = [...new Set(mocks.get.mock.calls.map(([url]) => url as string))].sort();
    expect(urls).toEqual([
      "auth/my-profile",
      "finance/operators/me/balance",
      "finance/operators/me/earnings",
      "finance/operators/me/payments",
    ]);
    // «Daromadlar» hali chizilmaydi; «Taklif · backend kerak» belgisi kodga ko'chirilmaydi.
    expect(screen.queryByRole("heading", { name: "Daromadlar" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Taklif/)).not.toBeInTheDocument();
  });

  it("«Hisob»: Qoldiq · Daromad («82 ta sotilgan buyurtmadan») · To'langan («Oxirgisi»); «To'lovlar» — faqat o'qish, bekor qilingan belgisi bilan", async () => {
    mockApi(profile({ commission_type: "percent", commission_value: 5 }));
    renderPage();

    const account = screen.getByRole("region", { name: "Hisob" });
    await waitFor(() => expect(account).toHaveTextContent("186 500"));
    expect(account).toHaveTextContent("Sizga to'lanishi kerak");
    expect(account).toHaveTextContent("1 286 500");
    await waitFor(() => expect(account).toHaveTextContent("82 ta sotilgan buyurtmadan"));
    expect(account).toHaveTextContent("1 100 000");
    expect(account).toHaveTextContent("Oxirgisi: 01.10.2026");

    const payments = screen.getByRole("heading", { level: 2, name: "To'lovlar" }).closest("section") as HTMLElement;
    const table = await within(payments).findByRole("table", { name: "To'lovlar" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("300 000 so'm");
    expect(rows[0]).toHaveTextContent("Sentabr, 2-qism");
    expect(rows[0]).toHaveTextContent("01.10.2026");
    expect(rows[1]).toHaveTextContent("Bekor qilingan");
    expect(rows[1]).toHaveTextContent("Sabab: Summa xato");
    expect(payments).toHaveTextContent("2 ta to'lov");
    await waitFor(() => expect(payments).toHaveTextContent("Jami: 1 100 000 so'm"));
    // Faqat o'qish: yozish / bekor qilish tugmalari yo'q.
    expect(within(payments).queryByRole("button", { name: /to'lov|bekor/i })).toBeNull();
  });

  it("qat'iy summa: «3 000 so'm» va «har sotilgan buyurtma uchun»; namunada summaning o'zi", async () => {
    mockApi(profile({ commission_type: "fixed", commission_value: 3000 }));
    renderPage();

    const card = await rateCard();
    expect(within(card).getByTestId("operator-rate-value")).toHaveTextContent("3 000so'm");
    expect(card).toHaveTextContent("har sotilgan buyurtma uchun");
    expect(card).toHaveTextContent("TuriQat'iy summa");
    expect(card).toHaveTextContent("Namuna250 000 so'm → 3 000 so'm");
  });

  it.each([
    ["turi yo'q", { commission_type: null, commission_value: null }],
    ["qiymati 0", { commission_type: "percent", commission_value: 0 }],
  ])("komissiya belgilanmagan (%s) — ogohlantirish, «Belgilanmagan», «Turi —», namunasiz", async (_case, extra) => {
    mockApi(profile(extra));
    renderPage();

    const title = await screen.findByText("Komissiya belgilanmagan — daromad yozilmaydi");
    expect(title.closest('[role="status"]')).not.toBeNull();
    expect(
      screen.getByText(
        "Market egasi sizga stavka belgilamaguncha sotuvlaringiz uchun daromad hisoblanmaydi. U bilan bog'laning.",
      ),
    ).toBeInTheDocument();
    const card = await rateCard();
    expect(within(card).getByText("Belgilanmagan")).toBeInTheDocument();
    expect(card).toHaveTextContent("Turi—");
    expect(card).toHaveTextContent("BelgilaydiMarket egasi");
    expect(card).not.toHaveTextContent("Namuna");
    expect(within(card).queryByTestId("operator-rate-value")).not.toBeInTheDocument();
    expect(card).toHaveTextContent("Stavka belgilanmaguncha daromad yozilmaydi. Market egasi bilan bog'laning.");
  });

  it("profil yuklanmasa — karta ichida xato (xom backend matnisiz) va «Qayta urinish»", async () => {
    const user = userEvent.setup();
    mockApi(httpError(500, "identity.user.profile RPC timeout"), profile({ commission_type: "percent", commission_value: 5 }));
    renderPage();

    const card = await rateCard();
    expect(await within(card).findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText(/RPC timeout/)).not.toBeInTheDocument();
    await user.click(within(card).getByRole("button", { name: "Qayta urinish" }));
    await waitFor(() => expect(screen.getByTestId("operator-rate-value")).toHaveTextContent("5%"));
  });

  it("ogohlantirish sahifa kengligida, «Hisob» ustida (maket `-earnings-no-commission`)", async () => {
    mockApi(profile({ commission_type: null, commission_value: null }));
    renderPage();

    const alert = (await screen.findByText("Komissiya belgilanmagan — daromad yozilmaydi")).closest('[role="status"]');
    expect(alert).not.toHaveClass("max-w-xl");
    const account = screen.getByRole("region", { name: "Hisob" });
    expect(alert!.compareDocumentPosition(account) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it.each([
    ["bo'sh", { data: null }],
    ["id siz obyekt", { data: { statusCode: 200, message: "ok" } }],
    ["matn", { data: "<html>Bad gateway</html>" }],
  ])("javobda profil yo'q (%s) — «Belgilanmagan» emas, xato va «Qayta urinish»", async (_case, malformed) => {
    const user = userEvent.setup();
    mockApi(malformed, profile({ commission_type: "percent", commission_value: 5 }));
    renderPage();

    const card = await rateCard();
    expect(await within(card).findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("Komissiya belgilanmagan — daromad yozilmaydi")).not.toBeInTheDocument();
    expect(within(card).queryByText("Belgilanmagan")).not.toBeInTheDocument();
    await user.click(within(card).getByRole("button", { name: "Qayta urinish" }));
    await waitFor(() => expect(screen.getByTestId("operator-rate-value")).toHaveTextContent("5%"));
  });

  it.each([
    ["uz", uzSidebar, uzPage],
    ["ru", ruSidebar, ruPage],
    ["en", enSidebar, enPage],
  ])("%s: menyu bandi nomi sahifa sarlavhasi bilan bir xil", (_lang, sidebar, page) => {
    expect(sidebar.earnings).toBe(page.title);
  });

  it("ru/en: sarlavha va karta tarjimasi", async () => {
    mockApi(profile({ commission_type: "percent", commission_value: 5 }));
    await i18n.changeLanguage("ru");
    try {
      const { unmount } = renderPage();
      expect(await screen.findByRole("heading", { level: 1, name: "Мой доход" })).toBeInTheDocument();
      expect(await screen.findByText("Владелец маркета")).toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 2, name: "Моя ставка" })).toBeInTheDocument();
      unmount();
      await i18n.changeLanguage("en");
      renderPage();
      expect(await screen.findByRole("heading", { level: 1, name: "My earnings" })).toBeInTheDocument();
      expect(await screen.findByText("Market owner")).toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 2, name: "My rate" })).toBeInTheDocument();
    } finally {
      await i18n.changeLanguage("uz");
    }
  });
});
