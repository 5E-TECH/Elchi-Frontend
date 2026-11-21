import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../../test/test-utils";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("../../../../../shared/api/api", () => ({ api: { get: mocks.get, post: vi.fn() } }));

import type { OrderDetail } from "../orderDetailModel";
import { OrderAiTraceRow } from "./OrderAiTrace";
import { checkRows, editedRows, retentionDate, splitSourceText, unchangedCount, type TraceLookups } from "./aiTraceModel";
import { toAiOrderTrace, type AiOrderTrace } from "../../../../../entities/ai-order";

/**
 * «AI IZI» (vncdmXOy; maket `superadmin-orders-detail-ai-trace-dialog`).
 *
 * Qator faqat superadmin/admin va iz topilganda; 404 (AI'dan yaratilmagan) — qator yo'q, xato ham yo'q.
 * Oyna: model, ko'rsatma versiyasi, kim tasdiqladi, manba matn (`[TEL_n]` qalin), o'zgargan maydonlar
 * (AI taklifi → yakuniy, telefon har ikkisida maskalangan), ishlagan tekshiruvlar.
 */

const ORDER = {
  id: "10241",
  status: "received",
  where_deliver: "address",
  total_price: 185000,
  to_be_paid: 185000,
  paid_amount: 0,
  comment: "Kechqurun",
  address: "Lutfiy ko'chasi, 14-uy, 32-xonadon",
  district_id: "101",
  district: { id: "101", name: "Chilonzor tumani", region: { id: "11", name: "Toshkent sh." } },
  items: [
    { id: "1", quantity: 1, product: { id: "501", name: "Bolalar kurtkasi, 110 sm" } },
    { id: "2", quantity: 2, product: { id: "502", name: "Qishki shapka" } },
  ],
  customer: { id: "9", name: "Dilnoza Karimova", phone_number: "+998901234567" },
} as unknown as OrderDetail;

const RAW_TRACE = {
  order_id: "10241",
  item_index: 0,
  confirmed_by: "77",
  confirmed_at: "2026-11-21T09:15:00.000Z",
  created_at: "2026-11-21T09:12:00.000Z",
  source_text: "Assalomu alaykum:\n1) Dilnoza Karimova [TEL_1], Lutfiy 14-uy, mo'ljal Qatortol.",
  source_purged: false,
  image_count: 1,
  model: "claude-sonnet-5",
  prompt_version: "2026-10-26.1",
  ai_suggestion: {
    customer_name: "Dilnoza Karimova",
    phone_masked: "+99890*****76",
    extra_masked: null,
    region_id: "11",
    district_id: "103",
    address: "Lutfiy, 14-uy, 32-xonadon",
    total_price: 1850000,
    where_deliver: "address",
    comment: "Kechqurun",
    operator: null,
    items: [
      { name: "kurtka 110", product_id: "501", quantity: 1 },
      { name: "shapka", product_id: "502", quantity: 1 },
    ],
    district_match: { method: "address", ai_text: "Qatortol", score: 0.6 },
    region_inferred: true,
    check_codes: ["district_low_confidence", "price_check"],
  },
  edited_fields: ["phone_number", "district_id", "address", "total_price", "items"],
};

const ok = (data: unknown) => Promise.resolve({ data: { statusCode: 200, message: "ok", data } });
const httpError = (status: number) =>
  Promise.reject(
    new AxiosError(`Request failed with status code ${status}`, "ERR_BAD_REQUEST", {} as InternalAxiosRequestConfig, null, {
      status,
      statusText: "",
      data: { statusCode: status, message: "x" },
      headers: new AxiosHeaders(),
      config: {} as InternalAxiosRequestConfig,
    }),
  );

let traceResponse: () => Promise<unknown>;
const traceCalls = () => mocks.get.mock.calls.filter(([url]) => url === "orders/10241/ai-trace");

beforeEach(() => {
  traceResponse = () => ok(RAW_TRACE);
  mocks.get.mockReset();
  mocks.get.mockImplementation((url: string) => {
    if (url === "orders/10241/ai-trace") return traceResponse();
    if (url === "users/77") return ok({ id: "77", name: "Nilufar Rashidova", role: "admin" });
    if (url === "region") return ok([{ id: 11, name: "Toshkent sh." }]);
    if (url === "district/103") return ok({ id: "103", name: "Uchtepa tumani", region_id: "11" });
    return ok([]);
  });
});

const renderRow = (role: string, order: OrderDetail | null = ORDER) =>
  renderWithProviders(<OrderAiTraceRow orderId="10241" order={order} role={role} />);

