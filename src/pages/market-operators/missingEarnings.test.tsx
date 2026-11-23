import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/test-utils";
import { normalizeMissingEarnings } from "../../entities/operator-payment";
import MarketOperatorsPage from "./index";

/**
 * 2026-11-20 — «O'tgan sotuvlarga hisoblash»: sotuv paytida stavka belgilanmagan bo'lsa ulush yozilmagan. Qator
 * menyusidan (faqat komissiyasi bor operatorda) oyna — oldindan ko'rish (hech narsa yozilmaydi), «Hisoblash» —
 * `POST finance/operator-payments/missing-earnings`. `notify` mock qilinmaydi.
 */

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock("../../shared/api/api", () => ({ api }));

const OPERATORS = [
  { id: "41", name: "Madina Xoliqova", phone_number: "+998902143658", status: "active", commission_type: "percent", commission_value: 5 },
  { id: "44", name: "Dilfuza Qodirova", phone_number: "+998941187032", status: "active", commission_type: null, commission_value: null },
];
const PREVIEW = {
  sold_orders: 57,
  already_recorded: 41,
  missing: 16,
  to_record: 15,
  amount: 187500,
  commission_type: "percent",
  commission_value: 5,
  operator_name: "Madina Xoliqova",
  truncated: false,
  created: 0,
  dry_run: true,
};
let preview: Record<string, unknown>;

const ok = (data: unknown) => Promise.resolve({ data: { statusCode: 200, message: "ok", data } });
const marketState = {
  role: { id: "12", role: "market", region: null, name: "Baraka Shop" },
  user: { user: { id: "12", name: "Baraka Shop", role: "market" } },
} as never;
const renderPage = () => renderWithProviders(<MarketOperatorsPage />, { route: "/market-operators", preloadedState: marketState });
const MISSING = "finance/operator-payments/missing-earnings";

const openMenu = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  await user.click((await screen.findAllByRole("button", { name: `${name} amallari` }))[0]);
  return screen.findByRole("menu", { name: `${name} amallari` });
};

beforeEach(() => {
  preview = { ...PREVIEW };
  api.get.mockReset().mockImplementation((url: string) => {
    if (url === "market-operators") return ok({ items: OPERATORS, meta: { page: 1, limit: 20, total: 2, totalPages: 1 } });
    if (url === MISSING) return ok(preview);
    return ok({});
  });
  api.post.mockReset().mockImplementation((url: string) =>
    url === MISSING ? ok({ ...PREVIEW, created: 15, created_amount: 187500, dry_run: false }) : ok({}),
  );
});

describe("«O'tgan sotuvlarga hisoblash»", () => {
  it("menyuda faqat komissiyasi bor operatorda", async () => {
    const user = userEvent.setup();
    renderPage();
    const madina = await openMenu(user, "Madina Xoliqova");
    expect(within(madina).getByRole("menuitem", { name: "O'tgan sotuvlarga hisoblash" })).toBeInTheDocument();
    await user.keyboard("{Escape}");

    const dilfuza = await openMenu(user, "Dilfuza Qodirova");
    expect(within(dilfuza).queryByRole("menuitem", { name: "O'tgan sotuvlarga hisoblash" })).toBeNull();
  });

  it("oldindan ko'rish — hech narsa yozilmaydi; «Hisoblash» → POST, xabar, oyna yopiladi", async () => {
    const user = userEvent.setup();
    renderPage();
    const menu = await openMenu(user, "Madina Xoliqova");
    await user.click(within(menu).getByRole("menuitem", { name: "O'tgan sotuvlarga hisoblash" }));

    const dialog = await screen.findByRole("dialog", { name: "Madina Xoliqova — o'tgan sotuvlar" });
    await waitFor(() => expect(dialog).toHaveTextContent("Komissiya yozilmagan16"));
    expect(dialog).toHaveTextContent("Sotilgan buyurtmalar57");
    expect(dialog).toHaveTextContent("187 500");
    expect(dialog).toHaveTextContent("«Hisoblash» bosilsa 15 ta buyurtmaga jami 187 500 so'm yoziladi");
    expect(api.get).toHaveBeenCalledWith(MISSING, { params: { operator_id: "41" } });
    expect(api.post).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Hisoblash" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(MISSING, { operator_id: "41" }));
    expect(await screen.findByText("Madina Xoliqova: 15 ta buyurtmaga komissiya yozildi")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Madina Xoliqova — o'tgan sotuvlar" })).toBeNull());
  });

  it("hisoblanadigan narsa yo'q — «Hisoblash» o'chiq va izoh", async () => {
    preview = { ...PREVIEW, missing: 0, to_record: 0, amount: 0, already_recorded: 57 };
    const user = userEvent.setup();
    renderPage();
    const menu = await openMenu(user, "Madina Xoliqova");
    await user.click(within(menu).getByRole("menuitem", { name: "O'tgan sotuvlarga hisoblash" }));
    const dialog = await screen.findByRole("dialog", { name: "Madina Xoliqova — o'tgan sotuvlar" });
    expect(await within(dialog).findByText("Hisoblanadigan buyurtma yo'q — barcha sotuvlarga komissiya yozilgan.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Hisoblash" })).toBeDisabled();
  });

  it("audit #9: `truncated` — «barcha sotuvlarga yozilgan» deyilmaydi, faqat «hammasi ko'rib chiqilmadi»", async () => {
    preview = { ...PREVIEW, missing: 0, to_record: 0, amount: 0, already_recorded: 57, truncated: true };
    const user = userEvent.setup();
    renderPage();
    const menu = await openMenu(user, "Madina Xoliqova");
    await user.click(within(menu).getByRole("menuitem", { name: "O'tgan sotuvlarga hisoblash" }));
    const dialog = await screen.findByRole("dialog", { name: "Madina Xoliqova — o'tgan sotuvlar" });
    expect(
      await within(dialog).findByText(
        "Sotuvlar juda ko'p (100 000 dan ortiq) — hammasi ko'rib chiqilmadi. Qolganini hisoblash uchun Elchi bilan bog'laning.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText(/barcha sotuvlarga komissiya yozilgan/)).toBeNull();
    expect(within(dialog).getByRole("button", { name: "Hisoblash" })).toBeDisabled();
  });
});

describe("normalizeMissingEarnings", () => {
  it("konvertdan; noma'lum stavka turi — null", () => {
    expect(
      normalizeMissingEarnings({ statusCode: 200, data: { ...PREVIEW, commission_type: "x", amount: "187500.5", truncated: true } }),
    ).toEqual({
      soldOrders: 57,
      alreadyRecorded: 41,
      missing: 16,
      toRecord: 15,
      amount: 187500.5,
      commissionType: null,
      commissionValue: 5,
      truncated: true,
      created: 0,
      createdAmount: 0,
    });
  });
});
