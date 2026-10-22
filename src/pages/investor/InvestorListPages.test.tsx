import { onlineManager } from "@tanstack/react-query";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AxiosRequestConfig } from "axios";
import { useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RootState } from "../../app/config/store";
import i18n from "../../i18n";
import { api } from "../../shared/api/api";
import { renderWithProviders } from "../../test/test-utils";
import InvestmentsPage from "./InvestmentsPage";
import ProfitsPage from "./ProfitsPage";

/**
 * IN-2 — «Investitsiyalar» (`/investments`) va «Foyda tarixi» (`/profits`): maketlar `investor-investments-list`,
 * `-loading`, `-filtered-empty`, `investor-profits-list`, `-filtered-empty`. API — `api.get` soxta; xom backend matni
 * hech qayerda ko'rinmaydi; filtr va sahifa URL'da.
 */

const logoutAndRedirect = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("../../auth/authService", () => ({ default: { logoutAndRedirect } }));

const RAW = "investor profile is inactive (raw)";

const httpError = (status: number) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    response: { status, data: { statusCode: status, message: RAW } },
  });

type Params = Record<string, unknown> | undefined;
type Handler = (url: string, params: Params) => unknown;

const mockApi = (handler: Handler) =>
  vi.spyOn(api, "get").mockImplementation(async (url: string, config?: AxiosRequestConfig) => {
    const result = await handler(url, config?.params as Params);
    if (result instanceof Error) throw result;
    return { data: result } as never;
  });

const paramsOf = (get: ReturnType<typeof mockApi>, url: string) =>
  get.mock.calls.filter(([called]) => called === url).map(([, config]) => (config as AxiosRequestConfig).params);

const INVESTMENTS = [
  { id: "1", amount: 100_000_000, invested_at: "2026-08-01T12:00:00+05:00" },
  { id: "2", amount: 50_000_000, invested_at: "2026-06-20T12:00:00+05:00" },
  { id: "3", amount: 100_000_000, invested_at: "2026-04-12T12:00:00+05:00" },
  { id: "4", amount: 80_000_000, invested_at: "2026-03-03T12:00:00+05:00" },
  { id: "5", amount: 120_000_000, invested_at: "2026-01-15T12:00:00+05:00" },
];

const investmentsBody = (
  items: unknown[] = INVESTMENTS,
  meta: Partial<{ page: number; limit: number; total: number; totalPages: number }> = {},
) => ({
  statusCode: 200,
  message: "success",
  data: {
    items,
    meta: { page: 1, limit: 10, total: items.length, totalPages: 1, ...meta },
    summary: { total_amount: 450_000_000 },
  },
});

const profit = (id: string, month: number, last: number, amount: number, paidAt: string | null) => {
  const mm = String(month).padStart(2, "0");
  return {
    id,
    amount,
    percentage: 12.5,
    period_start: `2026-${mm}-01T12:00:00+05:00`,
    period_end: `2026-${mm}-${last}T23:59:59+05:00`,
    is_paid: paidAt != null,
    paid_at: paidAt,
  };
};

const PROFITS = [profit("20", 9, 30, 6_200_000, null), profit("19", 8, 31, 5_600_000, "2026-09-05T10:00:00+05:00")];

const profitsBody = (
  items: unknown[] = PROFITS,
  meta: Partial<{ page: number; total: number; totalPages: number }> = {},
) => ({
  data: {
    items,
    meta: { page: 1, limit: 10, total: items.length, totalPages: 1, ...meta },
    summary: { total_paid_amount: 34_300_000, total_unpaid_amount: 6_200_000 },
  },
});

const investorState = {
  role: { id: "42", role: "investor", region: null, name: null },
  user: {
    user: { id: "42", role: "investor", name: "Habibulla Nazirov" },
    isAuthenticated: true,
    accessToken: "t",
    loading: false,
    isAppInitializing: false,
    error: null,
  },
} as unknown as Partial<RootState>;

const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
};
const location = () => screen.getByTestId("location").textContent ?? "";

const renderAt = (page: "investments" | "profits", search = "") =>
  renderWithProviders(
    <>
      {page === "investments" ? <InvestmentsPage /> : <ProfitsPage />}
      <LocationProbe />
    </>,
    { route: `/${page}${search}`, preloadedState: investorState },
  );

const asPhone = () => {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: query.includes("max-width: 767px"),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as unknown as MediaQueryList,
  );
};

