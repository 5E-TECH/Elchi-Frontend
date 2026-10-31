import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import type { User, UserRole } from "../../../entities/user/types/user";
import i18n from "../../../i18n";
import { UserDetailView } from "./UserDetailView";

/**
 * Yangi v2 tafsilot (`/all-users/:id`, `/new-orders/userDetail/:id`) — eski (o'chirilgan) `UserDetailWidget` testlaridagi
 * holatlar shu yerda: kuryer o'tkazish tugmasi (faqat superadmin/admin va faqat kuryer), har kalit
 * mutatsiyasi va xabarlari, «Telegram guruhi» kartasi kimga chiqishi (TG-B).
 */

const mocks = vi.hoisted(() => ({
  updateUser: vi.fn(),
  updateMarketAddOrder: vi.fn(),
  updateMarketExpenseProof: vi.fn(),
  updateMarketCancelledHandoverQr: vi.fn(),
  updateMarketExtraCost: vi.fn(),
  updateMarketTelegramGroupPii: vi.fn(),
}));

vi.mock("../../../entities/user/api/userApi", () => ({
  useUser: () => ({
    updateUser: { mutateAsync: mocks.updateUser, isPending: false },
    updateMarketAddOrder: { mutateAsync: mocks.updateMarketAddOrder, isPending: false },
    updateMarketExpenseProof: { mutateAsync: mocks.updateMarketExpenseProof, isPending: false },
    updateMarketCancelledHandoverQr: { mutateAsync: mocks.updateMarketCancelledHandoverQr, isPending: false },
    updateMarketExtraCost: { mutateAsync: mocks.updateMarketExtraCost, isPending: false },
    updateMarketTelegramGroupPii: { mutateAsync: mocks.updateMarketTelegramGroupPii, isPending: false },
    useGetUserById: () => ({ data: undefined, isLoading: false }),
    updateMyProfile: { mutateAsync: vi.fn(), isPending: false },
  }),
}));

// Karta o'z so'rovlarini yuboradi (o'z testi — `MarketTelegramGroupsCard.test.tsx`); bu yerda faqat kim ko'radi.
vi.mock("./MarketTelegramGroupsCard", () => ({
  MarketTelegramGroupsCard: ({ user, mode }: { user: User; mode: string }) => (
    <section aria-label="Telegram guruhi" data-mode={mode} data-market-id={user.id} />
  ),
}));

vi.mock("../../../features/courier-transfer-branch", () => ({
  TransferCourierButton: ({
    courierId,
    courierName,
    variant,
  }: {
    courierId: string;
    courierName?: string;
    variant?: string;
  }) => (
    <button type="button" data-testid={`transfer-${courierId}`} data-variant={variant}>
      {courierName}
    </button>
  ),
}));

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const makeUser = (role: UserRole, overrides: Partial<User> = {}): User => ({
  id: "201",
  name: "Baraka Shop",
  phone_number: "+998903152241",
  username: "baraka_shop",
  role,
  status: "active",
  salary: 0,
  payment_day: null,
  createdAt: "2026-09-29T09:00:00.000Z",
  updatedAt: "2026-10-05T09:00:00.000Z",
  is_deleted: false,
  tariff_home: 35000,
  tariff_center: 25000,
  default_tariff: "home",
  add_order: true,
  cancelled_handover_qr_required: true,
  expense_proof_conditions: ["sell_any"],
  ...overrides,
});

const stateFor = (role: string, branchName?: string) =>
  ({
    role: { id: `${role}-1`, role, region: null, name: role },
    ...(branchName
      ? {
          user: {
            user: { id: `${role}-1`, role, branch: { branch: { id: "44", name: branchName, type: "REGIONAL" } } },
            isAuthenticated: true,
            accessToken: null,
            loading: false,
            isAppInitializing: false,
            error: null,
          },
        }
      : {}),
  }) as never;

const renderView = (user: User, viewerRole: string, branchName?: string) =>
  renderWithProviders(<UserDetailView user={user} />, { preloadedState: stateFor(viewerRole, branchName) });

