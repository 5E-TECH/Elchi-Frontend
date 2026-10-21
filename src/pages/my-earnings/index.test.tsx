import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/test-utils";
import i18n from "../../i18n";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../../shared/api/api", () => ({
  api: { get: mocks.get, patch: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

import MyEarningsPage from "./index";

/**
 * «Daromadim» (`/my-earnings`, MO-2; maketlar `market_operator-earnings`, `-earnings-no-commission` — qisman):
 * «Stavkam» kartasi `GET auth/my-profile` dan, stavka yo'q — ogohlantirish; «Hisob», «To'lovlar», «Daromadlar»
 * (Taklif · backend kerak) chizilmaydi va so'ralmaydi.
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

beforeEach(() => {
  mocks.get.mockReset();
});

describe("MyEarningsPage — «Daromadim»", () => {
  it("foiz stavkasi: qiymat, turi, belgilovchi, namuna va izoh; ogohlantirish yo'q", async () => {
    mocks.get.mockResolvedValue(profile({ commission_type: "percent", commission_value: "5.00" }));
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

    // Faqat profil so'raladi — moliya (`finance/operators/*`) so'rovlari yo'q (backend 403, MO-6).
    expect(mocks.get.mock.calls.map(([url]) => url)).toEqual(["auth/my-profile"]);
    // «Taklif · backend kerak» bloklari chizilmaydi.
    for (const title of ["Hisob", "To'lovlar", "Daromadlar"]) {
      expect(screen.queryByRole("heading", { name: title })).not.toBeInTheDocument();
    }
    expect(screen.queryByText(/Taklif/)).not.toBeInTheDocument();
  });

  it("qat'iy summa: «3 000 so'm» va «har sotilgan buyurtma uchun»; namunada summaning o'zi", async () => {
    mocks.get.mockResolvedValue(profile({ commission_type: "fixed", commission_value: 3000 }));
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
    mocks.get.mockResolvedValue(profile(extra));
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
    mocks.get
      .mockRejectedValueOnce(httpError(500, "identity.user.profile RPC timeout"))
      .mockResolvedValue(profile({ commission_type: "percent", commission_value: 5 }));
    renderPage();

    const card = await rateCard();
    expect(await within(card).findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText(/RPC timeout/)).not.toBeInTheDocument();
    await user.click(within(card).getByRole("button", { name: "Qayta urinish" }));
    await waitFor(() => expect(screen.getByTestId("operator-rate-value")).toHaveTextContent("5%"));
  });

  it("ru/en: sarlavha va karta tarjimasi", async () => {
    mocks.get.mockResolvedValue(profile({ commission_type: "percent", commission_value: 5 }));
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
