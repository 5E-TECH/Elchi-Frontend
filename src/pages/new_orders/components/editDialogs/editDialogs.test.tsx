import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../test/test-utils";
import { EditAddressDialog, EditCustomerDialog, EditOrderDialog, type EditDialogOrder } from ".";

/**
 * Buyurtma tafsilotining tahrirlash oynalari (dizayn v2): maket matnlari, maydon ostidagi xatolar,
 * payload (`newOrderUpdateRules.ts` — o'zgarmagan), yuklanish, natija/xato xabari.
 */

const mutations = vi.hoisted(() => ({
  updateNewOrder: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("../../../../entities/orders", () => ({
  useOrders: () => ({ updateNewOrder: { mutateAsync: mutations.updateNewOrder, isPending: false } }),
}));

vi.mock("../../../../entities/user/api/userApi", () => ({
  useUser: () => ({ updateUser: { mutateAsync: mutations.updateUser, isPending: false } }),
}));

const DISTRICTS: Record<string, { id: string; name: string }[]> = {
  r1: [
    { id: "d1", name: "Samarqand shahri" },
    { id: "d2", name: "Urgut tumani" },
  ],
  r2: [
    { id: "d3", name: "Chilonzor tumani" },
    { id: "d4", name: "Yunusobod tumani" },
  ],
};

vi.mock("../../../../entities/logistics/api/logisticsApi", () => ({
  useLogistics: () => ({
    useGetRegions: () => ({
      data: { data: [{ id: "r1", name: "Samarqand viloyati" }, { id: "r2", name: "Toshkent shahri" }] },
      isLoading: false,
    }),
    useGetDistricts: (regionId?: string) => ({
      data: regionId ? DISTRICTS[regionId] ?? [] : undefined,
      isLoading: false,
    }),
  }),
}));

const baseOrder: EditDialogOrder = {
  id: "10241",
  status: "new",
  where_deliver: "address",
  total_price: 1150000,
  comment: "Oldin qo'ng'iroq qiling, domofon ishlamaydi.",
  address: "Lutfiy ko'chasi, 14-uy, 32-xonadon",
  district_id: "d1",
  district: { id: "d1", name: "Samarqand shahri", region_id: "r1", region: { id: "r1", name: "Samarqand viloyati" } },
  customer: { id: "c1", name: "Dilnoza Karimova", phone_number: "+998901234567" },
  market: { id: "m1", name: "Baraka Shop" },
  items: [
    { id: "i1", quantity: 1, product: { id: "p1", name: "Smartfon A15, 128 GB" } },
    { id: "i2", quantity: 2, product: { id: "p2", name: "Himoya g'ilofi" } },
  ],
};

beforeEach(() => {
  mutations.updateNewOrder.mockReset().mockResolvedValue({ statusCode: 200 });
  mutations.updateUser.mockReset().mockResolvedValue({ statusCode: 200 });
});

afterEach(() => {
  vi.clearAllMocks();
});

const backendError = (message: string) => Object.assign(new Error(message), { response: { data: { message } } });

// ─── Manzil ──────────────────────────────────────────────────────────────────

describe("EditAddressDialog (maket *-orders-detail-edit-address-dialog)", () => {
  const renderAddress = (order: EditDialogOrder = baseOrder) => {
    const onClose = vi.fn();
    const onSaved = vi.fn();
    renderWithProviders(<EditAddressDialog open order={order} onClose={onClose} onSaved={onSaved} />);
    return { onClose, onSaved, dialog: screen.getByRole("dialog", { name: "Manzilni tahrirlash" }) };
  };

  it("sarlavha, «№ · mijoz» izohi, maydonlar joriy manzil bilan to'ldirilgan", () => {
    const { dialog } = renderAddress();
    expect(dialog).toHaveAccessibleDescription("№10241 · Dilnoza Karimova");
    expect(within(dialog).getByRole("combobox", { name: /^Viloyat/ })).toHaveTextContent("Samarqand viloyati");
    expect(within(dialog).getByRole("combobox", { name: /^Tuman/ })).toHaveTextContent("Samarqand shahri");
    expect(within(dialog).getByLabelText("To'liq manzil")).toHaveValue("Lutfiy ko'chasi, 14-uy, 32-xonadon");
    expect(within(dialog).getByLabelText("To'liq manzil")).toHaveAttribute("placeholder", "Manzilni kiriting");
    expect(within(dialog).getByRole("button", { name: "Bekor qilish" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Saqlash" })).toHaveAttribute("type", "submit");
  });

  it("viloyat almashsa tuman bo'shaydi va «qayta tanlang» ko'rsatmasi chiqadi; tumansiz saqlanmaydi", async () => {
    const user = userEvent.setup();
    const { onClose } = renderAddress();

    await user.click(screen.getByRole("combobox", { name: /^Viloyat/ }));
    await user.click(await screen.findByRole("option", { name: "Toshkent shahri" }));

    const district = screen.getByRole("combobox", { name: /^Tuman/ });
    expect(district).toHaveTextContent("Tumanni tanlang");
    expect(screen.getByText("Viloyat o'zgargani uchun tumanni qayta tanlang.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Saqlash" }));
    expect(district).toHaveAttribute("aria-invalid", "true");
    expect(district).toHaveAccessibleErrorMessage("Tumanni tanlang");
    expect(district).toHaveFocus();
    expect(mutations.updateNewOrder).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("yangi viloyat/tuman/manzil — PATCH /orders/:id/full faqat o'zgarganlar bilan, xabar va yopilish", async () => {
    const user = userEvent.setup();
    const { onClose, onSaved } = renderAddress();

    await user.click(screen.getByRole("combobox", { name: /^Viloyat/ }));
    await user.click(await screen.findByRole("option", { name: "Toshkent shahri" }));
    await user.click(screen.getByRole("combobox", { name: /^Tuman/ }));
    await user.click(await screen.findByRole("option", { name: "Yunusobod tumani" }));
    const address = screen.getByLabelText("To'liq manzil");
    await user.clear(address);
    await user.type(address, "Amir Temur ko'chasi, 5");
    await user.click(screen.getByRole("button", { name: "Saqlash" }));

    expect(mutations.updateNewOrder).toHaveBeenCalledWith({
      orderId: "10241",
      data: { region_id: "r2", district_id: "d4", address: "Amir Temur ko'chasi, 5" },
    });
    expect(await screen.findByText("Manzil saqlandi")).toBeInTheDocument();
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("hech narsa o'zgarmagan — so'rovsiz yopiladi", async () => {
    const user = userEvent.setup();
    const { onClose, onSaved } = renderAddress();
    await user.click(screen.getByRole("button", { name: "Saqlash" }));
    expect(mutations.updateNewOrder).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("server rad etsa — xato xabari (backend matni), oyna ochiq qoladi", async () => {
    const user = userEvent.setup();
    mutations.updateNewOrder.mockRejectedValueOnce(backendError("Bu tumanga yetkazib berilmaydi"));
    const { onClose } = renderAddress();

    await user.click(screen.getByRole("combobox", { name: /^Tuman/ }));
    await user.click(await screen.findByRole("option", { name: "Urgut tumani" }));
    await user.click(screen.getByRole("button", { name: "Saqlash" }));

    expect(await screen.findByText("Bu tumanga yetkazib berilmaydi")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Manzilni tahrirlash" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Saqlash" })).not.toHaveAttribute("aria-busy");
  });

  it("so'rov ketayotganda «Saqlash» yuklanmoqda, «Bekor qilish» o'chiq, Esc yopmaydi", async () => {
    const user = userEvent.setup();
    let resolve: (value: unknown) => void = () => undefined;
    mutations.updateNewOrder.mockImplementationOnce(() => new Promise((done) => (resolve = done)));
    const { onClose } = renderAddress();

    await user.click(screen.getByRole("combobox", { name: /^Tuman/ }));
    await user.click(await screen.findByRole("option", { name: "Urgut tumani" }));
    await user.click(screen.getByRole("button", { name: "Saqlash" }));

    expect(screen.getByRole("button", { name: "Saqlash" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Bekor qilish" })).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();

    resolve({ statusCode: 200 });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("filialga jo'natilgan buyurtma — maydonlar qulf, sababi ko'rinadi, so'rov ketmaydi", async () => {
    const user = userEvent.setup();
    renderAddress({ ...baseOrder, status: "on the road" });
    expect(
      screen.getByText("Filialga jo'natilgandan keyin mijoz va manzilni o'zgartirib bo'lmaydi."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("To'liq manzil")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Saqlash" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Saqlash" }));
    expect(mutations.updateNewOrder).not.toHaveBeenCalled();
  });
});

// ─── Mijoz ───────────────────────────────────────────────────────────────────

describe("EditCustomerDialog (maket *-orders-detail-edit-customer-dialog)", () => {
  const renderCustomer = (order: EditDialogOrder = baseOrder) => {
    const onClose = vi.fn();
    renderWithProviders(<EditCustomerDialog open order={order} onClose={onClose} />);
    return { onClose, dialog: screen.getByRole("dialog", { name: "Mijoz ma'lumotini tahrirlash" }) };
  };

  it("izoh «№ · market», ism va telefon (+998 alohida), profil eslatmasi", () => {
    const { dialog } = renderCustomer();
    expect(dialog).toHaveAccessibleDescription("№10241 · Baraka Shop");
    expect(within(dialog).getByLabelText(/^Ism/)).toHaveValue("Dilnoza Karimova");
    expect(within(dialog).getByLabelText(/^Ism/)).toHaveAttribute("placeholder", "Mijoz ismi");
    expect(within(dialog).getByLabelText(/^Telefon/)).toHaveValue("90 123 45 67");
    expect(dialog).toHaveTextContent("+998");
    expect(
      within(dialog).getByText("O'zgarish mijoz profiliga saqlanadi va uning barcha buyurtmalarida ko'rinadi."),
    ).toBeInTheDocument();
  });

  it("market nomi bo'lmasa izohda faqat raqam", () => {
    const { dialog } = renderCustomer({ ...baseOrder, market: null });
    expect(dialog).toHaveAccessibleDescription("№10241");
  });

  it.each([
    ["", "901234567", "Mijoz ismini kiriting", /^Ism/],
    ["Dilnoza", "", "Mijozning telefon raqamini kiriting", /^Telefon/],
    ["Dilnoza", "90123", "Telefon raqam 9 ta raqamdan iborat bo'lishi kerak", /^Telefon/],
  ])("tekshiruv: ism %j, telefon %j → «%s» maydon ostida", async (name, phone, message, field) => {
    const user = userEvent.setup();
    renderCustomer();
    const nameInput = screen.getByLabelText(/^Ism/);
    const phoneInput = screen.getByLabelText(/^Telefon/);
    await user.clear(nameInput);
    if (name) await user.type(nameInput, name);
    await user.clear(phoneInput);
    if (phone) await user.type(phoneInput, phone);

    await user.click(screen.getByRole("button", { name: "Saqlash" }));
    const control = screen.getByLabelText(field);
    expect(control).toHaveAttribute("aria-invalid", "true");
    expect(control).toHaveAccessibleErrorMessage(message);
    expect(control).toHaveFocus();
    expect(mutations.updateUser).not.toHaveBeenCalled();
  });

  it("yangi telefon — PATCH /users/:id, buyurtmalar keshi yangilanadi, xabar va yopilish", async () => {
    const user = userEvent.setup();
    const { onClose } = renderCustomer();
    const phone = screen.getByLabelText(/^Telefon/);
    await user.clear(phone);
    await user.type(phone, "911112233");
    await user.click(screen.getByRole("button", { name: "Saqlash" }));

    expect(mutations.updateUser).toHaveBeenCalledWith({ id: "c1", data: { phone_number: "+998911112233" } });
    expect(await screen.findByText("Mijoz ma'lumoti saqlandi")).toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("server xatosi (matnsiz) — sukut matni «Ma'lumotlarni yangilab bo'lmadi.», oyna ochiq", async () => {
    const user = userEvent.setup();
    mutations.updateUser.mockRejectedValueOnce({});
    const { onClose } = renderCustomer();
    const name = screen.getByLabelText(/^Ism/);
    await user.type(name, "a");
    await user.click(screen.getByRole("button", { name: "Saqlash" }));
    expect(await screen.findByText("Ma'lumotlarni yangilab bo'lmadi.")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});

// ─── Buyurtma ────────────────────────────────────────────────────────────────

describe("EditOrderDialog (maket *-orders-detail-edit-order-dialog, manager-…-edit-products-dialog)", () => {
  const renderOrder = (order: EditDialogOrder = baseOrder) => {
    const onClose = vi.fn();
    renderWithProviders(<EditOrderDialog open order={order} onClose={onClose} />);
    return { onClose, dialog: screen.getByRole("dialog", { name: "Buyurtmani tahrirlash" }) };
  };

  it("mahsulot qatorlari, yetkazish turi «Uygacha», summa «so'm» bilan, izoh", () => {
    const { dialog } = renderOrder();
    expect(dialog).toHaveAccessibleDescription("№10241 · Dilnoza Karimova");
    const list = within(dialog).getByRole("list", { name: "Mahsulotlar" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(within(list).getByRole("group", { name: "Smartfon A15, 128 GB soni" })).toHaveTextContent("1");
    expect(within(list).getByRole("button", { name: "Smartfon A15, 128 GB sonini kamaytirish" })).toBeDisabled();
    expect(within(list).getByRole("button", { name: "Himoya g'ilofi sonini kamaytirish" })).toBeEnabled();
    expect(within(list).getByRole("button", { name: "Himoya g'ilofi ni olib tashlash" })).toHaveAttribute(
      "data-variant",
      "danger-soft",
    );
    expect(within(dialog).getByRole("combobox", { name: "Yetkazish turi" })).toHaveTextContent("Uygacha");
    expect(within(dialog).getByLabelText(/^Umumiy summa/)).toHaveValue("1 150 000");
    expect(within(dialog).getByText("so'm")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Izoh")).toHaveValue("Oldin qo'ng'iroq qiling, domofon ishlamaydi.");
    expect(within(dialog).getByLabelText("Izoh")).toHaveAttribute("placeholder", "Izoh kiriting...");
  });

  it("⭐ total_price \"150000.00\" (satr) — maydonda 150 000, 15 000 000 emas; tegilmasa yuborilmaydi", async () => {
    const user = userEvent.setup();
    const { onClose } = renderOrder({ ...baseOrder, total_price: "150000.00" as unknown as number });
    expect(screen.getByLabelText(/^Umumiy summa/)).toHaveValue("150 000");
    await user.click(screen.getByRole("button", { name: "Saqlash" }));
    expect(mutations.updateNewOrder).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("son o'zgartirish, olib tashlash, izoh — faqat o'zgarganlar yuboriladi", async () => {
    const user = userEvent.setup();
    const { onClose } = renderOrder();

    await user.click(screen.getByRole("button", { name: "Smartfon A15, 128 GB sonini oshirish" }));
    expect(screen.getByRole("group", { name: "Smartfon A15, 128 GB soni" })).toHaveTextContent("2");
    await user.click(screen.getByRole("button", { name: "Himoya g'ilofi ni olib tashlash" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    const note = screen.getByLabelText("Izoh");
    await user.clear(note);
    await user.type(note, "Domofon 32");
    await user.click(screen.getByRole("button", { name: "Saqlash" }));

    expect(mutations.updateNewOrder).toHaveBeenCalledWith({
      orderId: "10241",
      data: { comment: "Domofon 32", items: [{ product_id: "p1", quantity: 2 }] },
    });
    expect(await screen.findByText("Buyurtma saqlandi")).toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("yetkazish turi va summa o'zgarsa — where_deliver va total_price (son) yuboriladi", async () => {
    const user = userEvent.setup();
    renderOrder();
    await user.click(screen.getByRole("combobox", { name: "Yetkazish turi" }));
    await user.click(await screen.findByRole("option", { name: "Markazgacha" }));
    const total = screen.getByLabelText(/^Umumiy summa/);
    await user.clear(total);
    await user.type(total, "990000");
    expect(total).toHaveValue("990 000");
    await user.click(screen.getByRole("button", { name: "Saqlash" }));

    expect(mutations.updateNewOrder).toHaveBeenCalledWith({
      orderId: "10241",
      data: { where_deliver: "center", total_price: 990000 },
    });
  });

  it("summa bo'sh — maydon ostida xato, so'rov ketmaydi", async () => {
    const user = userEvent.setup();
    renderOrder();
    const total = screen.getByLabelText(/^Umumiy summa/);
    await user.clear(total);
    await user.click(screen.getByRole("button", { name: "Saqlash" }));
    expect(total).toHaveAccessibleErrorMessage("Summani raqam bilan kiriting. Summa 0 bo'lsa, 0 kiriting.");
    expect(total).toHaveFocus();
    expect(mutations.updateNewOrder).not.toHaveBeenCalled();
  });

  it("hamma mahsulot olib tashlansa — «Ro'yxatda mahsulot qolmadi.»", async () => {
    const user = userEvent.setup();
    renderOrder();
    await user.click(screen.getByRole("button", { name: "Smartfon A15, 128 GB ni olib tashlash" }));
    // Fokus keyingi qatorning «olib tashlash» tugmasiga o'tadi.
    expect(screen.getByRole("button", { name: "Himoya g'ilofi ni olib tashlash" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Himoya g'ilofi ni olib tashlash" }));
    // Oxirgi qator ketdi — fokus `body` ga tushmaydi, bo'sh ro'yxat xabarida (oyna ichida) qoladi.
    expect(screen.getByText("Ro'yxatda mahsulot qolmadi.")).toHaveFocus();
  });

  it("katalogsiz mahsulot nomi (product: null) qatorda ko'rinadi", () => {
    renderOrder({
      ...baseOrder,
      items: [{ id: "x1", quantity: 1, product: null, product_id: null, product_name: "Avto changyutgich" }],
    });
    expect(screen.getByRole("group", { name: "Avto changyutgich soni" })).toBeInTheDocument();
  });

  it("filialga jo'natilgan (batch_id) — yetkazish turi qulf va sababi ostida, payload'da yo'q", async () => {
    const user = userEvent.setup();
    renderOrder({ ...baseOrder, batch_id: "b1" });
    const delivery = screen.getByRole("combobox", { name: "Yetkazish turi" });
    expect(delivery).toHaveAccessibleDescription(
      "Filialga jo'natilgandan keyin mijoz va manzilni o'zgartirib bo'lmaydi.",
    );
    const note = screen.getByLabelText("Izoh");
    await user.type(note, "!");
    await user.click(screen.getByRole("button", { name: "Saqlash" }));
    expect(mutations.updateNewOrder).toHaveBeenCalledWith({
      orderId: "10241",
      data: { comment: "Oldin qo'ng'iroq qiling, domofon ishlamaydi.!" },
    });
  });

  it("HQ qabul qilgan — mahsulotlar faqat o'qish uchun, summa qulf (sababi bilan)", () => {
    renderOrder({ ...baseOrder, status: "received" });
    expect(screen.queryByRole("button", { name: /sonini oshirish/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole("listitem")[1]).toHaveTextContent("2 ta");
    const total = screen.getByLabelText(/^Umumiy summa/);
    expect(total).toBeDisabled();
    expect(total).toHaveAccessibleDescription(
      "HQ qabul qilgandan keyin summa va mahsulotlarni o'zgartirib bo'lmaydi.",
    );
  });
});

// ─── Sessiya ─────────────────────────────────────────────────────────────────

describe("Tahrirlash oynalari — har ochilishda forma qaytadan", () => {
  const Harness = () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Ochish
        </button>
        <EditOrderDialog open={open} order={baseOrder} onClose={() => setOpen(false)} />
      </>
    );
  };

  it("birinchi ochilishgacha oyna yo'q; bekor qilingan o'zgarish qayta ochilganda qolmaydi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ochish" }));
    await user.click(screen.getByRole("button", { name: "Himoya g'ilofi sonini oshirish" }));
    expect(screen.getByRole("group", { name: "Himoya g'ilofi soni" })).toHaveTextContent("3");
    await user.click(screen.getByRole("button", { name: "Bekor qilish" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Ochish" }));
    expect(screen.getByRole("group", { name: "Himoya g'ilofi soni" })).toHaveTextContent("2");
  });
});
