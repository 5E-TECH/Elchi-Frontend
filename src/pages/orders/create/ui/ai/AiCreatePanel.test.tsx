import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../../test/test-utils";
import { aiApiGet, aiPreview } from "../../../../../test/aiOrderFixtures";

const mocks = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));

vi.mock("../../../../../shared/api/api", () => ({ api: { post: mocks.post, get: mocks.get } }));

import { FormProvider, useForm } from "react-hook-form";
import type { AiConfirmRequest, AiPreviewOrder } from "../../../../../entities/ai-order";
import { ORDER_CREATE_DEFAULT_VALUES, type OrderCreateFormValues } from "../../model/orderCreateForm";
import AiCreatePanel from "./AiCreatePanel";

/**
 * AI BUYURTMA — TASDIQLASH, YARATISH, QISMAN NATIJA (yDLrGAz8).
 */

const marketState = { role: { id: "7", role: "market", region: null, name: "Test market" } } as never;

/** `i`-buyurtma: telefon va narx har xil, ya'ni imzolari ham har xil. */
const order = (i: number, overrides: Partial<AiPreviewOrder> = {}) =>
  aiPreview({
    customer_name: `Mijoz ${i}`,
    phone_number: `+99890${String(1000000 + i).slice(-7)}`,
    total_price: 100000 + i * 1000,
    ...overrides,
  });

let parseOrders: AiPreviewOrder[];
let confirmResponse: (request: AiConfirmRequest) => unknown;

const confirmCalls = () =>
  mocks.post.mock.calls.filter(([url]) => url === "orders/ai-confirm").map(([, body]) => body as AiConfirmRequest);

const renderPanel = () =>
  renderWithProviders(<AiCreatePanel active isMarketRole market={null} onSwitchToManual={vi.fn()} />, {
    preloadedState: marketState,
  });

const parse = async (expectedCards: number) => {
  fireEvent.change(screen.getByRole("textbox", { name: "Buyurtma matni" }), { target: { value: "buyurtmalar matni" } });
  fireEvent.click(screen.getByRole("button", { name: /Tahlil qilish|Qayta tahlil qil/ }));
  if (expectedCards > 0) {
    await waitFor(() => expect(screen.getAllByTestId("ai-preview-card")).toHaveLength(expectedCards));
  }
};

const reparse = async () => {
  fireEvent.click(screen.getByRole("button", { name: "Matnni tahrirlash" }));
  fireEvent.click(screen.getByRole("button", { name: /Tahlil qilish/ }));
};

const allResultsOk = (request: AiConfirmRequest) => ({
  results: request.orders.map((_, index) => ({ index, ok: true, order_id: String(900 + index) })),
});

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  parseOrders = [];
  confirmResponse = allResultsOk;
  mocks.get.mockReset();
  mocks.get.mockImplementation(aiApiGet);
  mocks.post.mockReset();
  mocks.post.mockImplementation((url: string, body: unknown) => {
    if (url === "orders/ai-parse") {
      return Promise.resolve({ data: { statusCode: 200, data: { ok: true, orders: parseOrders } } });
    }
    if (url === "orders/ai-confirm") {
      return Promise.resolve({ data: { statusCode: 200, data: confirmResponse(body as AiConfirmRequest) } });
    }
    return Promise.reject(new Error(`kutilmagan POST ${url}`));
  });
});

