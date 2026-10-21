import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n";
import { renderWithProviders } from "../../../test/test-utils";
import MailDetailPage from "./index";

/**
 * Pochta tafsiloti — dizayn v2 tuzilmasi (haqiqiy `OrdersTable` bilan): rejimga qarab sarlavha amallari,
 * ogohlantirishlar, ko'rsatkichlar, karta sarlavhasi va xato holati (maketlar `*-mails-detail*`).
 */

const mocks = vi.hoisted(() => ({
  useMailDetail: vi.fn(),
  useRefused: vi.fn(),
  scanner: null as null | {
    onMatch: (order: { id: string }, raw: string, source: "keyboard" | "camera") => void;
    onMissing: (raw: string, source: "keyboard" | "camera") => void;
    orders: Array<{ id: string }>;
  },
}));

vi.mock("../../../entities/branch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../entities/branch")>()),
  getDispatchDestinations: vi.fn(),
}));

vi.mock("../../../entities/mails", () => ({
  useMails: () => ({ useGetRefusedMailsCourierByPostId: mocks.useRefused }),
  useMailDetail: mocks.useMailDetail,
  useReceivePost: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReceiveCanceledPost: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteOrdersFromPost: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDispatchPostToBranch: () => ({ mutateAsync: vi.fn(), isPending: false, reset: vi.fn() }),
}));

vi.mock("../../../shared/lib/useOrderQrScanner", () => ({
  useOrderQrScanner: (options: NonNullable<typeof mocks.scanner>) => {
    mocks.scanner = options;
  },
}));

beforeAll(async () => {
  await i18n.changeLanguage("uz");
});

const POST_ID = "7";

const order = (id: string, status: string, price = 100000) => ({
  id,
  status,
  createdAt: "2026-10-05T09:14:00.000Z",
  updatedAt: "2026-10-05T09:14:00.000Z",
  where_deliver: "address",
  total_price: price,
  customer: { id: `c${id}`, name: `Mijoz ${id}`, phone_number: "+998914521830" },
  market: { id: "7", name: "Baraka Shop" },
  district: { id: "5", name: "Guliston", region_id: "12", region: { name: "Sirdaryo" } },
});

const stateFor = (role: string, branchType?: string) =>
  ({
    role: { id: `${role}-1`, role, region: null, name: role },
    user: {
      user: { id: `${role}-1`, role, ...(branchType ? { branch: { id: "1", type: branchType } } : {}) },
      isAuthenticated: true,
      accessToken: null,
      loading: false,
      isAppInitializing: false,
      error: null,
    },
  }) as never;

const regular = (rows: ReturnType<typeof order>[], post?: { status: string }) =>
  mocks.useMailDetail.mockImplementation((postId: string) => ({
    data: postId ? { data: { allOrdersByPostId: rows, ...(post ? { post: { id: POST_ID, ...post } } : {}) } } : undefined,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn().mockResolvedValue({ data: { data: { allOrdersByPostId: rows } } }),
  }));

/** Joriy URL va `location.state` (MD-1: `?q=` va rejim holati). */
const LocationProbe = () => {
  const location = useLocation();
  return (
    <output data-testid="location" data-state={JSON.stringify(location.state ?? null)}>
      {`${location.pathname}${location.search}`}
    </output>
  );
};

const renderPage = (preloadedState: never, route: string | { pathname: string; state?: unknown } = `/mails/${POST_ID}`) =>
  renderWithProviders(
    <Routes>
      <Route
        path="/mails/:id"
        element={
          <>
            <MailDetailPage />
            <LocationProbe />
          </>
        }
      />
    </Routes>,
    { route, preloadedState },
  );

