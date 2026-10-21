import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation } from "react-router-dom";
import { vi } from "vitest";
import { renderWithProviders } from "../../../../test/test-utils";
import RegionSatoManagementPage from "./index";

const api = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }));
vi.mock("../../../../shared/api/api", () => ({ api }));

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

  it("«Takroriy nomlar» va «Bazada yo'q» (faqat ko'rish) tablari", async () => {
    const user = userEvent.setup();
    open("superadmin", "?tab=sato");
    await screen.findByText("Tuman 01");

    await user.click(statusTab(/^Takroriy nomlar/));
    const duplicates = await screen.findByRole("table", { name: "Dublikat tumanlar" });
    expect(within(duplicates).getAllByText("Bo'ka tumani")).toHaveLength(2);
    expect(within(duplicates).getByText("ID 32")).toBeInTheDocument();
    expect(
      within(duplicates).getByRole("button", { name: "Kod kiritish: Bo'ka tumani (Samarqand)" }),
    ).toBeInTheDocument();
    expect(screen.getByText("1 ta nom · 2 ta yozuv")).toBeInTheDocument();

    await user.click(statusTab(/^Bazada yo'q/));
    const missing = await screen.findByRole("table", { name: "Bazada yo'q SATO yozuvlari" });
    const row = within(missing).getByText("Urgut tumani").closest("tr")!;
    expect(row).toHaveTextContent("1718236");
    expect(row).toHaveTextContent("Samarqand");
    expect(within(missing).queryByRole("button")).not.toBeInTheDocument();
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