describe("UserDetailView — sarlavha va kartalar (maket `superadmin-users-detail`)", () => {
  it("market: ism + holat, «Market · Login: …», Aloqa va sanalar, Ruxsatlar, Tarif", () => {
    renderView(makeUser("market"), "superadmin");

    expect(screen.getByRole("heading", { level: 1, name: "Baraka Shop" })).toBeInTheDocument();
    expect(screen.getByText("Faol")).toBeInTheDocument();
    expect(screen.getByText("Market · Login: baraka_shop")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Foydalanuvchilar" })).toHaveAttribute("href", "/all-users");
    const contact = screen.getByRole("region", { name: "Aloqa va sanalar" });
    expect(contact).toHaveTextContent("+998 90 315 22 41");
    expect(contact).toHaveTextContent("29.09.2026");
    expect(contact).toHaveTextContent("05.10.2026");
    expect(screen.getByRole("region", { name: "Ruxsatlar" })).toHaveTextContent("O'zgarish darhol saqlanadi");
    const tariff = screen.getByRole("region", { name: "Tarif" });
    expect(tariff).toHaveTextContent("Uygacha");
    expect(tariff).toHaveTextContent("35 000 so'm");
    expect(tariff).toHaveTextContent("25 000 so'm");
    // «Faoliyat» — Taklif, chizilmaydi.
    expect(screen.queryByText("Faoliyat")).not.toBeInTheDocument();
  });

  it("kGIjOciz: superadmin kuryer tafsilotida — kuryerning o'z filiali sarlavhada va «Profil ma'lumotlari» da", () => {
    renderView(
      makeUser("courier", { id: "26", username: "kuryer26", branch_id: "3", branch: { id: "3", name: "QA Filial" } }),
      "superadmin",
    );

    expect(screen.getByText("Kuryer · QA Filial · Login: kuryer26")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Profil ma'lumotlari" })).toHaveTextContent("QA Filial");
  });

  it("kGIjOciz: menejer ko'rinishida filial — foydalanuvchiniki (ko'ruvchiniki emas)", () => {
    renderView(
      makeUser("courier", { name: "Jasur", branch_id: "9", branch: { id: "9", name: "Kattaqo'rg'on filiali" } }),
      "manager",
      "Urgut filiali",
    );

    expect(screen.getByText("Kattaqo'rg'on filiali · +998 90 315 22 41")).toBeInTheDocument();
    expect(screen.queryByText(/Urgut filiali/)).not.toBeInTheDocument();
  });

  it("menejer ko'rinishi: rol va holat badge'lari, «{filial} · {telefon}», «Profil ma'lumotlari»", () => {
    renderView(
      makeUser("registrator", { name: "Kamola Rustamova", salary: 4200000, payment_day: "25" }),
      "manager",
      "Urgut filiali",
    );

    expect(screen.getByText("Ro'yxatchi")).toBeInTheDocument();
    expect(screen.getByText("Urgut filiali · +998 90 315 22 41")).toBeInTheDocument();
    const profile = screen.getByRole("region", { name: "Profil ma'lumotlari" });
    expect(profile).toHaveTextContent("Urgut filiali");
    expect(profile).toHaveTextContent("4 200 000 so'm");
    expect(profile).toHaveTextContent("Har oyning 25-kuni");
    // Menejer ruxsat kalitlarini o'zgartira olmaydi.
    expect(screen.queryByRole("region", { name: "Ruxsatlar" })).not.toBeInTheDocument();
  });

  it("«Tahrirlash» — tahrirlash oynasini ochadi", async () => {
    const user = userEvent.setup();
    renderView(makeUser("courier", { name: "Sherzod Alimov" }), "admin");

    await user.click(screen.getByRole("button", { name: "Tahrirlash" }));

    expect(await screen.findByRole("dialog", { name: "Foydalanuvchini tahrirlash" })).toHaveAccessibleDescription(
      "Sherzod Alimov · Kuryer",
    );
  });
});

describe("UserDetailView — kuryerni boshqa filialga o'tkazish tugmasi", () => {
  it.each(["superadmin", "admin"])("%s kuryer sahifasida v2 tugmani ko'radi", (viewerRole) => {
    renderView(makeUser("courier", { id: "263", name: "E2E Kuryer" }), viewerRole);

    const transfer = screen.getByTestId("transfer-263");
    expect(transfer).toHaveAttribute("data-variant", "secondary");
    expect(transfer).toHaveTextContent("E2E Kuryer");
    expect(screen.getByRole("button", { name: "Tahrirlash" })).toBeInTheDocument();
  });

  it.each(["manager", "registrator", "courier"])("%s kuryer sahifasida tugmani ko'rmaydi", (viewerRole) => {
    renderView(makeUser("courier", { id: "263" }), viewerRole);
    expect(screen.queryByTestId("transfer-263")).not.toBeInTheDocument();
  });

  it.each<UserRole>(["manager", "market", "registrator", "admin"])(
    "kuryer bo'lmagan foydalanuvchida (%s) superadmin ham tugmani ko'rmaydi",
    (userRole) => {
      renderView(makeUser(userRole, { id: "263" }), "superadmin");
      expect(screen.queryByTestId("transfer-263")).not.toBeInTheDocument();
    },
  );
});

describe("UserDetailView — «Parolni tiklash va SMS yuborish» (xtXKLUwT)", () => {
  const action = { name: "Parolni tiklash va SMS yuborish" };
  const stateOf = (role: string, id = "1") => ({ role: { id, role, region: null, name: "Ko'ruvchi" } }) as never;
  const person = (role: UserRole, id = "91") => makeUser(role, { id });

  it.each<[string, UserRole, boolean]>([
    ["superadmin", "admin", true],
    ["superadmin", "market", true],
    ["admin", "courier", true],
    ["admin", "admin", false],
    ["manager", "courier", true],
    ["manager", "market", false],
    ["registrator", "courier", false],
    ["superadmin", "customer", false],
  ])("%s → %s: %s", (viewer, target, visible) => {
    renderWithProviders(<UserDetailView user={person(target)} />, { preloadedState: stateOf(viewer) });
    expect(screen.queryAllByRole("button", action)).toHaveLength(visible ? 1 : 0);
  });

  it("o'zi uchun ko'rinmaydi (backend 403 — parol profilda almashtiriladi)", () => {
    renderWithProviders(<UserDetailView user={person("admin", "7")} />, { preloadedState: stateOf("superadmin", "7") });
    expect(screen.queryByRole("button", action)).not.toBeInTheDocument();
  });
});

describe("UserDetailView — ruxsat kalitlari (darhol saqlanadi)", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((fn) => fn.mockReset().mockResolvedValue({ statusCode: 200 }));
  });

  it("market: «Buyurtma qo'shish» — `add_order` teskarisi va xabar", async () => {
    const user = userEvent.setup();
    renderView(makeUser("market", { add_order: true }), "superadmin");

    const toggle = screen.getByRole("switch", { name: "Buyurtma qo'shish" });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    await user.click(toggle);

    await waitFor(() => expect(mocks.updateMarketAddOrder).toHaveBeenCalledWith({ id: "201", add_order: false }));
    expect(await screen.findByText("Market uchun buyurtma qo'shish o'chirildi")).toBeInTheDocument();
  });

  it("market: QR talabi — `cancelled_handover_qr_required` (false bo'lmasa yoqiq hisoblanadi)", async () => {
    const user = userEvent.setup();
    renderView(makeUser("market", { cancelled_handover_qr_required: undefined }), "admin");

    const toggle = screen.getByRole("switch", { name: "Bekor qilinganlarni QR bilan topshirish" });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    await user.click(toggle);

    await waitFor(() =>
      expect(mocks.updateMarketCancelledHandoverQr).toHaveBeenCalledWith({
        id: "201",
        cancelled_handover_qr_required: false,
      }),
    );
  });

  it("market: «Qo'shimcha xarajat» — yopiq marketni ochadi, tasdiq kaliti yopiqda bosilmaydi (w2bDrE3i)", async () => {
    const user = userEvent.setup();
    renderView(makeUser("market", { extra_cost_enabled: false }), "superadmin");

    const toggle = screen.getByRole("switch", { name: "Qo'shimcha xarajat" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("switch", { name: "Market tasdig'i" })).toBeDisabled();
    await user.click(toggle);

    await waitFor(() =>
      expect(mocks.updateMarketExtraCost).toHaveBeenCalledWith({ id: "201", extra_cost_enabled: true }),
    );
    expect(await screen.findByText("Market uchun qo'shimcha xarajat yoqildi")).toBeInTheDocument();
  });

  it("market: «Market tasdig'i» — `extra_cost_requires_approval` (false bo'lmasa yoqiq hisoblanadi)", async () => {
    const user = userEvent.setup();
    renderView(makeUser("market", { extra_cost_enabled: true }), "admin");

    const toggle = screen.getByRole("switch", { name: "Market tasdig'i" });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    await user.click(toggle);

    await waitFor(() =>
      expect(mocks.updateMarketExtraCost).toHaveBeenCalledWith({
        id: "201",
        extra_cost_requires_approval: false,
      }),
    );
    expect(await screen.findByText("Qo'shimcha xarajat endi tasdiqsiz yoziladi")).toBeInTheDocument();
  });

  it("market: isbot shartlari — ro'yxatga qo'shadi va olib tashlaydi", async () => {
    const user = userEvent.setup();
    renderView(makeUser("market", { expense_proof_conditions: ["sell_any"] }), "superadmin");

    expect(screen.getByText("Rasm yoki video isbot")).toBeInTheDocument();
    await user.click(screen.getByRole("switch", { name: "Bekor qilishda qo'shimcha xarajat isboti" }));
    await waitFor(() =>
      expect(mocks.updateMarketExpenseProof).toHaveBeenCalledWith({
        id: "201",
        expense_proof_conditions: ["sell_any", "cancel_extra_cost"],
      }),
    );

    await user.click(screen.getByRole("switch", { name: "Sotishda isbot" }));
    await waitFor(() =>
      expect(mocks.updateMarketExpenseProof).toHaveBeenLastCalledWith({ id: "201", expense_proof_conditions: [] }),
    );
  });

  it("kuryer: «Qo'shimcha xarajat» — `can_add_extra_cost`", async () => {
    const user = userEvent.setup();
    renderView(makeUser("courier", { can_add_extra_cost: false }), "admin");

    await user.click(screen.getByRole("switch", { name: "Qo'shimcha xarajat" }));

    await waitFor(() =>
      expect(mocks.updateUser).toHaveBeenCalledWith({ id: "201", data: { can_add_extra_cost: true } }),
    );
    expect(await screen.findByText("Qo'shimcha harajat ruxsati yoqildi")).toBeInTheDocument();
  });

  it("menejer foydalanuvchi: qo'shimcha xarajat va «Sotish / bekor qilish» (`can_sell_cancel`)", async () => {
    const user = userEvent.setup();
    renderView(makeUser("manager", { can_sell_cancel: true }), "superadmin");

    expect(screen.getByRole("switch", { name: "Qo'shimcha xarajat" })).toBeInTheDocument();
    await user.click(screen.getByRole("switch", { name: "Sotish / bekor qilish" }));

    await waitFor(() =>
      expect(mocks.updateUser).toHaveBeenCalledWith({ id: "201", data: { can_sell_cancel: false } }),
    );
  });

  it("xato bo'lsa — backend matni xabarda", async () => {
    mocks.updateMarketAddOrder.mockRejectedValue({ response: { status: 403, data: { message: "Ruxsat yo'q" } } });
    const user = userEvent.setup();
    renderView(makeUser("market"), "superadmin");

    await user.click(screen.getByRole("switch", { name: "Buyurtma qo'shish" }));

    expect(await screen.findByText("Ruxsat yo'q")).toBeInTheDocument();
  });

  it("market sahifasida menejer kalitlarni bosolmaydi (faqat ko'radi), isbot bo'limi yo'q", () => {
    renderView(makeUser("market"), "manager");

    expect(screen.getByRole("switch", { name: "Buyurtma qo'shish" })).toBeDisabled();
    expect(screen.queryByText("Rasm yoki video isbot")).not.toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "Qo'shimcha xarajat" })).not.toBeInTheDocument();
  });

  it("«Ruxsatlar» da «Guruhda mijoz ismi va telefoni» kaliti yo'q — u «Telegram guruhi» kartasiga ko'chdi (TG-B S3)", () => {
    renderView(makeUser("market"), "superadmin");
    const permissions = screen.getByRole("region", { name: "Ruxsatlar" });
    expect(within(permissions).queryByRole("switch", { name: "Guruhda mijoz ismi va telefoni" })).not.toBeInTheDocument();
  });
});

