import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/test-utils";
import { normalizeUnlinkedOperatorOrders } from "../../entities/market-operator";
import MarketOperatorsPage from "./index";

/**
 * 2026-11-20 — ega: «operator nomidan yaratilgan buyurtmalarga xizmat haqqi yozilmayapti». Eski buyurtmalarda
 * operator ismi faqat matn (`operator_id` yo'q) — «Operatorlar» sahifasida ism guruhlari, operatorni market O'ZI
 * tanlaydi (mos ism — oldindan tanlangan taklif) → tasdiq → `POST market-operators/unlinked-orders/assign` 100 tadan.
 * `notify` / `confirm` mock qilinmaydi.
 */

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock("../../shared/api/api", () => ({ api }));

const OPERATORS = [
  { id: "41", name: "Sevinch Karimova", phone_number: "+998902143658", status: "active", commission_type: "percent", commission_value: 5 },
  { id: "42", name: "Bekzod Aliyev", phone_number: "+998935071244", status: "active", commission_type: "fixed", commission_value: 3000 },
];
const SELECTABLE = [
  { id: "41", name: "Sevinch Karimova" },
  { id: "42", name: "Bekzod Aliyev" },
];
const ids = (from: number, count: number) => Array.from({ length: count }, (_, i) => String(from + i));
let groups: unknown[];

const ok = (data: unknown) => Promise.resolve({ data: { statusCode: 200, message: "ok", data } });
const marketState = {
  role: { id: "12", role: "market", region: null, name: "Baraka Shop" },
  user: { user: { id: "12", name: "Baraka Shop", role: "market" } },
} as never;
const renderPage = () => renderWithProviders(<MarketOperatorsPage />, { route: "/market-operators", preloadedState: marketState });
const card = () => screen.findByRole("region", { name: "Operatorga bog'lanmagan buyurtmalar" });
const assignCalls = () => api.post.mock.calls.filter(([url]) => url === "market-operators/unlinked-orders/assign");

beforeEach(() => {
  groups = [
    { name: "#sevinch", key: "sevinch", total_orders: 150, sold_orders: 40, order_ids: ids(1000, 150) },
    { name: "Shahzoda", key: "shahzoda", total_orders: 2, sold_orders: 0, order_ids: ["7", "8"] },
  ];
  api.get.mockReset().mockImplementation((url: string) => {
    if (url === "market-operators") return ok({ items: OPERATORS, meta: { page: 1, limit: 20, total: 2, totalPages: 1 } });
    if (url === "market-operators/selectable") return ok({ items: SELECTABLE });
    if (url === "market-operators/unlinked-orders") return ok({ groups, total_orders: 152 });
    return ok({});
  });
  api.post.mockReset().mockImplementation((url: string, body: { order_ids: string[] }) =>
    url === "market-operators/unlinked-orders/assign"
      ? ok({ assigned: body.order_ids.length, failed: 0, earnings_recorded: 20, results: [] })
      : ok({}),
  );
});

