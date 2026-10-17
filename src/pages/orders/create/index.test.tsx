import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { aiApiGet } from "../../../test/aiOrderFixtures";

const mocks = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));

vi.mock("../../../shared/api/api", () => ({
  api: { post: mocks.post, get: mocks.get, patch: vi.fn(), delete: vi.fn() },
}));

import OrderCreate from "./index";

/**
 * /new-orders/create — "QO'LDA" VA "AI BILAN" REJIMLARI (DUFZDG5r) + dizayn v2 (maketlar
 * `*-create-manual-step1`, `*-create-market-picker-dialog`, `*-create-manual-step2`,
 * `market-new-orders-create-manual`).
 */

const marketState = {
  role: { id: "7", role: "market", region: null, name: "Test market" },
} as never;
const adminState = {
  role: { id: "1", role: "superadmin", region: null, name: "Admin" },
} as never;

const MARKETS = [
  { id: 3, name: "Baraka Shop", phone_number: "+998903152241", status: "active" },
  { id: 4, name: "Nur Elektronika", phone_number: "+998936041872", status: "active" },
];

/** `markets` ro'yxati bilan soxta GET (qolgani — AI namunalari). */
const getWithMarkets = (url: string) =>
  url === "markets"
    ? Promise.resolve({ data: { statusCode: 200, message: "ok", data: MARKETS } })
    : aiApiGet(url);

// «Yaratish usuli» — v2 segment (`radiogroup` + `radio`, `aria-checked`).
const tab = (name: "Qo'lda" | "AI bilan") =>
  within(screen.getByRole("radiogroup", { name: "Yaratish usuli" })).getByRole("radio", { name });

const aiPanel = () => screen.getByTestId("ai-mode-panel");
const manualPanel = () => screen.getByTestId("manual-mode-panel");

/** v2 `Select` (qidiruvli combobox): ochiladi va portaldagi ro'yxatdan variant tanlanadi. */
const pickOption = async (user: ReturnType<typeof userEvent.setup>, comboboxId: string, option: string) => {
  const combobox = document.getElementById(comboboxId) as HTMLElement;
  await waitFor(() => expect(combobox).toBeEnabled());
  await user.click(combobox);
  await user.click(await screen.findByRole("option", { name: option }));
};

/** Admin: 1-qadamda tanlash oynasidan marketni tanlaydi. */
const chooseMarket = async (user: ReturnType<typeof userEvent.setup>, name = "Baraka Shop") => {
  await user.click(screen.getByRole("button", { name: /^Market/ }));
  const dialog = await screen.findByRole("dialog", { name: "Market tanlash" });
  await user.click(await within(dialog).findByRole("option", { name: new RegExp(name) }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Market tanlash" })).not.toBeInTheDocument());
};

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  mocks.get.mockReset();
  mocks.get.mockImplementation(aiApiGet);
  mocks.post.mockReset();
  mocks.post.mockResolvedValue({ data: { statusCode: 200, data: { ok: true, orders: [] } } });
});