describe("UserDetailView — «Telegram guruhi» kartasi (TG-B, `*-users-detail-telegram`)", () => {
  it.each(["superadmin", "admin"])("%s: market tafsilotida karta (`staff` rejimi, shu market bilan)", (role) => {
    renderView(makeUser("market"), role);
    const card = screen.getByRole("region", { name: "Telegram guruhi" });
    expect(card).toHaveAttribute("data-mode", "staff");
    expect(card).toHaveAttribute("data-market-id", "201");
    expect(screen.queryByRole("region", { name: "Telegram token" })).not.toBeInTheDocument();
  });

  it.each(["manager", "registrator"])("%s market tafsilotida kartani ham, PII kalitini ham ko'rmaydi (maket)", (role) => {
    renderView(makeUser("market"), role);
    expect(screen.queryByRole("region", { name: "Telegram guruhi" })).not.toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "Guruhda mijoz ismi va telefoni" })).not.toBeInTheDocument();
  });

  it.each<UserRole>(["courier", "manager", "customer"])("%s foydalanuvchida karta yo'q", (role) => {
    renderView(makeUser(role), "superadmin");
    expect(screen.queryByRole("region", { name: "Telegram guruhi" })).not.toBeInTheDocument();
  });
});

describe("UserDetailView — mijoz", () => {
  it("buyurtmalar jadvali (maket yo'q — eng yaqini `superadmin-users-detail`)", () => {
    renderView(
      makeUser("customer", {
        name: "Gulnora Ismoilova",
        username: "",
        orders: [
          {
            id: "10225",
            market_id: "5",
            customer_id: "201",
            product_quantity: 2,
            where_deliver: "home",
            total_price: 245000,
            to_be_paid: 245000,
            paid_amount: 0,
            status: "sold",
            comment: null,
            district_id: "1",
            region_id: "1",
            createdAt: "2026-10-06T09:30:00.000Z",
            updatedAt: "2026-10-06T09:30:00.000Z",
          },
        ],
      }),
      "superadmin",
    );

    expect(screen.getByText("Mijoz")).toBeInTheDocument();
    const orders = screen.getByRole("table", { name: "Mijoz buyurtmalari" });
    expect(orders).toHaveTextContent("№10225");
    expect(orders).toHaveTextContent("2 ta mahsulot");
    expect(orders).toHaveTextContent("245 000 so'm");
    // Klaviatura uchun: buyurtma raqami — tahrirlash sahifasiga havola (qatorni bosish faqat sichqoncha uchun).
    expect(within(orders).getByRole("link", { name: "№10225" })).toHaveAttribute("href", "/new-orders/5/edit/10225");
  });
});

