import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import OrderFilters from "./OrderFilters";

/** `MemoryRouter` brauzer manzilini o'zgartirmaydi — URL `useLocation` dan o'qiladi. */
const LocationProbe = () => {
  const { search } = useLocation();
  return <span data-testid="search">{search}</span>;
};
const currentParams = () => new URLSearchParams(screen.getByTestId("search").textContent ?? "");

const regions = [
  { id: "r1", name: "Toshkent sh." },
  { id: "r2", name: "Farg'ona" },
];
const branches = [{ id: "b1", name: "Toshkent HQ" }];
const markets = [{ id: "m1", name: "Nur Elektronika" }];
const couriers = [{ id: "c1", name: "Aziz Kuryer" }];
const districts = [
  { id: "d1", name: "Urgut tumani" },
  { id: "d2", name: "Jomboy tumani" },
];

type QueryHook<R> = (params?: Record<string, unknown>, enabled?: boolean, options?: unknown) => R;
const getCouriersMock = vi.fn<QueryHook<{ data: unknown; isLoading: boolean }>>(() => ({
  data: { data: { items: couriers } },
  isLoading: false,
}));
const getOrdersMock = vi.fn<QueryHook<{ data: unknown; isPlaceholderData: boolean; isError: boolean }>>(() => ({
  data: { data: [], total: 124 },
  isPlaceholderData: false,
  isError: false,
}));

vi.mock("../../../entities/user/api/userApi", () => ({
  useUser: () => ({
    useGetRegions: () => ({ data: { data: regions }, isLoading: false }),
    useGetCouriers: (params?: Record<string, unknown>, enabled?: boolean) => getCouriersMock(params, enabled),
    useGetMyProfile: () => ({ data: { data: { branch: { region_id: "r9" } } } }),
  }),
}));

vi.mock("../../../entities/logistics/api/logisticsApi", () => ({
  useLogistics: () => ({ useGetDistricts: () => ({ data: districts, isLoading: false }) }),
}));

vi.mock("../../../entities/markets", () => ({
  useMarkets: () => ({ useGetMarkets: () => ({ data: { data: { items: markets } }, isLoading: false }) }),
}));

vi.mock("../../../entities/branch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../entities/branch")>()),
  useBranches: () => ({ data: { data: branches }, isLoading: false }),
}));

vi.mock("../../../entities/order/api/orderApi", () => ({
  useOrders: () => ({
    useGetOrders: (params?: Record<string, unknown>, enabled?: boolean, _refetch?: unknown, options?: unknown) =>
      getOrdersMock(params, enabled, options),
  }),
}));

const stateFor = (role: string) => ({ role: { id: "u1", role, region: null, name: "Test" } }) as never;

const open = (role: string, route = "/orders") =>
  renderWithProviders(
    <>
      <OrderFilters />
      <LocationProbe />
    </>,
    { route, preloadedState: stateFor(role) },
  );

const PHONE_QUERY = "(max-width: 767px)";
const usePhoneViewport = () => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === PHONE_QUERY,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
};

/** Varaqa pastidagi amallar (maydondagi × ham «Tozalash» deb ataladi). */
const sheetFooter = (sheet: HTMLElement) => within(sheet.querySelector<HTMLElement>("[data-dialog-footer]")!);

const panel = () => screen.getByRole("group", { name: "Qo'shimcha filtrlar" });
const fieldLabels = () =>
  Array.from(panel().querySelectorAll("[data-field] > span, [data-field] > div > span")).map((el) => el.textContent);