describe("OrderCreate — rejim tablari", () => {
  it("sukut bo'yicha \"Qo'lda\" tabi faol va qo'lda forma avvalgidek ko'rinadi", () => {
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });

    expect(tab("Qo'lda")).toHaveAttribute("aria-checked", "true");
    expect(tab("AI bilan")).toHaveAttribute("aria-checked", "false");
    expect(manualPanel()).not.toHaveClass("hidden");
    expect(aiPanel()).toHaveClass("hidden");
    expect(within(manualPanel()).getByPlaceholderText("Ism kiriting")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buyurtma yaratish" })).toBeInTheDocument();
  });

  it("\"AI bilan\" tabida Step2Combined o'rniga AI paneli chiqadi, xulosa va «Orqaga» ko'rinmaydi", () => {
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });

    fireEvent.click(tab("AI bilan"));

    expect(tab("AI bilan")).toHaveAttribute("aria-checked", "true");
    expect(aiPanel()).not.toHaveClass("hidden");
    expect(manualPanel()).toHaveClass("hidden");
    expect(within(aiPanel()).getByRole("textbox", { name: "Buyurtma matni" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Buyurtma yaratish" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Orqaga" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Orqaga" })).not.toBeInTheDocument();
  });

  it("tab almashganda qo'lda forma qiymatlari (ism, summa) yo'qolmaydi", () => {
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });
    fireEvent.change(within(manualPanel()).getByPlaceholderText("Ism kiriting"), { target: { value: "Vali" } });
    fireEvent.change(screen.getByLabelText(/^Umumiy summa/), { target: { value: "150000" } });

    fireEvent.click(tab("AI bilan"));
    fireEvent.click(tab("Qo'lda"));

    expect((within(manualPanel()).getByPlaceholderText("Ism kiriting") as HTMLInputElement).value).toBe("Vali");
    expect((screen.getByLabelText(/^Umumiy summa/) as HTMLInputElement).value).toBe("150 000");
  });

  it("AI→Qo'lda→AI: kiritilgan matn saqlanib qoladi", () => {
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });
    fireEvent.click(tab("AI bilan"));
    fireEvent.change(within(aiPanel()).getByRole("textbox", { name: "Buyurtma matni" }), { target: { value: "Vali 90 123 45 67" } });

    fireEvent.click(tab("Qo'lda"));
    fireEvent.click(tab("AI bilan"));

    expect((within(aiPanel()).getByRole("textbox", { name: "Buyurtma matni" }) as HTMLTextAreaElement).value).toBe("Vali 90 123 45 67");
  });

  it("admin/registrator uchun market tanlanmagan bo'lsa AI tabi \"Avval marketni tanlang\" va market tanlashni ko'rsatadi", () => {
    renderWithProviders(<OrderCreate />, { preloadedState: adminState });

    fireEvent.click(tab("AI bilan"));

    expect(within(aiPanel()).getByText(/Avval marketni tanlang/)).toBeInTheDocument();
    expect(within(aiPanel()).queryByRole("textbox", { name: "Buyurtma matni" })).not.toBeInTheDocument();
    expect(within(aiPanel()).getByText("Market tanlash")).toBeInTheDocument();
  });

  it("market roli bilan AI tabi darhol ishlaydi (market so'ralmaydi)", () => {
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });

    fireEvent.click(tab("AI bilan"));

    expect(within(aiPanel()).queryByText(/Avval marketni tanlang/)).not.toBeInTheDocument();
    expect(within(aiPanel()).getByRole("textbox", { name: "Buyurtma matni" })).toBeInTheDocument();
  });

  it("AI tugmalari qo'lda formani submit QILMAYDI — POST /orders chaqirilmaydi", async () => {
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });
    fireEvent.click(tab("AI bilan"));
    fireEvent.change(within(aiPanel()).getByRole("textbox", { name: "Buyurtma matni" }), { target: { value: "Vali 90 123 45 67" } });

    fireEvent.click(within(aiPanel()).getByRole("button", { name: "Tahlil qilish" }));
    // Enter bilan implicit submit ham qo'lda buyurtma yaratmasin.
    fireEvent.submit(aiPanel().closest("form") as HTMLFormElement);

    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith("orders/ai-parse", expect.anything(), expect.anything()));
    expect(mocks.post.mock.calls.map(([url]) => url)).not.toContain("orders");
  });

  it("backend `reason: \"disabled\"` qaytarsa tushuntirish chiqadi va \"Qo'lda yaratish\" Qo'lda tabiga o'tkazadi", async () => {
    mocks.post.mockResolvedValue({ data: { statusCode: 200, data: { ok: false, reason: "disabled" } } });
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });
    fireEvent.click(tab("AI bilan"));
    fireEvent.change(within(aiPanel()).getByRole("textbox", { name: "Buyurtma matni" }), { target: { value: "matn" } });
    fireEvent.click(within(aiPanel()).getByRole("button", { name: "Tahlil qilish" }));

    fireEvent.click(await within(aiPanel()).findByRole("button", { name: "Qo'lda yaratish" }));

    expect(tab("Qo'lda")).toHaveAttribute("aria-checked", "true");
    expect(manualPanel()).not.toHaveClass("hidden");
  });

  it("market tanlangach yon ustundagi «Yangi buyurtmalar» kartasi ikkala tabda ham ko'rinadi", async () => {
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });
    const card = await screen.findByRole("region", { name: "Yangi buyurtmalar" });
    expect(within(card).getByText("Test market · bugun")).toBeInTheDocument();
    // Market roli: «Jami N ta»; bo'sh ro'yxat — v2 bo'sh holati.
    expect(within(card).getByText("Jami 0 ta")).toBeInTheDocument();
    expect(await within(card).findByText("Bugun yangi buyurtma yo'q")).toBeInTheDocument();

    fireEvent.click(tab("AI bilan"));

    expect(within(card).getByText("Bugun yangi buyurtma yo'q")).toBeVisible();
    expect(mocks.get).toHaveBeenCalledWith("orders/markets/7/new", expect.anything());
  });

  it("market roli telefonda ro'yxat o'rniga havola-karta: «Bugungi yangi buyurtmalar, N ta» → yangi buyurtmalar", async () => {
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });

    const card = await screen.findByRole("region", { name: "Yangi buyurtmalar" });
    expect(card).toHaveClass("max-md:hidden");
    const link = screen.getByRole("link", { name: "Bugungi yangi buyurtmalar, 0 ta" });
    expect(link).toHaveAttribute("href", "/new-orders/7");
    expect(link).toHaveClass("hidden", "max-md:flex");
    expect(link).toHaveTextContent("Test market · bugun · 0 ta");
  });

  it("bugungi buyurtma qatori — tafsilotga havola: ism, summa, №, tuman, holat va yetkazish turi", async () => {
    mocks.get.mockImplementation((url: string) =>
      url === "orders/markets/7/new"
        ? Promise.resolve({
            data: {
              statusCode: 200,
              data: [
                {
                  id: "10259",
                  status: "new",
                  where_deliver: "center",
                  total_price: 232500,
                  paid_amount: 0,
                  to_be_paid: 232500,
                  createdAt: "2026-01-02T09:49:00.000Z",
                  comment: null,
                  address: null,
                  customer: { id: "c1", name: "Ozoda Qayumova", phone_number: "+998901112233", district: { name: "Zangiota" } },
                },
              ],
            },
          })
        : aiApiGet(url),
    );
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });

    const card = await screen.findByRole("region", { name: "Yangi buyurtmalar" });
    const row = await within(card).findByRole("link", { name: /Ozoda Qayumova/ });
    expect(row).toHaveAttribute("href", "/new-orders/7/edit/10259");
    expect(row).toHaveTextContent("232 500 so'm");
    expect(row).toHaveTextContent(/№10259 · Zangiota · /);
    expect(row).toHaveTextContent("Markazgacha");
    expect(within(card).getByText("Jami 1 ta")).toBeInTheDocument();
  });

  it("segment telefonda sarlavha ostida to'liq enli (dropdown yo'q), ikonkali variantlar", () => {
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });
    const tabs = screen.getByTestId("create-mode-tabs");
    const group = within(tabs).getByRole("radiogroup", { name: "Yaratish usuli" });

    expect(tabs).toHaveClass("max-md:w-full");
    expect(group).toHaveClass("max-md:w-full");
    expect(within(tabs).queryByRole("button", { expanded: false })).not.toBeInTheDocument();
    for (const option of within(group).getAllByRole("radio")) {
      expect(option).toHaveClass("max-md:min-h-11");
      expect(option.querySelector("svg")).not.toBeNull();
    }
  });

  it("ai-availability `enabled:false` bo'lsa AI tabi UMUMAN ko'rinmaydi, faqat qo'lda oqim (HD5zOyBp #9)", async () => {
    mocks.get.mockImplementation((url: string) =>
      url === "orders/ai-availability"
        ? Promise.resolve({ data: { statusCode: 200, data: { enabled: false, state: "disabled" } } })
        : aiApiGet(url),
    );
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });

    await waitFor(() => expect(screen.queryByTestId("create-mode-tabs")).not.toBeInTheDocument());
    expect(screen.queryByTestId("ai-mode-panel")).not.toBeInTheDocument();
    expect(manualPanel()).not.toHaveClass("hidden");
    expect(screen.getByRole("button", { name: "Buyurtma yaratish" })).toBeInTheDocument();
  });

  it("ai-availability so'rovi yiqilsa (eski backend) tab YASHIRILMAYDI", async () => {
    mocks.get.mockImplementation((url: string) =>
      url === "orders/ai-availability" ? Promise.reject(new Error("404")) : aiApiGet(url),
    );
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });

    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith("orders/ai-availability"));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByTestId("create-mode-tabs")).toBeInTheDocument();
    expect(tab("AI bilan")).toBeInTheDocument();
  });
});