describe("«Operatorga bog'lanmagan buyurtmalar»", () => {
  it("guruhlar soni bilan; mos ism — taklif oldindan tanlangan, mos kelmasa — tanlanmagan va tugma o'chiq", async () => {
    renderPage();
    const region = await card();
    expect(region).toHaveTextContent("Operatorga bog'lanmagan buyurtmalar: 152 ta");
    expect(region).toHaveTextContent("150 ta buyurtma, 40 tasi sotilgan");

    const sevinch = within(region).getByText("«#sevinch»").closest("li") as HTMLElement;
    await waitFor(() => expect(within(sevinch).getByRole("combobox")).toHaveTextContent("Sevinch Karimova"));
    expect(within(sevinch).getByRole("button", { name: "«#sevinch» buyurtmalarini biriktirish" })).toBeEnabled();

    const shahzoda = within(region).getByText("«Shahzoda»").closest("li") as HTMLElement;
    expect(within(shahzoda).getByRole("combobox")).toHaveTextContent("Operatorni tanlang");
    expect(within(shahzoda).getByRole("button", { name: "«Shahzoda» buyurtmalarini biriktirish" })).toBeDisabled();
    expect(assignCalls()).toHaveLength(0);
  });

  it("«Biriktirish» → tasdiq → 100 tadan bo'laklab POST; natija xabari va ro'yxat qayta so'raladi", async () => {
    const user = userEvent.setup();
    renderPage();
    const region = await card();
    const sevinch = within(region).getByText("«#sevinch»").closest("li") as HTMLElement;
    await waitFor(() => expect(within(sevinch).getByRole("combobox")).toHaveTextContent("Sevinch Karimova"));
    await user.click(within(sevinch).getByRole("button", { name: "«#sevinch» buyurtmalarini biriktirish" }));

    const dialog = await screen.findByRole("alertdialog", { name: "«Sevinch Karimova» ga biriktirilsinmi?" });
    expect(dialog).toHaveTextContent("«#sevinch» ismi yozilgan 150 ta buyurtma shu operatorga bog'lanadi");
    expect(dialog).toHaveTextContent("Biriktirilgan operatorni keyin almashtirib bo'lmaydi");
    expect(assignCalls()).toHaveLength(0);
    const unlinkedReads = api.get.mock.calls.filter(([url]) => url === "market-operators/unlinked-orders").length;
    await user.click(within(dialog).getByRole("button", { name: "Biriktirish" }));

    await waitFor(() => expect(assignCalls()).toHaveLength(2));
    expect(assignCalls()[0][1]).toEqual({ operator_id: "41", order_ids: ids(1000, 100) });
    expect(assignCalls()[1][1]).toEqual({ operator_id: "41", order_ids: ids(1100, 50) });
    expect(await screen.findByText("150 ta buyurtma «Sevinch Karimova» ga biriktirildi")).toBeInTheDocument();
    await waitFor(() =>
      expect(api.get.mock.calls.filter(([url]) => url === "market-operators/unlinked-orders").length).toBeGreaterThan(
        unlinkedReads,
      ),
    );
  });

  it("tasdiqdan voz kechilsa — hech narsa yuborilmaydi; boshqa operator qo'lda tanlanishi mumkin", async () => {
    const user = userEvent.setup();
    renderPage();
    const region = await card();
    const shahzoda = within(region).getByText("«Shahzoda»").closest("li") as HTMLElement;
    await user.click(within(shahzoda).getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Bekzod Aliyev" }));
    await user.click(within(shahzoda).getByRole("button", { name: "«Shahzoda» buyurtmalarini biriktirish" }));
    const dialog = await screen.findByRole("alertdialog", { name: "«Bekzod Aliyev» ga biriktirilsinmi?" });
    await user.click(within(dialog).getByRole("button", { name: "Bekor qilish" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(assignCalls()).toHaveLength(0);
  });

  it("guruh yo'q — karta chiqmaydi", async () => {
    groups = [];
    renderPage();
    await screen.findByRole("table", { name: "Operatorlar ro'yxati" });
    await waitFor(() =>
      expect(api.get.mock.calls.some(([url]) => url === "market-operators/unlinked-orders")).toBe(true),
    );
    expect(screen.queryByRole("region", { name: "Operatorga bog'lanmagan buyurtmalar" })).toBeNull();
  });
});

describe("normalizeUnlinkedOperatorOrders", () => {
  it("konvertdan; id'siz guruh tushib qoladi; jami — guruhlar yig'indisi", () => {
    expect(
      normalizeUnlinkedOperatorOrders({
        statusCode: 200,
        data: {
          groups: [
            { name: " #sevinch ", key: "sevinch", total_orders: "3", sold_orders: 1, order_ids: [3, "2", "x"] },
            { name: "bo'sh", key: "bosh", total_orders: 1, sold_orders: 0, order_ids: [] },
          ],
        },
      }),
    ).toEqual({
      groups: [{ name: "#sevinch", key: "sevinch", totalOrders: 3, soldOrders: 1, orderIds: ["3", "2"] }],
      totalOrders: 3,
    });
  });
});
