import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation } from "react-router-dom";
import { vi } from "vitest";
import { renderWithProviders } from "../../../../test/test-utils";
import RegionSatoManagementPage from "./index";

const api = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), post: vi.fn() }));
vi.mock("../../../../shared/api/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../shared/api/api")>()),
  api,
}));

const REGIONS = [
  {
    id: "1",
    name: "Toshkent shahri",
    districts: [
      { id: "2", name: "Chilonzor" },
      { id: "3", name: "Mirobod" },
    ],
  },
  { id: "6", name: "Samarqand viloyati", districts: [{ id: "179", name: "Samarqand shahri" }] },
  { id: "11", name: "Sirdaryo viloyati", districts: [] },
];

const TOSHKENT_SH = { id: "1", name: "Toshkent sh.", sato_code: "1726" };
const SAMARQAND = { id: "6", name: "Samarqand", sato_code: "1718" };

/** 12 ta «Topildi» (sahifalash 10 + 2), 1 «Topilmadi», 2 «Kodi bor», 1 takroriy guruh (2 yozuv). */
const FOUND = Array.from({ length: 12 }, (_, i) => ({
  id: String(100 + i),
  name: `Tuman ${String(i + 1).padStart(2, "0")}`,
  code: String(1726200 + i),
}));
const DISTRICTS = [
  ...FOUND.map((d) => ({ id: d.id, name: d.name, sato_code: null as string | null, region_id: "1", region: TOSHKENT_SH })),
  { id: "14", name: "Urgut sh.", sato_code: null, region_id: "6", region: SAMARQAND },
  { id: "12", name: "Uchtepa tumani", sato_code: "1726262", region_id: "1", region: TOSHKENT_SH },
  { id: "13", name: "Yashnobod tumani", sato_code: "1726290", region_id: "1", region: TOSHKENT_SH },
  { id: "31", name: "Bo'ka tumani", sato_code: "1727228", region_id: "6", region: SAMARQAND },
  { id: "32", name: "Bo'ka tumani", sato_code: null, region_id: "6", region: SAMARQAND },
];
const PREVIEW = {
  matched: [
    ...FOUND.map((d) => ({
      dbId: d.id,
      dbName: `${d.name} (Toshkent sh.)`,
      satoCode: d.code,
      satoName: `${d.name} (Toshkent shahri)`,
    })),
    { dbId: "12", dbName: "Uchtepa tumani", satoCode: "1726262", satoName: "(allaqachon mavjud)" },
    { dbId: "13", dbName: "Yashnobod tumani", satoCode: "1726290", satoName: "(allaqachon mavjud)" },
  ],
  unmatched: [{ dbId: "14", dbName: "Urgut sh.", regionName: "Samarqand" }],
  duplicates: [{ name: "Bo'ka tumani (Samarqand)", entries: [{ id: "31" }, { id: "32" }] }],
  missingSatoEntries: [{ satoCode: "1718236", satoName: "Urgut tumani", regionName: "Samarqand viloyati" }],
  stats: { totalDb: 18, totalSato: 203, matchedCount: 14, unmatchedCount: 1, duplicatesCount: 2, missingCount: 1 },
};

const ok = (data: unknown) => Promise.resolve({ data: { statusCode: 200, data } });
const httpError = (status: number, message = "District sato_code already exists") =>
  Object.assign(new Error("fail"), { isAxiosError: true, response: { status, data: { message } } });

const mockGets = (overrides: Record<string, () => Promise<unknown>> = {}) =>
  api.get.mockImplementation((url: string) => {
    if (overrides[url]) return overrides[url]();
    if (url === "region") return ok(REGIONS);
    if (url === "district") return ok(DISTRICTS);
    if (url === "district/sato-match/preview") return ok(PREVIEW);
    if (url === "district/sato/1726262")
      return ok({ id: "12", name: "Uchtepa tumani", region: { name: "Toshkent sh." } });
    return Promise.reject(httpError(404, "not found"));
  });
const calls = (url: string) => api.get.mock.calls.filter(([u]) => u === url).length;

const Where = () => {
  const location = useLocation();
  return <span data-testid="path">{`${location.pathname}${location.search}`}</span>;
};
const open = (role = "superadmin", search = "") =>
  renderWithProviders(
    <Routes>
      <Route
        path="/regions/sato-management"
        element={
          <>
            <RegionSatoManagementPage />
            <Where />
          </>
        }
      />
      <Route path="/regions" element={<Where />} />
    </Routes>,
    {
      route: `/regions/sato-management${search}`,
      preloadedState: { role: { id: "1", role, region: null, name: role } } as never,
    },
  );

const dataTransfer = () => {
  const store: Record<string, string> = {};
  return {
    setData: (k: string, v: string) => {
      store[k] = v;
    },
    getData: (k: string) => store[k] ?? "",
  };
};
const drag = (districtId: string, toRegionId: string) => {
  const dt = dataTransfer();
  fireEvent.dragStart(screen.getByTestId(`district-${districtId}`), { dataTransfer: dt });
  fireEvent.dragOver(screen.getByTestId(`region-${toRegionId}`), { dataTransfer: dt });
  fireEvent.drop(screen.getByTestId(`region-${toRegionId}`), { dataTransfer: dt });
};