describe("UserDetailView — FY-1: «AI narxi» va logist maoshi", () => {
  it("market «Tarif» kartasida «AI narxi (1 buyurtma)» — belgilangan qiymat (maket `superadmin-users-edit-market-ai`)", () => {
    renderView(makeUser("market", { ai_price_per_order: 250 }), "superadmin");

    const tariff = screen.getByRole("region", { name: "Tarif" });
    expect(within(tariff).getByText("AI narxi (1 buyurtma)")).toBeInTheDocument();
    expect(tariff).toHaveTextContent("250 so'm");
  });

  it("AI narxi 0 — «0 so'm» (bepul); admin ham ko'radi", () => {
    renderView(makeUser("market", { ai_price_per_order: "0.00" }), "admin");

    const tariff = screen.getByRole("region", { name: "Tarif" });
    expect(within(tariff).getByText("AI narxi (1 buyurtma)").nextElementSibling).toHaveTextContent("0 so'm");
  });

  it("AI narxi `null` / yo'q — qator yo'q, sukut narx (300) ko'rsatilmaydi (FY-S5)", () => {
    const { unmount } = renderView(makeUser("market", { ai_price_per_order: null }), "superadmin");
    expect(screen.queryByText("AI narxi (1 buyurtma)")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Tarif" })).not.toHaveTextContent("300");
    unmount();

    renderView(makeUser("market"), "superadmin");
    expect(screen.queryByText("AI narxi (1 buyurtma)")).not.toBeInTheDocument();
  });

  it("menejer marketni ko'rsa — «AI narxi» qatori yo'q (tahrirda ham yashirin)", () => {
    renderView(makeUser("market", { ai_price_per_order: 250 }), "manager", "Urgut filiali");

    expect(screen.queryByText("AI narxi (1 buyurtma)")).not.toBeInTheDocument();
  });

  it("logist — «Profil ma'lumotlari»da maosh va to'lov kuni (maosh 0 bo'lsa ham qator bor)", () => {
    const { unmount } = renderView(
      makeUser("logist", { name: "Dilshod Karimov", salary: 3000000, payment_day: "10" }),
      "superadmin",
    );
    const profile = screen.getByRole("region", { name: "Profil ma'lumotlari" });
    expect(profile).toHaveTextContent("3 000 000 so'm");
    expect(profile).toHaveTextContent("Har oyning 10-kuni");
    unmount();

    renderView(makeUser("logist", { name: "Dilshod Karimov", salary: 0 }), "admin");
    expect(screen.getByRole("region", { name: "Profil ma'lumotlari" })).toHaveTextContent("0 so'm");
  });
});

describe("UserDetailView — CS-C: market yorliqlari «Uyga / Markazga standart narx» (maket `superadmin-users-detail`)", () => {
  const valueOf = (region: HTMLElement, label: string) => within(region).getByText(label).nextElementSibling;

  it.each(["superadmin", "admin"])("%s: market «Tarif» kartasida standart narx yorliqlari va summalari", (viewerRole) => {
    renderView(makeUser("market"), viewerRole);

    const tariff = screen.getByRole("region", { name: "Tarif" });
    expect(valueOf(tariff, "Asosiy tarif")).toHaveTextContent("Uygacha");
    expect(valueOf(tariff, "Uyga standart narx")).toHaveTextContent("35 000 so'm");
    expect(valueOf(tariff, "Markazga standart narx")).toHaveTextContent("25 000 so'm");
    expect(tariff).not.toHaveTextContent("Uyga tarif");
    expect(tariff).not.toHaveTextContent("Markazga tarif");
    // «Vazn va hajm bo'yicha narx» — backend maydoni yo'q (DAqXPeSy), chizilmaydi.
    expect(screen.queryByText("Vazn va hajm bo'yicha narx")).not.toBeInTheDocument();
  });

  it("menejer market sahifasida ham yangi yorliqlarni ko'radi", () => {
    renderView(makeUser("market"), "manager", "Urgut filiali");

    const tariff = screen.getByRole("region", { name: "Tarif" });
    expect(valueOf(tariff, "Uyga standart narx")).toHaveTextContent("35 000 so'm");
    expect(valueOf(tariff, "Markazga standart narx")).toHaveTextContent("25 000 so'm");
  });

  it("kuryer va menejer (tarifli) — eski «Uyga tarif» / «Markazga tarif» o'zgarmaydi", () => {
    const { unmount } = renderView(makeUser("courier", { name: "Sherzod Alimov" }), "superadmin");
    let tariff = screen.getByRole("region", { name: "Tarif" });
    expect(valueOf(tariff, "Uyga tarif")).toHaveTextContent("35 000 so'm");
    expect(valueOf(tariff, "Markazga tarif")).toHaveTextContent("25 000 so'm");
    expect(tariff).not.toHaveTextContent("standart narx");
    unmount();

    renderView(makeUser("manager", { name: "Aziz Karimov" }), "superadmin");
    tariff = screen.getByRole("region", { name: "Tarif" });
    expect(within(tariff).getByText("Uyga tarif")).toBeInTheDocument();
    expect(tariff).not.toHaveTextContent("standart narx");
  });

  it.each([
    ["ru", "Тариф", "Стандартная цена до дома", "Стандартная цена до центра"],
    ["en", "Tariff", "Standard price to the door", "Standard price to the centre"],
  ])("%s: market yorliqlari tarjima qilingan", async (language, title, home, center) => {
    await i18n.changeLanguage(language);
    try {
      renderView(makeUser("market"), "superadmin");
      const tariff = screen.getByRole("region", { name: title });
      expect(within(tariff).getByText(home)).toBeInTheDocument();
      expect(within(tariff).getByText(center)).toBeInTheDocument();
    } finally {
      await i18n.changeLanguage("uz");
    }
  });
});
