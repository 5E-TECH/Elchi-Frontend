import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CourierOrders from "./index";
import { renderWithProviders } from "../../../../test/test-utils";
import { getActiveScanTarget } from "../../../../shared/lib/scanner/scanTargets";
import { PHONE_QUERY } from "../../../../shared/ui/primitives/date/useIsPhone";
import {
  clearPendingExtraCostApproval,
  recordPendingExtraCostApproval,
} from "../../../../entities/orders/extraCostApproval";

/**
 * Kuryer «Buyurtmalar» — dizayn v2 (maketlar `courier-orders-pending` · `-all` · `-cancelled` ·
 * `-tab-switcher-open`): tablar → so'rov holati, qidiruv va sana → API parametrlari, bekor
 * qilinganlarda tanlov paneli, telefonda kartalar va pastki yuborish paneli, qatordagi amallar.
 */

const COURIER_ID = "56";

type Row = Record<string, unknown> & { id: string };

const order = (id: string, name: string, over: Record<string, unknown> = {}): Row => ({
  id,
  created_at: "2026-10-01T08:00:00.000Z",
  status: "waiting",
  total_price: 150000,
  where_deliver: "center",
  product_quantity: 1,
  market: { name: "Baraka Shop" },
  customer: { name, phone_number: "+998902146631" },
  district: { name: "Qibray tumani" },
  region: { name: "Toshkent vil." },
  items: [],
  holder_type: "COURIER",
  holder_courier_id: COURIER_ID,
  ...over,
});

const state: {
  rows: Row[];
  total?: number;
  isLoading: boolean;
  /** Shu parametrlar uchun javob hali kelmagan (masalan 2-sahifa yuklanmoqda). */
  loadingWhen?: (params: Record<string, unknown>) => boolean;
  calls: Array<Record<string, unknown>>;
} = { rows: [], isLoading: false, calls: [] };

const sendToPost = vi.fn();
const idle = { mutate: vi.fn(), isPending: false };

vi.mock("../../../../entities/orders", () => ({
  useOrders: () => ({
    useGetOrderCourier: (params: Record<string, unknown>) => {
      state.calls.push(params);
      return state.isLoading || state.loadingWhen?.(params)
        ? { data: undefined, isLoading: true, isFetching: true, isPending: true }
        : {
            data: { data: state.rows, total: state.total ?? state.rows.length, page: 1, limit: 10 },
            isLoading: false,
          };
    },
    SellOrder: idle,
    PartlySellOrder: idle,
    RollbackOrder: idle,
    CancelOrder: idle,
    SendToPost: { mutate: sendToPost, isPending: false },
  }),
}));

const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="location">{location.search}</output>;
};

const courierState = {
  role: { id: COURIER_ID, role: "courier", region: null, name: "Kuryer" },
} as never;

const renderPage = (route = "/orders?status=waiting") =>
  renderWithProviders(
    <>
      <CourierOrders />
      <LocationProbe />
    </>,
    { route, preloadedState: courierState },
  );

const lastCall = () => state.calls.at(-1) ?? {};
const search = () => new URLSearchParams(screen.getByTestId("location").textContent ?? "");

const mockPhone = (matches: boolean) => {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: matches && query === PHONE_QUERY,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
};

beforeEach(() => {
  state.rows = [];
  state.total = undefined;
  state.isLoading = false;
  state.loadingWhen = undefined;
  state.calls = [];
  sendToPost.mockReset();
});