beforeEach(() => {
  getCouriersMock.mockClear();
  // mockReset — vi.fn(...) dagi asl javobga qaytaradi (bir testdagi mockImplementation keyingisiga o'tmasin).
  getOrdersMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("OrderFilters — desktop/planshet (superadmin-orders-list)", () => {
  it("renders the toolbar, an open panel with active filters and their chips", () => {
    open("superadmin", "/orders?orderBranchId=b1&orderRegionId=r1&startDay=2026-10-01&endDay=2026-10-08");

    expect(screen.getByRole("searchbox", { name: "Buyurtmalarni ism, telefon yoki raqam bo'yicha qidirish" })).toHaveAttribute(
      "placeholder",
      "Shu ro'yxatdan qidirish",
    );
    // Sana va qidiruv soniga kirmaydi: «Filtrlar 2» = filial + viloyat.
    const toggle = screen.getByRole("button", { name: "Filtrlar 2" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById(toggle.getAttribute("aria-controls") ?? "")).toBe(panel().parentElement);
    expect(fieldLabels()).toEqual(["Market", "Filial", "Viloyat", "Kuryer", "Yetkazish turi", "Holat"]);

    const active = screen.getByRole("group", { name: "Faol filtrlar" });
    expect(within(active).getByText("Filial: Toshkent HQ")).toBeInTheDocument();
    expect(within(active).getByText("Viloyat: Toshkent sh.")).toBeInTheDocument();
    // Desktopda sana chipi yo'q — sana maydoni qatorda ko'rinib turibdi.
    expect(within(active).queryByText(/01\.10/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sana oralig'i: 01\.10\.2026 dan 08\.10\.2026 gacha/ })).toBeInTheDocument();
  });

  it("starts collapsed without panel filters and toggles the panel", async () => {
    const user = userEvent.setup();
    open("superadmin");

    const toggle = screen.getByRole("button", { name: "Filtrlar" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("group", { name: "Qo'shimcha filtrlar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Faol filtrlar" })).not.toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(panel()).toBeVisible();
  });

  it("removes one filter with its chip and clears all with «Filtrlarni tozalash»", async () => {
    const user = userEvent.setup();
    open(
      "admin",
      "/orders?orderBranchId=b1&orderRegionId=r1&orderCourierId=c1&orderSearch=12&startDay=2026-10-01&endDay=2026-10-08&page=3",
    );

    await user.click(screen.getByRole("button", { name: "Filial filtrini olib tashlash" }));
    expect(currentParams().get("orderBranchId")).toBeNull();
    expect(currentParams().get("orderRegionId")).toBe("r1");

    // Viloyatni olib tashlash kuryerni ham tozalaydi (kuryerlar viloyatga bog'liq).
    await user.click(screen.getByRole("button", { name: "Viloyat filtrini olib tashlash" }));
    expect(currentParams().get("orderRegionId")).toBeNull();
    expect(currentParams().get("orderCourierId")).toBeNull();

    expect(screen.getByText("Qidiruv: «12»")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Filtrlarni tozalash" }));
    const params = currentParams();
    expect(params.get("orderSearch")).toBeNull();
    expect(params.get("startDay")).toBeNull();
    expect(params.get("endDay")).toBeNull();
    expect(params.get("page")).toBe("3");
    expect(screen.getByRole("searchbox")).toHaveValue("");
  });

  it("changes a panel filter right away and resets the courier when the region changes", async () => {
    const user = userEvent.setup();
    open("superadmin", "/orders?orderRegionId=r1&orderCourierId=c1");

    await user.click(screen.getByRole("combobox", { name: "Viloyat" }));
    await user.click(screen.getByRole("option", { name: "Farg'ona" }));

    expect(currentParams().get("orderRegionId")).toBe("r2");
    expect(currentParams().get("orderCourierId")).toBeNull();
    // Kuryerlar yangi viloyat bo'yicha so'raladi.
    await waitFor(() =>
      expect(getCouriersMock).toHaveBeenLastCalledWith(expect.objectContaining({ region_id: "r2" }), true),
    );

    await user.click(screen.getByRole("combobox", { name: "Yetkazish turi" }));
    await user.click(screen.getByRole("option", { name: "Uygacha" }));
    expect(currentParams().get("where_deliver")).toBe("address");
    expect(screen.getByText("Yetkazish turi: Uygacha")).toBeInTheDocument();
  });

  it("treats a tab status set as the tab, not as a filter", async () => {
    const user = userEvent.setup();
    open("superadmin", "/orders?status=waiting&where_deliver=address");

    // «Kutilmoqda» tabi: holat «Filtrlar» soniga ham, chipga ham kirmaydi.
    expect(screen.getByRole("button", { name: "Filtrlar 1" })).toBeInTheDocument();
    expect(screen.queryByText(/^Holat:/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Filtrlarni tozalash" }));
    expect(currentParams().get("where_deliver")).toBeNull();
    expect(currentParams().get("status")).toBe("waiting");
  });

  it("shows a custom status set from «Holat» as chips and clears it", async () => {
    const user = userEvent.setup();
    open("superadmin", "/orders?status=waiting,sold,new");

    expect(screen.getByRole("button", { name: "Filtrlar 1" })).toBeInTheDocument();
    expect(screen.getByText("Holat: Kutilmoqda")).toBeInTheDocument();
    expect(screen.getByText("Holat: Sotilgan")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Holat: Sotilgan filtrini olib tashlash" }));
    expect(currentParams().get("status")).toBe("new,waiting");

    await user.click(screen.getByRole("button", { name: "Filtrlarni tozalash" }));
    expect(currentParams().get("status")).toBeNull();
    expect(screen.getByRole("button", { name: "Filtrlar" })).toBeInTheDocument();
  });

  it("debounces typing, applies Enter and × at once and keeps the token of a pasted QR link", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    open("superadmin");
    const input = screen.getByRole("searchbox");

    await user.type(input, "Aziz");
    expect(currentParams().get("orderSearch")).toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    expect(currentParams().get("orderSearch")).toBe("Aziz");

    await user.clear(input);
    await user.type(input, "998{Enter}");
    expect(currentParams().get("orderSearch")).toBe("998");

    await user.click(screen.getByRole("button", { name: "Qidiruvni tozalash" }));
    expect(currentParams().get("orderSearch")).toBeNull();
    // Kechikkan eski yozuv tozalashdan keyin qaytib kelmaydi.
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(currentParams().get("orderSearch")).toBeNull();

    fireEvent.change(input, { target: { value: "https://elchi.uz/scan/ABCDEF123" } });
    expect(input).toHaveValue("ABCDEF123");
  });

  it("a delayed search write keeps filter changes made while it was pending", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    open("superadmin", "/orders?orderBranchId=b1&orderRegionId=r1&page=3");

    await user.type(screen.getByRole("searchbox"), "Aziz");
    // Kechikish tugamasdan boshqa filtr o'zgaradi (chip ×).
    await user.click(screen.getByRole("button", { name: "Filial filtrini olib tashlash" }));
    expect(currentParams().get("orderBranchId")).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    const params = currentParams();
    expect(params.get("orderSearch")).toBe("Aziz");
    // Eski URL nusxasi qaytib yozilmaydi: olib tashlangan filial qaytmaydi.
    expect(params.get("orderBranchId")).toBeNull();
    expect(params.get("orderRegionId")).toBe("r1");
  });

  it("⭐ D-11: faqat bo'shliq — qidiruv va chip yo'q; «№53» → `orderSearch=53`, maydonda yozilgani qoladi", async () => {
    const user = userEvent.setup();
    open("superadmin");
    const input = screen.getByRole("searchbox");

    await user.type(input, "   {Enter}");
    expect(currentParams().get("orderSearch")).toBeNull();
    expect(screen.queryByRole("group", { name: "Faol filtrlar" })).not.toBeInTheDocument();

    await user.clear(input);
    await user.type(input, "№53{Enter}");
    expect(currentParams().get("orderSearch")).toBe("53");
    expect(input).toHaveValue("№53");
    expect(within(screen.getByRole("group", { name: "Faol filtrlar" })).getByText(/53/)).toBeInTheDocument();
  });

  it("D-11: eski havoladagi bo'shliqli qidiruv (`?orderSearch=%20%20`) chip bermaydi", () => {
    open("superadmin", "/orders?orderSearch=%20%20");
    expect(screen.queryByRole("group", { name: "Faol filtrlar" })).not.toBeInTheDocument();
  });

  it("D-08: noto'g'ri sana (`?startDay=falonchi`) — filtr emas, sana maydoni bo'sh", () => {
    open("superadmin", "/orders?startDay=falonchi");
    expect(screen.getByRole("button", { name: /Sana oralig'i/ })).not.toHaveAccessibleName(/falonchi/);
    expect(screen.queryByRole("group", { name: "Faol filtrlar" })).not.toBeInTheDocument();
  });

  it("gives every element a unique id", () => {
    open("superadmin", "/orders?orderBranchId=b1&orderRegionId=r1");
    const ids = Array.from(document.querySelectorAll("[id]")).map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("OrderFilters — rollar", () => {
  it("registrator: full search placeholder and no market or branch filters", async () => {
    const user = userEvent.setup();
    open("registrator");

    expect(screen.getByRole("searchbox")).toHaveAttribute("placeholder", "Ism, telefon yoki buyurtma raqami");
    await user.click(screen.getByRole("button", { name: "Filtrlar" }));
    expect(fieldLabels()).toEqual(["Viloyat", "Kuryer", "Yetkazish turi", "Holat"]);
  });

  it("market: only region, delivery type and status", async () => {
    const user = userEvent.setup();
    open("market");

    await user.click(screen.getByRole("button", { name: "Filtrlar" }));
    expect(fieldLabels()).toEqual(["Viloyat", "Yetkazish turi", "Holat"]);
    // Market rolida kuryer ro'yxati so'ralmaydi.
    expect(getCouriersMock).toHaveBeenCalledWith(expect.anything(), false);
  });

  it("manager: district instead of region; changing it resets the courier", async () => {
    const user = userEvent.setup();
    open("manager", "/orders?orderDistrictId=d1&orderCourierId=c1");

    expect(fieldLabels()).toEqual(["Tuman", "Kuryer", "Yetkazish turi", "Holat"]);
    expect(screen.getByText("Tuman: Urgut tumani")).toBeInTheDocument();
    // Kuryerlar menejer filiali viloyati bo'yicha.
    expect(getCouriersMock).toHaveBeenLastCalledWith(expect.objectContaining({ region_id: "r9" }), true);

    await user.click(screen.getByRole("combobox", { name: "Tuman" }));
    await user.click(screen.getByRole("option", { name: "Jomboy tumani" }));
    expect(currentParams().get("orderDistrictId")).toBe("d2");
    expect(currentParams().get("orderCourierId")).toBeNull();
  });
});

describe("OrderFilters — telefon (superadmin-orders-filters-mobile)", () => {
  beforeEach(usePhoneViewport);

  it("moves the date into the sheet and counts it on the «Filtrlar» button", () => {
    open("superadmin", "/orders?orderBranchId=b1&orderRegionId=r1&startDay=2026-10-01&endDay=2026-10-08");

    expect(screen.queryByRole("button", { name: /Sana oralig'i/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Qo'shimcha filtrlar" })).not.toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Filtrlar 3" });
    expect(button).toHaveAttribute("aria-haspopup", "dialog");

    const active = screen.getByRole("group", { name: "Faol filtrlar" });
    expect(within(active).getByText("01.10 – 08.10.2026")).toBeInTheDocument();
    expect(within(active).getByRole("button", { name: "Sana filtrini olib tashlash" })).toBeInTheDocument();
    // D-09: yonga suriladigan qator, brauzer skroll chizig'isiz (`scrollbar-hide` Tailwind v4 da utilita emas).
    expect(active).toHaveClass("max-md:overflow-x-auto", "max-md:[scrollbar-width:none]", "max-md:[&::-webkit-scrollbar]:hidden");
    expect(active).not.toHaveClass("max-md:scrollbar-hide");
  });

  it("edits a draft in the sheet and writes the URL once on «Natijalarni ko'rsatish»", async () => {
    const user = userEvent.setup();
    open("superadmin", "/orders?orderRegionId=r1&page=2");

    await user.click(screen.getByRole("button", { name: "Filtrlar 1" }));
    const sheet = await screen.findByRole("dialog", { name: "Filtrlar" });
    expect(within(sheet).getByText("1 ta filtr tanlangan")).toBeInTheDocument();
    expect(within(sheet).getByRole("radiogroup", { name: "Tezkor davr" })).toBeInTheDocument();
    expect(within(sheet).getByRole("combobox", { name: "Market" })).toBeInTheDocument();
    expect(within(sheet).getByRole("combobox", { name: "Filial" })).toBeInTheDocument();

    await user.click(within(sheet).getByRole("button", { name: "Qabul qilindi" }));
    await user.click(within(sheet).getByRole("button", { name: "Yo'lda" }));
    await user.click(within(sheet).getByRole("radio", { name: "Uygacha" }));
    await user.click(within(sheet).getByRole("radio", { name: "Bugun" }));

    expect(within(sheet).getByText("2 ta tanlangan")).toBeInTheDocument();
    expect(within(sheet).getByText("4 ta filtr tanlangan")).toBeInTheDocument();
    // Qoralama hali URL'ga yozilmagan.
    expect(currentParams().get("status")).toBeNull();
    // Son — qoralama bo'yicha so'rov (1-sahifa).
    expect(getOrdersMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, region_id: "r1", status: ["received", "on the road"], where_deliver: "address" }),
      true,
      { silentError: true },
    );

    await user.click(within(sheet).getByRole("button", { name: "Natijalarni ko'rsatish (124)" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const params = currentParams();
    expect(params.get("status")).toBe("received,on the road");
    expect(params.get("where_deliver")).toBe("address");
    expect(params.get("orderRegionId")).toBe("r1");
    expect(params.get("startDay")).toBe(params.get("endDay"));
    expect(params.get("startDay")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("discards the draft on close and resets it with «Tozalash»", async () => {
    const user = userEvent.setup();
    open("superadmin", "/orders?orderRegionId=r1");

    await user.click(screen.getByRole("button", { name: "Filtrlar 1" }));
    let sheet = await screen.findByRole("dialog", { name: "Filtrlar" });
    await user.click(within(sheet).getByRole("button", { name: "Sotilgan" }));
    await user.click(within(sheet).getByRole("button", { name: "Filtrlarni yopish" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(currentParams().get("status")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Filtrlar 1" }));
    sheet = await screen.findByRole("dialog", { name: "Filtrlar" });
    // Qayta ochilganda qoralama URL'dan — «Sotilgan» tanlanmagan.
    expect(within(sheet).getByRole("button", { name: "Sotilgan" })).toHaveAttribute("aria-pressed", "false");

    await user.click(sheetFooter(sheet).getByRole("button", { name: "Tozalash" }));
    expect(within(sheet).getByText("0 ta filtr tanlangan")).toBeInTheDocument();
    expect(currentParams().get("orderRegionId")).toBe("r1");
  });

  it("loads couriers for the draft region and drops the courier when the region changes", async () => {
    const user = userEvent.setup();
    open("admin", "/orders?orderRegionId=r1&orderCourierId=c1");

    await user.click(screen.getByRole("button", { name: "Filtrlar 2" }));
    const sheet = await screen.findByRole("dialog", { name: "Filtrlar" });
    await user.click(within(sheet).getByRole("combobox", { name: "Viloyat" }));
    await user.click(screen.getByRole("option", { name: "Farg'ona" }));

    await waitFor(() =>
      expect(getCouriersMock).toHaveBeenLastCalledWith(expect.objectContaining({ region_id: "r2" }), true),
    );
    // URL hali o'zgarmagan — faqat qoralama.
    expect(currentParams().get("orderRegionId")).toBe("r1");

    await user.click(sheetFooter(sheet).getByRole("button", { name: /Natijalarni ko'rsatish/ }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(currentParams().get("orderRegionId")).toBe("r2");
    expect(currentParams().get("orderCourierId")).toBeNull();
  });

  it("hides the count while the preview is loading", async () => {
    getOrdersMock.mockImplementation(() => ({ data: undefined, isPlaceholderData: false, isError: false }));
    const user = userEvent.setup();
    open("registrator");

    await user.click(screen.getByRole("button", { name: "Filtrlar" }));
    const sheet = await screen.findByRole("dialog", { name: "Filtrlar" });
    expect(within(sheet).getByRole("button", { name: "Natijalarni ko'rsatish" })).toBeInTheDocument();
    // Registrator: faqat viloyat va kuryer ro'yxatlari.
    expect(within(sheet).queryByRole("combobox", { name: "Market" })).not.toBeInTheDocument();
    expect(within(sheet).getByRole("combobox", { name: "Viloyat" })).toBeInTheDocument();
    expect(within(sheet).getByRole("combobox", { name: "Kuryer" })).toBeInTheDocument();
  });

  it("hides the count on error and keeps the preview error out of the global toast", async () => {
    getOrdersMock.mockImplementation(() => ({ data: { data: [], total: 5 }, isPlaceholderData: false, isError: true }));
    const user = userEvent.setup();
    open("superadmin");

    await user.click(screen.getByRole("button", { name: "Filtrlar" }));
    const sheet = await screen.findByRole("dialog", { name: "Filtrlar" });
    expect(sheetFooter(sheet).getByRole("button", { name: "Natijalarni ko'rsatish" })).toBeInTheDocument();
    // D-10: `limit=1` backend'da 400 edi — son hech qachon chiqmasdi. Eng kichik ruxsat etilgan qiymat — 10.
    expect(getOrdersMock).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 10 }), true, { silentError: true });
  });

  it("manager keeps the date in the toolbar and the sheet has no date section", async () => {
    const user = userEvent.setup();
    open("manager", "/orders?where_deliver=address&startDay=2026-10-01&endDay=2026-10-08");

    expect(screen.getByRole("button", { name: /Sana oralig'i: 01\.10\.2026 dan 08\.10\.2026 gacha/ })).toBeInTheDocument();
    // «Filtrlar 1» — faqat yetkazish turi (sana qatorda ko'rinadi).
    await user.click(screen.getByRole("button", { name: "Filtrlar 1" }));
    const sheet = await screen.findByRole("dialog", { name: "Filtrlar" });
    expect(within(sheet).queryByRole("radiogroup", { name: "Tezkor davr" })).not.toBeInTheDocument();
    expect(within(sheet).getByRole("combobox", { name: "Tuman" })).toBeInTheDocument();

    await user.click(sheetFooter(sheet).getByRole("button", { name: "Tozalash" }));
    await user.click(sheetFooter(sheet).getByRole("button", { name: /Natijalarni ko'rsatish/ }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    // «Tozalash» varaqadagi filtrlarni tozaladi, qatordagi sanaga tegmadi.
    expect(currentParams().get("where_deliver")).toBeNull();
    expect(currentParams().get("startDay")).toBe("2026-10-01");
  });
});