describe("OrderCreate — sahifa sarlavhasi (dizayn v2)", () => {
  it("«← Qabul va yaratish» havolasi, h1 «Yangi buyurtma»; 1-qadamda izoh «qadamlarni bajaring»", () => {
    renderWithProviders(<OrderCreate />, { preloadedState: adminState });

    expect(screen.getByRole("heading", { level: 1, name: "Yangi buyurtma" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Qabul va yaratish" })).toHaveAttribute("href", "/new-orders");
    expect(screen.getByText("Buyurtma yaratish uchun qadamlarni bajaring")).toBeInTheDocument();
  });

  it("market roli: izoh «Tanlangan market: <nom>»", () => {
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });

    const header = screen.getByRole("heading", { level: 1, name: "Yangi buyurtma" }).closest("header") as HTMLElement;
    expect(header).toHaveTextContent("Tanlangan market: Test market");
    expect(within(header).getByText("Test market").tagName).toBe("STRONG");
  });
});

describe("OrderCreate — 1-qadam: market tanlash (admin)", () => {
  it("market tanlanmaguncha «Keyingi» o'chiq, holat «Avval market tanlang», yon ustun yo'q", () => {
    renderWithProviders(<OrderCreate />, { preloadedState: adminState });

    const nav = screen.getByRole("navigation", { name: "Qadamlar" });
    expect(within(nav).getAllByRole("listitem")[0]).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("region", { name: "Market tanlang" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keyingi" })).toBeDisabled();
    expect(screen.getByRole("status", { name: "" })).toHaveTextContent("Avval market tanlang");
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Orqaga" })).toHaveAttribute("href", "/new-orders");
  });

  it("tanlash oynasi: qidiruv, «Marketlar» ro'yxati; tanlangach maydonda nom va telefon, «Keyingi» faol", async () => {
    mocks.get.mockImplementation(getWithMarkets);
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: adminState });

    const trigger = screen.getByRole("button", { name: /^Market/ });
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    await user.click(trigger);

    const dialog = await screen.findByRole("dialog", { name: "Market tanlash" });
    expect(dialog).toHaveTextContent("Marketlar soni ko'p bo'lsa ham ro'yxat shu panel ichida qoladi");
    const search = within(dialog).getByRole("combobox", { name: "Market qidirish" });
    await waitFor(() => expect(search).toHaveFocus());
    expect(search).toHaveAttribute("placeholder", "Market qidirish...");
    const list = within(dialog).getByRole("listbox", { name: "Marketlar" });
    const option = await within(list).findByRole("option", { name: /Baraka Shop/ });
    expect(option).toHaveAttribute("aria-selected", "false");
    expect(option).toHaveTextContent("+998 90 315 22 41");

    await user.click(option);

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Market tanlash" })).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: /^Market.*Baraka Shop/ })).toBeInTheDocument();
    expect(screen.getByText("Boshqa market tanlash uchun ro'yxatni oching")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keyingi" })).toBeEnabled();
    expect(screen.getByText("Keyingi bosqichga o'tish uchun ma'lumotlar tayyor")).toBeInTheDocument();
    // Market tanlangach yon ustunda uning bugungi buyurtmalari.
    expect(await screen.findByRole("region", { name: "Yangi buyurtmalar" })).toHaveTextContent("Baraka Shop · bugun");
  });

  it("klaviatura: qidiruvda ↓ va Enter marketni tanlaydi (sahifa formasi yuborilmaydi)", async () => {
    mocks.get.mockImplementation(getWithMarkets);
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: adminState });

    await user.click(screen.getByRole("button", { name: /^Market/ }));
    const dialog = await screen.findByRole("dialog", { name: "Market tanlash" });
    await within(dialog).findByRole("option", { name: /Nur Elektronika/ });
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Market tanlash" })).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: /^Market.*Nur Elektronika/ })).toBeInTheDocument();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("«Tozalash» tanlangan marketni olib tashlaydi, «Keyingi» yana o'chiq", async () => {
    mocks.get.mockImplementation(getWithMarkets);
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: adminState });
    await chooseMarket(user);

    await user.click(screen.getByRole("button", { name: "Tanlangan marketni tozalash" }));

    expect(screen.getByRole("button", { name: /^Market/ })).toHaveTextContent("Market tanlash");
    expect(screen.getByRole("button", { name: "Keyingi" })).toBeDisabled();
  });

  it("«Keyingi» → 2-qadam; «O'zgartirish» va «Oldingi» 1-qadamga qaytaradi, market saqlanadi", async () => {
    mocks.get.mockImplementation(getWithMarkets);
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: adminState });
    await chooseMarket(user);

    await user.click(screen.getByRole("button", { name: "Keyingi" }));

    const nav = screen.getByRole("navigation", { name: "Qadamlar" });
    expect(within(nav).getAllByRole("listitem")[1]).toHaveAttribute("aria-current", "step");
    expect(nav).toHaveTextContent("1-qadam · Market");
    expect(nav).toHaveTextContent("Baraka Shop");
    // Bosilgan «Keyingi» yo'qoldi — fokus «Qadamlar» da (body'ga tushib qolmaydi).
    expect(nav.parentElement).toHaveFocus();
    const header = screen.getByRole("heading", { level: 1, name: "Yangi buyurtma" }).closest("header") as HTMLElement;
    expect(header).toHaveTextContent("Majburiy maydonlar * bilan belgilangan");

    await user.click(within(nav).getByRole("button", { name: "Marketni o'zgartirish" }));
    expect(screen.getByRole("region", { name: "Market tanlang" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Market.*Baraka Shop/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Keyingi" }));
    await user.click(screen.getByRole("button", { name: "Oldingi" }));
    expect(screen.getByRole("region", { name: "Market tanlang" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Market.*Baraka Shop/ })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Qadamlar" }).parentElement).toHaveFocus();
  });

  it("1-qadamga qaytib BOSHQA market tanlansa — tasdiq oynasi; tasdiqlansa eski market katalog mahsulotlari olib tashlanadi, katalogsiz mahsulot qoladi", async () => {
    mocks.get.mockImplementation(getWithMarkets);
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: adminState });
    await chooseMarket(user);
    await user.click(screen.getByRole("button", { name: "Keyingi" }));

    const catalog = await screen.findByRole("list", { name: "Baraka Shop katalogi" });
    await user.click(await within(catalog).findByRole("button", { name: /Telefon ushlagich/ }));
    await user.type(screen.getByLabelText("Katalogda yo'q mahsulot"), "Bant{Enter}");
    expect(within(screen.getByRole("list", { name: "Tanlangan mahsulotlar" })).getAllByRole("listitem")).toHaveLength(2);

    // Shu marketning o'zi qayta tanlansa — hech narsa yo'qolmaydi.
    await user.click(screen.getByRole("button", { name: "Oldingi" }));
    await user.click(screen.getByRole("button", { name: "Keyingi" }));
    expect(within(screen.getByRole("list", { name: "Tanlangan mahsulotlar" })).getAllByRole("listitem")).toHaveLength(2);

    // Boshqa market: katalog mahsuloti (Baraka Shop'niki) ketadi, «Bant» qoladi.
    await user.click(screen.getByRole("button", { name: "Oldingi" }));
    await chooseMarket(user, "Nur Elektronika");
    await user.click(screen.getByRole("button", { name: "Keyingi" }));

    // Jimgina o'chmaydi: avval tasdiq (ega qarori 2026-10-17).
    const dialog = await screen.findByRole("alertdialog", { name: "Marketni almashtirasizmi?" });
    expect(dialog).toHaveTextContent(
      "«Nur Elektronika» tanlansa, «Baraka Shop» katalogidan qo'shilgan mahsulotlar (1 ta) buyurtmadan olib tashlanadi. Katalogda yo'q mahsulotlar qoladi.",
    );
    await user.click(within(dialog).getByRole("button", { name: "Marketni almashtirish" }));

    const selected = await screen.findByRole("list", { name: "Tanlangan mahsulotlar" });
    expect(within(selected).getAllByRole("listitem")).toHaveLength(1);
    expect(within(selected).getByText("Bant")).toBeInTheDocument();
    expect(within(selected).queryByText("Telefon ushlagich")).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Qadamlar" })).toHaveTextContent("Nur Elektronika");
  });

  it("market almashtirish tasdig'i bekor qilinsa — market eskisiga qaytadi, mahsulotlar o'chmaydi", async () => {
    mocks.get.mockImplementation(getWithMarkets);
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: adminState });
    await chooseMarket(user);
    await user.click(screen.getByRole("button", { name: "Keyingi" }));

    const catalog = await screen.findByRole("list", { name: "Baraka Shop katalogi" });
    await user.click(await within(catalog).findByRole("button", { name: /Telefon ushlagich/ }));

    await user.click(screen.getByRole("button", { name: "Oldingi" }));
    await chooseMarket(user, "Nur Elektronika");
    await user.click(screen.getByRole("button", { name: "Keyingi" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Marketni almashtirasizmi?" });
    await user.click(within(dialog).getByRole("button", { name: "Bekor qilish" }));

    // 1-qadamda qolinadi, tanlov eski marketga qaytdi.
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(screen.getByRole("region", { name: "Market tanlang" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Market.*Baraka Shop/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Keyingi" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    const selected = await screen.findByRole("list", { name: "Tanlangan mahsulotlar" });
    expect(within(selected).getByText("Telefon ushlagich")).toBeInTheDocument();
  });

  it("katalog mahsuloti yo'q bo'lsa market almashtirishda tasdiq so'ralmaydi", async () => {
    mocks.get.mockImplementation(getWithMarkets);
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: adminState });
    await chooseMarket(user);
    await user.click(screen.getByRole("button", { name: "Keyingi" }));
    await user.type(await screen.findByLabelText("Katalogda yo'q mahsulot"), "Bant{Enter}");

    await user.click(screen.getByRole("button", { name: "Oldingi" }));
    await chooseMarket(user, "Nur Elektronika");
    await user.click(screen.getByRole("button", { name: "Keyingi" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Tanlangan mahsulotlar" })).getByText("Bant")).toBeInTheDocument();
  });

  it("2-qadamdan qaytib kelganda tuman SAQLANADI (qayta mount tumanni tozalamaydi), viloyat almashsa tozalanadi", async () => {
    mocks.get.mockImplementation(getWithMarkets);
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: adminState });
    await chooseMarket(user);
    await user.click(screen.getByRole("button", { name: "Keyingi" }));

    await pickOption(user, "customer.region_id", "Toshkent shahri • 1726");
    await pickOption(user, "customer.district_id", "Chilonzor • 1726269");
    expect(within(screen.getByRole("complementary", { name: "Buyurtma xulosasi" })).getByText("Chilonzor")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Oldingi" }));
    await user.click(screen.getByRole("button", { name: "Keyingi" }));

    expect(document.getElementById("customer.district_id")).toHaveValue("Chilonzor • 1726269");

    await pickOption(user, "customer.region_id", "Samarqand viloyati • 1718");
    await waitFor(() => expect(document.getElementById("customer.district_id")).toHaveValue(""));
  });
});

describe("OrderCreate — 2-qadam: mijoz, manzil, mahsulotlar va xulosa", () => {
  it("yetkazish turi — ikki radio-karta; «Uygacha» tanlansa «Manzil» majburiy bo'ladi", () => {
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });

    const group = screen.getByRole("group", { name: /Yetkazish turi/ });
    const center = within(group).getByRole("radio", { name: /Markazgacha/ });
    const home = within(group).getByRole("radio", { name: /Uygacha/ });
    expect(center).toBeChecked();
    expect(screen.getByLabelText(/^Manzil/)).not.toHaveAttribute("aria-required");

    fireEvent.click(home);

    expect(home).toBeChecked();
    expect(home.closest("label")).toHaveClass("border-action", "bg-action-soft");
    expect(screen.getByLabelText(/^Manzil/)).toHaveAttribute("aria-required", "true");
  });

  it("katalog: «Qo'shish» → «Qo'shilgan», tanlanganlarda son tanlagich (− 1 da o'chiq) va olib tashlash", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });

    const catalog = await screen.findByRole("list", { name: "Test market katalogi" });
    const product = await within(catalog).findByRole("button", { name: /Telefon ushlagich/ });
    expect(product).toHaveTextContent("45 000 so'm");
    expect(product).toHaveTextContent("Qo'shish");
    expect(screen.getByText("Mahsulot tanlang")).toBeInTheDocument();

    await user.click(product);

    expect(product).toHaveTextContent("Qo'shilgan");
    const selected = screen.getByRole("list", { name: "Tanlangan mahsulotlar" });
    const stepper = within(selected).getByRole("group", { name: "Telefon ushlagich soni" });
    expect(within(stepper).getByRole("button", { name: "Telefon ushlagich sonini kamaytirish" })).toBeDisabled();
    await user.click(within(stepper).getByRole("button", { name: "Telefon ushlagich sonini oshirish" }));
    expect(stepper).toHaveTextContent("2");
    // Qayta bosish ham sonni oshiradi (avvalgidek).
    await user.click(product);
    expect(stepper).toHaveTextContent("3");
    expect(screen.getByText("1 ta mahsulot tanlangan")).toBeInTheDocument();
    expect(within(screen.getByRole("complementary", { name: "Buyurtma xulosasi" })).getByText("1 ta · 3 dona")).toBeInTheDocument();

    await user.click(within(selected).getByRole("button", { name: "Telefon ushlagichni olib tashlash" }));
    expect(screen.queryByRole("list", { name: "Tanlangan mahsulotlar" })).not.toBeInTheDocument();
  });

  it("katalogda yo'q mahsulot: nom + soni, Enter yoki «Qo'shish» bilan; «Katalogdan tashqari»", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });

    const name = screen.getByLabelText("Katalogda yo'q mahsulot");
    const qty = screen.getByRole("group", { name: "Yangi mahsulot soni" });
    const add = name.closest("[data-field]")!.querySelector("button:not([aria-label])") as HTMLButtonElement;
    expect(add).toHaveTextContent("Qo'shish");
    expect(add).toBeDisabled();
    expect(within(qty).getByRole("button", { name: "Yangi mahsulot sonini kamaytirish" })).toBeDisabled();

    await user.type(name, "Sovg'a qadog'i");
    await user.click(within(qty).getByRole("button", { name: "Yangi mahsulot sonini oshirish" }));
    await user.click(add);

    const selected = screen.getByRole("list", { name: "Tanlangan mahsulotlar" });
    expect(within(selected).getByText("Sovg'a qadog'i")).toBeInTheDocument();
    expect(within(selected).getByText("Katalogdan tashqari")).toBeInTheDocument();
    expect(within(selected).getByRole("group", { name: "Sovg'a qadog'i soni" })).toHaveTextContent("2");
    expect(name).toHaveValue("");

    await user.type(name, "Bant{Enter}");
    expect(within(selected).getByText("Bant")).toBeInTheDocument();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("market roli: xulosada «Market» qatori yo'q, pastda «Orqaga» → /new-orders", () => {
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });

    const aside = screen.getByRole("complementary", { name: "Buyurtma xulosasi" });
    expect(within(aside).queryByText("Market")).not.toBeInTheDocument();
    expect(within(aside).getByRole("link", { name: "Orqaga" })).toHaveAttribute("href", "/new-orders");
    expect(within(aside).getByText("Mijozdan olinadigan jami summa")).toBeInTheDocument();
    expect(within(aside).getByRole("status")).toHaveTextContent("Majburiy maydonlarni to'ldirib, mahsulot tanlang");
    expect(within(aside).getByRole("button", { name: "Buyurtma yaratish" })).toBeDisabled();
  });

  it("to'liq buyurtma: holat «Buyurtma yuborishga tayyor», POST /orders payload avvalgidek, keyin forma tozalanadi", async () => {
    mocks.post.mockResolvedValue({ data: { statusCode: 201, data: { id: "o1" } } });
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });

    await user.type(screen.getByRole("textbox", { name: /^Telefon/ }), "901234567");
    expect(screen.getByRole("textbox", { name: /^Telefon/ })).toHaveValue("90 123 45 67");
    await user.type(screen.getByLabelText(/^Mijoz ismi/), "Aliyev Vali");
    await pickOption(user, "customer.region_id", "Toshkent shahri • 1726");
    await pickOption(user, "customer.district_id", "Chilonzor • 1726269");
    await user.type(screen.getByLabelText(/^Manzil/), "Chilonzor 19-kvartal");
    await user.click(await screen.findByRole("button", { name: /Telefon ushlagich/ }));
    await user.type(screen.getByLabelText(/^Umumiy summa/), "150000");
    expect(screen.getByLabelText(/^Umumiy summa/)).toHaveValue("150 000");

    const aside = screen.getByRole("complementary", { name: "Buyurtma xulosasi" });
    expect(within(aside).getByRole("status")).toHaveTextContent("Buyurtma yuborishga tayyor");
    const submit = within(aside).getByRole("button", { name: "Buyurtma yaratish" });
    expect(submit).toHaveAttribute("type", "submit");
    await user.click(submit);

    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith("orders", expect.anything()));
    expect(mocks.post.mock.calls.find(([url]) => url === "orders")?.[1]).toEqual({
      customer: {
        name: "Aliyev Vali",
        phone_number: "+998901234567",
        district_id: "101",
        address: "Chilonzor 19-kvartal",
      },
      items: [{ product_id: "501", quantity: 1 }],
      district_id: "101",
      region_id: "11",
      total_price: 150000,
      where_deliver: "center",
      address: "Chilonzor 19-kvartal",
    });
    await waitFor(() => expect(screen.getByLabelText(/^Mijoz ismi/)).toHaveValue(""));
  });

  it("server xatosi forma tepasida v2 ogohlantirish («Buyurtma yaratilmadi»), maydon xatosi maydonda", async () => {
    mocks.post.mockRejectedValue({
      response: { data: { message: "Telefon noto'g'ri", errors: { phone_number: "Telefon noto'g'ri" } } },
    });
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });

    await user.type(screen.getByRole("textbox", { name: /^Telefon/ }), "901234567");
    await user.type(screen.getByLabelText(/^Mijoz ismi/), "Vali");
    await pickOption(user, "customer.region_id", "Toshkent shahri • 1726");
    await pickOption(user, "customer.district_id", "Chilonzor • 1726269");
    await user.click(await screen.findByRole("button", { name: /Telefon ushlagich/ }));
    await user.type(screen.getByLabelText(/^Umumiy summa/), "1000");
    await user.click(screen.getByRole("button", { name: "Buyurtma yaratish" }));

    const alert = await within(manualPanel()).findByRole("alert");
    expect(alert).toHaveTextContent("Buyurtma yaratilmadi");
    expect(alert).toHaveTextContent("Telefon noto'g'ri");
    expect(alert).toHaveClass("bg-danger-soft");
    expect(screen.getByRole("textbox", { name: /^Telefon/ })).toHaveAttribute("aria-invalid", "true");
  });
});

