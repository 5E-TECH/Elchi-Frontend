import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DeliveryTariffsPage from "./index";
import {
  computeMeasureWeights,
  computeTariffTotal,
  DEFAULT_WEIGHT_RULES,
  meetsVolumetricThreshold,
} from "../../entities/delivery-pricing";
import { formatDateLocalized } from "../../shared/lib/formatDateTime";
import { renderWithProviders } from "../../test/test-utils";
import { addDays, toIsoDay } from "./model/tariffForm";

/**
 * «Yetkazish tariflari» — `/delivery-tariffs` (47WFHzlx; maketlar `superadmin-regions-delivery-tariffs`,
 * `*-regions-delivery-tariff-edit-dialog`): haqiqiy UI (Dialog, notify) orqali; API — `shared/api/api` mock'i,
 * soxta server holat saqlaydi (yangi versiya tarixga tushadi, chegara narxni o'zgartiradi).
 */

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));

vi.mock("../../shared/api/api", () => ({
  api: { get: mocks.get, post: mocks.post, patch: mocks.patch, put: vi.fn(), delete: vi.fn() },
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));

type TariffRow = {
  id: string;
  tariff_id: "city" | "center" | "address";
  base_price: number;
  extra_per_kg: number;
  days_min: number;
  days_max: number;
  valid_from: string;
  createdAt: string;
  created_by_name?: string | null;
  /** B0ILd7YI — bekor qilingan rejalashtirilgan versiya (server: `is_active = false`). */
  cancelled_at?: string | null;
  cancelled_by_name?: string | null;
};

const SEED: TariffRow[] = [
  { id: "1", tariff_id: "city", base_price: 35000, extra_per_kg: 4000, days_min: 1, days_max: 1, valid_from: "2026-10-08T00:00:00+05:00", createdAt: "2026-10-08T09:00:00+05:00" },
  { id: "2", tariff_id: "center", base_price: 40000, extra_per_kg: 4000, days_min: 1, days_max: 2, valid_from: "2026-10-08T00:00:00+05:00", createdAt: "2026-10-08T09:00:00+05:00" },
  { id: "3", tariff_id: "address", base_price: 60000, extra_per_kg: 5000, days_min: 2, days_max: 3, valid_from: "2026-10-08T00:00:00+05:00", createdAt: "2026-10-08T09:00:00+05:00" },
];

let rows: TariffRow[] = [];
let settings: Record<string, number | string | null> & { first_kg_included: number; round_to: number; volumetric_from_kg: number } = { id: "1", volumetric_divisor: 5000, volumetric_from_kg: 0, first_kg_included: 1, min_billable_kg: 0.1, billable_step_kg: 0.1, round_to: 500, pickup_fee: 20000, pickup_free_from_count: 10, express_multiplier: 1.4, min_delivery_price: null, extra_cost_limit_amount: null };
let settingsHistory: Record<string, unknown>[] = [];
const now = () => Date.now();

const tariffsResponse = () => {
  const current = Object.fromEntries(
    (["city", "center", "address"] as const).map((id) => [
      id,
      rows
        .filter((row) => row.tariff_id === id && !row.cancelled_at && Date.parse(row.valid_from) <= now())
        .sort((a, b) => Date.parse(b.valid_from) - Date.parse(a.valid_from))[0] ?? null,
    ]),
  );
  const currentIds = new Set(Object.values(current).map((row) => (row as TariffRow | null)?.id));
  return {
    statusCode: 200,
    data: {
      current,
      versions: [...rows]
        .sort((a, b) => Date.parse(b.valid_from) - Date.parse(a.valid_from) || Number(b.id) - Number(a.id))
        .map((row) => ({
          ...row,
          is_current: currentIds.has(row.id),
          is_scheduled: !row.cancelled_at && Date.parse(row.valid_from) > now(),
          is_cancelled: Boolean(row.cancelled_at),
        })),
    },
  };
};

type QuoteBody = { items: { weight_kg: number; length_cm: number; width_cm: number; height_cm: number; volumetric_enabled: boolean }[] };

const quoteResponse = (body: QuoteBody) => {
  const { current } = tariffsResponse().data as { current: Record<string, TariffRow | null> };
  // Server kabi: hajm chegarasi (`volumetric_from_kg`) bilan; javobda qo'llangan chegara va «hajm qo'llandi».
  const rules = { ...DEFAULT_WEIGHT_RULES, volumetricFromKg: settings.volumetric_from_kg };
  const weights = computeMeasureWeights(body.items[0], rules);
  const volumetricApplied = meetsVolumetricThreshold(body.items[0], rules);
  const quotes = Object.fromEntries(
    Object.entries(current).map(([id, tariff]) => {
      if (!tariff) return [id, null];
      const extraKg = Math.max(0, Math.ceil(weights.billableKg - settings.first_kg_included - 1e-9));
      return [
        id,
        {
          tariffId: id,
          base: tariff.base_price,
          perExtraKg: tariff.extra_per_kg,
          actualKg: weights.actualKg,
          volumetricKg: weights.volumetricKg,
          billableKg: weights.billableKg,
          basis: weights.basis,
          volumetricFromKg: settings.volumetric_from_kg,
          volumetricApplied,
          extraKg,
          total: computeTariffTotal({
            billableKg: weights.billableKg,
            basePrice: tariff.base_price,
            extraPerKg: tariff.extra_per_kg,
            firstKgIncluded: settings.first_kg_included,
            roundTo: settings.round_to,
          }),
        },
      ];
    }),
  );
  return { statusCode: 200, data: { quotes } };
};

const respond = () => {
  mocks.get.mockImplementation((url: string) => {
    if (url === "delivery/tariffs") return Promise.resolve({ data: tariffsResponse() });
    if (url === "delivery/pricing-settings") return Promise.resolve({ data: { statusCode: 200, data: settings } });
    if (url === "delivery/pricing-settings/history")
      return Promise.resolve({ data: { statusCode: 200, data: { versions: settingsHistory } } });
    return Promise.reject(new Error(`kutilmagan so'rov: ${url}`));
  });
  mocks.post.mockImplementation((url: string, body: Record<string, unknown>) => {
    if (url === "delivery/quote/by-tariff") return Promise.resolve({ data: quoteResponse(body as QuoteBody) });
    const cancel = /^delivery\/tariffs\/(\d+)\/cancel$/.exec(url);
    if (cancel) {
      // Server kabi (backend #696): faqat kelajakdagi versiya; takror — 200 `already_cancelled`; kuchga kirgan — 409.
      const row = rows.find((item) => item.id === cancel[1]);
      if (!row) return Promise.reject(httpError(404));
      if (row.cancelled_at) return Promise.resolve({ data: { statusCode: 200, data: { ...row, already_cancelled: true } } });
      if (Date.parse(row.valid_from) <= now()) return Promise.reject(httpError(409));
      Object.assign(row, { cancelled_at: new Date().toISOString(), cancelled_by_name: "Shodiyor Ergashev" });
      return Promise.resolve({ data: { statusCode: 200, data: { ...row, is_cancelled: true, already_cancelled: false } } });
    }
    if (url === "delivery/tariffs") {
      rows = [
        ...rows,
        {
          id: String(rows.length + 10),
          tariff_id: body.tariff_id as TariffRow["tariff_id"],
          base_price: body.base_price as number,
          extra_per_kg: body.extra_per_kg as number,
          days_min: body.days_min as number,
          days_max: body.days_max as number,
          valid_from: (body.valid_from as string | undefined) ?? new Date().toISOString(),
          createdAt: new Date().toISOString(),
        },
      ];
      return Promise.resolve({ data: { statusCode: 201 } });
    }
    return Promise.reject(new Error(`kutilmagan: ${url}`));
  });
  mocks.patch.mockImplementation((_url: string, body: Record<string, unknown>) => {
    // Server kabi: qiymatlar mutlaq, hech narsa o'zgarmasa — yangi versiya yo'q («Sozlamalar o'zgarmadi»).
    if (Object.entries(body).every(([key, value]) => settings[key] === value))
      return Promise.resolve({ data: { statusCode: 200, message: "Sozlamalar o'zgarmadi", data: settings } });
    settings = { ...settings, ...(body as typeof settings) };
    // Tarix yuritilayotgan bo'lsa (BE #565) — yangi faol versiya tepaga.
    if (settingsHistory.length > 0) {
      settingsHistory = [
        { ...settings, id: String(settingsHistory.length + 1), is_active: true, createdAt: new Date().toISOString() },
        ...settingsHistory.map((version) => ({ ...version, is_active: false })),
      ];
    }
    return Promise.resolve({ data: { statusCode: 200, data: settings } });
  });
};

const renderPage = (role = "admin") =>
  renderWithProviders(<DeliveryTariffsPage />, {
    route: "/delivery-tariffs",
    preloadedState: { role: { id: `${role}-1`, role, region: null, name: role } } as never,
  });

const calls = (mock: typeof mocks.post, url: string) => mock.mock.calls.filter(([called]) => called === url);

/** axios xatosi shakli (`response.status`). */
function httpError(status: number) {
  return Object.assign(new Error(`HTTP ${status}`), { isAxiosError: true, response: { status, data: {} } });
}

/** «Qoidalarni saqlash» → tasdiq oynasi (B0ILd7YI): tasdiqsiz so'rov ketmaydi. */
const openSaveConfirm = async (user: ReturnType<typeof userEvent.setup>, rules: HTMLElement) => {
  await user.click(within(rules).getByRole("button", { name: "Qoidalarni saqlash" }));
  return screen.findByRole("alertdialog", { name: "Hisob qoidalarini saqlaysizmi?" });
};

const fill = async (user: ReturnType<typeof userEvent.setup>, input: HTMLElement, value: string) => {
  await user.clear(input);
  await user.type(input, value);
};

beforeEach(() => {
  rows = [
    ...SEED,
    // Rejalashtirilgan: Markazgacha — har kg 4 000 → 4 500, kelajakda.
    { id: "9", tariff_id: "center", base_price: 40000, extra_per_kg: 4500, days_min: 1, days_max: 2, valid_from: "2099-10-25T00:00:00+05:00", createdAt: new Date().toISOString() },
  ];
  settings = { ...settings, first_kg_included: 1, round_to: 500, volumetric_from_kg: 0, min_delivery_price: null, extra_cost_limit_amount: null };
  settingsHistory = [];
  respond();
});

describe("DeliveryTariffsPage — tariflar", () => {
  it("sarlavha, «← Hududlar», jadval (asosiy narx · chegara, har kg, muddat, sana) va rejalashtirilgan izoh", async () => {
    renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "Yetkazish tariflari" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Hududlar" })).toHaveAttribute("href", "/regions");
    const table = await screen.findByRole("table", { name: "Tariflar — asosiy narx va har kg narxi" });
    await waitFor(() =>
      expect(within(table).getAllByRole("columnheader").map((th) => th.textContent)).toEqual([
        "Yo'nalish",
        "Asosiy narx · 1,0 kg gacha",
        "Har qo'shimcha kg",
        "Muddat",
        "Kuchga kirgan",
        "Amallar",
      ]),
    );
    const [, city, center, address] = within(table).getAllByRole("row");
    expect(city).toHaveTextContent("Shahar ichida");
    expect(city).toHaveTextContent("Ikkala uchi Toshkent shahri");
    expect(city).toHaveTextContent(/35\s000 so'm/);
    expect(city).toHaveTextContent("1 kun");
    expect(center).toHaveTextContent("1–2 kun");
    expect(center).toHaveTextContent("08.10.2026");
    expect(address).toHaveTextContent(/5\s000 so'm/);
    expect(
      screen.getByText(/^Rejalashtirilgan: Markazgacha — har qo'shimcha kg 4\s000 → 4\s500 so'm, 25\.10\.2099 dan\.$/),
    ).toBeInTheDocument();
  });

  it("«O'zgartirish» → oyna: joriy qiymatlar, namunaviy posilkalar, `POST delivery/tariffs` (yangi versiya), tarixda chiqadi", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Markazgacha tarifini o'zgartirish" }));
    const dialog = await screen.findByRole("dialog", { name: "Tarifni o'zgartirish" });
    expect(within(dialog).getByText("Markazgacha · viloyat filialigacha")).toBeInTheDocument();
    expect((within(dialog).getByRole("textbox", { name: /Asosiy narx/ }) as HTMLInputElement).value).toMatch(/^40\s000$/);
    expect(within(dialog).getByText("1,0 kg gacha (qoidalardagi chegara)")).toBeInTheDocument();
    const perKg = within(dialog).getByRole("textbox", { name: /Har qo'shimcha kg/ });

    await fill(user, perKg, "4500");
    expect(within(dialog).getByText(/^52\s000 → 53\s500 so'm$/)).toBeInTheDocument();
    expect(within(dialog).getByText(/^64\s000 → 67\s000 so'm$/)).toBeInTheDocument();
    expect(within(dialog).getByText(/^40\s000 → 40\s000 so'm$/)).toBeInTheDocument();
    const tomorrow = addDays(toIsoDay(new Date()), 1);
    expect(
      within(dialog).getByText(
        `Yangi narx ${formatDateLocalized(tomorrow)} dan keyin yaratilgan buyurtmalarga qo'llanadi; sayt kalkulyatori ham yangilanadi. Eski buyurtmalar narxi o'zgarmaydi.`,
      ),
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Saqlash" }));
    await waitFor(() => expect(calls(mocks.post, "delivery/tariffs")).toHaveLength(1));
    expect(calls(mocks.post, "delivery/tariffs")[0][1]).toEqual({
      tariff_id: "center",
      base_price: 40000,
      extra_per_kg: 4500,
      days_min: 1,
      days_max: 2,
      valid_from: `${tomorrow}T00:00:00+05:00`,
    });
    expect(await screen.findByText("Tarif yangilandi")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    // Tarix va jadval qayta so'raladi — yangi rejalashtirilgan versiya ko'rinadi.
    const history = screen.getByRole("list", { name: "O'zgarishlar tarixi" });
    await waitFor(() => expect(within(history).getAllByText("Rejalashtirilgan")).toHaveLength(2));
    expect(within(history).getAllByText(/^Markazgacha · har kg 4\s000 → 4\s500 so'm$/).length).toBeGreaterThan(0);
  });

  it("oyna tekshiruvi: eng ko'p muddat eng kamidan kichik — xato, so'rov ketmaydi", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Uygacha tarifini o'zgartirish" }));
    const dialog = await screen.findByRole("dialog", { name: "Tarifni o'zgartirish" });
    await fill(user, within(dialog).getByRole("textbox", { name: /Muddat \(eng kam\)/ }), "5");
    await user.clear(within(dialog).getByRole("textbox", { name: /Asosiy narx/ }));
    await user.click(within(dialog).getByRole("button", { name: "Saqlash" }));

    expect(await within(dialog).findByText("Eng ko'p muddat eng kamidan kichik bo'lmasin")).toBeInTheDocument();
    expect(within(dialog).getByText("Qiymatni kiriting")).toBeInTheDocument();
    expect(calls(mocks.post, "delivery/tariffs")).toHaveLength(0);
  });

  it("yuklab bo'lmasa — «Tariflarni yuklab bo'lmadi» va «Qayta urinish»", async () => {
    mocks.get.mockImplementation((url: string) =>
      url === "delivery/tariffs"
        ? Promise.reject(Object.assign(new Error("boom"), { isAxiosError: true, response: { status: 500 } }))
        : Promise.resolve({ data: { data: settings } }),
    );
    renderPage();
    expect(await screen.findByText("Tariflarni yuklab bo'lmadi")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Qayta urinish" }).length).toBeGreaterThan(0);
  });
});

describe("DeliveryTariffsPage — hisob qoidalari va kalkulyator", () => {
  it("chegara 1,0 → 2,0 saqlansa: PATCH faqat `first_kg_included`; 3,4 kg «Markazgacha» 52 000 → 48 000 so'm", async () => {
    const user = userEvent.setup();
    renderPage();

    const calculator = await screen.findByRole("region", { name: "Narx kalkulyatori" });
    await fill(user, within(calculator).getByRole("textbox", { name: "Og'irlik" }), "3,4");
    for (const name of ["Uzunlik", "Kenglik", "Balandlik"]) {
      await fill(user, within(calculator).getByRole("textbox", { name }), "10");
    }
    const prices = await within(calculator).findByRole("list", { name: "Taxminiy yetkazish narxi" });
    await waitFor(() => expect(within(prices).getAllByRole("listitem")[1]).toHaveTextContent(/52\s000 so'm/));
    expect(within(calculator).getByText("1,0 kg asosiy + 3 kg qo'shimcha")).toBeInTheDocument();

    const rules = screen.getByRole("region", { name: "Hisob qoidalari — qo'shimcha haq qachon boshlanadi" });
    const first = within(rules).getByRole("textbox", { name: /Asosiy narxga kiradigan og'irlik/ });
    expect(first).toHaveValue("1,0");
    expect(
      within(rules).getByText(/1,0 kg asosiy narxga kiradi → qolgan 2,4 kg yuqoriga yaxlitlanib 3 kg → 40\s000 \+ 3 × 4\s000 = 52\s000 so'm\. Chegara 2,0 kg qilinsa: 40\s000 \+ 2 × 4\s000 = 48\s000 so'm\./),
    ).toBeInTheDocument();

    await fill(user, first, "2");
    expect(
      within(rules).getByText(/2,0 kg asosiy narxga kiradi → qolgan 1,4 kg yuqoriga yaxlitlanib 2 kg → 40\s000 \+ 2 × 4\s000 = 48\s000 so'm\. Hozirgi chegara 1,0 kg da: .*52\s000 so'm\./),
    ).toBeInTheDocument();
    const dialog = await openSaveConfirm(user, rules);
    expect(mocks.patch).not.toHaveBeenCalled();
    expect(within(dialog).getByText("Asosiy narxga kiradigan og'irlik")).toBeInTheDocument();
    expect(within(dialog).getByText("1 kg edi, 2 kg bo'ladi")).toBeInTheDocument();
    expect(within(dialog).getByText("Darhol kuchga kiradi — yangi narxlar shu qoidalar bilan hisoblanadi")).toBeInTheDocument();
    expect(within(dialog).getByText("Saytdagi narx kalkulyatori ham darhol o'zgaradi")).toBeInTheDocument();
    expect(within(dialog).queryByText(/faqat narx dvigateli sotuvga ulanganda/)).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Qoidalarni saqlash" }));

    await waitFor(() => expect(mocks.patch).toHaveBeenCalledTimes(1));
    expect(mocks.patch).toHaveBeenCalledWith("delivery/pricing-settings", { first_kg_included: 2 });
    expect(await screen.findByText("Qoidalar saqlandi")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    await waitFor(() => expect(within(prices).getAllByRole("listitem")[1]).toHaveTextContent(/48\s000 so'm/));
    expect(within(calculator).getByText("2,0 kg asosiy + 2 kg qo'shimcha")).toBeInTheDocument();
    expect(within(table()).getByRole("columnheader", { name: "Asosiy narx · 2,0 kg gacha" })).toBeInTheDocument();
  });

  it("«Bekor qilish» saqlangan qiymatga qaytaradi; o'zgarishsiz saqlash — so'rovsiz izoh; xato qiymat — forma xatosi", async () => {
    const user = userEvent.setup();
    renderPage();
    const rules = await screen.findByRole("region", { name: "Hisob qoidalari — qo'shimcha haq qachon boshlanadi" });
    const step = await within(rules).findByRole("textbox", { name: "Hisob vazni qadami" });

    await user.click(within(rules).getByRole("button", { name: "Qoidalarni saqlash" }));
    expect(await screen.findByText("Qoidalarda o'zgarish yo'q")).toBeInTheDocument();

    await fill(user, step, "abc");
    await user.click(within(rules).getByRole("button", { name: "Qoidalarni saqlash" }));
    expect(await within(rules).findByText("Faqat raqam kiriting")).toBeInTheDocument();
    expect(mocks.patch).not.toHaveBeenCalled();

    await user.click(within(rules).getByRole("button", { name: "Bekor qilish" }));
    expect(step).toHaveValue("0,1");
    expect(within(rules).getByText("U × K × B / 5 000 — doimiy (ega qarori)")).toBeInTheDocument();
  });

  it("kalkulyator boshlang'ich namunasi: 0,8 kg, 50 × 35 × 20 → 7,0 kg; uchala tarif", async () => {
    renderPage();
    const calculator = await screen.findByRole("region", { name: "Narx kalkulyatori" });
    expect(within(calculator).getAllByText("7,0 kg")).toHaveLength(2);
    const prices = await within(calculator).findByRole("list", { name: "Taxminiy yetkazish narxi" });
    await waitFor(() => expect(prices).toHaveTextContent(/59\s000 so'm/));
    expect(prices).toHaveTextContent(/64\s000 so'm/);
    expect(prices).toHaveTextContent(/90\s000 so'm/);
    expect(within(prices).getAllByRole("listitem")[0]).toHaveTextContent(/35\s000 \+ 6 kg × 4\s000/);
  });

  it("tarix: kim o'zgartirgani va hisob qoidalari o'zgarishlari (47WFHzlx)", async () => {
    rows = [{ ...SEED[0], created_by_name: "Dilshodbek Urozov" }, SEED[1], SEED[2]];
    settingsHistory = [
      { ...settings, id: "2", is_active: true, created_by: "1", created_by_name: "Shodiyor Ergashev", createdAt: "2026-10-20T10:00:00.000Z" },
      { ...settings, id: "1", round_to: 1000, is_active: false, created_by: null, createdAt: "2026-10-08T04:00:00.000Z" },
    ];
    renderPage();
    const history = await screen.findByRole("list", { name: "O'zgarishlar tarixi" });
    expect(await within(history).findByText(/^Hisob qoidalari · yaxlitlash 1\s000 → 500 so'm$/)).toBeInTheDocument();
    expect(within(history).getByText("Hisob qoidalari · dastlabki: asosiy narxga 1 kg kiradi")).toBeInTheDocument();
    expect(within(history).getByText(/ · Shodiyor Ergashev$/)).toBeInTheDocument();
    expect(within(history).getByText(/^08\.10\.2026 dan · .* · Dilshodbek Urozov$/)).toBeInTheDocument();
    // Qoidalar o'zgarishi (20.10) tariflardan (08.10) yangiroq — tepada.
    expect(within(history).getAllByRole("listitem")[0]).toHaveTextContent("yaxlitlash");
  });

  it("tarix: dastlabki tariflar va rejalashtirilgan versiya", async () => {
    renderPage();
    const history = await screen.findByRole("list", { name: "O'zgarishlar tarixi" });
    expect(within(history).getByText(/^Shahar ichida · dastlabki tarif — 35\s000 so'm, har kg 4\s000 so'm$/)).toBeInTheDocument();
    expect(within(history).getByText(/^Markazgacha · har kg 4\s000 → 4\s500 so'm$/)).toBeInTheDocument();
    expect(within(history).getByText("Rejalashtirilgan")).toBeInTheDocument();
    expect(within(history).getAllByText(/^08\.10\.2026 dan · /)).toHaveLength(3);
  });
});

const table = () => screen.getByRole("table", { name: "Tariflar — asosiy narx va har kg narxi" });

describe("DeliveryTariffsPage — hajm bo'yicha hisoblash chegarasi (ega 2026-10-25)", () => {
  it("chegara 0 → 3 saqlansa: PATCH faqat `volumetric_from_kg`; misol jonli; kalkulyator 20 × 20 × 20, 0,5 kg → 0,5 kg; tarixda", async () => {
    settingsHistory = [{ ...settings, id: "1", is_active: true, created_by: null, createdAt: "2026-10-08T04:00:00.000Z" }];
    const user = userEvent.setup();
    renderPage("superadmin");

    const calculator = await screen.findByRole("region", { name: "Narx kalkulyatori" });
    await fill(user, within(calculator).getByRole("textbox", { name: "Og'irlik" }), "0,5");
    for (const name of ["Uzunlik", "Kenglik", "Balandlik"]) {
      await fill(user, within(calculator).getByRole("textbox", { name }), "20");
    }
    const prices = await within(calculator).findByRole("list", { name: "Taxminiy yetkazish narxi" });
    // Chegara 0 — hajm bo'yicha: 1,6 kg → 1 kg qo'shimcha.
    await waitFor(() => expect(within(prices).getAllByRole("listitem")[0]).toHaveTextContent(/39\s000 so'm/));
    expect(within(calculator).getAllByText("1,6 kg")).toHaveLength(2);
    expect(within(calculator).queryByText(/dan kichik — narx og'irlik bo'yicha/)).not.toBeInTheDocument();

    const rules = screen.getByRole("region", { name: "Hisob qoidalari — qo'shimcha haq qachon boshlanadi" });
    const threshold = within(rules).getByRole("textbox", { name: "Hajm bo'yicha hisoblash chegarasi" });
    expect(threshold).toHaveValue("0,0");
    expect(within(rules).getByText("Misol: chegara 0 — hajm har doim hisobga olinadi")).toBeInTheDocument();
    expect(
      within(rules).getByText("20 × 20 × 20 sm, 0,5 kg → hajmli vazn 1,6 kg → hisob 1,6 kg (hajm bo'yicha)"),
    ).toBeInTheDocument();

    await fill(user, threshold, "3");
    expect(within(rules).getByText("Misol: chegara 3,0 kg")).toBeInTheDocument();
    expect(
      within(rules).getByText("20 × 20 × 20 sm, 0,5 kg → hajmli vazn 1,6 kg → hisob 0,5 kg (chegaradan kichik — og'irlik bo'yicha)"),
    ).toBeInTheDocument();
    expect(
      within(rules).getByText("50 × 35 × 20 sm, 0,8 kg → hajmli vazn 7,0 kg → hisob 7,0 kg (hajm bo'yicha)"),
    ).toBeInTheDocument();
    const dialog = await openSaveConfirm(user, rules);
    expect(within(dialog).getByText("0 kg edi, 3 kg bo'ladi")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Qoidalarni saqlash" }));

    await waitFor(() => expect(mocks.patch).toHaveBeenCalledTimes(1));
    expect(mocks.patch).toHaveBeenCalledWith("delivery/pricing-settings", { volumetric_from_kg: 3 });
    expect(await screen.findByText("Qoidalar saqlandi")).toBeInTheDocument();

    // Narx qayta so'raladi — hajm chegaradan kichik: faqat og'irlik (0,5 kg), asosiy narx.
    await waitFor(() => expect(within(prices).getAllByRole("listitem")[0]).toHaveTextContent(/35\s000 so'm/));
    expect(await within(calculator).findByText("Chegara 3,0 kg dan kichik — narx og'irlik bo'yicha")).toBeInTheDocument();
    expect(within(calculator).getByText("1,6 kg")).toHaveClass("line-through");
    expect(within(calculator).getByText("0,5 kg")).toBeInTheDocument();

    const history = screen.getByRole("list", { name: "O'zgarishlar tarixi" });
    expect(
      await within(history).findByText("Hisob qoidalari · hajm bo'yicha hisoblash chegarasi 0 → 3 kg"),
    ).toBeInTheDocument();
  });

  it("chegara 3, kalkulyator 50 × 35 × 20, 0,8 kg → hajmli 7,0 ≥ 3: hajm bo'yicha, izohsiz; noto'g'ri qiymat — xato, so'rov yo'q", async () => {
    settings = { ...settings, volumetric_from_kg: 3 };
    const user = userEvent.setup();
    renderPage();
    const calculator = await screen.findByRole("region", { name: "Narx kalkulyatori" });
    const prices = await within(calculator).findByRole("list", { name: "Taxminiy yetkazish narxi" });
    await waitFor(() => expect(prices).toHaveTextContent(/59\s000 so'm/));
    expect(within(calculator).getAllByText("7,0 kg")).toHaveLength(2);
    expect(within(calculator).queryByText(/dan kichik — narx og'irlik bo'yicha/)).not.toBeInTheDocument();

    const rules = screen.getByRole("region", { name: "Hisob qoidalari — qo'shimcha haq qachon boshlanadi" });
    const threshold = within(rules).getByRole("textbox", { name: "Hajm bo'yicha hisoblash chegarasi" });
    expect(threshold).toHaveValue("3,0");
    await fill(user, threshold, "1001");
    await user.click(within(rules).getByRole("button", { name: "Qoidalarni saqlash" }));
    expect(await within(rules).findByText(/^0 dan 1\s000 gacha kiriting$/)).toBeInTheDocument();
    expect(mocks.patch).not.toHaveBeenCalled();
  });
});

describe("DeliveryTariffsPage — «Qoidalarni saqlash» tasdig'i va takror so'rov (B0ILd7YI)", () => {
  const rulesRegion = () => screen.findByRole("region", { name: "Hisob qoidalari — qo'shimcha haq qachon boshlanadi" });

  it("tasdiqsiz saqlanmaydi: oynada «Bekor qilish» — PATCH yo'q, forma tahrirda qoladi", async () => {
    const user = userEvent.setup();
    renderPage();
    const rules = await rulesRegion();
    const roundTo = await within(rules).findByRole("textbox", { name: "Narxni yaxlitlash" });
    await fill(user, roundTo, "1000");

    const dialog = await openSaveConfirm(user, rules);
    expect(within(dialog).getByText("Narxni yaxlitlash")).toBeInTheDocument();
    expect(within(dialog).getByText(/^500 so'm edi, 1\s000 so'm bo'ladi$/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Bekor qilish" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(mocks.patch).not.toHaveBeenCalled();
    expect((roundTo as HTMLInputElement).value).toMatch(/^1\s?000$/);
  });

  it("faqat soni o'zgargan maydonlar: «1,0» → «1» — o'zgarish emas, so'rovsiz izoh", async () => {
    const user = userEvent.setup();
    renderPage();
    const rules = await rulesRegion();
    await fill(user, await within(rules).findByRole("textbox", { name: /Asosiy narxga kiradigan og'irlik/ }), "1");
    await user.click(within(rules).getByRole("button", { name: "Qoidalarni saqlash" }));
    expect(await screen.findByText("Qoidalarda o'zgarish yo'q")).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(mocks.patch).not.toHaveBeenCalled();
  });

  it("vaqt tugasa: xato oynada, qayta bosish o'sha tanani yuboradi — ikkinchi bir xil versiya yaratilmaydi", async () => {
    settingsHistory = [{ ...settings, id: "1", is_active: true, created_by: null, createdAt: "2026-10-08T04:00:00.000Z" }];
    const user = userEvent.setup();
    const respondPatch = mocks.patch.getMockImplementation()!;
    // Birinchi so'rov serverda YOZILADI, lekin javob kelmaydi (gateway vaqti tugadi).
    mocks.patch.mockImplementationOnce(async (url: string, body: Record<string, unknown>) => {
      await respondPatch(url, body);
      throw Object.assign(new Error("timeout of 20000ms exceeded"), { isAxiosError: true, code: "ECONNABORTED" });
    });
    renderPage("superadmin");
    const rules = await rulesRegion();
    await fill(user, await within(rules).findByRole("textbox", { name: "Narxni yaxlitlash" }), "1000");

    const dialog = await openSaveConfirm(user, rules);
    const save = within(dialog).getByRole("button", { name: "Qoidalarni saqlash" });
    await user.click(save);
    expect(await within(dialog).findByText("Qoidalarni saqlab bo'lmadi")).toBeInTheDocument();
    expect(mocks.patch).toHaveBeenCalledTimes(1);

    // Qayta bosish — aynan o'sha tana; server «o'zgarmadi» deydi, yangi versiya yo'q.
    await user.click(within(dialog).getByRole("button", { name: "Qoidalarni saqlash" }));
    await waitFor(() => expect(mocks.patch).toHaveBeenCalledTimes(2));
    expect(mocks.patch.mock.calls[1]).toEqual(mocks.patch.mock.calls[0]);
    expect(mocks.patch).toHaveBeenLastCalledWith("delivery/pricing-settings", { round_to: 1000 });
    expect(await screen.findByText("Qoidalar saqlandi")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(settingsHistory).toHaveLength(2);

    const history = screen.getByRole("list", { name: "O'zgarishlar tarixi" });
    expect(await within(history).findAllByText(/^Hisob qoidalari · yaxlitlash 500 → 1\s000 so'm$/)).toHaveLength(1);
  });

  it("sotuv chegaralari: «Minimal yetkazish narxi» va «Kuryer qo'shimcha xarajati chegarasi» — PATCH, bo'sh — `null`", async () => {
    settings = { ...settings, extra_cost_limit_amount: 20000 };
    const user = userEvent.setup();
    renderPage();
    const rules = await rulesRegion();
    const minPrice = await within(rules).findByRole("textbox", { name: "Minimal yetkazish narxi" });
    const extraLimit = within(rules).getByRole("textbox", { name: "Kuryer qo'shimcha xarajati chegarasi" });
    expect(minPrice).toHaveValue("");
    expect((extraLimit as HTMLInputElement).value).toMatch(/^20\s?000$/);

    await fill(user, minPrice, "15000");
    await user.clear(extraLimit);
    const dialog = await openSaveConfirm(user, rules);
    expect(within(dialog).getByText(/^chegarasiz edi, 15\s000 so'm bo'ladi$/)).toBeInTheDocument();
    expect(within(dialog).getByText(/^20\s000 so'm edi, sukut \(asosiy narxlar farqi\) bo'ladi$/)).toBeInTheDocument();
    // Faqat sotuv chegaralari o'zgardi — sayt kalkulyatori o'zgarmaydi, oyna buni aytadi.
    expect(
      within(dialog).getByText(
        "Minimal narx va kuryer xarajati chegarasi faqat narx dvigateli sotuvga ulanganda ishlatiladi — sayt kalkulyatori o'zgarmaydi",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText("Saytdagi narx kalkulyatori ham darhol o'zgaradi")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Darhol kuchga kiradi — yangi narxlar shu qoidalar bilan hisoblanadi")).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Qoidalarni saqlash" }));

    await waitFor(() => expect(mocks.patch).toHaveBeenCalledTimes(1));
    expect(mocks.patch).toHaveBeenCalledWith("delivery/pricing-settings", {
      min_delivery_price: 15000,
      extra_cost_limit_amount: null,
    });
    expect(await screen.findByText("Qoidalar saqlandi")).toBeInTheDocument();
  });
});

describe("DeliveryTariffsPage — rejalashtirilgan tarifni bekor qilish (B0ILd7YI)", () => {
  const scheduledLine = /^Rejalashtirilgan: Markazgacha — har qo'shimcha kg 4\s000 → 4\s500 so'm, 25\.10\.2099 dan\.$/;
  const cancelButton = () =>
    screen.findByRole("button", { name: "Markazgacha — 25.10.2099 dan rejalashtirilgan tarifni bekor qilish" });

  it("«Bekor qilish» → tasdiq → `POST delivery/tariffs/9/cancel`; rejalashtirilgan qator yo'qoladi, tarixda «Bekor qilingan»", async () => {
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText(scheduledLine)).toBeInTheDocument();

    await user.click(await cancelButton());
    const dialog = await screen.findByRole("alertdialog", { name: "Rejalashtirilgan tarifni bekor qilasizmi?" });
    expect(within(dialog).getByText("Markazgacha")).toBeInTheDocument();
    expect(within(dialog).getByText(/^har qo'shimcha kg 4\s000 → 4\s500 so'm$/)).toBeInTheDocument();
    expect(within(dialog).getByText("25.10.2099 dan kuchga kirishi kerak edi")).toBeInTheDocument();
    expect(calls(mocks.post, "delivery/tariffs/9/cancel")).toHaveLength(0);

    await user.click(within(dialog).getByRole("button", { name: "Tarifni bekor qilish" }));
    await waitFor(() => expect(calls(mocks.post, "delivery/tariffs/9/cancel")).toHaveLength(1));
    expect(mocks.post).toHaveBeenCalledWith("delivery/tariffs/9/cancel");
    expect(await screen.findByText("Rejalashtirilgan tarif bekor qilindi")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(scheduledLine)).not.toBeInTheDocument());

    const history = screen.getByRole("list", { name: "O'zgarishlar tarixi" });
    expect(await within(history).findByText("Bekor qilingan")).toBeInTheDocument();
    expect(within(history).queryByText("Rejalashtirilgan")).not.toBeInTheDocument();
    expect(within(history).getByText(/bekor qilindi .* · Shodiyor Ergashev$/)).toBeInTheDocument();
    // Hozirgi tarif o'zgarmagan.
    expect(within(table()).getAllByRole("row")[2]).toHaveTextContent(/4\s000 so'm/);
  });

  it("oynada «Yopish» — so'rov yo'q, versiya rejalashtirilganicha qoladi", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await cancelButton());
    const dialog = await screen.findByRole("alertdialog", { name: "Rejalashtirilgan tarifni bekor qilasizmi?" });
    await user.click(within(dialog).getByRole("button", { name: "Yopish" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(calls(mocks.post, "delivery/tariffs/9/cancel")).toHaveLength(0);
    expect(screen.getByText(scheduledLine)).toBeInTheDocument();
  });

  it("409 — versiya allaqachon kuchga kirgan: xato oynada, «Tarifni bekor qilish» o'chadi, ro'yxat qayta so'raladi", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await cancelButton());
    const dialog = await screen.findByRole("alertdialog", { name: "Rejalashtirilgan tarifni bekor qilasizmi?" });
    // Oyna ochiq turganda versiya kuchga kirdi.
    rows = rows.map((row) => (row.id === "9" ? { ...row, valid_from: "2026-10-09T00:00:00+05:00" } : row));
    const tariffLoads = calls(mocks.get, "delivery/tariffs").length;

    await user.click(within(dialog).getByRole("button", { name: "Tarifni bekor qilish" }));
    expect(
      await within(dialog).findByText(
        "Bu versiyani endi bekor qilib bo'lmaydi: u kuchga kirgan yoki faol emas. Narxni o'zgartirish uchun yangi versiya yarating.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Tarifni bekor qilish" })).toBeDisabled();
    await waitFor(() => expect(calls(mocks.get, "delivery/tariffs").length).toBeGreaterThan(tariffLoads));
    expect(calls(mocks.post, "delivery/tariffs/9/cancel")).toHaveLength(1);
  });
});

describe("«Yetkazish narxi» — faqat `/delivery-tariffs` (LIuf0DcD: Ops nusxasi olib tashlandi)", () => {
  it("sarlavha, «← Hududlar», Ops kirish kartasi yo'q", async () => {
    renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Yetkazish tariflari" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Hududlar" })).toHaveAttribute("href", "/regions");
    expect(screen.queryByRole("heading", { name: "Yetkazish narxi — tariflar va hisob qoidalari" })).not.toBeInTheDocument();
    expect(await screen.findByRole("textbox", { name: "Hajm bo'yicha hisoblash chegarasi" })).toBeInTheDocument();
  });
});