describe("MailDetailPage v2 — rejimlar", () => {
  beforeEach(() => {
    mocks.useRefused.mockReturnValue({ data: undefined, isLoading: false, isError: false });
  });

  it("superadmin jo'natish: tanlov sarlavha amallari va ko'rsatkichlarni yangilaydi (`superadmin-mails-detail`)", async () => {
    const user = userEvent.setup();
    regular([order("101", "received", 185000), order("102", "received", 240000)], { status: "new" });
    renderPage(stateFor("superadmin"));

    const send = screen.getByRole("button", { name: "Pochtani jo'natish — 0 ta" });
    expect(send).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Chop etish/ })).toBeDisabled();
    expect(screen.getByText("QR kodni skanerlasangiz, buyurtma ro'yxatda avtomatik tanlanadi")).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "№101 ni tanlash" }));
    expect(screen.getByRole("button", { name: "Pochtani jo'natish — 1 ta" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Chop etish 1" })).toBeEnabled();
    expect(screen.getByRole("region", { name: "Tanlangan buyurtmalar" })).toHaveTextContent("1 ta buyurtma tanlandi / 2 ta");
    expect(screen.getByRole("group", { name: "Pochta xulosasi" })).toHaveTextContent("1 ta tanlandi");
    // Savat — superadmin, NEW pochta.
    expect(screen.getByRole("button", { name: "№102 ni pochtadan o'chirish" })).toBeInTheDocument();
  });

  it("rad etilgan pochta (HQ registratori): info ogohlantirish maket matni bilan, skaner izohi yo'q (`registrator-mails-detail-refused`)", () => {
    mocks.useMailDetail.mockReturnValue({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() });
    mocks.useRefused.mockImplementation((postId: string) => ({
      data: postId ? { data: [order("201", "cancelled (sent)"), order("202", "cancelled")] } : undefined,
      isLoading: false,
      isError: false,
    }));
    renderPage(stateFor("registrator", "HQ"), `/mails/${POST_ID}?type=refused`);

    const note = screen.getByRole("note");
    expect(note).toHaveTextContent("Kuryer qaytargan buyurtmalarning QR kodini skanerlang.");
    expect(note).toHaveTextContent(
      "Mos buyurtmalar ro'yxatda avtomatik tanlanadi, so'ng «Pochtani qabul qilish» tugmasini bosing.",
    );
    expect(screen.getByRole("region", { name: "Rad etilgan buyurtmalar" })).toBeInTheDocument();
    expect(screen.queryByText(/QR kodni skanerlasangiz/)).toBeNull();
    expect(screen.getByRole("button", { name: "Pochtani qabul qilish — 0 ta" })).toBeDisabled();
    // Bekor bosqichi (tizim-states-data §09): qaytarish pochtasidagi buyurtma — «Bekor · yo'lda».
    expect(screen.getByText("Bekor · yo'lda")).toBeInTheDocument();
  });

  it("menejer qabul: sarlavha «Yo'ldagi» emas, «Buyurtmalar»; skaner izohi menejer matni (`manager-mails-detail-receive`)", () => {
    regular([order("301", "on the road"), order("302", "waiting")], { status: "new" });
    renderPage(stateFor("manager", "REGIONAL"));
    expect(screen.getByRole("heading", { level: 2, name: "Buyurtmalar" })).toBeInTheDocument();
    expect(screen.getByText("QR kodni skanerlang — buyurtma ro'yxatda tanlanadi")).toBeInTheDocument();
    // Qabul rejimida faqat yo'ldagi buyurtma.
    expect(screen.getByRole("checkbox", { name: "№301 ni tanlash" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "№302 ni tanlash" })).toBeNull();
    expect(
      within(screen.getByRole("table")).getAllByRole("columnheader").map((th) => th.textContent?.trim()),
    ).toEqual(["", "Buyurtma", "Mijoz", "Tuman / manzil", "Market", "Yetkazish", "Holat", "Summa", "Amallar"]);
  });

  it("kuryer qabul: «Yo'ldagi buyurtmalar», raqam havolasiz, «Tanlangan» kartasida jarayon chizig'i (`courier-mails-detail-receive`)", () => {
    regular([order("401", "on the road"), order("402", "on the road")], { status: "sent" });
    renderPage(stateFor("courier", "REGIONAL"));
    expect(screen.getByRole("heading", { level: 2, name: "Yo'ldagi buyurtmalar" })).toBeInTheDocument();
    expect(screen.getByText("QR skanerlansa, buyurtma avtomatik tanlanadi")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).queryByRole("link")).toBeNull();
    expect(screen.getByRole("progressbar", { name: "Tanlangan buyurtmalar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tanlangan 0 ta buyurtmani chop etish" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "№401 yorlig'ini chop etish" })).toBeInTheDocument();
  });

  it("kuryerning rad etilgan pochtasi: «Barchasini chop etish», «Faqat o'qish», filial izohi, tanlov yo'q (`courier-mails-detail-refused`)", () => {
    mocks.useMailDetail.mockReturnValue({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() });
    mocks.useRefused.mockImplementation((postId: string) => ({
      data: postId ? { data: [order("501", "cancelled (sent)", 145000), order("502", "cancelled (sent)", 210000)] } : undefined,
      isLoading: false,
      isError: false,
    }));
    renderPage(stateFor("courier", "REGIONAL"), { pathname: `/mails/${POST_ID}`, state: { fromTab: "refused", type: "refused" } });

    const printAll = screen.getByRole("button", { name: "Barcha 2 ta buyurtma yorlig'ini chop etish" });
    expect(printAll).toBeEnabled();
    expect(printAll).toHaveTextContent(/^Barchasini chop etish$/);
    expect(screen.getByText("Faqat o'qish")).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent("Rad etilgan pochtani filial qabul qiladi.");
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("button", { name: /Pochtani qabul qilish/ })).toBeNull();
    expect(screen.getByRole("group", { name: "Pochta xulosasi" })).toHaveTextContent("Rad etilgan");
  });

  it("xato — ErrorState «Qayta urinish» so'rovni qayta yuboradi", async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    mocks.useMailDetail.mockReturnValue({ data: undefined, isLoading: false, isError: true, error: new Error("x"), refetch });
    renderPage(stateFor("superadmin"));
    expect(screen.getByText("Ma'lumotlarni yuklab bo'lmadi")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Qayta urinish/ }));
    expect(refetch).toHaveBeenCalled();
  });
});