describe("AiCreatePanel", () => {
  it("`ready` bo'lmagan kartalar yaratishga umuman yuborilmaydi; tugmadagi N jonli yangilanadi", async () => {
    parseOrders = [order(1), order(2), order(3, { district_id: null, district_name: null })];
    renderPanel();
    await parse(3);

    const bar = screen.getByTestId("ai-confirm-bar");
    expect(bar).toHaveTextContent("2 ta tayyor · 1 ta to'ldirilmagan");
    expect(within(bar).getByRole("button", { name: "Tayyorlarini yaratish — 2 ta" })).toBeEnabled();

    // Bitta tayyor kartani tashlab yuborish — N darhol kamayadi.
    fireEvent.click(within(screen.getAllByTestId("ai-preview-card")[0]).getByRole("button", { name: "Bu buyurtmani tashlab yuborish" }));
    expect(within(bar).getByRole("button", { name: "Tayyorlarini yaratish — 1 ta" })).toBeInTheDocument();

    fireEvent.click(within(bar).getByRole("button", { name: "Tayyorlarini yaratish — 1 ta" }));

    await waitFor(() => expect(confirmCalls()).toHaveLength(1));
    expect(confirmCalls()[0].orders.map((o) => o.customer.name)).toEqual(["Mijoz 2"]);
  });

  it("tayyor karta bo'lmasa tugma disabled (\"Hammasini yaratish\" yo'q)", async () => {
    parseOrders = [order(1, { total_price: null })];
    renderPanel();
    await parse(1);

    expect(screen.getByRole("button", { name: "Tayyorlarini yaratish — 0 ta" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Hammasini/ })).not.toBeInTheDocument();
  });

  it("5 dan ortiq buyurtmada tasdiq oynasi chiqadi va ichida ism/tuman/narx ro'yxati bor", async () => {
    parseOrders = Array.from({ length: 6 }, (_, i) => order(i + 1));
    renderPanel();
    await parse(6);

    fireEvent.click(screen.getByRole("button", { name: "Tayyorlarini yaratish — 6 ta" }));

    const dialog = await screen.findByRole("dialog", { name: "6 ta buyurtma yaratiladi" });
    expect(dialog).toHaveAccessibleDescription("Tuman va narxlarni tekshirdingizmi?");
    const list = within(dialog).getByRole("list", { name: "Yaratiladigan buyurtmalar" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(6);
    // Har qatorda ism, summa va tuman.
    expect(within(rows[0]).getByText("Mijoz 1")).toBeInTheDocument();
    expect(within(rows[0]).getByText("101 000 so'm")).toBeInTheDocument();
    expect(within(rows[0]).getByText("Chilonzor")).toBeInTheDocument();
    expect(confirmCalls()).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Ha, yaratish" }));
    await waitFor(() => expect(confirmCalls()).toHaveLength(1));
  });

  it("10 tadan 7 tasi muvaffaqiyatli: 7 tasi \"Yaratildi\" ro'yxatiga o'tadi, 3 tasi xato matni bilan kartada qoladi", async () => {
    parseOrders = Array.from({ length: 10 }, (_, i) => order(i + 1));
    const failedIndexes = new Set([1, 4, 8]);
    confirmResponse = (request) => ({
      results: request.orders.map((_, index) =>
        failedIndexes.has(index)
          ? { index, ok: false, reason: "tuman topilmadi" }
          : { index, ok: true, order_id: String(900 + index) },
      ),
    });
    renderPanel();
    await parse(10);

    fireEvent.click(screen.getByRole("button", { name: "Tayyorlarini yaratish — 10 ta" }));
    fireEvent.click(screen.getByRole("button", { name: "Ha, yaratish" }));

    const summary = await screen.findByText("7 ta yaratildi · 3 ta xato");
    // Xato bor — natija xabari sariq (`warning`), `role="status"`.
    expect(summary.closest("[data-tone]")).toHaveAttribute("data-tone", "warning");
    expect(summary.closest("[data-tone]")).toHaveAttribute("role", "status");
    const createdRows = within(screen.getByTestId("ai-created-list")).getAllByRole("listitem");
    expect(createdRows).toHaveLength(7);
    expect(createdRows[0]).toHaveTextContent(/^Mijoz 1 · \+998 90 100 00 01Chilonzor · 101 000 so'm · №900$/);
    const remaining = screen.getAllByTestId("ai-preview-card");
    expect(remaining).toHaveLength(3);
    remaining.forEach((card) => expect(within(card).getByText("tuman topilmadi")).toBeInTheDocument());
    expect(remaining.map((card) => (within(card).getByRole("textbox", { name: "Mijoz ismi" }) as HTMLInputElement).value)).toEqual([
      "Mijoz 2",
      "Mijoz 5",
      "Mijoz 9",
    ]);
  });

  it("xato kartadagi maydonni tuzatib qayta yuborish mumkin", async () => {
    parseOrders = [order(1)];
    confirmResponse = () => ({ results: [{ index: 0, ok: false, reason: "telefon noto'g'ri" }] });
    renderPanel();
    await parse(1);
    fireEvent.click(screen.getByRole("button", { name: "Bu kartani yaratish" }));
    expect(await screen.findByText("telefon noto'g'ri")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "Mijoz ismi" }), { target: { value: "Aliyev Vali" } });
    expect(screen.queryByText("telefon noto'g'ri")).not.toBeInTheDocument();
    confirmResponse = allResultsOk;
    fireEvent.click(screen.getByRole("button", { name: "Bu kartani yaratish" }));

    await waitFor(() => expect(confirmCalls()).toHaveLength(2));
    expect(confirmCalls()[1].orders[0].customer.name).toBe("Aliyev Vali");
    await waitFor(() => expect(screen.queryAllByTestId("ai-preview-card")).toHaveLength(0));
  });

  it("yaratilgan buyurtma qayta tahlilda preview'ga qo'shilmaydi va \"o'tkazib yuborildi\" xabari chiqadi", async () => {
    parseOrders = [order(1), order(2)];
    renderPanel();
    await parse(2);
    fireEvent.click(screen.getByRole("button", { name: "Tayyorlarini yaratish — 2 ta" }));
    await waitFor(() => expect(screen.queryAllByTestId("ai-preview-card")).toHaveLength(0));
    // Xatosiz — natija xabari yashil (`success`).
    expect(screen.getByText("2 ta yaratildi · 0 ta xato").closest("[data-tone]")).toHaveAttribute("data-tone", "success");

    parseOrders = [order(1), order(2), order(3)];
    await reparse();

    expect(await screen.findByText("2 ta allaqachon yaratilgan buyurtma o'tkazib yuborildi.")).toBeInTheDocument();
    expect(screen.getAllByTestId("ai-preview-card")).toHaveLength(1);
    expect((screen.getByRole("textbox", { name: "Mijoz ismi" }) as HTMLInputElement).value).toBe("Mijoz 3");
  });

  it("so'rov davomida tugma disabled — ikki marta bosish ikkita POST yubormaydi", async () => {
    parseOrders = [order(1)];
    let resolveConfirm!: (value: unknown) => void;
    mocks.post.mockImplementation((url: string) =>
      url === "orders/ai-parse"
        ? Promise.resolve({ data: { data: { ok: true, orders: parseOrders } } })
        : new Promise((resolve) => (resolveConfirm = resolve)),
    );
    renderPanel();
    await parse(1);

    const button = screen.getByRole("button", { name: "Tayyorlarini yaratish — 1 ta" });
    fireEvent.click(button);
    fireEvent.click(button);

    // Yuklanish holati (`Button loading`): `aria-disabled` + `aria-busy`, bosish bloklangan.
    await waitFor(() => expect(screen.getByRole("button", { name: "Yaratilmoqda..." })).toHaveAttribute("aria-disabled", "true"));
    expect(screen.getByRole("button", { name: "Yaratilmoqda..." })).toHaveAttribute("aria-busy", "true");
    fireEvent.click(screen.getByRole("button", { name: "Yaratilmoqda..." }));
    expect(confirmCalls()).toHaveLength(1);
    resolveConfirm({ data: { data: { results: [{ index: 0, ok: true, order_id: "900" }] } } });
    await waitFor(() => expect(screen.getByTestId("ai-created-list")).toBeInTheDocument());
  });

  it("har yuborishda yangi `request_id` generatsiya qilinadi va payloadga kiradi", async () => {
    parseOrders = [order(1), order(2)];
    renderPanel();
    await parse(2);

    const cards = screen.getAllByTestId("ai-preview-card");
    fireEvent.click(within(cards[0]).getByRole("button", { name: "Bu kartani yaratish" }));
    await waitFor(() => expect(confirmCalls()).toHaveLength(1));
    await waitFor(() => expect(screen.getAllByTestId("ai-preview-card")).toHaveLength(1));
    fireEvent.click(screen.getByRole("button", { name: "Bu kartani yaratish" }));
    await waitFor(() => expect(confirmCalls()).toHaveLength(2));

    const [first, second] = confirmCalls().map((request) => request.request_id);
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(second).toMatch(/^[0-9a-f-]{36}$/);
    expect(first).not.toBe(second);
  });

  it("market roli uchun `market_id` yuborilmaydi; status/region_id yo'q", async () => {
    parseOrders = [order(1)];
    renderPanel();
    await parse(1);

    fireEvent.click(screen.getByRole("button", { name: "Tayyorlarini yaratish — 1 ta" }));

    await waitFor(() => expect(confirmCalls()).toHaveLength(1));
    const request = confirmCalls()[0];
    expect(request).not.toHaveProperty("market_id");
    expect(request.orders[0]).not.toHaveProperty("status");
    expect(request.orders[0]).not.toHaveProperty("region_id");
  });

  it("timeout holatida AVTOMATIK qayta yuborish yo'q, aniq tushuntirish chiqadi", async () => {
    parseOrders = [order(1)];
    mocks.post.mockImplementation((url: string) =>
      url === "orders/ai-parse"
        ? Promise.resolve({ data: { data: { ok: true, orders: parseOrders } } })
        : Promise.reject(
            new AxiosError("timeout of 90000ms exceeded", "ECONNABORTED", {} as InternalAxiosRequestConfig),
          ),
    );
    renderPanel();
    await parse(1);

    fireEvent.click(screen.getByRole("button", { name: "Tayyorlarini yaratish — 1 ta" }));

    expect(await screen.findByText(/Natija noma'lum/)).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(confirmCalls()).toHaveLength(1);
    // Karta joyida qoladi — operator ro'yxatni tekshirib, o'zi qaror qiladi.
    expect(screen.getAllByTestId("ai-preview-card")).toHaveLength(1);
  });

  it("muvaffaqiyatdan keyin `orders` va `dashboard` querylar invalidate bo'ladi", async () => {
    parseOrders = [order(1)];
    const { queryClient } = renderPanel();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    await parse(1);

    fireEvent.click(screen.getByRole("button", { name: "Tayyorlarini yaratish — 1 ta" }));

    await waitFor(() =>
      expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual(
        expect.arrayContaining([["orders"], ["dashboard"]]),
      ),
    );
  });

  it("tasdiqlanmagan `ready` kartalar borida sahifadan chiqishda ogohlantirish chiqadi", async () => {
    parseOrders = [order(1)];
    renderPanel();
    await parse(1);

    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);

    const link = document.createElement("a");
    link.href = "/orders";
    document.body.appendChild(link);
    const click = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    link.dispatchEvent(click);

    // O'tish to'xtatiladi va v2 tasdiqlash oynasi (`useConfirm`) ochiladi — brauzer `confirm()` emas.
    expect(click.defaultPrevented).toBe(true);
    const dialog = await screen.findByRole("alertdialog", { name: "Sahifadan chiqasizmi?" });
    expect(dialog).toHaveTextContent("Tasdiqlanmagan buyurtmalar bor. Sahifadan chiqsangiz ular yo'qoladi.");

    fireEvent.click(screen.getByRole("button", { name: "Qolish" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    // Qolindi — kartalar joyida.
    expect(screen.getAllByTestId("ai-preview-card")).toHaveLength(1);
    link.remove();
  });

  it("hamma karta yaratilgach chiqish ogohlantirishi olib tashlanadi", async () => {
    parseOrders = [order(1)];
    renderPanel();
    await parse(1);
    fireEvent.click(screen.getByRole("button", { name: "Tayyorlarini yaratish — 1 ta" }));
    await waitFor(() => expect(screen.queryAllByTestId("ai-preview-card")).toHaveLength(0));

    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(false);
  });

  it("parse natijasi bo'sh bo'lsa xato emas, \"buyurtma topilmadi\" xabari", async () => {
    parseOrders = [];
    renderPanel();
    await parse(0);

    expect(await screen.findByText("Matnda buyurtma topilmadi.")).toBeInTheDocument();
  });

  it("parse javobidagi `draft_id` har buyurtma bilan ai-confirm ga qaytadi (lYVuADRE #18)", async () => {
    parseOrders = [order(1), order(2)];
    mocks.post.mockImplementation((url: string, body: unknown) => {
      if (url === "orders/ai-parse") {
        return Promise.resolve({
          data: { data: { ok: true, orders: parseOrders, draft_id: "3f0c2a52-8a5b-4c6e-9d0e-1b2c3d4e5f60" } },
        });
      }
      return Promise.resolve({ data: { data: allResultsOk(body as AiConfirmRequest) } });
    });
    renderPanel();
    await parse(2);

    fireEvent.click(screen.getByRole("button", { name: "Tayyorlarini yaratish — 2 ta" }));

    await waitFor(() => expect(confirmCalls()).toHaveLength(1));
    expect(confirmCalls()[0].orders.map((o) => o.draft_id)).toEqual([
      "3f0c2a52-8a5b-4c6e-9d0e-1b2c3d4e5f60",
      "3f0c2a52-8a5b-4c6e-9d0e-1b2c3d4e5f60",
    ]);
  });
  it("⭐ vncdmXOy: har buyurtmaga preview o'rni `ai_item_index` (backend `index`, bo'lmasa javobdagi o'rni) — yaratilganlar chiqarilsa ham asl o'rin", async () => {
    const DRAFT = "3f0c2a52-8a5b-4c6e-9d0e-1b2c3d4e5f60";
    parseOrders = [order(1), order(2)];
    mocks.post.mockImplementation((url: string, body: unknown) => {
      if (url === "orders/ai-parse") return Promise.resolve({ data: { data: { ok: true, orders: parseOrders, draft_id: DRAFT } } });
      return Promise.resolve({ data: { data: allResultsOk(body as AiConfirmRequest) } });
    });
    renderPanel();
    await parse(2);

    fireEvent.click(screen.getByRole("button", { name: "Tayyorlarini yaratish — 2 ta" }));
    await waitFor(() => expect(confirmCalls()).toHaveLength(1));
    expect(confirmCalls()[0].orders.map((o) => o.ai_item_index)).toEqual([0, 1]);
    await waitFor(() => expect(screen.queryAllByTestId("ai-preview-card")).toHaveLength(0));

    // Qayta tahlil: 1–2 allaqachon yaratilgan — kartada faqat 3-buyurtma, o'rni esa javobdagidek 2 (0 emas).
    parseOrders = [order(1), order(2), order(3)];
    await reparse();
    await waitFor(() => expect(screen.getAllByTestId("ai-preview-card")).toHaveLength(1));
    fireEvent.click(screen.getByRole("button", { name: "Tayyorlarini yaratish — 1 ta" }));
    await waitFor(() => expect(confirmCalls()).toHaveLength(2));
    expect(confirmCalls()[1].orders.map((o) => o.ai_item_index)).toEqual([2]);
  });

  it("vncdmXOy: backend preview `index` bersa — o'shasi yuboriladi", async () => {
    parseOrders = [order(1, { index: 7 }), order(2, { index: 4 })];
    mocks.post.mockImplementation((url: string, body: unknown) => {
      if (url === "orders/ai-parse") return Promise.resolve({ data: { data: { ok: true, orders: parseOrders, draft_id: "d-1" } } });
      return Promise.resolve({ data: { data: allResultsOk(body as AiConfirmRequest) } });
    });
    renderPanel();
    await parse(2);

    fireEvent.click(screen.getByRole("button", { name: "Tayyorlarini yaratish — 2 ta" }));
    await waitFor(() => expect(confirmCalls()).toHaveLength(1));
    expect(confirmCalls()[0].orders.map((o) => o.ai_item_index)).toEqual([7, 4]);
  });

  it("ai-confirm kodi tarjima qilinadi: `duplicate_recent` → mavjud buyurtma raqami bilan (6LSlbHoi)", async () => {
    parseOrders = [order(1), order(2)];
    confirmResponse = () => ({
      results: [
        { index: 0, ok: false, code: "duplicate_recent", order_id: "512", reason: "server matni" },
        { index: 1, ok: false, code: "district_mismatch", reason: "server matni" },
      ],
    });
    renderPanel();
    await parse(2);

    fireEvent.click(screen.getByRole("button", { name: "Tayyorlarini yaratish — 2 ta" }));

    const [first, second] = await waitFor(() => {
      const cards = screen.getAllByTestId("ai-preview-card");
      expect(within(cards[0]).getByText(/allaqachon yaratilgan \(#512\)/)).toBeInTheDocument();
      return cards;
    });
    expect(within(first).queryByText("server matni")).not.toBeInTheDocument();
    expect(within(second).getByText(/Mijoz tumani buyurtma tumani bilan bir xil emas/)).toBeInTheDocument();
  });

  it("⭐ j3WEDIpt duplicate_recent: karta «Mavjud (#48)», «Bu kartani yaratish» o'chiq, №48 ga havola; xulosa warning; qayta yuborilmaydi", async () => {
    parseOrders = [order(1), order(2)];
    confirmResponse = () => ({
      results: [
        { index: 0, ok: false, code: "duplicate_recent", order_id: "48", reason: "server matni" },
        { index: 1, ok: true, order_id: "901" },
      ],
    });
    renderPanel();
    await parse(2);
    fireEvent.click(screen.getByRole("button", { name: "Tayyorlarini yaratish — 2 ta" }));

    const summary = await screen.findByText("1 ta yaratildi · 1 ta xato");
    expect(summary.closest("[data-tone]")).toHaveAttribute("data-tone", "warning");
    const [card] = screen.getAllByTestId("ai-preview-card");
    expect(card).toHaveAttribute("data-existing", "");
    expect(within(card).getByText("Mavjud (#48)")).toBeInTheDocument();
    expect(within(card).queryByText("Tayyor")).not.toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Bu kartani yaratish" })).toBeDisabled();
    expect(within(card).getByText("Bu buyurtma allaqachon bor").closest("[data-tone]")).toHaveAttribute("data-tone", "warning");
    expect(within(card).getByRole("link", { name: "№48 ni ochish" })).toHaveAttribute("href", "/orders/edit/48");
    // Yaratish paneli uni na tayyor, na to'ldirilmagan deb sanaydi — yuboradigan narsa yo'q.
    expect(screen.getByRole("button", { name: /Tayyorlarini yaratish/ })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /To'ldirilmagan/ })).not.toBeInTheDocument();
    expect(confirmCalls()).toHaveLength(1);

    // Ma'lumot tuzatilsa — yangi urinish: karta yana «Tayyor», yaratish mumkin.
    fireEvent.change(within(card).getByRole("textbox", { name: "Mijoz ismi" }), { target: { value: "Boshqa mijoz" } });
    expect(within(card).getByText("Tayyor")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Bu kartani yaratish" })).toBeEnabled();
  });

  it("xodim market tanlamagan bo'lsa: ko'rsatma va market tanlash maydoni, AI kirish paneli yo'q", () => {
    // Market maydoni sahifaning umumiy formasida — panel uni shu yerdan o'qiydi.
    const Harness = () => {
      const methods = useForm<OrderCreateFormValues>({ defaultValues: ORDER_CREATE_DEFAULT_VALUES });
      return (
        <FormProvider {...methods}>
          <AiCreatePanel active isMarketRole={false} market={null} onSwitchToManual={vi.fn()} onChangeMarket={vi.fn()} />
        </FormProvider>
      );
    };
    renderWithProviders(<Harness />, {
      preloadedState: { role: { id: "1", role: "admin", region: null, name: "Admin" } } as never,
    });

    const hint = screen.getByText("Avval marketni tanlang — AI buyurtmalarni shu market nomidan yaratadi.");
    expect(hint.closest("[data-tone]")).toHaveAttribute("data-tone", "info");
    expect(screen.getByRole("button", { name: /Market tanlash/ })).toHaveAttribute("aria-haspopup", "dialog");
    expect(screen.queryByRole("textbox", { name: "Buyurtma matni" })).not.toBeInTheDocument();
  });

  describe("telefon 390px (JzQIec06)", () => {
    it("\"To'ldirilmagan (N)\" keyingi TAYYOR BO'LMAGAN kartaga scroll qiladi, oxiridan keyin boshiga qaytadi", async () => {
      parseOrders = [
        order(1),
        order(2, { district_id: null, district_name: null }),
        order(3),
        order(4, { total_price: null }),
      ];
      renderPanel();
      await parse(4);

      const cards = screen.getAllByTestId("ai-preview-card");
      const unready = [cards[1], cards[3]];
      // Ekran balandligi 800: 2-karta markazdan pastda (500), 4-karta yanada pastda (1400).
      const tops = new Map<HTMLElement, number>([
        [unready[0], 500],
        [unready[1], 1400],
      ]);
      const scrolled: HTMLElement[] = [];
      vi.spyOn(window, "innerHeight", "get").mockReturnValue(800);
      for (const card of unready) {
        card.getBoundingClientRect = () => ({ top: tops.get(card) ?? 0 }) as DOMRect;
        card.scrollIntoView = vi.fn(() => {
          scrolled.push(card);
          // Ekran tepasiga keldi: undan keyingilar yuqoriga suriladi.
          const shift = tops.get(card) ?? 0;
          for (const other of unready) tops.set(other, (tops.get(other) ?? 0) - shift);
        });
      }

      const jump = within(screen.getByTestId("ai-confirm-bar")).getByRole("button", { name: "To'ldirilmagan (2)" });
      fireEvent.click(jump);
      fireEvent.click(jump);
      fireEvent.click(jump);

      expect(scrolled).toEqual([unready[0], unready[1], unready[0]]);
      expect(unready[0].scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    });

    it("hamma karta tayyor bo'lsa \"To'ldirilmagan\" tugmasi yo'q", async () => {
      parseOrders = [order(1), order(2)];
      renderPanel();
      await parse(2);
      expect(screen.queryByRole("button", { name: /To'ldirilmagan/ })).not.toBeInTheDocument();
    });
  });
});