describe("OrderCreate — telefonda mijoz bloki (duIKLi7n)", () => {
  it("forma gridlari telefonda bir ustunga tushadi (auto-fit + min(…,100%) yoki max-md:grid-cols-1) — yashirin ikkinchi ustun yo'q", () => {
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });

    const panel = manualPanel();
    // Prefiksiz `col-span-2` telefondagi bitta ustunli gridda yashirin ikkinchi ustun yaratardi.
    expect(Array.from(panel.querySelectorAll("*")).filter((el) => el.classList.contains("col-span-2"))).toHaveLength(0);
    const formGrids = Array.from(panel.querySelectorAll<HTMLElement>(".grid")).filter((el) => !el.matches("li"));
    expect(formGrids.length).toBeGreaterThanOrEqual(4);
    for (const grid of formGrids) {
      // auto-fit + min(…,100%) yoki aniq «telefonda bitta ustun».
      expect(grid.className).toMatch(
        /grid-cols-\[repeat\(auto-fit,minmax\(min\(\d+px,100%\),1fr\)\)\]|grid-cols-2 .*max-md:grid-cols-1/,
      );
    }
  });

  it("+998 prefiksiga bosish fokusni telefon maydoniga o'tkazadi", () => {
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });

    for (const label of [/^Telefon/, /^Qo'shimcha raqam/]) {
      const input = within(manualPanel()).getByLabelText(label);
      const prefix = within(input.parentElement as HTMLElement).getByText("+998");
      fireEvent.mouseDown(prefix);
      expect(input).toHaveFocus();
    }
  });
});

