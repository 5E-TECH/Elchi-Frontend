import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DeliveryTariffsPage from "./index";
import { computeMeasureWeights, computeTariffTotal } from "../../entities/delivery-pricing";
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
};

const SEED: TariffRow[] = [
  { id: "1", tariff_id: "city", base_price: 35000, extra_per_kg: 4000, days_min: 1, days_max: 1, valid_from: "2026-10-08T00:00:00+05:00", createdAt: "2026-10-08T09:00:00+05:00" },
  { id: "2", tariff_id: "center", base_price: 40000, extra_per_kg: 4000, days_min: 1, days_max: 2, valid_from: "2026-10-08T00:00:00+05:00", createdAt: "2026-10-08T09:00:00+05:00" },
  { id: "3", tariff_id: "address", base_price: 60000, extra_per_kg: 5000, days_min: 2, days_max: 3, valid_from: "2026-10-08T00:00:00+05:00", createdAt: "2026-10-08T09:00:00+05:00" },
];

let rows: TariffRow[] = [];
let settings = { id: "1", volumetric_divisor: 5000, first_kg_included: 1, min_billable_kg: 0.1, billable_step_kg: 0.1, round_to: 500, pickup_fee: 20000, pickup_free_from_count: 10, express_multiplier: 1.4 };
const now = () => Date.now();

const tariffsResponse = () => {
  const current = Object.fromEntries(
    (["city", "center", "address"] as const).map((id) => [
      id,
      rows
        .filter((row) => row.tariff_id === id && Date.parse(row.valid_from) <= now())
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
        .map((row) => ({ ...row, is_current: currentIds.has(row.id), is_scheduled: Date.parse(row.valid_from) > now() })),
    },
  };
};

type QuoteBody = { items: { weight_kg: number; length_cm: number; width_cm: number; height_cm: number; volumetric_enabled: boolean }[] };

const quoteResponse = (body: QuoteBody) => {
  const { current } = tariffsResponse().data as { current: Record<string, TariffRow | null> };
  const weights = computeMeasureWeights(body.items[0]);
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
          billableKg: weights.billableKg,
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
    return Promise.reject(new Error(`kutilmagan so'rov: ${url}`));
  });
  mocks.post.mockImplementation((url: string, body: Record<string, unknown>) => {
    if (url === "delivery/quote/by-tariff") return Promise.resolve({ data: quoteResponse(body as QuoteBody) });
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
    settings = { ...settings, ...body };
    return Promise.resolve({ data: { statusCode: 200, data: settings } });
  });
};

const renderPage = (role = "admin") =>
  renderWithProviders(<DeliveryTariffsPage />, {
    route: "/delivery-tariffs",
    preloadedState: { role: { id: `${role}-1`, role, region: null, name: role } } as never,
  });

const calls = (mock: typeof mocks.post, url: string) => mock.mock.calls.filter(([called]) => called === url);

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
  settings = { ...settings, first_kg_included: 1, round_to: 500 };
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
    await user.click(within(rules).getByRole("button", { name: "Qoidalarni saqlash" }));

    await waitFor(() => expect(mocks.patch).toHaveBeenCalledTimes(1));
    expect(mocks.patch).toHaveBeenCalledWith("delivery/pricing-settings", { first_kg_included: 2 });
    expect(await screen.findByText("Qoidalar saqlandi")).toBeInTheDocument();
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