/** Telefon kengligi (`useIsPhone` — `matchMedia("(max-width: 767px)")`). */
const asPhone = () => {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: query.includes("max-width: 767px"),
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

const statusTab = (name: RegExp) =>
  within(screen.getByRole("tablist", { name: "SATO holati bo'yicha" })).getByRole("tab", { name });

describe("RegionSatoManagementPage (v2) — «Tumanlarni o'tkazish» tabi", () => {
  beforeEach(() => {
    mockGets();
    api.patch.mockResolvedValue({ data: { statusCode: 200 } });
  });
  afterEach(() => vi.clearAllMocks());

  it("bitta sarlavha, ikki tab (sukut — o'tkazish), sonlar va izoh; SATO so'rovlari ketmaydi", async () => {
    open("admin");

    const tashkent = await screen.findByRole("region", { name: "Toshkent shahri" });
    expect(within(tashkent).getByText("Chilonzor")).toBeInTheDocument();
    expect(within(tashkent).getByText("2 ta")).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Sirdaryo viloyati" })).getByText("Tuman biriktirilmagan"),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Tumanlar va SATO kodlari" })).toBeInTheDocument();
    const pageTabs = screen.getByRole("tablist", { name: "Tumanlar bo'limlari" });
    expect(within(pageTabs).getByRole("tab", { name: "Tumanlarni o'tkazish" })).toHaveAttribute("aria-selected", "true");
    expect(within(pageTabs).getByRole("tab", { name: "SATO kodlari" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("group", { name: "Umumiy son" })).toHaveTextContent("Viloyatlar 3");
    expect(
      screen.getByText("Tumanni ushlab olib kerakli viloyat ustiga tashlang yoki uning o'tkazish tugmasini bosing."),
    ).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("region");
    expect(calls("district")).toBe(0);
    expect(calls("district/sato-match/preview")).toBe(0);
  });

  it("moves a dragged district with PATCH /district/:id {assigned_region} and shows the success toast", async () => {
    open();
    await screen.findByText("Chilonzor");

    act(() => drag("2", "6"));

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith("district/2", { assigned_region: "6" }));
    expect(
      within(screen.getByRole("region", { name: "Samarqand viloyati" })).getByText("Chilonzor"),
    ).toBeInTheDocument();
    expect(await screen.findByText("Tuman boshqa viloyatga o'tkazildi")).toBeInTheDocument();
  });

  it("reloads the list and keeps the district in place when the move fails", async () => {
    api.patch.mockRejectedValue(new Error("fail"));
    open();
    await screen.findByText("Chilonzor");

    act(() => drag("2", "6"));

    expect(await screen.findByText("O'tkazishda xatolik yuz berdi")).toBeInTheDocument();
    expect(screen.getByText("Ro'yxat qayta yuklandi, tuman joyida qoldi")).toBeInTheDocument();
    await waitFor(() => expect(calls("region")).toBe(2));
    await waitFor(() =>
      expect(
        within(screen.getByRole("region", { name: "Toshkent shahri" })).getByText("Chilonzor"),
      ).toBeInTheDocument(),
    );
  });

  it("on a phone moves a district through the «⇆» region picker", async () => {
    const restore = asPhone();
    try {
      const user = userEvent.setup();
      open();
      await screen.findByRole("button", { name: /^Toshkent shahri/ });

      await user.click(screen.getByRole("button", { name: "Mirobod — boshqa viloyatga o'tkazish" }));
      const dialog = await screen.findByRole("dialog", { name: "Boshqa viloyatga o'tkazish" });
      expect(within(dialog).queryByRole("radio", { name: "Toshkent shahri" })).not.toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: "O'tkazish" })).toBeDisabled();
      await user.click(within(dialog).getByRole("radio", { name: "Sirdaryo viloyati" }));
      await user.click(within(dialog).getByRole("button", { name: "O'tkazish" }));

      await waitFor(() => expect(api.patch).toHaveBeenCalledWith("district/3", { assigned_region: "11" }));
    } finally {
      restore();
    }
  });

  it("load error is shown on the page (ErrorState) and is not toasted globally again", async () => {
    mockGets({ region: () => Promise.reject(httpError(500, "boom")) });
    const { queryClient } = open();

    expect(await screen.findByText("Ma'lumotni yuklab bo'lmadi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Qayta urinish" })).toBeInTheDocument();
    const [query] = queryClient.getQueryCache().getAll();
    expect(query?.meta?.silentError).toBe(true);
  });

  it("redirects other roles to /regions without loading", async () => {
    open("manager");
    expect(await screen.findByTestId("path")).toHaveTextContent("/regions");
    expect(api.get).not.toHaveBeenCalled();
  });

  it("«SATO kodlari» tabi `?tab=sato` ga o'tadi, qaytishda parametr olinadi", async () => {
    const user = userEvent.setup();
    open();
    await screen.findByText("Chilonzor");

    await user.click(screen.getByRole("tab", { name: "SATO kodlari" }));
    expect(screen.getByTestId("path")).toHaveTextContent("/regions/sato-management?tab=sato");
    expect(await screen.findByText("Tuman 01")).toBeInTheDocument();
    // SATO tabida sonlar guruhi yo'q (sarlavha amallari tabga bog'liq).
    expect(screen.queryByRole("group", { name: "Umumiy son" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Tumanlarni o'tkazish" }));
    expect(screen.getByTestId("path")).toHaveTextContent(/^\/regions\/sato-management$/);
  });
});

describe("RegionSatoManagementPage (v2) — «SATO kodlari» (superadmin)", () => {
  beforeEach(() => {
    mockGets();
    api.patch.mockResolvedValue({ data: { statusCode: 200, data: {} } });
  });
  afterEach(() => vi.clearAllMocks());

  it("preview + /district: KPI qatori, tab sonlari (sato_code bo'yicha), «Topildi» qatorlari va sahifalash", async () => {
    const user = userEvent.setup();
    open("superadmin", "?tab=sato");

    expect(await screen.findByText("Tuman 01")).toBeInTheDocument();
    expect(calls("district/sato-match/preview")).toBe(1);
    expect(calls("district")).toBe(1);
    expect(calls("region")).toBe(0);

    const kpi = screen.getByRole("region", { name: "SATO solishtirish natijasi" });
    expect(kpi).toHaveTextContent(/Bazada\s*18/);
    expect(kpi).toHaveTextContent(/Mos keldi\s*14/);
    expect(kpi).toHaveTextContent("2 tasida kod bor");
    expect(kpi).toHaveTextContent("Yozuv · 1 ta nomda");
    expect(within(kpi).getByRole("meter", { name: "Mos kelganlar ulushi" })).toBeInTheDocument();

    expect(statusTab(/^Topildi/)).toHaveTextContent("12");
    expect(statusTab(/^Topilmadi/)).toHaveTextContent("1");
    expect(statusTab(/^Kodi bor/)).toHaveTextContent("2");
    expect(statusTab(/^Takroriy nomlar/)).toHaveTextContent("1");
    expect(statusTab(/^Bazada yo'q/)).toHaveTextContent("1");

    const table = screen.getByRole("table", { name: "SATO kodi topilgan tumanlar" });
    const row = within(table).getByText("Tuman 01").closest("tr")!;
    expect(row).toHaveTextContent("1726200");
    expect(row).toHaveTextContent("Tuman 01 (Toshkent shahri)");
    expect(within(table).getAllByRole("row")).toHaveLength(11);
    expect(screen.getByText("1–10 / 12 ta tuman")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Keyingi sahifa" }));
    expect(within(screen.getByRole("table")).getByText("Tuman 12")).toBeInTheDocument();
    expect(screen.getByText("11–12 / 12 ta tuman")).toBeInTheDocument();
  });

  it("qidiruv (kod bo'yicha) va viloyat filtri; natija yo'q — «Filtrlarni tozalash»", async () => {
    const user = userEvent.setup();
    open("superadmin", "?tab=sato");
    await screen.findByText("Tuman 01");

    const search = screen.getByRole("searchbox", { name: "Tuman, viloyat yoki SATO kodi bo'yicha qidirish" });
    await user.type(search, "1726205");
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(2);
    expect(within(table).getByText("Tuman 06")).toBeInTheDocument();
    expect(screen.getByText("1 ta tuman")).toBeInTheDocument();

    await user.clear(search);
    await user.click(screen.getByRole("combobox", { name: "Viloyat" }));
    await user.click(await screen.findByRole("option", { name: "Samarqand" }));
    expect(await screen.findByText("Hech narsa topilmadi")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Filtrlarni tozalash" }));
    expect(await screen.findByText("Tuman 01")).toBeInTheDocument();
  });

  it("«Topildi»: ✎ → topilgan kod maydonda → «Saqlash» → PATCH district/sato/:id, xabar, preview va /district birga yangilanadi", async () => {
    const user = userEvent.setup();
    open("superadmin", "?tab=sato");
    await screen.findByText("Tuman 01");

    await user.click(screen.getByRole("button", { name: "Tuman 01 — SATO kodini o'zgartirish" }));
    const input = screen.getByRole("textbox", { name: "Tuman 01 — SATO kodi" });
    expect(input).toHaveValue("1726200");
    expect(input).toHaveFocus();
    expect(screen.getByText("Faqat raqamlar, masalan 1727401")).toBeInTheDocument();
    // Bir vaqtda bitta qator: boshqa qatorlarda maydon yo'q.
    expect(screen.getAllByRole("textbox", { name: /— SATO kodi$/ })).toHaveLength(1);

    await user.clear(input);
    await user.type(input, "17262a99");
    expect(input).toHaveValue("1726299");
    await user.click(screen.getByRole("button", { name: "Saqlash" }));

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith("district/sato/100", { sato_code: "1726299" }));
    expect(await screen.findByText("SATO kodi saqlandi")).toBeInTheDocument();
    expect(screen.getByText("Tuman 01 · 1726299")).toBeInTheDocument();
    await waitFor(() => expect(calls("district/sato-match/preview")).toBe(2));
    expect(calls("district")).toBe(2);
    expect(screen.queryByRole("textbox", { name: /— SATO kodi$/ })).not.toBeInTheDocument();
  });

  it("409 → GET district/sato/:code → «Bu kod band: <tuman>, <viloyat>» (server matni ko'rsatilmaydi)", async () => {
    api.patch.mockRejectedValue(httpError(409));
    const user = userEvent.setup();
    open("superadmin", "?tab=sato");
    await screen.findByText("Tuman 01");

    await user.click(statusTab(/^Kodi bor/));
    await user.click(await screen.findByRole("button", { name: "Yashnobod tumani — SATO kodini o'zgartirish" }));
    const input = screen.getByRole("textbox", { name: "Yashnobod tumani — SATO kodi" });
    await user.clear(input);
    await user.type(input, "1726262{Enter}");

    expect(await screen.findByText("Bu kod band: Uchtepa tumani, Toshkent sh.")).toBeInTheDocument();
    expect(api.patch).toHaveBeenCalledWith("district/sato/13", { sato_code: "1726262" });
    expect(api.get).toHaveBeenCalledWith("district/sato/1726262");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText(/already exists/)).not.toBeInTheDocument();
    expect(screen.queryByText("SATO kodi saqlandi")).not.toBeInTheDocument();

    // Kod o'zgarsa xato yo'qoladi; Esc — bekor, fokus ✎ ga qaytadi.
    await user.type(input, "1");
    expect(screen.queryByText("Bu kod band: Uchtepa tumani, Toshkent sh.")).not.toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("textbox", { name: "Yashnobod tumani — SATO kodi" })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Yashnobod tumani — SATO kodini o'zgartirish" })).toHaveFocus(),
    );
  });

  it("bo'sh kod — so'rov ketmaydi; o'zgarmagan kod — muharrir yopiladi; boshqa xato — umumiy matn", async () => {
    api.patch.mockRejectedValue(httpError(500, "Internal server error: db timeout"));
    const user = userEvent.setup();
    open("superadmin", "?tab=sato");
    await screen.findByText("Tuman 01");

    await user.click(statusTab(/^Topilmadi/));
    // Ko'rinadigan matn nomning boshida (WCAG 2.5.3 «label in name»).
    const enter = await screen.findByRole("button", { name: "Kod kiritish: Urgut sh." });
    expect(enter).toHaveTextContent("Kod kiritish");
    await user.click(enter);
    await user.click(screen.getByRole("button", { name: "Saqlash" }));
    expect(screen.getByText("Faqat raqamlar kiriting, masalan 1727401")).toBeInTheDocument();
    expect(api.patch).not.toHaveBeenCalled();

    await user.type(screen.getByRole("textbox", { name: "Urgut sh. — SATO kodi" }), "1718236");
    await user.click(screen.getByRole("button", { name: "Saqlash" }));
    expect(await screen.findByText("Kodni saqlab bo'lmadi. Qayta urinib ko'ring.")).toBeInTheDocument();
    expect(screen.queryByText(/db timeout/)).not.toBeInTheDocument();

    await user.click(statusTab(/^Kodi bor/));
    await user.click(await screen.findByRole("button", { name: "Uchtepa tumani — SATO kodini o'zgartirish" }));
    await user.click(screen.getByRole("button", { name: "Saqlash" }));
    expect(screen.queryByRole("textbox", { name: "Uchtepa tumani — SATO kodi" })).not.toBeInTheDocument();
    expect(api.patch).toHaveBeenCalledTimes(1);
  });

  it("«Takroriy nomlar» (guruh sarlavhasi, «Birlashtirish») va «Bazada yo'q» («Tuman qo'shish») tablari", async () => {
    const user = userEvent.setup();
    open("superadmin", "?tab=sato");
    await screen.findByText("Tuman 01");

    await user.click(statusTab(/^Takroriy nomlar/));
    const duplicates = await screen.findByRole("table", { name: "Dublikat tumanlar" });
    // Guruh sarlavhasi + 2 yozuv.
    expect(within(duplicates).getAllByText("Bo'ka tumani")).toHaveLength(3);
    expect(within(duplicates).getByRole("rowheader", { name: /Bo'ka tumani/ })).toHaveTextContent("2 ta yozuv");
    expect(within(duplicates).getByText("ID 32")).toBeInTheDocument();
    expect(
      within(duplicates).getByRole("button", { name: "Kod kiritish: Bo'ka tumani (Samarqand)" }),
    ).toBeInTheDocument();
    expect(within(duplicates).getByRole("button", { name: "Bo'ka tumani yozuvlarini birlashtirish" })).toHaveTextContent(
      "Birlashtirish",
    );
    expect(screen.getByText("1 ta nom · 2 ta yozuv")).toBeInTheDocument();

    await user.click(statusTab(/^Bazada yo'q/));
    const missing = await screen.findByRole("table", { name: "Bazada yo'q SATO yozuvlari" });
    const row = within(missing).getByText("Urgut tumani").closest("tr")!;
    expect(row).toHaveTextContent("1718236");
    expect(row).toHaveTextContent("Samarqand");
    expect(within(row).getByRole("button", { name: "Urgut tumani — tuman qo'shish" })).toHaveTextContent("Tuman qo'shish");
    expect(screen.getByText("1 ta yozuv")).toBeInTheDocument();
  });

  it("preview yuklanmasa — «Solishtirishni yuklab bo'lmadi» + «Qayta urinish» (ikkala so'rov qayta), KPI yo'q", async () => {
    let fail = true;
    mockGets({
      "district/sato-match/preview": () => (fail ? Promise.reject(httpError(500, "raw backend text")) : ok(PREVIEW)),
    });
    const user = userEvent.setup();
    open("superadmin", "?tab=sato");

    expect(await screen.findByText("Solishtirishni yuklab bo'lmadi")).toBeInTheDocument();
    expect(screen.getByText("Internetni tekshirib, qayta urinib ko'ring.")).toBeInTheDocument();
    expect(screen.queryByText("raw backend text")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "SATO solishtirish natijasi" })).not.toBeInTheDocument();

    fail = false;
    await user.click(screen.getByRole("button", { name: "Qayta urinish" }));
    expect(await screen.findByText("Tuman 01")).toBeInTheDocument();
    expect(calls("district")).toBe(2);
  });

  it("telefonda: holat tablari o'rniga `Select`, kartadagi muharrir (yorliq «SATO kodi»)", async () => {
    const restore = asPhone();
    try {
      const user = userEvent.setup();
      open("superadmin", "?tab=sato");
      await screen.findByText("Tuman 01");

      expect(screen.queryByRole("tablist", { name: "SATO holati bo'yicha" })).not.toBeInTheDocument();
      const select = screen.getByRole("combobox", { name: "SATO bo'limi: Topildi" });
      expect(screen.getByText("Toshkent sh. · 1726200")).toBeInTheDocument();

      await user.click(select);
      await user.click(await screen.findByRole("option", { name: /Topilmadi/ }));
      expect(await screen.findByRole("combobox", { name: "SATO bo'limi: Topilmadi" })).toBeInTheDocument();
      expect(screen.getByText("Samarqand · Kod yo'q")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Urgut sh. — SATO kodini kiritish" }));
      expect(screen.getByText("SATO kodi")).toBeInTheDocument();
      await user.type(screen.getByRole("textbox", { name: "Urgut sh. — SATO kodi" }), "1718236");
      await user.click(screen.getByRole("button", { name: "Saqlash" }));
      await waitFor(() => expect(api.patch).toHaveBeenCalledWith("district/sato/14", { sato_code: "1718236" }));
    } finally {
      restore();
    }
  });
});

describe("RegionSatoManagementPage (v2) — «SATO kodlari» (admin)", () => {
  beforeEach(() => {
    mockGets();
    api.patch.mockResolvedValue({ data: { statusCode: 200, data: {} } });
  });
  afterEach(() => vi.clearAllMocks());

  it("preview chaqirilmaydi (403): «Kodsiz» · «Kodi bor» (takroriylar ham), KPI yo'q", async () => {
    const user = userEvent.setup();
    open("admin", "?tab=sato");

    expect(await screen.findByText("Tuman 01")).toBeInTheDocument();
    expect(calls("district/sato-match/preview")).toBe(0);
    expect(screen.queryByRole("region", { name: "SATO solishtirish natijasi" })).not.toBeInTheDocument();
    const tabs = within(screen.getByRole("tablist", { name: "SATO holati bo'yicha" })).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Kodsiz 14", "Kodi bor 3"]);
    expect(
      screen.getByText("Kodni tumanning rasmiy SATO raqamidan kiriting. Bitta kod faqat bitta tumanga yoziladi."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Kod kiritish: Urgut sh." }));
    await user.type(screen.getByRole("textbox", { name: "Urgut sh. — SATO kodi" }), "1718236{Enter}");
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith("district/sato/14", { sato_code: "1718236" }));
    await waitFor(() => expect(calls("district")).toBe(2));
    expect(calls("district/sato-match/preview")).toBe(0);
  });

  it("«Kodsiz» bo'sh — «Hamma tumanda SATO kodi bor»; yuklash xatosi — «Tumanlarni yuklab bo'lmadi»", async () => {
    mockGets({ district: () => ok(DISTRICTS.filter((d) => d.sato_code)) });
    const first = open("admin", "?tab=sato");
    expect(await screen.findByText("Hamma tumanda SATO kodi bor")).toBeInTheDocument();
    first.unmount();

    mockGets({ district: () => Promise.reject(httpError(503, "upstream")) });
    open("admin", "?tab=sato");
    expect(await screen.findByText("Tumanlarni yuklab bo'lmadi")).toBeInTheDocument();
    expect(screen.queryByText("upstream")).not.toBeInTheDocument();
  });
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe("RegionSatoManagementPage (v2) — SATO muharriri: fokus, e'lon, kenglik, sahifalash", () => {
  beforeEach(() => {
    mockGets();
    api.patch.mockResolvedValue({ data: { statusCode: 200, data: {} } });
  });
  afterEach(() => vi.clearAllMocks());

  const openYashnobod = async (user: ReturnType<typeof userEvent.setup>) => {
    open("superadmin", "?tab=sato");
    await screen.findByText("Tuman 01");
    await user.click(statusTab(/^Kodi bor/));
    await user.click(await screen.findByRole("button", { name: "Yashnobod tumani — SATO kodini o'zgartirish" }));
    const input = screen.getByRole("textbox", { name: "Yashnobod tumani — SATO kodi" });
    await user.clear(input);
    return input;
  };

  it("saqlash paytida maydon readOnly (disabled emas): 409 dan keyin fokus maydonda, xato e'lon qilinadi, Esc ishlaydi", async () => {
    const patch = deferred<never>();
    api.patch.mockReturnValue(patch.promise);
    const user = userEvent.setup();
    const input = await openYashnobod(user);
    await user.type(input, "1726262{Enter}");

    expect(input).not.toBeDisabled();
    expect(input).toHaveAttribute("readonly");
    expect(input).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(api.patch).toHaveBeenCalledTimes(1);

    const live = screen.getByTestId("sato-editor-live");
    expect(live).toHaveAttribute("role", "alert");
    expect(live).toBeEmptyDOMElement();
    await act(async () => patch.reject(httpError(409)));

    await waitFor(() => expect(live).toHaveTextContent("Yashnobod tumani — SATO kodi: Bu kod band: Uchtepa tumani, Toshkent sh."));
    expect(input).not.toHaveAttribute("readonly");
    expect(input).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("textbox", { name: "Yashnobod tumani — SATO kodi" })).not.toBeInTheDocument();
    expect(live).toBeEmptyDOMElement();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Yashnobod tumani — SATO kodini o'zgartirish" })).toHaveFocus(),
    );
  });

  it("jadvaldagi kod maydoni ~200px o'rovchida (TextInput qutisining `w-full` i kenglikni yutmaydi)", async () => {
    const user = userEvent.setup();
    const input = await openYashnobod(user);
    const box = input.closest("[data-sato-code-box]");
    expect(box).not.toBeNull();
    expect(box).toHaveClass("w-[200px]", "max-w-full");
    expect(box).not.toHaveClass("w-full");
  });

  it("so'rov davomida muharrir yopilsa (qidiruv) — xato yo'qolmaydi: qalqib chiquvchi xabar, server matnisiz", async () => {
    const patch = deferred<never>();
    api.patch.mockReturnValue(patch.promise);
    const user = userEvent.setup();
    const input = await openYashnobod(user);
    await user.type(input, "1726262{Enter}");
    await user.type(screen.getByRole("searchbox", { name: "Tuman, viloyat yoki SATO kodi bo'yicha qidirish" }), "Yash");
    expect(screen.queryByRole("textbox", { name: "Yashnobod tumani — SATO kodi" })).not.toBeInTheDocument();

    await act(async () => patch.reject(httpError(500, "Internal server error: db timeout")));

    expect(await screen.findByText("Yashnobod tumani — SATO kodi saqlanmadi")).toBeInTheDocument();
    expect(screen.getByText("Kodni saqlab bo'lmadi. Qayta urinib ko'ring.")).toBeInTheDocument();
    expect(screen.queryByText(/db timeout/)).not.toBeInTheDocument();
  });

  it("«Topildi»dan saqlangan qator «Kodi bor»ga o'tsa — fokus qidiruv maydoniga (body ga tushib qolmaydi)", async () => {
    let districtCalls = 0;
    mockGets({
      district: () => {
        districtCalls += 1;
        return ok(districtCalls === 1 ? DISTRICTS : DISTRICTS.map((d) => (d.id === "100" ? { ...d, sato_code: "1726200" } : d)));
      },
    });
    const user = userEvent.setup();
    open("superadmin", "?tab=sato");
    await screen.findByText("Tuman 01");

    await user.click(screen.getByRole("button", { name: "Tuman 01 — SATO kodini o'zgartirish" }));
    await user.click(screen.getByRole("button", { name: "Saqlash" }));

    await waitFor(() => expect(statusTab(/^Topildi/)).toHaveTextContent("11"));
    await waitFor(() =>
      expect(screen.getByRole("searchbox", { name: "Tuman, viloyat yoki SATO kodi bo'yicha qidirish" })).toHaveFocus(),
    );
  });

  it("muvaffaqiyatdan keyin qayta yuklash kutilayotganda boshqa qator «Saqlanmoqda…» ko'rinmaydi", async () => {
    const reload = deferred<unknown>();
    let districtCalls = 0;
    mockGets({
      district: () => {
        districtCalls += 1;
        return districtCalls === 1 ? ok(DISTRICTS) : reload.promise;
      },
    });
    const user = userEvent.setup();
    open("superadmin", "?tab=sato");
    await screen.findByText("Tuman 01");

    await user.click(screen.getByRole("button", { name: "Tuman 01 — SATO kodini o'zgartirish" }));
    const first = screen.getByRole("textbox", { name: "Tuman 01 — SATO kodi" });
    await user.clear(first);
    await user.type(first, "1726299");
    await user.click(screen.getByRole("button", { name: "Saqlash" }));
    expect(await screen.findByText("SATO kodi saqlandi")).toBeInTheDocument();
    await waitFor(() => expect(districtCalls).toBe(2));

    await user.click(screen.getByRole("button", { name: "Tuman 02 — SATO kodini o'zgartirish" }));
    expect(screen.getByRole("button", { name: "Saqlash" })).not.toHaveAttribute("aria-busy");
    expect(screen.getByRole("textbox", { name: "Tuman 02 — SATO kodi" })).not.toHaveAttribute("readonly");

    await act(async () => reload.resolve(await ok(DISTRICTS)));
  });

  it("kattaroq sahifa hajmi tanlangach ham hajm tanlagichi qoladi (10 ga qaytarish mumkin)", async () => {
    const user = userEvent.setup();
    open("superadmin", "?tab=sato");
    await screen.findByText("Tuman 01");

    await user.click(screen.getByRole("combobox", { name: "Sahifadagi qatorlar soni: 10 ta" }));
    await user.click(await screen.findByRole("option", { name: "25 ta" }));
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(13);

    const size = await screen.findByRole("combobox", { name: "Sahifadagi qatorlar soni: 25 ta" });
    await user.click(size);
    await user.click(await screen.findByRole("option", { name: "10 ta" }));
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(11);
  });
});

describe("RegionSatoManagementPage (v2) — SA-2: «SATO kodlarini yozish»", () => {
  beforeEach(() => {
    mockGets();
    api.patch.mockResolvedValue({ data: { statusCode: 200, data: {} } });
  });
  afterEach(() => vi.clearAllMocks());

  const applyButton = () => screen.getByRole("button", { name: /^SATO kodlarini yozish/ });

  it("tugma faqat superadminda va faqat SATO tabida; N = «Topildi», N = 0 — o'chiq", async () => {
    const first = open("superadmin");
    await screen.findByText("Chilonzor");
    expect(screen.queryByRole("button", { name: /^SATO kodlarini yozish/ })).not.toBeInTheDocument();
    first.unmount();

    const second = open("superadmin", "?tab=sato");
    await screen.findByText("Tuman 01");
    expect(applyButton()).toHaveTextContent("SATO kodlarini yozish12");
    expect(applyButton()).toBeEnabled();
    second.unmount();

    const third = open("admin", "?tab=sato");
    await screen.findByText("Tuman 01");
    expect(screen.queryByRole("button", { name: /^SATO kodlarini yozish/ })).not.toBeInTheDocument();
    third.unmount();

    mockGets({ "district/sato-match/preview": () => ok({ ...PREVIEW, matched: PREVIEW.matched.slice(12) }) });
    open("superadmin", "?tab=sato");
    await screen.findByText("Yoziladigan kod yo'q");
    expect(applyButton()).toBeDisabled();
    expect(applyButton()).toHaveTextContent("0");
  });

  it("oyna: Yoziladi / O'zgarmaydi / Yozilmaydi, 3 tuman + «yana 9 ta»; «Yozilmoqda…» (yopilmaydi) → POST → xabar, qayta yuklash", async () => {
    const apply = deferred<unknown>();
    api.post.mockReturnValue(apply.promise);
    const user = userEvent.setup();
    open("superadmin", "?tab=sato");
    await screen.findByText("Tuman 01");

    await user.click(applyButton());
    const dialog = await screen.findByRole("alertdialog", { name: "SATO kodlarini yozasizmi?" });
    expect(dialog).toHaveTextContent("Rasmiy ro'yxatdan topilgan 12 ta kod bazadagi tumanlarga yoziladi.");
    const summary = within(dialog).getByText("Yoziladi").closest("dl")!;
    expect(summary).toHaveTextContent("Yoziladi12 ta");
    expect(summary).toHaveTextContent("O'zgarmaydi2 ta");
    expect(summary).toHaveTextContent("Yozilmaydi3 ta");
    const list = within(dialog).getByRole("list", { name: "Yoziladigan kodlar" });
    expect(within(list).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Tuman 01Toshkent sh.1726200",
      "Tuman 02Toshkent sh.1726201",
      "Tuman 03Toshkent sh.1726202",
      "yana 9 ta tuman",
    ]);
    expect(dialog).toHaveTextContent(
      "Kodi bor tumanlar o'zgarmaydi. Topilmagan 1 ta va takroriy 2 ta yozuvga kod yozilmaydi. Amal faoliyat jurnaliga yoziladi.",
    );

    await user.click(within(dialog).getByRole("button", { name: "12 ta kodni yozish" }));
    expect(api.post).toHaveBeenCalledWith("district/sato-match/apply");
    expect(within(dialog).getByRole("button", { name: "Yozilmoqda…" })).toHaveAttribute("aria-busy", "true");
    expect(within(dialog).getByRole("button", { name: "Bekor qilish" })).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("alertdialog", { name: "SATO kodlarini yozasizmi?" })).toBeInTheDocument();

    await act(async () =>
      apply.resolve({ data: { statusCode: 200, message: "12 ta tumanga SATO code qo'shildi", data: { appliedCount: 12 } } }),
    );
    expect(await screen.findByText("12 ta tumanga SATO kodi yozildi")).toBeInTheDocument();
    expect(screen.getByText("Ro'yxat yangilandi")).toBeInTheDocument();
    expect(screen.queryByText(/SATO code qo'shildi/)).not.toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(calls("district")).toBe(2);
    expect(calls("district/sato-match/preview")).toBe(2);
  });

  it("504: ro'yxat qayta olinadi va haqiqiy holat aytiladi — qisman yozilgan (5 / 12)", async () => {
    api.post.mockRejectedValue(httpError(504, "Gateway Timeout"));
    let districtCalls = 0;
    mockGets({
      district: () => {
        districtCalls += 1;
        if (districtCalls === 1) return ok(DISTRICTS);
        return ok(DISTRICTS.map((d, i) => (i < 5 ? { ...d, sato_code: String(1726200 + i) } : d)));
      },
    });
    const user = userEvent.setup();
    open("superadmin", "?tab=sato");
    await screen.findByText("Tuman 01");

    await user.click(applyButton());
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "12 ta kodni yozish" }));

    expect(await screen.findByText("Kodlar qisman yozildi")).toBeInTheDocument();
    expect(
      screen.getByText("5 / 12 ta tumanga kod yozildi. Ro'yxat yangilandi — qolganini qayta yozing."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Gateway/)).not.toBeInTheDocument();
    await waitFor(() => expect(statusTab(/^Topildi/)).toHaveTextContent("7"));
  });

  it("504, lekin hammasi yozilgan — muvaffaqiyat; hech biri — xato; ro'yxat ham yuklanmasa — «Natija noma'lum»", async () => {
    api.post.mockRejectedValue(httpError(504, "Gateway Timeout"));
    let mode: "all" | "none" | "fail" = "all";
    let districtCalls = 0;
    mockGets({
      district: () => {
        districtCalls += 1;
        if (districtCalls === 1) return ok(DISTRICTS);
        if (mode === "fail") return Promise.reject(httpError(503, "upstream"));
        if (mode === "none") return ok(DISTRICTS);
        return ok(DISTRICTS.map((d, i) => (i < 12 ? { ...d, sato_code: String(1726200 + i) } : d)));
      },
    });
    const user = userEvent.setup();
    const run = async () => {
      districtCalls = 0;
      const view = open("superadmin", "?tab=sato");
      await screen.findByText("Tuman 01");
      await user.click(applyButton());
      await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "12 ta kodni yozish" }));
      return view;
    };

    let view = await run();
    expect(await screen.findByText("12 ta tumanga SATO kodi yozildi")).toBeInTheDocument();
    view.unmount();

    mode = "none";
    view = await run();
    expect(await screen.findByText("SATO kodlarini yozib bo'lmadi")).toBeInTheDocument();
    expect(screen.getByText("Ro'yxat yangilandi — kodlar yozilmagan. Qayta urinib ko'ring.")).toBeInTheDocument();
    view.unmount();

    mode = "fail";
    await run();
    expect(await screen.findByText("Natija noma'lum")).toBeInTheDocument();
    expect(screen.queryByText("upstream")).not.toBeInTheDocument();
  });

  it("«Bekor qilish» — so'rov ketmaydi, fokus tugmaga qaytadi", async () => {
    const user = userEvent.setup();
    open("superadmin", "?tab=sato");
    await screen.findByText("Tuman 01");
    await user.click(applyButton());
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Bekor qilish" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(api.post).not.toHaveBeenCalled();
    await waitFor(() => expect(applyButton()).toHaveFocus());
  });
});

describe("RegionSatoManagementPage (v2) — SA-2: «Tuman qo'shish»", () => {
  beforeEach(() => {
    mockGets();
    api.patch.mockResolvedValue({ data: { statusCode: 200, data: {} } });
  });
  afterEach(() => vi.clearAllMocks());

  const openAdd = async (user: ReturnType<typeof userEvent.setup>) => {
    open("superadmin", "?tab=sato");
    await screen.findByText("Tuman 01");
    await user.click(statusTab(/^Bazada yo'q/));
    await user.click(await screen.findByRole("button", { name: "Urgut tumani — tuman qo'shish" }));
    return screen.findByRole("dialog", { name: "Tuman qo'shish" });
  };

  it("rasmiy ro'yxatdan to'ldirilgan, o'xshash nom ogohlantirishi → POST district → xabar, ro'yxatlar qayta", async () => {
    api.post.mockResolvedValue({ data: { statusCode: 201, message: "New district added", data: { id: "300" } } });
    const user = userEvent.setup();
    const dialog = await openAdd(user);

    expect(dialog).toHaveTextContent("Rasmiy SATO ro'yxatidan to'ldirildi — tekshirib, saqlang");
    const name = within(dialog).getByRole("textbox", { name: /Tuman nomi/ });
    expect(name).toHaveValue("Urgut tumani");
    expect(name).toHaveFocus();
    expect(within(dialog).getByRole("combobox", { name: /Viloyat/ })).toHaveTextContent("Samarqand");
    expect(within(dialog).getByRole("textbox", { name: "SATO kodi" })).toHaveValue("1718236");
    expect(within(dialog).getByText("Faqat raqamlar. Bitta kod faqat bitta tumanga yoziladi.")).toBeInTheDocument();
    expect(within(dialog).getByRole("note")).toHaveTextContent(
      "Bazada «Urgut sh.» bor. Agar bu o'sha tuman bo'lsa, yangisini qo'shmang — «Topilmadi» tabida unga kodni kiriting.",
    );

    await user.click(within(dialog).getByRole("button", { name: "Tuman qo'shish" }));
    expect(api.post).toHaveBeenCalledWith("district", { name: "Urgut tumani", region_id: "6", sato_code: "1718236" });
    expect(await screen.findByText("Tuman qo'shildi")).toBeInTheDocument();
    expect(screen.getByText("Urgut tumani · Samarqand")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Tuman qo'shish" })).not.toBeInTheDocument());
    await waitFor(() => expect(calls("district")).toBe(2));
    expect(calls("district/sato-match/preview")).toBe(2);
  });

  it("tekshiruv: bo'sh nom, harfli kod — so'rov ketmaydi; kodsiz — `sato_code` yuborilmaydi", async () => {
    api.post.mockResolvedValue({ data: { statusCode: 201, data: {} } });
    const user = userEvent.setup();
    const dialog = await openAdd(user);
    const name = within(dialog).getByRole("textbox", { name: /Tuman nomi/ });
    const code = within(dialog).getByRole("textbox", { name: "SATO kodi" });
    await user.clear(name);
    await user.clear(code);
    await user.type(code, "17a");
    await user.click(within(dialog).getByRole("button", { name: "Tuman qo'shish" }));
    expect(within(dialog).getByText("Tuman nomini kiriting")).toBeInTheDocument();
    expect(within(dialog).getByText("Faqat raqamlar kiriting, masalan 1718236")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();

    await user.type(name, "Yangi tuman");
    await user.clear(code);
    await user.click(within(dialog).getByRole("button", { name: "Tuman qo'shish" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("district", { name: "Yangi tuman", region_id: "6" }));
  });

  it("409: kod band (egasi so'raladi) — kod maydonida; egasi yo'q — nom maydonida; server matni yo'q", async () => {
    api.post.mockRejectedValue(httpError(409, "District sato_code already exists"));
    mockGets({
      "district/sato/1718236": () => ok({ id: "77", name: "Urgut tumani", region: { name: "Samarqand" } }),
    });
    const user = userEvent.setup();
    const dialog = await openAdd(user);
    await user.click(within(dialog).getByRole("button", { name: "Tuman qo'shish" }));
    expect(await within(dialog).findByText("Bu kod band: Urgut tumani, Samarqand")).toBeInTheDocument();
    expect(within(dialog).getByRole("textbox", { name: "SATO kodi" })).toHaveAttribute("aria-invalid", "true");
    expect(within(dialog).queryByText("Bu viloyatda shu nomli tuman bor")).not.toBeInTheDocument();
    expect(screen.queryByText(/already exists/)).not.toBeInTheDocument();

    api.post.mockRejectedValue(httpError(409, "District already exists in this region"));
    mockGets();
    await user.click(within(dialog).getByRole("button", { name: "Tuman qo'shish" }));
    expect(await within(dialog).findByText("Bu viloyatda shu nomli tuman bor")).toBeInTheDocument();
    expect(within(dialog).getByRole("textbox", { name: /Tuman nomi/ })).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("dialog", { name: "Tuman qo'shish" })).toBeInTheDocument();
  });

  it("boshqa xato — umumiy xabar, oyna ochiq qoladi", async () => {
    api.post.mockRejectedValue(httpError(500, "QueryFailedError: duplicate key"));
    const user = userEvent.setup();
    const dialog = await openAdd(user);
    await user.click(within(dialog).getByRole("button", { name: "Tuman qo'shish" }));
    expect(await screen.findByText("Tumanni qo'shib bo'lmadi")).toBeInTheDocument();
    expect(screen.queryByText(/QueryFailedError/)).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Tuman qo'shish" })).toBeInTheDocument();
  });
});

describe("RegionSatoManagementPage (v2) — SA-2: takroriylarni birlashtirish", () => {
  beforeEach(() => {
    mockGets();
    api.patch.mockResolvedValue({ data: { statusCode: 200, data: {} } });
  });
  afterEach(() => vi.clearAllMocks());

  const TOSHKENT_V = { id: "2", name: "Toshkent viloyati", sato_code: "1727" };
  const withCrossRegion = () =>
    mockGets({
      district: () =>
        ok([
          ...DISTRICTS,
          { id: "40", name: "Chilonzor tumani", sato_code: "1726294", region_id: "1", region: TOSHKENT_SH },
          { id: "41", name: "Chilonzor tumani", sato_code: null, region_id: "2", region: TOSHKENT_V },
        ]),
      "district/sato-match/preview": () =>
        ok({
          ...PREVIEW,
          duplicates: [...PREVIEW.duplicates, { name: "Chilonzor tumani", entries: [{ id: "40" }, { id: "41" }] }],
        }),
    });

  it("turli viloyatdagi guruh — «Turli viloyatda — birlashtirilmaydi», tugmasiz", async () => {
    withCrossRegion();
    const user = userEvent.setup();
    open("superadmin", "?tab=sato");
    await screen.findByText("Tuman 01");
    await user.click(statusTab(/^Takroriy nomlar/));
    const table = await screen.findByRole("table", { name: "Dublikat tumanlar" });
    const chilonzor = within(table).getByRole("rowheader", { name: /Chilonzor tumani/ });
    expect(chilonzor).toHaveTextContent("Toshkent sh., Toshkent viloyati");
    expect(chilonzor).toHaveTextContent("Turli viloyatda — birlashtirilmaydi");
    expect(within(chilonzor).queryByRole("button")).not.toBeInTheDocument();
    expect(within(table).getByRole("rowheader", { name: /Bo'ka tumani/ })).toHaveTextContent("Birlashtirish");
    expect(screen.getByText("2 ta nom · 4 ta yozuv")).toBeInTheDocument();

    // Filtr: guruhning bitta yozuvi mos kelsa ham guruh butunligicha.
    await user.type(screen.getByRole("searchbox", { name: "Tuman, viloyat yoki SATO kodi bo'yicha qidirish" }), "1726294");
    expect(within(screen.getByRole("table", { name: "Dublikat tumanlar" })).getAllByRole("row")).toHaveLength(4);
    expect(screen.getByText("1 ta nom · 2 ta yozuv")).toBeInTheDocument();
  });

  it("«Birlashtirish» → kodsiz yozuv (ID 32) → kodli yozuv (ID 31), «SATO kodi … saqlanadi» → POST merge → natija, ro'yxatlar qayta", async () => {
    api.post.mockResolvedValue({
      data: {
        statusCode: 200,
        data: {
          moved: { orders: 3, users: 1, branches: 0 },
          target_before: { orders: 40, users: 2, branches: 0 },
          target_after: { orders: 43, users: 3, branches: 0 },
        },
      },
    });
    const user = userEvent.setup();
    open("superadmin", "?tab=sato");
    await screen.findByText("Tuman 01");
    await user.click(statusTab(/^Takroriy nomlar/));
    await user.click(await screen.findByRole("button", { name: "Bo'ka tumani yozuvlarini birlashtirish" }));

    const dialog = await screen.findByRole("dialog", { name: "Tumanni birlashtirish" });
    expect(dialog).toHaveTextContent(
      "Bo'ka tumani (ID 32) dagi hamma narsa tanlangan tumanga ko'chadi, ID 32 yozuvi o'chiriladi.",
    );
    expect(dialog).toHaveTextContent("Bo'ka tumani · ID 32");
    expect(dialog).toHaveTextContent("Samarqand · Kod yo'q");
    const target = within(dialog).getByRole("combobox", { name: /Maqsad tuman/ });
    expect(target).toHaveTextContent("Bo'ka tumani · ID 31");
    expect(target).toHaveTextContent("1727228");
    expect(dialog).toHaveTextContent("Faqat Samarqand tumanlari. SATO kodi 1727228 saqlanadi.");
    expect(dialog).toHaveTextContent("ID 32 yozuvi butunlay o'chiriladi. Birlashtirish 2 daqiqagacha davom etishi mumkin.");
    // Sonlar bloki (SA-3, N4) — yo'q.
    expect(within(dialog).queryByText("Buyurtmalar")).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Birlashtirish" }));
    expect(api.post).toHaveBeenCalledWith("district/32/merge", { target_district_id: "31" }, expect.objectContaining({ timeout: 125_000 }));
    const result = await screen.findByRole("dialog", { name: "Tumanlar birlashtirildi" });
    expect(result).toHaveTextContent("Bo'ka tumani (ID 32) o'chirildi.");
    await waitFor(() => expect(calls("district")).toBe(2));
    expect(calls("district/sato-match/preview")).toBe(2);
  });

  it("maqsad ro'yxati — faqat shu viloyatdan (Samarqand): «Urgut sh. · ID 14» bor, Toshkent tumanlari yo'q", async () => {
    const user = userEvent.setup();
    open("superadmin", "?tab=sato");
    await screen.findByText("Tuman 01");
    await user.click(statusTab(/^Takroriy nomlar/));
    await user.click(await screen.findByRole("button", { name: "Bo'ka tumani yozuvlarini birlashtirish" }));
    const dialog = await screen.findByRole("dialog", { name: "Tumanni birlashtirish" });
    await user.click(within(dialog).getByRole("combobox", { name: /Maqsad tuman/ }));
    const options = (await screen.findAllByRole("option")).map((option) => option.textContent);
    expect(options).toEqual(["Bo'ka tumani · ID 311727228", "Urgut sh. · ID 14"]);
    await user.click(screen.getByRole("option", { name: /Urgut sh\. · ID 14/ }));
    expect(dialog).toHaveTextContent("Faqat Samarqand tumanlari.");
    expect(dialog).not.toHaveTextContent("saqlanadi");
  });
});

describe("RegionSatoManagementPage (v2) — SA-2 telefonda", () => {
  beforeEach(() => {
    mockGets();
  });
  afterEach(() => vi.clearAllMocks());

  it("takroriylar: guruh sarlavhasi + to'liq enli «Birlashtirish», yozuv kartalari; «Bazada yo'q» kartasida «+»", async () => {
    const restore = asPhone();
    try {
      const user = userEvent.setup();
      open("superadmin", "?tab=sato");
      await screen.findByText("Tuman 01");
      expect(screen.getByRole("button", { name: /^SATO kodlarini yozish/ })).toBeInTheDocument();

      await user.click(screen.getByRole("combobox", { name: "SATO bo'limi: Topildi" }));
      await user.click(await screen.findByRole("option", { name: /Takroriy nomlar/ }));
      const groups = await screen.findByRole("list", { name: "Dublikat tumanlar" });
      const merge = within(groups).getByRole("button", { name: "Bo'ka tumani yozuvlarini birlashtirish" });
      expect(merge).toHaveAttribute("data-size", "lg");
      const records = within(groups).getByRole("list", { name: "Bo'ka tumani" });
      expect(within(records).getAllByRole("listitem")).toHaveLength(2);
      expect(within(records).getByText("Samarqand · ID 32 · Kod yo'q")).toBeInTheDocument();

      await user.click(screen.getByRole("combobox", { name: "SATO bo'limi: Takroriy nomlar" }));
      await user.click(await screen.findByRole("option", { name: /Bazada yo'q/ }));
      expect(await screen.findByText("Samarqand · 1718236")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Urgut tumani — tuman qo'shish" }));
      expect(await screen.findByRole("dialog", { name: "Tuman qo'shish" })).toBeInTheDocument();
    } finally {
      restore();
    }
  });
});