describe("OrderCreate — maydonlar v2 Field geometriyasida (viloyat/tuman Select bilan tekis)", () => {
  it("har maydon v2 yorliq bilan bog'langan va Select bilan bir xil quti o'lchamida", () => {
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });

    const region = within(manualPanel()).getByRole("combobox", { name: /^Viloyat/ });
    const regionBox = region.closest("[class*='bg-input']") as HTMLElement;
    expect(regionBox).toHaveClass("h-10", "max-md:h-11");
    const labelClass = document.getElementById(`${region.id}-label`)?.className;

    const fields: Array<[RegExp, string, string[]]> = [
      [/^Telefon/, "customer.phone", ["h-10", "max-md:h-11", "rounded-[10px]", "bg-input"]],
      [/^Qo'shimcha raqam/, "customer.extra_phone", ["h-10", "max-md:h-11", "rounded-[10px]", "bg-input"]],
      [/^Mijoz ismi/, "customer.name", ["h-10", "max-md:h-11", "rounded-[10px]", "bg-input"]],
      // Umumiy summa — maketdagi `.el-input-lg` (48 px) + valyuta.
      [/^Umumiy summa/, "details.total_price", ["h-12", "rounded-xl", "bg-input"]],
      [/^Operator/, "details.operator", ["h-10", "max-md:h-11", "rounded-[10px]", "bg-input"]],
    ];
    for (const [label, id, boxClasses] of fields) {
      const input = screen.getByLabelText(label);
      expect(input, id).toHaveAttribute("id", id);
      expect(input.parentElement, id).toHaveClass(...boxClasses);
      // Yorliq — Select bilan bir xil v2 `.el-label`.
      expect(document.querySelector(`label[for="${id}"]`)?.className, id).toBe(labelClass);
    }

    expect(screen.getByLabelText(/^Mijoz ismi/)).toHaveAttribute("aria-required", "true");
    expect(screen.getByLabelText(/^Umumiy summa/).parentElement).toHaveTextContent("so'm");
    expect(screen.getByLabelText(/^Manzil/)).toHaveClass("min-h-[88px]");
    expect(screen.getByLabelText(/^Izoh/)).toHaveClass("min-h-[88px]");
  });
});