/** MD-1: qidiruv (`?q=`) va takroriy telefonlar — maketlar `*-mails-detail-search*`, `*-duplicates`. */
describe("MailDetailPage — qidiruv va takroriy telefonlar (MD-1)", () => {
  const person = (id: string, name: string, phone: string, market = "Baraka Shop", status = "received") => ({
    ...order(id, status),
    customer: { id: `c${id}`, name, phone_number: phone },
    market: { id: `m-${market}`, name: market },
  });
  const DISPATCH = [
    person("10212", "Shoxrux Rahmonov", "+998914521830"),
    person("10209", "Mohira Ergasheva", "+998937180462", "Nur Elektronika"),
    person("10207", "Laylo Hasanova", "+998902335179", "Chilonzor Market"),
    person("10192", "Laylo Hasanova", "902335179"),
    person("10188", "Zarina Usmonova", "+998 93 718 04 62", "Ipak Yo'li Savdo"),
  ];
  const location = () => screen.getByTestId("location");
  const searchbox = () => screen.getByRole("searchbox", { name: "Pochtadagi buyurtmalarni qidirish" });
  const rowIds = () =>
    within(screen.getByRole("table"))
      .queryAllByRole("checkbox", { name: /^№\d+ ni tanlash$/ })
      .map((box) => box.getAttribute("aria-label")?.replace(/^№(\d+) ni tanlash$/, "$1"));

  beforeEach(() => {
    mocks.useRefused.mockReturnValue({ data: undefined, isLoading: false, isError: false });
    mocks.scanner = null;
  });

  it("jo'natish (superadmin): banner 2 ta raqam, chip qidiruvga yozadi va URL'da `?q=`; faol chip qayta bosilsa tozalanadi", async () => {
    const user = userEvent.setup();
    regular(DISPATCH, { status: "new" });
    renderPage(stateFor("superadmin"));

    const banner = screen.getByTestId("mail-duplicate-phones");
    expect(banner).toHaveTextContent("Takroriy telefon raqamlar aniqlandi (2 ta)");
    expect(banner).toHaveTextContent(
      "Shu pochtadagi 4 ta buyurtma bir xil raqamlarga ketmoqda. Tekshirib oling — bu jo'natishni to'xtatmaydi.",
    );
    const chips = within(within(banner).getByRole("group", { name: /Takroriy raqamlar/ })).getAllByRole("button");
    // Chiplar raqam tartibida (maketdagidek), pochtada birinchi uchrashi emas.
    expect(chips.map((chip) => chip.getAttribute("aria-label"))).toEqual([
      "+998 90 233 51 79 raqamli 2 ta buyurtmani ko'rsatish: №10207, №10192",
      "+998 93 718 04 62 raqamli 2 ta buyurtmani ko'rsatish: №10209, №10188",
    ]);
    // Takroriy raqamli qatorlarda belgi (4 ta), jo'natish to'silmaydi.
    expect(within(screen.getByRole("table")).getAllByText("Takroriy raqam")).toHaveLength(4);

    await user.click(chips[0]);
    expect(location()).toHaveTextContent(`/mails/${POST_ID}?q=%2B998+90+233+51+79`);
    expect(searchbox()).toHaveValue("+998 90 233 51 79");
    expect(rowIds()).toEqual(["10207", "10192"]);
    expect(chips[0]).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/bo'yicha/).closest("p")).toHaveTextContent(
      "«+998 90 233 51 79» bo'yicha 2 ta buyurtma topildi",
    );
    // Banner qidiruvdan qat'i nazar turadi.
    expect(screen.getByTestId("mail-duplicate-phones")).toBeInTheDocument();

    await user.click(chips[0]);
    expect(location()).toHaveTextContent(new RegExp(`^/mails/${POST_ID}$`));
    expect(rowIds()).toHaveLength(5);
  });

  it("`?q=` havoladan: rejim maydonlari URL'dan state'ga o'tadi, `q` URL'da qoladi; tanlov qidiruvda yashirin qoladi", async () => {
    const user = userEvent.setup();
    regular(DISPATCH, { status: "new" });
    renderPage(stateFor("admin"), `/mails/${POST_ID}?from=today&q=Laylo`);

    expect(location()).toHaveTextContent(`/mails/${POST_ID}?q=Laylo`);
    expect(location().dataset.state).toContain('"fromTab":"today"');
    expect(searchbox()).toHaveValue("Laylo");
    expect(rowIds()).toEqual(["10207", "10192"]);

    await user.click(screen.getByRole("checkbox", { name: "№10207 ni tanlash" }));
    await user.clear(searchbox());
    await user.type(searchbox(), "Zarina");
    // URL kechikib (bir marta) yoziladi.
    await waitFor(() => expect(location()).toHaveTextContent(`/mails/${POST_ID}?q=Zarina`));
    // state har yozishda saqlanadi.
    expect(location().dataset.state).toContain('"fromTab":"today"');
    expect(rowIds()).toEqual(["10188"]);
    const region = screen.getByRole("region", { name: "Tanlangan buyurtmalar" });
    expect(region).toHaveTextContent("1 ta buyurtma tanlandi / 5 ta");
    expect(region).toHaveTextContent("1 tasi qidiruvda yashirin, lekin tanlangan qoladi");
    // Jo'natish butun tanlovga — yashirin buyurtma ham hisobda.
    expect(screen.getByRole("button", { name: "Pochtani jo'natish — 1 ta" })).toBeEnabled();

    await user.click(within(region).getByRole("button", { name: "Ko'rinayotganlarni tanlash (1)" }));
    expect(screen.getByRole("button", { name: "Pochtani jo'natish — 2 ta" })).toBeEnabled();
  });

  it("natija yo'q: «… topilmadi», «Qidiruvni tozalash» ro'yxatni qaytaradi", async () => {
    const user = userEvent.setup();
    regular(DISPATCH, { status: "new" });
    renderPage(stateFor("registrator", "HQ"), `/mails/${POST_ID}?q=Dilshod`);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByTestId("mail-search-status")).toHaveTextContent("«Dilshod» bo'yicha buyurtma topilmadi");
    expect(screen.getAllByText("«Dilshod» bo'yicha buyurtma topilmadi")).toHaveLength(2);
    expect(screen.getByText("0 ta ko'rsatilmoqda · 5 tadan")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Qidiruvni tozalash" }).at(-1)!);
    // Tozalash — darhol (kechikishsiz); fokus maydonga qaytadi.
    expect(location()).toHaveTextContent(new RegExp(`^/mails/${POST_ID}$`));
    expect(rowIds()).toHaveLength(5);
    expect(searchbox()).toHaveFocus();
  });

  it("menejer qabul: banner qabul matni (bitta raqam), market nomi bo'yicha qidiruv", async () => {
    const user = userEvent.setup();
    regular(
      [
        person("10354", "Dilnoza", "+998932076145", "Baraka Shop", "on the road"),
        person("10350", "Javohir", "+998 93 207 61 45", "Nur Elektronika", "on the road"),
        person("10351", "Sardor", "+998911112233", "Baraka Shop", "on the road"),
      ],
      { status: "sent" },
    );
    renderPage(stateFor("manager", "REGIONAL"));
    const banner = screen.getByTestId("mail-duplicate-phones");
    expect(banner).toHaveTextContent("Takroriy telefon raqamlar aniqlandi (1 ta)");
    expect(banner).toHaveTextContent(
      "Shu pochtadagi 2 ta buyurtma bir xil raqamga kelgan. Tekshirib oling — bu qabul qilishni to'xtatmaydi.",
    );
    await user.type(searchbox(), "baraka");
    expect(screen.getByText(/bo'yicha/).closest("p")).toHaveTextContent(
      "«baraka» bo'yicha 2 ta buyurtma topildi · market nomi bo'yicha",
    );
    expect(rowIds()).toEqual(["10354", "10351"]);
  });

  it("kuryer, rad etilgan va eski pochtada qidiruv va banner yo'q", () => {
    regular(
      DISPATCH.map((item) => ({ ...item, status: "on the road" })),
      { status: "sent" },
    );
    const { unmount } = renderPage(stateFor("courier", "REGIONAL"), `/mails/${POST_ID}?q=Laylo`);
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.queryByTestId("mail-duplicate-phones")).toBeNull();
    expect(rowIds()).toHaveLength(5);
    unmount();

    regular(DISPATCH, { status: "received" });
    renderPage(stateFor("superadmin"), { pathname: `/mails/${POST_ID}`, state: { fromTab: "old", view: "old" } });
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.queryByTestId("mail-duplicate-phones")).toBeNull();
  });

  it("USB skan qidiruv maydoni fokusda: token maydonga yozilsa ham skandan keyin oldingi `q` tiklanadi", async () => {
    const user = userEvent.setup();
    regular(DISPATCH, { status: "new" });
    renderPage(stateFor("superadmin"));
    const now = vi.spyOn(Date, "now");
    try {
      now.mockReturnValue(1_000);
      await user.type(searchbox(), "La");
      now.mockReturnValue(9_000);
      await user.type(searchbox(), "10209");
      expect(searchbox()).toHaveValue("La10209");
      act(() => {
        mocks.scanner!.onMatch(mocks.scanner!.orders.find((item) => item.id === "10209")!, "10209", "keyboard");
      });
      expect(searchbox()).toHaveValue("La");
      expect(location()).toHaveTextContent(`/mails/${POST_ID}?q=La`);
      expect(screen.getByRole("button", { name: "Pochtani jo'natish — 1 ta" })).toBeEnabled();
    } finally {
      now.mockRestore();
    }
  });

  it("maydon mahalliy qoralamaga bog'langan: act'siz ketma-ket kiritishda harf yo'qolmaydi, kursor o'rnida qoladi", async () => {
    regular(DISPATCH, { status: "new" });
    renderPage(stateFor("superadmin"), `/mails/${POST_ID}?q=Laylo`);
    const input = searchbox() as HTMLInputElement;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    const typeRaw = (value: string, caret = value.length) => {
      setValue.call(input, value);
      input.setSelectionRange(caret, caret);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    };

    // O'rtaga harf: «La|ylo» → «Lax|ylo» — kursor 3 da qoladi (URL'ga bog'langan maydonda oxirga sakrardi).
    typeRaw("Laxylo", 3);
    expect(input.value).toBe("Laxylo");
    expect(input.selectionStart).toBe(3);

    // Tez yozish: router o'tishi tugamasdan ikkinchi harf — birinchisi yo'qolmaydi.
    typeRaw("Laxylo B");
    typeRaw("Laxylo Ba");
    expect(input.value).toBe("Laxylo Ba");

    await waitFor(() => expect(location()).toHaveTextContent(`/mails/${POST_ID}?q=Laxylo+Ba`));
    expect(input.value).toBe("Laxylo Ba");
  });

  it("URL har harfda emas, yozish to'xtagach bir marta yoziladi", async () => {
    const user = userEvent.setup();
    regular(DISPATCH, { status: "new" });
    renderPage(stateFor("superadmin"));
    await user.type(searchbox(), "Zar");
    // Darhol — hali yozilmagan; jadval esa qoralama bo'yicha.
    expect(location()).toHaveTextContent(new RegExp(`^/mails/${POST_ID}$`));
    expect(rowIds()).toEqual(["10188"]);
    await waitFor(() => expect(location()).toHaveTextContent(`/mails/${POST_ID}?q=Zar`));
  });

  it("qidiruvga tez yozib Enter (skanerga o'xshaydi), matn shu pochtada topilsa — qidiruv: tiklanmaydi", async () => {
    const user = userEvent.setup();
    regular(DISPATCH, { status: "new" });
    renderPage(stateFor("superadmin"));
    const now = vi.spyOn(Date, "now");
    try {
      now.mockReturnValue(5_000);
      await user.type(searchbox(), "Laylo");
      act(() => {
        mocks.scanner!.onMissing("Laylo", "keyboard");
      });
      expect(searchbox()).toHaveValue("Laylo");
      expect(rowIds()).toEqual(["10207", "10192"]);
    } finally {
      now.mockRestore();
    }
  });
});