const openDialog = async () => {
  const row = await screen.findByTestId("order-ai-trace-row");
  fireEvent.click(within(row).getByRole("button", { name: "AI izi" }));
  return screen.findByTestId("ai-trace-dialog");
};

describe("OrderAiTraceRow", () => {
  it("superadmin: «Yaratish usuli: AI bilan · AI izi»; oynada model, versiya, kim tasdiqladi", async () => {
    renderRow("superadmin");

    const row = await screen.findByTestId("order-ai-trace-row");
    expect(row).toHaveAccessibleName("Yaratish usuli:");
    expect(within(row).getByText("AI bilan")).toBeInTheDocument();

    const dialog = await openDialog();
    expect(screen.getByRole("dialog", { name: "AI izi" })).toBeInTheDocument();
    expect(screen.getByText("№10241 · AI bilan yaratilgan buyurtma")).toBeInTheDocument();
    expect(within(dialog).getByText("claude-sonnet-5")).toBeInTheDocument();
    expect(within(dialog).getByText("2026-10-26.1")).toBeInTheDocument();
    expect(await within(dialog).findByText(/^Nilufar Rashidova, Admin · /)).toBeInTheDocument();
  });

  it("manba matn: `[TEL_n]` qalin, saqlash muddati sanasi; tarkib — «1 ta surat · matndagi 1-buyurtma»", async () => {
    renderRow("admin");
    const dialog = await openDialog();

    const source = within(dialog).getByTestId("ai-trace-source");
    expect(source).toHaveTextContent("1) Dilnoza Karimova [TEL_1], Lutfiy 14-uy");
    expect(within(source).getByText("[TEL_1]")).toHaveClass("font-semibold");
    expect(within(dialog).getByText("1 ta surat · matndagi 1-buyurtma")).toBeInTheDocument();
    expect(within(dialog).getByText(/^Telefon raqamlar yashirilgan\. Matn 30 kundan keyin o'chiriladi — /)).toBeInTheDocument();
  });

  it("o'zgargan maydonlar: AI taklifi → yakuniy (telefon har ikkisida maskalangan), «Qolgan 6 ta maydon …»", async () => {
    renderRow("superadmin");
    const dialog = await openDialog();

    const table = within(dialog).getByTestId("ai-trace-edited");
    const row = (field: string) => table.querySelector(`tr[data-field="${field}"]`) as HTMLElement;
    expect(row("phone_number")).toHaveTextContent("Telefon+998 90 *** ** 76+998 90 *** ** 67");
    await waitFor(() => expect(row("district_id")).toHaveTextContent("TumanUchtepa tumaniChilonzor tumani"));
    expect(row("total_price")).toHaveTextContent("Umumiy summa1 850 000 so'm185 000 so'm");
    // AI qatori katalog mahsulotiga bog'langan — katalog nomi bilan (yakuniy ustun bilan solishtirish oson).
    expect(row("items")).toHaveTextContent(
      "MahsulotlarBolalar kurtkasi, 110 sm — 1 taQishki shapka — 1 taBolalar kurtkasi, 110 sm — 1 taQishki shapka — 2 ta",
    );
    expect(within(dialog).getByText("Qolgan 6 ta maydon AI taklifidagidek qoldi.")).toBeInTheDocument();
  });

  it("ishlagan tekshiruvlar: tuman va narx tuzatilgan — «Tuzatildi», viloyat taxmini — «Eslatma»", async () => {
    renderRow("superadmin");
    const dialog = await openDialog();

    const checks = within(dialog).getByTestId("ai-trace-checks");
    const item = (code: string) => checks.querySelector(`li[data-code="${code}"]`) as HTMLElement;
    await waitFor(() => expect(item("district_low_confidence")).toHaveTextContent("AI o'qigan: «Qatortol» → Uchtepa tumani"));
    expect(item("district_low_confidence")).toHaveTextContent("Tuzatildi");
    expect(item("price_check")).toHaveTextContent("Narx matnga mos emasAI: 1 850 000 so'mTuzatildi");
    await waitFor(() => expect(item("region_inferred")).toHaveTextContent("Toshkent sh. · o'zgarmadi"));
    expect(item("region_inferred")).toHaveTextContent("Eslatma");
  });

  it("30 kundan keyin: «Manba matn va AI taklifi o'chirilgan», o'zgargan maydon nomlari qoladi, tekshiruvlar yo'q", async () => {
    traceResponse = () => ok({ ...RAW_TRACE, source_text: null, source_purged: true, ai_suggestion: null });
    renderRow("superadmin");
    const dialog = await openDialog();

    expect(within(dialog).getByTestId("ai-trace-purged")).toHaveTextContent(
      /Manba matn va AI taklifi o'chirilganSaqlash muddati .+ da tugadi\./,
    );
    expect(within(dialog).queryByTestId("ai-trace-source")).toBeNull();
    const table = within(dialog).getByTestId("ai-trace-edited");
    expect(table.querySelector('tr[data-field="district_id"]')).toHaveTextContent("Tuman—Chilonzor tumani");
    expect(within(dialog).queryByTestId("ai-trace-checks")).toBeNull();
  });

  it("operator hech narsani o'zgartirmagan — jadval o'rniga «AI taklifi o'zgarishsiz tasdiqlangan»", async () => {
    traceResponse = () => ok({ ...RAW_TRACE, edited_fields: [] });
    renderRow("superadmin");
    const dialog = await openDialog();

    expect(within(dialog).getByTestId("ai-trace-no-edits")).toHaveTextContent(
      "Operator hech narsani o'zgartirmaganAI taklifi o'zgarishsiz tasdiqlangan.",
    );
    expect(within(dialog).queryByTestId("ai-trace-edited")).toBeNull();
    // O'zgartirilmagan — bloklovchi tekshiruvlar operator tasdig'i bilan o'tgan.
    expect(within(dialog).getByTestId("ai-trace-checks")).toHaveTextContent("Tasdiqlandi");
  });

  it("404 (AI'dan yaratilmagan) — qator yo'q va xato xabari yo'q", async () => {
    traceResponse = () => httpError(404);
    renderRow("superadmin");

    await waitFor(() => expect(traceCalls()).toHaveLength(1));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByTestId("order-ai-trace-row")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("boshqa rollar (menejer, registrator, market) — so'rov ham ketmaydi", async () => {
    for (const role of ["manager", "registrator", "market"]) renderRow(role);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(traceCalls()).toHaveLength(0);
    expect(screen.queryByTestId("order-ai-trace-row")).toBeNull();
  });
});

describe("aiTraceModel", () => {
  const trace = toAiOrderTrace(RAW_TRACE) as AiOrderTrace;
  const lookups: TraceLookups = {
    regionName: (id) => (id ? `R${id}` : null),
    districtName: (id) => (id ? `D${id}` : null),
    money: (amount) => `${amount}`,
    delivery: (value) => value,
    itemLine: (name, count) => `${name} x${count}`,
  };

  it("qatorlar backend tartibida (`AI_AUDITED_FIELDS`), noma'lum qolgan soni", () => {
    expect(editedRows(trace, ORDER, lookups).map((row) => row.field)).toEqual([
      "phone_number",
      "district_id",
      "address",
      "total_price",
      "items",
    ]);
    expect(unchangedCount(trace)).toBe(6);
  });

  it("tekshiruv holati: maydon o'zgargan — fixed, bloklovchi o'zgarmagan — confirmed, yumshoq — note", () => {
    expect(checkRows({ ...trace, edited_fields: ["district_id"] })).toEqual([
      { code: "district_low_confidence", status: "fixed" },
      { code: "price_check", status: "confirmed" },
      { code: "region_inferred", status: "note" },
    ]);
    expect(checkRows({ ...trace, ai_suggestion: null })).toEqual([]);
  });

  it("`[TEL_n]` bo'laklari va saqlash muddati (+30 kun)", () => {
    expect(splitSourceText("a [TEL_1], b [TEL_12]")).toEqual([
      { text: "a ", phone: false },
      { text: "[TEL_1]", phone: true },
      { text: ", b ", phone: false },
      { text: "[TEL_12]", phone: true },
    ]);
    expect(retentionDate("2026-11-21T09:12:00.000Z")?.toISOString()).toBe("2026-12-21T09:12:00.000Z");
    expect(retentionDate(null)).toBeNull();
    expect(retentionDate("x")).toBeNull();
  });
});

describe("DetailHeader + «AI izi»", () => {
  it("qator «Yaratilgan: … · Market» ostida, sarlavha tavsifining ichida", async () => {
    const { DetailHeader } = await import("../DetailHeader");
    renderWithProviders(
      <DetailHeader
        orderId="10241"
        order={{ ...ORDER, market: { id: "7", name: "Baraka Shop" }, createdAt: "2026-11-21T09:15:00.000Z" } as OrderDetail}
        layout="default"
        onBack={vi.fn()}
        aiTrace={<OrderAiTraceRow orderId="10241" order={ORDER} role="superadmin" />}
      />,
    );

    const row = await screen.findByTestId("order-ai-trace-row");
    expect(row.closest("p")).toHaveTextContent(/Yaratilgan: .+ · Baraka ShopYaratish usuli:AI bilanAI izi/);
  });
});