afterEach(async () => {
  vi.restoreAllMocks();
  onlineManager.setOnline(true);
  if (i18n.language !== "uz") await i18n.changeLanguage("uz");
});

/** Javobni qo'lda bo'shatiladigan va'da (oraliq holatni tekshirish uchun). */
const deferred = <T,>() => {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

const loadingState = () => document.querySelector('[data-query-state="loading"]');

/** Oflayn testdan keyin: so'rovni bekor qilib (keshni tozalab), keyin aloqani qaytaradi — tarmoq qo'riqchisiga tegmaydi. */
const goOnlineAfter = (view: ReturnType<typeof renderAt>) => {
  view.unmount();
  view.queryClient.clear();
  onlineManager.setOnline(true);
};

describe("InvestmentsPage — /investments (investor-investments-list)", () => {
  it("sarlavha, «Jami: X · N ta», jadval (sana, summa, jamidagi hissasi), sahifalash; so'rov sanasiz", async () => {
    const get = mockApi(() => investmentsBody());
    renderAt("investments");

    expect(screen.getByRole("heading", { level: 1, name: "Investitsiyalar" })).toBeInTheDocument();
    expect(screen.getByText("Kiritgan mablag'laringiz, eng yangisi tepada")).toBeInTheDocument();
    const card = screen.getByRole("region", { name: "Investitsiyalar ro'yxati" });
    expect(await within(card).findByText("Jami: 450 000 000 so'm · 5 ta")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: /Sana oralig'i/ })).toHaveTextContent("Barcha vaqt");

    const rows = within(within(card).getByRole("table")).getAllByRole("row");
    expect(rows.map((row) => row.textContent)).toEqual([
      "Kiritilgan sanaSummaJamidagi hissasi",
      "01.08.2026100 000 000 so'm22,2%",
      "20.06.202650 000 000 so'm11,1%",
      "12.04.2026100 000 000 so'm22,2%",
      "03.03.202680 000 000 so'm17,8%",
      "15.01.2026120 000 000 so'm26,7%",
    ]);
    // Har o'lchagichning nomi o'z sanasi bilan (ekran o'quvchida 5 ta bir xil «Jamidagi hissasi» emas).
    const meters = within(card).getAllByRole("meter");
    expect(meters.map((meter) => meter.getAttribute("aria-label"))).toEqual([
      "01.08.2026 — Jamidagi hissasi",
      "20.06.2026 — Jamidagi hissasi",
      "12.04.2026 — Jamidagi hissasi",
      "03.03.2026 — Jamidagi hissasi",
      "15.01.2026 — Jamidagi hissasi",
    ]);
    expect(meters[0]).toHaveAttribute("aria-valuenow", String((100_000_000 / 450_000_000) * 100));
    expect(within(card).getByText("1–5 / 5 ta investitsiya")).toBeInTheDocument();
    // Sarlavhada saralash tugmasi yo'q (tartib serverda).
    expect(within(card).queryByRole("button", { name: /saralash/i })).not.toBeInTheDocument();

    expect(paramsOf(get, "investors/me/investments")).toEqual([{ page: 1, limit: 10 }]);
  });

  it("telefon: kartalar — summa, «Kiritilgan: sana», «22,2% hissa»", async () => {
    asPhone();
    mockApi(() => investmentsBody());
    renderAt("investments");
    const list = await screen.findByRole("list", { name: "Investitsiyalar ro'yxati" });
    const first = within(list).getAllByRole("listitem")[0];
    expect(first).toHaveTextContent("100 000 000 so'm");
    expect(first).toHaveTextContent("Kiritilgan: 01.08.2026");
    expect(first).toHaveTextContent("22,2% hissa");
  });

  it("oraliq (URL): Toshkent kuni bo'yicha so'rov; bo'sh — «Bu oraliqda investitsiya yo'q» + «Filtrni tozalash»", async () => {
    const user = userEvent.setup();
    const get = mockApi((_, params) => (params?.from_date ? investmentsBody([]) : investmentsBody()));
    renderAt("investments", "?from=2026-09-01&to=2026-09-30");

    expect(await screen.findByText("Bu oraliqda investitsiya yo'q")).toBeInTheDocument();
    expect(
      screen.getByText("Sana oralig'ini kengaytiring yoki filtrni tozalang. Jami investitsiyangiz: 450 000 000 so'm."),
    ).toBeInTheDocument();
    expect(screen.getByText("Tanlangan oraliqda: 0 so'm · 0 ta")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Sahifalar" })).not.toBeInTheDocument();
    expect(paramsOf(get, "investors/me/investments")[0]).toEqual({
      page: 1,
      limit: 10,
      from_date: "2026-09-01T00:00:00+05:00",
      to_date: "2026-09-30T23:59:59.999+05:00",
    });

    await user.click(screen.getByRole("button", { name: "Filtrni tozalash" }));
    expect(location()).toBe("/investments");
    expect(await screen.findByText("Jami: 450 000 000 so'm · 5 ta")).toBeInTheDocument();
    expect(paramsOf(get, "investors/me/investments").at(-1)).toEqual({ page: 1, limit: 10 });
  });

  it("oraliqda bitta sahifa — sahifa yig'indisi; bir necha sahifa — faqat son (N6 → IN-3)", async () => {
    mockApi(() => investmentsBody(INVESTMENTS.slice(0, 2)));
    const first = renderAt("investments", "?from=2026-06-01&to=2026-08-31");
    expect(await screen.findByText("Tanlangan oraliqda: 150 000 000 so'm · 2 ta")).toBeInTheDocument();
    first.unmount();

    vi.restoreAllMocks();
    mockApi(() => investmentsBody(INVESTMENTS, { total: 12, totalPages: 3 }));
    renderAt("investments", "?from=2026-01-01&to=2026-08-31");
    expect(await screen.findByText("Tanlangan oraliqda: 12 ta")).toBeInTheDocument();
    expect(screen.queryByText(/Tanlangan oraliqda: .*so'm/)).not.toBeInTheDocument();
  });

  it("filtrsiz bo'sh — bosh sahifa matni, sahifalashsiz", async () => {
    mockApi(() => ({ data: { items: [], meta: { page: 1, limit: 10, total: 0, totalPages: 1 }, summary: { total_amount: 0 } } }));
    renderAt("investments");
    expect(await screen.findByText("Hali investitsiya yo'q")).toBeInTheDocument();
    expect(screen.getByText("Jami: 0 so'm · 0 ta")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Filtrni tozalash" })).not.toBeInTheDocument();
  });

  it("sahifa almashadi (URL ?page=2); yangi sahifa kelguncha eski qatorlar turadi, URL qaytarilmaydi", async () => {
    const user = userEvent.setup();
    let release: () => void = () => undefined;
    const get = mockApi((_, params) => {
      if (params?.page === 2) {
        return new Promise((resolve) => {
          release = () => resolve(investmentsBody([INVESTMENTS[4]], { page: 2, total: 11, totalPages: 2 }));
        });
      }
      return investmentsBody(INVESTMENTS, { total: 11, totalPages: 2 });
    });
    renderAt("investments");
    await screen.findByText("1–10 / 11 ta investitsiya");

    await user.click(screen.getByRole("button", { name: "2" }));
    expect(location()).toBe("/investments?page=2");
    // Eski javob (1-sahifa) hali ekranda — URL tuzatilmaydi, bo'sh holat chizilmaydi.
    expect(screen.getByText("01.08.2026")).toBeInTheDocument();
    expect(location()).toBe("/investments?page=2");

    release();
    expect(await screen.findByText("15.01.2026")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("01.08.2026")).not.toBeInTheDocument());
    expect(paramsOf(get, "investors/me/investments").at(-1)).toEqual({ page: 2, limit: 10 });
    expect(location()).toBe("/investments?page=2");
  });

  it("oxirgi sahifadan tashqarida (eski havola) — YANGI javobdan keyin mavjud oxirgi sahifaga o'tadi", async () => {
    const page2 = deferred<unknown>();
    const get = mockApi((_, params) =>
      params?.page === 2 ? page2.promise : investmentsBody([], { page: Number(params?.page), total: 11, totalPages: 2 }),
    );
    renderAt("investments", "?page=7");
    await waitFor(() => expect(location()).toBe("/investments?page=2"));
    // 2-sahifa hali kelmagan: bo'sh `?page=7` javobi «Hali investitsiya yo'q» bo'lib chaqnamaydi — yuklanish.
    expect(loadingState()).toBeInTheDocument();
    expect(screen.queryByText("Hali investitsiya yo'q")).not.toBeInTheDocument();

    page2.resolve(investmentsBody([INVESTMENTS[4]], { page: 2, total: 11, totalPages: 2 }));
    expect(await screen.findByText("15.01.2026")).toBeInTheDocument();
    expect(paramsOf(get, "investors/me/investments").map((params) => params.page)).toEqual([7, 2]);
    expect(screen.queryByText("Hali investitsiya yo'q")).not.toBeInTheDocument();
  });

  it("bo'sh oraliqdan filtr tozalansa — yangi javob kelguncha yuklanish, «Hali investitsiya yo'q» chaqnamaydi", async () => {
    const user = userEvent.setup();
    const all = deferred<unknown>();
    mockApi((_, params) => (params?.from_date ? investmentsBody([]) : all.promise));
    renderAt("investments", "?from=2026-09-01&to=2026-09-30");
    expect(await screen.findByText("Bu oraliqda investitsiya yo'q")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Filtrni tozalash" }));
    expect(location()).toBe("/investments");
    expect(loadingState()).toBeInTheDocument();
    expect(screen.queryByText("Hali investitsiya yo'q")).not.toBeInTheDocument();
    expect(screen.queryByText("Bu oraliqda investitsiya yo'q")).not.toBeInTheDocument();

    all.resolve(investmentsBody());
    expect(await screen.findByText("Jami: 450 000 000 so'm · 5 ta")).toBeInTheDocument();
  });

  it("oraliqda sahifadan tashqari havola (`items=[]`, `total=3`) — sarlavhada «0 so'm» emas, faqat son", async () => {
    const page1 = deferred<unknown>();
    mockApi((_, params) =>
      params?.page === 3 ? investmentsBody([], { page: 3, total: 3, totalPages: 1 }) : page1.promise,
    );
    renderAt("investments", "?from=2026-04-01&to=2026-08-31&page=3");
    await waitFor(() => expect(location()).toBe("/investments?from=2026-04-01&to=2026-08-31"));
    expect(screen.getByText("Tanlangan oraliqda: 3 ta")).toBeInTheDocument();
    expect(screen.queryByText(/Tanlangan oraliqda: 0 so'm/)).not.toBeInTheDocument();

    page1.resolve(investmentsBody(INVESTMENTS.slice(0, 3)));
    expect(await screen.findByText("Tanlangan oraliqda: 250 000 000 so'm · 3 ta")).toBeInTheDocument();
  });

  it("yuklanish skeleti — maketdagidek ustun sarlavhasi qatorisiz (faqat qatorlar)", async () => {
    const pending = deferred<unknown>();
    mockApi(() => pending.promise);
    renderAt("investments");
    expect(loadingState()).toBeInTheDocument();
    expect(document.querySelector('[data-skeleton-preset="investor-list"]')).toBeInTheDocument();
    expect(screen.queryByText("Kiritilgan sana")).not.toBeInTheDocument();
    expect(screen.queryByText("Jamidagi hissasi")).not.toBeInTheDocument();
    pending.resolve(investmentsBody());
    expect(await screen.findByText("Jami: 450 000 000 so'm · 5 ta")).toBeInTheDocument();
  });

  it("oflayn — «Internet aloqasi yo'q», skelet emas, so'rov ketmaydi", async () => {
    onlineManager.setOnline(false);
    const get = mockApi(() => investmentsBody());
    const view = renderAt("investments");
    expect(await screen.findByText("Internet aloqasi yo'q")).toBeInTheDocument();
    expect(loadingState()).not.toBeInTheDocument();
    expect(document.querySelector('[data-skeleton]')).not.toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
    goOnlineAfter(view);
  });

  it("oflayn, bo'sh oraliqdan filtr tozalansa — «Internet aloqasi yo'q», cheksiz skelet emas", async () => {
    const user = userEvent.setup();
    const get = mockApi((_, params) => (params?.from_date ? investmentsBody([]) : investmentsBody()));
    const view = renderAt("investments", "?from=2026-09-01&to=2026-09-30");
    expect(await screen.findByText("Bu oraliqda investitsiya yo'q")).toBeInTheDocument();

    onlineManager.setOnline(false);
    await user.click(screen.getByRole("button", { name: "Filtrni tozalash" }));
    expect(location()).toBe("/investments");
    expect(await screen.findByText("Internet aloqasi yo'q")).toBeInTheDocument();
    expect(loadingState()).not.toBeInTheDocument();
    expect(paramsOf(get, "investors/me/investments")).toHaveLength(1);
    goOnlineAfter(view);
  });

  it("ru: sahifalash xulosasi ko'plik shakli bilan («из 1 инвестиции», «из 5 инвестиций» emas)", async () => {
    await i18n.changeLanguage("ru");
    mockApi(() => investmentsBody(INVESTMENTS.slice(0, 1)));
    renderAt("investments");
    expect(await screen.findByText("1–1 из 1 инвестиции")).toBeInTheDocument();
  });

  it("xato 500 — «Investitsiyalarni yuklab bo'lmadi» + «Qayta urinish»; backend matni ko'rinmaydi", async () => {
    const user = userEvent.setup();
    let fail = true;
    const get = mockApi(() => (fail ? httpError(500) : investmentsBody()));
    renderAt("investments");
    expect(await screen.findByText("Investitsiyalarni yuklab bo'lmadi")).toBeInTheDocument();
    expect(screen.queryByText(RAW)).not.toBeInTheDocument();

    fail = false;
    await user.click(screen.getByRole("button", { name: "Qayta urinish" }));
    expect(await screen.findByText("Jami: 450 000 000 so'm · 5 ta")).toBeInTheDocument();
    expect(paramsOf(get, "investors/me/investments")).toHaveLength(2);
  });

  it.each([
    [403, "Investor profilingiz nofaol"],
    [404, "Investor profili hali bog'lanmagan"],
    [409, "Investor profilini aniqlab bo'lmadi"],
  ])("%s — bosh sahifadagi butun sahifa holati («Qayta urinish», «Chiqish»)", async (status, title) => {
    mockApi(() => httpError(status));
    renderAt("investments");
    expect(await screen.findByRole("heading", { level: 2, name: title })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Investitsiyalar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Qayta urinish" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Chiqish" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Investitsiyalar ro'yxati" })).not.toBeInTheDocument();
    expect(screen.queryByText(RAW)).not.toBeInTheDocument();
  });
});

describe("ProfitsPage — /profits (investor-profits-list)", () => {
  it("sarlavha, «To'langan · Kutilmoqda», holat segmenti, jadval va sahifalash", async () => {
    const get = mockApi(() => profitsBody());
    renderAt("profits");

    expect(screen.getByRole("heading", { level: 1, name: "Foyda tarixi" })).toBeInTheDocument();
    expect(screen.getByText("Har bir davr uchun hisoblangan foyda va to'lov holati")).toBeInTheDocument();
    const card = screen.getByRole("region", { name: "Foyda yozuvlari" });
    expect(await within(card).findByText("To'langan: 34 300 000 so'm")).toBeInTheDocument();
    expect(within(card).getByText("Kutilmoqda: 6 200 000 so'm")).toBeInTheDocument();

    const segment = within(card).getByRole("radiogroup", { name: "To'lov holati" });
    expect(within(segment).getAllByRole("radio").map((radio) => radio.textContent)).toEqual([
      "Barchasi",
      "To'langan",
      "Kutilmoqda",
    ]);
    expect(within(segment).getByRole("radio", { name: "Barchasi" })).toHaveAttribute("aria-checked", "true");

    const table = within(card).getByRole("table", { name: "Foyda yozuvlari" });
    const [, pending, paid] = within(table).getAllByRole("row");
    expect(pending).toHaveTextContent("01.09 – 30.09.2026");
    expect(within(pending).getByText("Kutilmoqda")).toBeInTheDocument();
    expect(within(paid).getByText("To'langan")).toBeInTheDocument();
    expect(paid).toHaveTextContent("05.09.2026");
    expect(within(card).getByText("1–2 / 2 ta yozuv")).toBeInTheDocument();
    expect(paramsOf(get, "investors/me/profits")).toEqual([{ page: 1, limit: 10 }]);
  });

  it("«Kutilmoqda» — `is_paid=false`, URL'da; bo'sh — maket matni + «Filtrni tozalash» → Barchasi", async () => {
    const user = userEvent.setup();
    const get = mockApi((_, params) => (params?.is_paid === false ? profitsBody([]) : profitsBody()));
    renderAt("profits", "?page=2");
    await screen.findByText("1–2 / 2 ta yozuv");

    await user.click(screen.getByRole("radio", { name: "Kutilmoqda" }));
    expect(location()).toBe("/profits?status=pending");
    expect(await screen.findByText("Kutilayotgan foyda yo'q")).toBeInTheDocument();
    expect(
      screen.getByText("Hisoblangan foydaning hammasi to'langan. Yangi davr foydasi oy yopilgach shu yerda chiqadi."),
    ).toBeInTheDocument();
    expect(paramsOf(get, "investors/me/profits").at(-1)).toEqual({ page: 1, limit: 10, is_paid: false });
    // Jami summalar filtrga bog'liq emas — joyida.
    expect(screen.getByText("To'langan: 34 300 000 so'm")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Filtrni tozalash" }));
    expect(location()).toBe("/profits");
    expect(await screen.findByText("1–2 / 2 ta yozuv")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Barchasi" })).toHaveAttribute("aria-checked", "true");
  });

  it("«To'langan» bo'yicha bo'sh — «To'langan foyda yo'q»; so'rov `is_paid=true`", async () => {
    const get = mockApi(() => profitsBody([]));
    renderAt("profits", "?status=paid");
    expect(await screen.findByText("To'langan foyda yo'q")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "To'langan" })).toHaveAttribute("aria-checked", "true");
    expect(paramsOf(get, "investors/me/profits")[0]).toEqual({ page: 1, limit: 10, is_paid: true });
  });

  it("filtrsiz bo'sh — «Hali foyda yozuvi yo'q», tozalash tugmasisiz", async () => {
    mockApi(() => profitsBody([]));
    renderAt("profits");
    expect(await screen.findByText("Hali foyda yozuvi yo'q")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Filtrni tozalash" })).not.toBeInTheDocument();
  });

  it("xato 500 — «Foyda tarixini yuklab bo'lmadi»; 403 — butun sahifa holati; backend matni ko'rinmaydi", async () => {
    mockApi(() => httpError(500));
    const view = renderAt("profits");
    expect(await screen.findByText("Foyda tarixini yuklab bo'lmadi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Qayta urinish" })).toBeInTheDocument();
    expect(screen.queryByText(RAW)).not.toBeInTheDocument();
    view.unmount();

    vi.restoreAllMocks();
    mockApi(() => httpError(403));
    renderAt("profits");
    expect(await screen.findByRole("heading", { level: 2, name: "Investor profilingiz nofaol" })).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "To'lov holati" })).not.toBeInTheDocument();
    expect(screen.queryByText(RAW)).not.toBeInTheDocument();
  });

  it("oxirgi sahifadan tashqarida (`?page=7`) — yangi javobdan keyin oxirgi sahifaga; oraliqda bo'sh holat chaqnamaydi", async () => {
    const page2 = deferred<unknown>();
    const get = mockApi((_, params) =>
      params?.page === 2
        ? page2.promise
        : { data: { ...profitsBody([]).data, meta: { page: Number(params?.page), limit: 10, total: 11, totalPages: 2 } } },
    );
    renderAt("profits", "?page=7");
    await waitFor(() => expect(location()).toBe("/profits?page=2"));
    expect(loadingState()).toBeInTheDocument();
    expect(screen.queryByText("Hali foyda yozuvi yo'q")).not.toBeInTheDocument();

    page2.resolve(profitsBody(PROFITS.slice(0, 1), { page: 2, total: 11, totalPages: 2 }));
    expect(await screen.findByText("11–11 / 11 ta yozuv")).toBeInTheDocument();
    expect(paramsOf(get, "investors/me/profits").map((params) => params.page)).toEqual([7, 2]);
    expect(screen.queryByText("Hali foyda yozuvi yo'q")).not.toBeInTheDocument();
  });

  it("oflayn — «Internet aloqasi yo'q», skelet emas, so'rov ketmaydi", async () => {
    onlineManager.setOnline(false);
    const get = mockApi(() => profitsBody());
    const view = renderAt("profits");
    expect(await screen.findByText("Internet aloqasi yo'q")).toBeInTheDocument();
    expect(loadingState()).not.toBeInTheDocument();
    expect(document.querySelector('[data-skeleton]')).not.toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
    goOnlineAfter(view);
  });

  it("ru/en: «из 1 записи», «of 1 record»", async () => {
    await i18n.changeLanguage("ru");
    mockApi(() => profitsBody(PROFITS.slice(0, 1)));
    const view = renderAt("profits");
    expect(await screen.findByText("1–1 из 1 записи")).toBeInTheDocument();
    view.unmount();
    await i18n.changeLanguage("en");
    renderAt("profits");
    expect(await screen.findByText("1–1 of 1 record")).toBeInTheDocument();
  });

  it("telefon: kartalar — davr, summa, holat, «Hali to'lanmagan» / «To'langan: sana»", async () => {
    asPhone();
    mockApi(() => profitsBody());
    renderAt("profits");
    const list = await screen.findByRole("list", { name: "Foyda yozuvlari" });
    const [pending, paid] = within(list).getAllByRole("listitem");
    expect(pending).toHaveTextContent("Hali to'lanmagan");
    expect(paid).toHaveTextContent("To'langan: 05.09.2026");
  });
});