describe("Kuryer buyurtmalari — sarlavha, tablar va so'rov (v2)", () => {
  it("sarlavha «Buyurtmalar», izohda API jami soni; tablar maketdagidek", () => {
    state.rows = [order("1001", "Laylo Hasanova")];
    state.total = 7;
    renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "Buyurtmalar" })).toBeInTheDocument();
    expect(screen.getByText("Jami 7 ta buyurtma")).toBeInTheDocument();
    const tablist = screen.getByRole("tablist", { name: "Holat bo'yicha" });
    expect(within(tablist).getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Kutilayotgan",
      "Barchasi",
      "Bekor qilingan",
    ]);
    expect(screen.getByRole("tab", { name: "Kutilayotgan" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("region", { name: "Kutilayotgan buyurtmalar" })).toBeInTheDocument();
  });

  it("tab almashsa so'rov holati darhol o'zgaradi va URL yangilanadi", async () => {
    const user = userEvent.setup();
    state.rows = [order("1001", "Laylo Hasanova")];
    renderPage();
    expect(lastCall()).toMatchObject({ status: "waiting", page: 1, limit: 10 });

    await user.click(screen.getByRole("tab", { name: "Barchasi" }));
    expect(lastCall()).not.toHaveProperty("status");
    expect(search().get("status")).toBeNull();

    await user.click(screen.getByRole("tab", { name: "Bekor qilingan" }));
    expect(lastCall()).toMatchObject({ status: "cancelled" });
    expect(search().get("status")).toBe("cancelled");
  });

  it("qidiruv: Enter darhol, yozish 600 ms dan keyin — `search` va 1-sahifa", async () => {
    const user = userEvent.setup();
    state.rows = [order("1001", "Laylo Hasanova")];
    renderPage("/orders?status=waiting&page=3");

    const input = screen.getByRole("searchbox", { name: "Buyurtmalarni ism, telefon yoki raqam bo'yicha qidirish" });
    await user.type(input, "Laylo{Enter}");
    expect(lastCall()).toMatchObject({ search: "Laylo", page: 1 });
    expect(search().get("orderSearch")).toBe("Laylo");

    await user.clear(input);
    await user.type(input, "9021");
    await waitFor(() => expect(lastCall()).toMatchObject({ search: "9021" }), { timeout: 2000 });
  });

  it("sana oralig'i URL'dan `startDate` / `endDate` bo'lib ketadi; bekor qilinganlarda qidiruv va sana yuborilmaydi", async () => {
    const user = userEvent.setup();
    state.rows = [order("1001", "Laylo Hasanova", { status: "cancelled" })];
    renderPage("/orders?status=waiting&startDay=2026-10-01&endDay=2026-10-08&orderSearch=Laylo");
    expect(lastCall()).toMatchObject({ startDate: "2026-10-01", endDate: "2026-10-08", search: "Laylo" });

    await user.click(screen.getByRole("tab", { name: "Bekor qilingan" }));
    expect(lastCall()).toMatchObject({ status: "cancelled" });
    expect(lastCall()).not.toHaveProperty("search");
    expect(lastCall()).not.toHaveProperty("startDate");
    // Maketda bu tabda qidiruv yo'q — skaner bloki.
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.getByRole("region", { name: "Skanerlash" })).toHaveTextContent("Skaner bilan tanlash");
  });

  it("filtr natija bermasa — «Buyurtmalar topilmadi» va «Filtrlarni tozalash» URL'ni tozalaydi", async () => {
    const user = userEvent.setup();
    renderPage("/orders?status=waiting&orderSearch=zzz&startDay=2026-10-01&endDay=2026-10-08");

    expect(screen.getByText("Buyurtmalar topilmadi")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Filtrlarni tozalash" }));
    expect(search().get("orderSearch")).toBeNull();
    expect(search().get("startDay")).toBeNull();
    expect(search().get("status")).toBe("waiting");
  });

  it("sahifa almashganda yangi javob kelguncha sahifalash va «Jami N» turadi, fokus bosilgan tugmada qoladi", async () => {
    const user = userEvent.setup();
    state.rows = [order("1001", "Laylo Hasanova")];
    state.total = 24;
    state.loadingWhen = (params) => params.page === 2;
    renderPage();

    const pages = screen.getByRole("navigation", { name: "Sahifalar" });
    const second = within(pages).getByRole("button", { name: "2" });
    second.focus();
    await user.keyboard("{Enter}");

    expect(lastCall()).toMatchObject({ page: 2 });
    expect(search().get("page")).toBe("2");
    // Oldingi javob turibdi: sarlavha soni skeletga almashmaydi, sahifalash o'chmaydi.
    expect(screen.getByText("Jami 24 ta buyurtma")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Sahifalar" })).toBeInTheDocument();
    expect(document.activeElement).not.toBe(document.body);
    expect(screen.getByRole("navigation", { name: "Sahifalar" })).toContainElement(document.activeElement as HTMLElement);
  });

  it("tab almashsa eski tab javobi ko'rsatilmaydi — sarlavhada skelet", async () => {
    const user = userEvent.setup();
    state.rows = [order("1001", "Laylo Hasanova")];
    state.total = 7;
    state.loadingWhen = (params) => params.status === undefined;
    renderPage();
    expect(screen.getByText("Jami 7 ta buyurtma")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Barchasi" }));
    expect(screen.queryByText(/^Jami/)).toBeNull();
    expect(screen.queryByText("Laylo Hasanova")).toBeNull();
  });

  it("filtrsiz bo'sh ro'yxat — avvalgi matn", () => {
    renderPage();
    expect(screen.getByText("Buyurtmalar mavjud emas")).toBeInTheDocument();
  });
});

describe("Kuryer buyurtmalari — jadval qatori (v2)", () => {
  it("ustunlar, № havolasi, telefon — qo'ng'iroq havolasi, yetkazish va holat badge'i", () => {
    state.rows = [order("1001", "Laylo Hasanova", { where_deliver: "address", status: "on the road" })];
    renderPage();

    const table = screen.getByRole("table", { name: "Kutilayotgan buyurtmalar" });
    expect(within(table).getAllByRole("columnheader").map((th) => th.textContent)).toEqual([
      "Buyurtma",
      "Mijoz",
      "Tuman / viloyat",
      "Market",
      "Holat",
      "Yetkazish",
      "Summa",
      "Amallar",
    ]);
    const row = screen.getByText("Laylo Hasanova").closest("tr")!;
    expect(within(row).getByRole("link", { name: "№1001" })).toHaveAttribute("href", expect.stringMatching(/edit\/1001$/));
    expect(
      within(row).getByRole("link", { name: "Laylo Hasanovaga qo'ng'iroq qilish, +998 90 214 66 31" }),
    ).toHaveAttribute("href", "tel:+998902146631");
    expect(within(row).getByText("Uygacha")).toBeInTheDocument();
    expect(within(row).getByText("Yo'lda")).toBeInTheDocument();
    expect(within(row).getByText("Toshkent vil.")).toBeInTheDocument();
  });

  it("«Barchasi»: faol — Sotish + Bekor qilish, sotilgan — Qayta tiklash, to'langan — «Amal yo'q»", async () => {
    const user = userEvent.setup();
    state.rows = [
      order("1001", "Faol mijoz"),
      order("1002", "Sotilgan mijoz", { status: "sold" }),
      order("1003", "To'langan mijoz", { status: "paid" }),
    ];
    renderPage();
    await user.click(screen.getByRole("tab", { name: "Barchasi" }));

    const active = screen.getByText("Faol mijoz").closest("tr")!;
    expect(within(active).getByRole("button", { name: "№1001 ni sotish" })).toHaveTextContent("Sotish");
    expect(within(active).getByRole("button", { name: "№1001 ni bekor qilish" })).toBeInTheDocument();

    const sold = screen.getByText("Sotilgan mijoz").closest("tr")!;
    const restore = within(sold).getByRole("button", { name: "№1002 ni kutilayotgan holatga qayta tiklash" });
    expect(restore).toHaveAttribute("title", "Kutilmoqda holatiga qaytarish");

    const paid = screen.getByText("To'langan mijoz").closest("tr")!;
    expect(within(paid).queryAllByRole("button", { name: /sotish|bekor qilish|qayta tiklash/ })).toHaveLength(0);
    expect(within(paid).getByText("Amal yo'q")).toBeInTheDocument();
  });

  it("«Kutilayotgan» (`?status=sold` havolasi): sotilgan qatorda ishlamaydigan «Qayta tiklash» chizilmaydi", () => {
    state.rows = [order("1002", "Sotilgan mijoz", { status: "sold" })];
    renderPage("/orders?status=sold");

    expect(lastCall()).toMatchObject({ status: "sold" });
    const sold = screen.getByText("Sotilgan mijoz").closest("tr")!;
    expect(within(sold).queryByRole("button", { name: /qayta tiklash/ })).toBeNull();
    expect(within(sold).getByText("Amal yo'q")).toBeInTheDocument();
  });

  it("«Qayta tiklash» — maketdagi tasdiq oynasi ochiladi", async () => {
    const user = userEvent.setup();
    state.rows = [order("1002", "Sotilgan mijoz", { status: "sold" })];
    renderPage();
    await user.click(screen.getByRole("tab", { name: "Barchasi" }));
    await user.click(screen.getByRole("button", { name: "№1002 ni kutilayotgan holatga qayta tiklash" }));

    const dialog = await screen.findByRole("alertdialog", { name: "Holatni qayta tiklash" });
    expect(within(dialog).getByRole("button", { name: "Ha, qayta tiklash" })).toBeInTheDocument();
  });

  it("saralash sahifa ichida: sukut — yangilari tepada, «Summa» bosilsa narx bo'yicha", async () => {
    const user = userEvent.setup();
    state.rows = [
      order("1001", "Eski arzon", { created_at: "2026-10-01T08:00:00.000Z", total_price: 50000 }),
      order("1002", "Yangi qimmat", { created_at: "2026-10-05T08:00:00.000Z", total_price: 900000 }),
      order("1003", "O'rta", { created_at: "2026-10-03T08:00:00.000Z", total_price: 300000 }),
    ];
    renderPage();
    const names = () =>
      screen.getAllByRole("row").slice(1).map((row) => within(row).getAllByRole("cell")[1].querySelector("div")?.textContent);

    expect(screen.getByRole("columnheader", { name: /Buyurtma/ })).toHaveAttribute("aria-sort", "descending");
    expect(names()).toEqual(["Yangi qimmat", "O'rta", "Eski arzon"]);

    await user.click(screen.getByRole("button", { name: /Summa/ }));
    expect(names()).toEqual(["Eski arzon", "O'rta", "Yangi qimmat"]);
  });

  it("№ nusxalanadi — xabar «Buyurtma raqami nusxalandi»", async () => {
    const user = userEvent.setup();
    state.rows = [order("1001", "Laylo Hasanova")];
    renderPage();

    await user.click(screen.getByRole("button", { name: "№1001 raqamini nusxalash" }));
    expect(await screen.findByText("Buyurtma raqami nusxalandi")).toBeInTheDocument();
    await expect(navigator.clipboard.readText()).resolves.toBe("1001");
  });

  it("market tasdig'ini kutayotgan buyurtma — «Tasdiq kutilmoqda», maslahatda amal, summa va vaqt", () => {
    const requestedAt = new Date();
    requestedAt.setHours(10, 52, 0, 0);
    recordPendingExtraCostApproval({
      orderId: "1001",
      action: "sell",
      amount: 20000,
      requestedAt: requestedAt.toISOString(),
      orderStatus: "waiting",
    });
    try {
      state.rows = [order("1001", "Kamron Ahmedov")];
      renderPage();
      const badge = within(screen.getByText("Kamron Ahmedov").closest("tr")!).getByText("Tasdiq kutilmoqda");
      expect(badge).toHaveAttribute(
        "title",
        expect.stringMatching(/^Sotish: 20\D000 so'm qo'shimcha xarajat 10:52 da market tasdig'iga yuborilgan$/),
      );
    } finally {
      clearPendingExtraCostApproval("1001");
    }
  });

  it("ustun kalitlari takrorlanmaydi (eski jadvaldagi «customer»/«id» kalit ogohlantirishi yo'q)", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    state.rows = [order("1001", "Laylo Hasanova"), order("1002", "Javohir Toshmatov")];
    renderPage();
    expect(consoleError.mock.calls.flat().join(" ")).not.toMatch(/same key/i);
    consoleError.mockRestore();
  });

  it("yuklanmoqda: sarlavha izohi skelet, ro'yxat `aria-busy`", () => {
    state.isLoading = true;
    renderPage();
    expect(screen.queryByText(/^Jami/)).toBeNull();
    expect(screen.getByRole("region", { name: "Kutilayotgan buyurtmalar" }).querySelector("[aria-busy='true']")).not.toBeNull();
  });
});

describe("Kuryer buyurtmalari — bekor qilinganlarni pochtaga yuborish (v2)", () => {
  const cancelledRows = () => [
    order("2001", "Malika Yusupova", { status: "cancelled" }),
    order("2002", "Bekzod Aliyev", { status: "cancelled" }),
    order("2003", "Jo'natilgan", { status: "cancelled", transport_status: "cancelled (sent)" }),
  ];

  it("faqat jo'natilmaganlar; tanlansa panel «2 / 2 ta buyurtma tanlandi», yuborish va tanlovni bekor qilish", async () => {
    const user = userEvent.setup();
    state.rows = cancelledRows();
    renderPage("/orders?status=cancelled");

    expect(screen.queryByText("Jo'natilgan")).toBeNull();
    expect(screen.queryByRole("region", { name: "Tanlangan buyurtmalar" })).toBeNull();

    await user.click(screen.getByRole("checkbox", { name: "Sahifadagi barcha bekor buyurtmalarni tanlash" }));
    const bar = screen.getByRole("region", { name: "Tanlangan buyurtmalar" });
    expect(bar).toHaveTextContent("2 / 2 ta buyurtma tanlandi");
    expect(screen.getByRole("checkbox", { name: "№2001 ni tanlash" })).toBeChecked();

    await user.click(within(bar).getByRole("button", { name: "2 ta buyurtmani pochtaga yuborish" }));
    expect(sendToPost).toHaveBeenCalledWith(["2001", "2002"], expect.any(Object));

    await user.click(within(bar).getByRole("button", { name: "Tanlovni bekor qilish" }));
    expect(screen.queryByRole("region", { name: "Tanlangan buyurtmalar" })).toBeNull();
    expect(screen.getByRole("checkbox", { name: "№2001 ni tanlash" })).not.toBeChecked();
  });

  it("kamera (markaziy «Skaner»): «Pochtaga yuborish» maqsadi, skan tanlaydi, ro'yxatda «Bekor qilish»", async () => {
    state.rows = cancelledRows();
    renderPage("/orders?status=cancelled");

    expect(getActiveScanTarget()).toMatchObject({
      id: "courier-orders:cancelled-to-post",
      title: "Pochtaga yuborish",
      context: "Bekor qilingan buyurtmalar · 2 ta",
      progress: { done: 0, total: 2, label: "ta tanlandi" },
      finish: { label: "Tugatish" },
    });

    act(() => {
      void getActiveScanTarget()!.onScan("2001", "camera");
    });
    expect(screen.getByRole("checkbox", { name: "№2001 ni tanlash" })).toBeChecked();
    await waitFor(() =>
      expect(getActiveScanTarget()?.list?.[0]).toMatchObject({ key: "order:2001", title: "№2001 · Malika Yusupova" }),
    );
    expect(getActiveScanTarget()?.progress).toMatchObject({ done: 1, total: 2 });

    act(() => getActiveScanTarget()!.list![0].onUndo!());
    expect(screen.getByRole("checkbox", { name: "№2001 ni tanlash" })).not.toBeChecked();
  });

  it("boshqa tabda kamera maqsadi yo'q (markaziy tugma universal skanerni ochadi)", () => {
    state.rows = [order("1001", "Laylo Hasanova")];
    renderPage("/orders?status=waiting");
    expect(getActiveScanTarget()).toBeNull();
  });

  it("bekor qilinganlar jadvalida amallar ustuni yo'q", () => {
    state.rows = cancelledRows();
    renderPage("/orders?status=cancelled");
    expect(screen.queryByRole("columnheader", { name: "Amallar" })).toBeNull();
    expect(screen.getByRole("table", { name: "Pochtaga yuborilmagan bekor qilingan buyurtmalar" })).toBeInTheDocument();
  });
});

describe("Kuryer buyurtmalari — telefon (< 768)", () => {
  let restore: () => void;
  beforeEach(() => {
    restore = mockPhone(true);
  });
  afterEach(() => restore());

  it("tablar va qidiruv karta ustida, ro'yxat — kartalar (jadval yo'q), kartada amallar", () => {
    state.rows = [order("1001", "Laylo Hasanova")];
    renderPage();

    const card = screen.getByRole("region", { name: "Kutilayotgan buyurtmalar" });
    expect(within(card).queryByRole("tablist")).toBeNull();
    expect(screen.getByRole("tablist", { name: "Buyurtmalar turi" })).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
    // Telefonda sana filtri yo'q (maket: faqat qidiruv).
    expect(screen.queryByRole("button", { name: /Sana oralig'i/ })).toBeNull();

    const item = within(card).getByRole("list", { name: "Kutilayotgan buyurtmalar" });
    expect(within(item).getByRole("link", { name: /№1001/ })).toHaveAttribute("href", expect.stringMatching(/edit\/1001$/));
    expect(within(item).getByRole("link", { name: /qo'ng'iroq qilish/ })).toHaveAttribute("href", "tel:+998902146631");
    expect(within(item).getByRole("button", { name: "Laylo Hasanova: sotish" })).toBeInTheDocument();
    expect(within(item).getByRole("button", { name: "Laylo Hasanova: bekor qilish" })).toBeInTheDocument();
  });

  it("bekor qilinganlar: «Barchasini tanlash» → pastki panelda yuborish tugmasi", async () => {
    const user = userEvent.setup();
    state.rows = [
      order("2001", "Malika Yusupova", { status: "cancelled" }),
      order("2002", "Bekzod Aliyev", { status: "cancelled" }),
    ];
    renderPage("/orders?status=cancelled");

    expect(screen.getByRole("note")).toHaveTextContent("Skaner bilan buyurtma QR kodini o'qitsangiz");
    await user.click(screen.getByRole("checkbox", { name: "Barchasini tanlash" }));
    expect(screen.getByText("2 / 2 ta tanlandi")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "2 ta buyurtmani pochtaga yuborish" }));
    expect(sendToPost).toHaveBeenCalledWith(["2001", "2002"], expect.any(Object));
  });
});
