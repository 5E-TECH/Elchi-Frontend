import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/test-utils";
import enLocale from "../../locales/en/marketOperators.json";
import MarketOperatorsPage from "./index";

/**
 * «Operatorlar» (MO-1, maketlar `market-operators-list`, `-empty`, `-create-dialog`, `-commission-dialog`,
 * `-commission-fixed-dialog`, `-delete-dialog`) — haqiqiy UI orqali: ro'yxat va komissiya matni, ogohlantirish va
 * «Faqat ularni ko'rsatish», bo'sh holat, qo'shish (POST faqat 3 maydon → PATCH komissiya; 409; PATCH yiqilsa
 * «Belgilash»), Komissiya oynasi (chegara xatosi, saqlash, olib tashlash tasdig'i) va o'chirish tasdig'i.
 * `notify` / `confirm` mock qilinmaydi.
 */

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));
vi.mock("../../shared/api/api", () => ({ api }));

const OPERATORS = [
  { id: "41", name: "Madina Xoliqova", phone_number: "+998902143658", status: "active", commission_type: "percent", commission_value: "5.00", createdAt: "2026-08-12T10:15:00+05:00" },
  { id: "42", name: "Sevara Usmonova", phone_number: "+998935071244", status: "active", commission_type: "fixed", commission_value: 3000, createdAt: "2026-08-20T16:40:00+05:00" },
  { id: "43", name: "Kamola Rasulova", phone_number: "+998916402713", status: "inactive", commission_type: "percent", commission_value: 3.5, createdAt: "2026-09-15T11:30:00+05:00" },
  { id: "44", name: "Dilfuza Qodirova", phone_number: "+998941187032", status: "active", commission_type: null, commission_value: null, createdAt: "2026-10-20T17:20:00+05:00" },
  { id: "45", name: "Nodira Aliyeva", phone_number: "+998974551820", status: "active", commission_type: null, commission_value: null, createdAt: "2026-10-21T09:40:00+05:00" },
];

let rows: unknown[] = OPERATORS;

const listResponse = (config?: { params?: Record<string, unknown> }) => {
  const { status, search } = config?.params ?? {};
  const page = Number(config?.params?.page ?? 1);
  const limit = Number(config?.params?.limit ?? 20);
  const matched = (rows as { status: string; name: string }[]).filter(
    (row) => (!status || row.status === status) && (!search || row.name.includes(String(search))),
  );
  return Promise.resolve({
    data: {
      statusCode: 200,
      data: {
        items: matched.slice((page - 1) * limit, page * limit),
        meta: { page, limit, total: matched.length, totalPages: Math.max(1, Math.ceil(matched.length / limit)) },
      },
    },
  });
};

const axiosError = (status: number, message = "QueryFailedError: duplicate key") =>
  Object.assign(new Error(message), { isAxiosError: true, response: { status, data: { message } } });

const marketState = {
  role: { id: "12", role: "market", region: null, name: "Baraka Shop" },
  user: { user: { id: "12", name: "Baraka Shop", role: "market" } },
} as never;

const renderPage = (preloadedState = marketState) =>
  renderWithProviders(<MarketOperatorsPage />, { route: "/market-operators", preloadedState });

const openRowMenu = async (user: ReturnType<typeof userEvent.setup>, name: string, item: string) => {
  const label = `${name} amallari`;
  await user.click((await screen.findAllByRole("button", { name: label }))[0]);
  const menu = await screen.findByRole("menu", { name: label });
  await user.click(within(menu).getByRole("menuitem", { name: item }));
};

beforeEach(() => {
  rows = OPERATORS;
  api.get.mockReset().mockImplementation((url: string, config?: { params?: Record<string, unknown> }) =>
    url === "market-operators" ? listResponse(config) : Promise.resolve({ data: {} }),
  );
  api.post.mockReset().mockResolvedValue({
    data: { statusCode: 201, data: { id: "46", name: "Lola Karimova", phone_number: "+998901234567", status: "active", commission_type: null, commission_value: null } },
  });
  api.patch.mockReset().mockResolvedValue({ data: { statusCode: 200, data: {} } });
  api.delete.mockReset().mockResolvedValue({ data: { statusCode: 200, data: { id: "41" } } });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("MarketOperatorsPage — ro'yxat", () => {
  it("sarlavha, market nomi, ustunlar, komissiya matni, holat va «N ta operator»", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "Operatorlar" })).toBeInTheDocument();
    expect(screen.getByText("Baraka Shop nomidan buyurtma yaratadigan xodimlar va ularning komissiyasi")).toBeInTheDocument();
    const table = await screen.findByRole("table", { name: "Operatorlar ro'yxati" });
    for (const header of ["Operator", "Telefon", "Komissiya", "Holat", "Qo'shilgan"]) {
      expect(within(table).getByRole("columnheader", { name: header })).toBeInTheDocument();
    }
    const madina = within(table).getByText("Madina Xoliqova").closest("tr")!;
    expect(madina).toHaveTextContent("+998 90 214 36 58");
    expect(madina).toHaveTextContent("5%");
    expect(madina).toHaveTextContent("Foiz · buyurtma narxidan");
    expect(madina).toHaveTextContent("Faol");
    const sevara = within(table).getByText("Sevara Usmonova").closest("tr")!;
    expect(sevara).toHaveTextContent("3 000 so'm");
    expect(sevara).toHaveTextContent("Qat'iy · har sotilgan buyurtma");
    const kamola = within(table).getByText("Kamola Rasulova").closest("tr")!;
    expect(kamola).toHaveTextContent("3,5%");
    expect(kamola).toHaveTextContent("Nofaol");
    expect(kamola).toHaveTextContent("Tizimga kira olmaydi");
    const dilfuza = within(table).getByText("Dilfuza Qodirova").closest("tr")!;
    expect(dilfuza).toHaveTextContent("Belgilanmagan");
    expect(dilfuza).toHaveTextContent("Daromad yozilmaydi");
    expect(screen.getByText("5 ta operator")).toBeInTheDocument();

    // So'rov: faqat sahifa va hajm — market_id yuborilmaydi (serverda JWT sub).
    expect(api.get).toHaveBeenCalledWith("market-operators", { params: { page: 1, limit: 20 } });
    // «Nofaol qilish» (MO-4) — chizilmaydi.
    await openRowMenu(userEvent.setup(), "Madina Xoliqova", "Komissiyani o'zgartirish");
    expect(screen.queryByRole("menuitem", { name: "Nofaol qilish" })).not.toBeInTheDocument();
  });

  it("2+ komissiyasiz: ogohlantirish ismlar bilan, «Faqat ularni ko'rsatish» ↔ «Hammasini ko'rsatish»", async () => {
    const user = userEvent.setup();
    renderPage();

    const alert = await screen.findByText("2 ta operatorda komissiya belgilanmagan — daromad yozilmaydi");
    expect(alert.parentElement).toHaveTextContent(
      "Dilfuza Qodirova va Nodira Aliyeva sotgan buyurtmalar uchun daromad hisoblanmaydi. Har biriga komissiya belgilang.",
    );
    await user.click(screen.getByRole("button", { name: "Faqat ularni ko'rsatish" }));
    const table = screen.getByRole("table", { name: "Operatorlar ro'yxati" });
    await waitFor(() => expect(within(table).queryByText("Madina Xoliqova")).not.toBeInTheDocument());
    expect(within(table).getByText("Dilfuza Qodirova")).toBeInTheDocument();
    expect(within(table).getByText("Nodira Aliyeva")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Hammasini ko'rsatish" }));
    expect(await within(table).findByText("Madina Xoliqova")).toBeInTheDocument();
  });

  it("1 ta komissiyasiz (nofaol hisobga olinmaydi): «Belgilash» shu operatorning Komissiya oynasini ochadi", async () => {
    rows = [OPERATORS[0], { ...OPERATORS[2], commission_type: null, commission_value: null }, OPERATORS[3]];
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("Komissiya belgilanmagan — daromad yozilmaydi")).toBeInTheDocument();
    expect(screen.getByText(/Dilfuza Qodirova sotgan buyurtmalar uchun/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Belgilash" }));
    const dialog = await screen.findByRole("dialog", { name: "Komissiya" });
    expect(dialog).toHaveTextContent("Dilfuza Qodirova · +998 94 118 70 32");
    expect(dialog).toHaveTextContent("Hozir bu operatorning sotuvlari uchun daromad hisoblanmaydi.");
  });

  it("«Holat» filtri — status so'rovga qo'shiladi; topilmasa «Filtrlarni tozalash»", async () => {
    rows = [OPERATORS[0]];
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Madina Xoliqova");

    await user.click(screen.getByRole("combobox", { name: /Holat/ }));
    await user.click(await screen.findByRole("option", { name: "Nofaol" }));
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith("market-operators", { params: { page: 1, limit: 20, status: "inactive" } }),
    );
    expect(await screen.findByText("Operator topilmadi")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Filtrlarni tozalash" }));
    expect(await screen.findByText("Madina Xoliqova")).toBeInTheDocument();
  });

  it("bo'sh: «Hali operator yo'q», sarlavhada tugma va filtrlar yo'q; tugma qo'shish oynasini ochadi", async () => {
    rows = [];
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("Hali operator yo'q")).toBeInTheDocument();
    expect(screen.getByText(/Operator Baraka Shop nomidan buyurtma yaratadi/)).toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    const buttons = screen.getAllByRole("button", { name: "Operator qo'shish" });
    expect(buttons).toHaveLength(1);
    await user.click(buttons[0]);
    expect(await screen.findByRole("dialog", { name: "Operator qo'shish" })).toHaveTextContent("Baraka Shop uchun yangi xodim");
  });
});

describe("MarketOperatorsPage — «Ombordagi qoldiqni ko'radi» kaliti (XtcEyQjb)", () => {
  const withAccess = () => {
    rows = OPERATORS.map((row) => ({ ...row, can_view_warehouse_stock: row.id === "42" }));
  };
  const switchOf = (name: string) => screen.getByRole("switch", { name: `${name} — ombordagi qoldiqni ko'radi` });

  it("ustun va kalit holati qatordan (sukut — o'chiq)", async () => {
    withAccess();
    renderPage();
    const table = await screen.findByRole("table", { name: "Operatorlar ro'yxati" });
    expect(within(table).getByRole("columnheader", { name: "Ombordagi qoldiq" })).toBeInTheDocument();
    expect(switchOf("Sevara Usmonova")).toHaveAttribute("aria-checked", "true");
    expect(switchOf("Madina Xoliqova")).toHaveAttribute("aria-checked", "false");
  });

  it("yoqish — PATCH :id/warehouse-access; optimistik emas: javobgacha eski holat, so'ng yangi + xabar", async () => {
    withAccess();
    let resolve: (value: unknown) => void = () => {};
    api.patch.mockImplementationOnce(() => new Promise((done) => (resolve = done)));
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("table", { name: "Operatorlar ro'yxati" });
    await user.click(switchOf("Madina Xoliqova"));
    expect(api.patch).toHaveBeenCalledWith("market-operators/41/warehouse-access", { can_view_warehouse_stock: true });
    // Server javobigacha — eski holat, kalit band.
    expect(switchOf("Madina Xoliqova")).toHaveAttribute("aria-checked", "false");
    expect(switchOf("Madina Xoliqova")).toBeDisabled();

    rows = (rows as { id: string }[]).map((row) => (row.id === "41" ? { ...row, can_view_warehouse_stock: true } : row));
    resolve({ data: { statusCode: 200, data: { ...OPERATORS[0], can_view_warehouse_stock: true } } });
    await waitFor(() => expect(switchOf("Madina Xoliqova")).toHaveAttribute("aria-checked", "true"));
    expect(await screen.findByText("Ombordagi qoldiq ochildi")).toBeInTheDocument();
  });

  it("xato — kalit qaytadi (o'zgarmaydi) va i18n xabar, xom backend matni yo'q", async () => {
    withAccess();
    api.patch.mockRejectedValueOnce(axiosError(500, "QueryFailedError: boom"));
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("table", { name: "Operatorlar ro'yxati" });
    await user.click(switchOf("Sevara Usmonova"));
    expect(api.patch).toHaveBeenCalledWith("market-operators/42/warehouse-access", { can_view_warehouse_stock: false });
    expect(await screen.findByText("Kalit saqlanmadi")).toBeInTheDocument();
    expect(screen.getByText("Kalit avvalgi holatida qoldi. Qayta urinib ko'ring.")).toBeInTheDocument();
    expect(screen.queryByText(/QueryFailedError/)).not.toBeInTheDocument();
    await waitFor(() => expect(switchOf("Sevara Usmonova")).not.toBeDisabled());
    expect(switchOf("Sevara Usmonova")).toHaveAttribute("aria-checked", "true");
  });

  it("404 — «Operator topilmadi — ro'yxat yangilandi.»", async () => {
    withAccess();
    api.patch.mockRejectedValueOnce(axiosError(404, "Operator not found"));
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("table", { name: "Operatorlar ro'yxati" });
    const before = api.get.mock.calls.length;
    await user.click(switchOf("Madina Xoliqova"));
    expect(await screen.findByText("Operator topilmadi — ro'yxat yangilandi.")).toBeInTheDocument();
    await waitFor(() => expect(api.get.mock.calls.length).toBeGreaterThan(before));
  });
});

describe("MarketOperatorsPage — operator qo'shish", () => {
  const fill = async (user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement) => {
    await user.type(within(dialog).getByLabelText(/Ism familiya/), "Lola Karimova");
    await user.type(within(dialog).getByLabelText(/Telefon/), "901234567");
    await user.type(within(dialog).getByLabelText(/^Parol/, { selector: "input" }), "lola25");
  };

  it("POST faqat 3 maydon, so'ng PATCH komissiya (qat'iy summa); xabar «Operator qo'shildi»", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Operator qo'shish" }));
    const dialog = await screen.findByRole("dialog", { name: "Operator qo'shish" });
    await fill(user, dialog);
    await user.click(within(dialog).getByRole("radio", { name: "Qat'iy summa" }));
    await user.type(within(dialog).getByLabelText(/Komissiya/, { selector: "input" }), "5 000");
    await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith("market-operators/46/commission", {
        commission_type: "fixed",
        commission_value: 5000,
      }),
    );
    expect(api.post).toHaveBeenCalledWith("market-operators", {
      name: "Lola Karimova",
      phone_number: "+998901234567",
      password: "lola25",
    });
    expect(await screen.findByText("Operator qo'shildi")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Operator qo'shish" })).not.toBeInTheDocument());
  });

  it("komissiyasiz — PATCH yo'q; mijoz tekshiruvi (bo'sh forma) so'rov yubormaydi", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Operator qo'shish" }));
    const dialog = await screen.findByRole("dialog", { name: "Operator qo'shish" });
    await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }));
    expect(await within(dialog).findByText("Ism familiyani kiriting")).toBeInTheDocument();
    expect(within(dialog).getByText("Telefon raqamni to'liq kiriting")).toBeInTheDocument();
    expect(within(dialog).getByText("Parolni kiriting")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();

    await fill(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.patch).not.toHaveBeenCalled();
  });

  it("409 — telefon maydonida «Bu telefon raqam band», oyna ochiq, xom matn yo'q", async () => {
    api.post.mockRejectedValueOnce(axiosError(409));
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Operator qo'shish" }));
    const dialog = await screen.findByRole("dialog", { name: "Operator qo'shish" });
    await fill(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }));

    expect(await within(dialog).findByText("Bu telefon raqam band — boshqa raqam kiriting")).toBeInTheDocument();
    expect(screen.queryByText(/QueryFailedError/)).not.toBeInTheDocument();
    expect(api.patch).not.toHaveBeenCalled();
  });

  it("PATCH yiqilsa — «Operator qo'shildi, komissiya saqlanmadi» + «Belgilash» Komissiya oynasini ochadi", async () => {
    api.patch.mockRejectedValueOnce(axiosError(500));
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Operator qo'shish" }));
    const dialog = await screen.findByRole("dialog", { name: "Operator qo'shish" });
    await fill(user, dialog);
    await user.type(within(dialog).getByLabelText(/Komissiya/, { selector: "input" }), "4");
    await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }));

    expect(await screen.findByText("Operator qo'shildi, komissiya saqlanmadi")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Belgilash" }));
    const commission = await screen.findByRole("dialog", { name: "Komissiya" });
    expect(commission).toHaveTextContent("Lola Karimova");
  });
});

describe("MarketOperatorsPage — komissiya va o'chirish", () => {
  it("qat'iy summa > 1 000 000 — maydon xatosi, PATCH yo'q; to'g'ri qiymat — PATCH va xabar", async () => {
    const user = userEvent.setup();
    renderPage();
    await openRowMenu(user, "Sevara Usmonova", "Komissiyani o'zgartirish");
    const dialog = await screen.findByRole("dialog", { name: "Komissiya" });
    expect(dialog).toHaveTextContent("Hozirgi stavka");
    expect(dialog).toHaveTextContent("3 000 so'm · qat'iy");
    expect(dialog).toHaveTextContent("Qanday hisoblanadi");
    const input = within(dialog).getByLabelText(/Summa/);
    // Mingliklar bo'sh joy bilan (maket «1 500 000»); izoh «Yangi stavka …» qat'iyda yo'q (maket).
    expect(input).toHaveValue("3 000");
    expect(dialog).not.toHaveTextContent("Yangi stavka faqat keyingi sotuvlarga");
    expect(within(dialog).getByText("250 000 so'mlik")).toHaveClass("whitespace-nowrap");
    expect(within(dialog).getByText("900 000 so'mlik")).toHaveClass("whitespace-nowrap");

    await user.clear(input);
    await user.type(input, "1 500 000");
    await user.click(within(dialog).getByRole("button", { name: "Saqlash" }));
    expect(await within(dialog).findByText("Qat'iy komissiya 1 000 000 so'mdan oshmasin")).toBeInTheDocument();
    expect(api.patch).not.toHaveBeenCalled();

    await user.clear(input);
    await user.type(input, "4500");
    await user.click(within(dialog).getByRole("button", { name: "Saqlash" }));
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith("market-operators/42/commission", {
        commission_type: "fixed",
        commission_value: 4500,
      }),
    );
    expect(await screen.findByText("Komissiya saqlandi")).toBeInTheDocument();
  });

  it("foiz: «Namuna» hisoblanadi; belgilanmagan operatorda «Komissiyani olib tashlash» yo'q", async () => {
    const user = userEvent.setup();
    renderPage();
    await openRowMenu(user, "Nodira Aliyeva", "Komissiya belgilash");
    const dialog = await screen.findByRole("dialog", { name: "Komissiya" });
    expect(within(dialog).queryByRole("button", { name: "Komissiyani olib tashlash" })).not.toBeInTheDocument();
    // Qiymat yo'q — «— —» emas, ko'rsatma.
    expect(dialog).toHaveTextContent("250 000 so'mlik sotilgan buyurtmadan — foizni kiriting");
    expect(dialog).not.toHaveTextContent("— —");
    expect(dialog).toHaveTextContent("Yangi stavka faqat keyingi sotuvlarga qo'llanadi");
    await user.type(within(dialog).getByLabelText(/^Foiz/), "4");
    expect(dialog).toHaveTextContent("250 000 so'mlik sotilgan buyurtmadan — 10 000 so'm");
    expect(within(dialog).getByText("250 000 so'mlik")).toHaveClass("whitespace-nowrap");
    expect(within(dialog).getByText("10 000 so'm")).toHaveClass("whitespace-nowrap", "font-semibold");
    await user.click(within(dialog).getByRole("button", { name: "Saqlash" }));
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith("market-operators/45/commission", {
        commission_type: "percent",
        commission_value: 4,
      }),
    );
  });

  it("«Komissiyani olib tashlash» — tasdiq (danger) → PATCH null", async () => {
    const user = userEvent.setup();
    renderPage();
    await openRowMenu(user, "Madina Xoliqova", "Komissiyani o'zgartirish");
    const dialog = await screen.findByRole("dialog", { name: "Komissiya" });
    await user.click(within(dialog).getByRole("button", { name: "Komissiyani olib tashlash" }));
    const confirm = await screen.findByRole("alertdialog", { name: "Komissiyani olib tashlaysizmi?" });
    expect(confirm).toHaveTextContent("Keyingi sotuvlari uchun daromad yozilmaydi. Avvalgi daromadlar saqlanadi.");
    await user.click(within(confirm).getByRole("button", { name: "Olib tashlash" }));
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith("market-operators/41/commission", {
        commission_type: null,
        commission_value: null,
      }),
    );
    expect(await screen.findByText("Komissiya olib tashlandi")).toBeInTheDocument();
  });

  it("o'chirish — tasdiq oynasi (ob'ekt kartasi, izoh) → DELETE; xato — i18n matn", async () => {
    api.delete.mockRejectedValueOnce(axiosError(500, "relation users does not exist"));
    const user = userEvent.setup();
    renderPage();
    await openRowMenu(user, "Kamola Rasulova", "O'chirish");
    const dialog = await screen.findByRole("alertdialog", { name: "Operatorni o'chirish" });
    expect(dialog).toHaveTextContent("«Kamola Rasulova» operatorini o'chirishni tasdiqlaysizmi?");
    expect(dialog).toHaveTextContent("Operator · +998 91 640 27 13");
    expect(dialog).toHaveTextContent("Komissiya: 3,5%");
    expect(dialog).toHaveTextContent("U tizimga boshqa kira olmaydi. Yaratgan buyurtmalari va daromad tarixi saqlanadi.");
    // Ob'ekt kartasi — ConfirmDialog'ning o'z kulrang bloki ichida, ikkinchi «karta ichida karta» yo'q.
    const card = within(dialog).getByText("Kamola Rasulova", { selector: "span" }).closest(".bg-sunken");
    expect(card).not.toBeNull();
    expect(card!.parentElement!.closest(".bg-sunken")).toBeNull();
    expect(card!.querySelectorAll(".bg-sunken")).toHaveLength(0);

    await user.click(within(dialog).getByRole("button", { name: "O'chirish" }));
    expect(await within(dialog).findByText("Operatorni o'chirib bo'lmadi. Qaytadan urinib ko'ring.")).toBeInTheDocument();
    expect(screen.queryByText(/relation users/)).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "O'chirish" }));
    await waitFor(() => expect(api.delete).toHaveBeenLastCalledWith("market-operators/43"));
    expect(await screen.findByText("Operator o'chirildi")).toBeInTheDocument();
  });
});

describe("MarketOperatorsPage — review tuzatishlari", () => {
  it("«Faqat ularni ko'rsatish»da pastki matn «2 / 5 ta operator»", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Faqat ularni ko'rsatish" }));
    expect(await screen.findByText("2 / 5 ta operator")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Hammasini ko'rsatish" }));
    expect(await screen.findByText("5 ta operator")).toBeInTheDocument();
  });

  it("market nomi yo'q — «Do'koningiz …» (Marketingiz emas)", async () => {
    rows = [];
    renderPage({ role: { id: "12", role: "market", region: null, name: null }, user: { user: { id: "12", name: "", role: "market" } } } as never);
    expect(await screen.findByText("Do'koningiz nomidan buyurtma yaratadigan xodimlar va ularning komissiyasi")).toBeInTheDocument();
    expect(await screen.findByText(/Operator do'koningiz nomidan buyurtma yaratadi/)).toBeInTheDocument();
    expect(screen.queryByText(/Marketingiz/)).not.toBeInTheDocument();
  });

  it("en matnlarda «» emas, “ ” qo'shtirnoq", () => {
    expect(JSON.stringify(enLocale)).not.toMatch(/[«»]/);
    expect(enLocale.deleteDialog.description).toBe("Delete the operator “{{name}}”?");
  });

  it("filtr almashganda eski bo'sh natija o'rniga skelet (noto'g'ri bo'sh holat chiqmaydi)", async () => {
    rows = [OPERATORS[0]];
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Madina Xoliqova");
    await user.click(screen.getByRole("combobox", { name: /Holat/ }));
    await user.click(await screen.findByRole("option", { name: "Nofaol" }));
    expect(await screen.findByText("Operator topilmadi")).toBeInTheDocument();

    let release: () => void = () => {};
    api.get.mockImplementationOnce(
      (_url: string, config?: { params?: Record<string, unknown> }) =>
        new Promise((resolve) => {
          release = () => resolve(listResponse(config));
        }),
    );
    await user.click(screen.getByRole("combobox", { name: /Holat/ }));
    await user.click(await screen.findByRole("option", { name: "Faol" }));
    await waitFor(() =>
      expect(api.get).toHaveBeenLastCalledWith("market-operators", { params: { page: 1, limit: 20, status: "active" } }),
    );
    expect(screen.queryByText("Operator topilmadi")).not.toBeInTheDocument();
    expect(screen.queryByText("Hali operator yo'q")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Operator qo'shish" })).toHaveLength(1);
    release();
    expect(await screen.findByText("Madina Xoliqova")).toBeInTheDocument();
  });

  it("ro'yxat yiqilsa — xato holati va «Qayta urinish» qayta so'raydi; xom matn yo'q", async () => {
    api.get.mockRejectedValueOnce(axiosError(500, "connect ECONNREFUSED identity"));
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Qayta urinish" }));
    expect(await screen.findByText("Madina Xoliqova")).toBeInTheDocument();
    expect(screen.queryByText(/ECONNREFUSED/)).not.toBeInTheDocument();
  });

  it("qidiruv — kechiktirib `search` bilan so'raydi, 1-sahifadan", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Madina Xoliqova");
    await user.type(screen.getByRole("searchbox", { name: "Operatorlarni qidirish" }), "Sevara");
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith("market-operators", { params: { page: 1, limit: 20, search: "Sevara" } }),
    );
    const table = screen.getByRole("table", { name: "Operatorlar ro'yxati" });
    await waitFor(() => expect(within(table).queryByText("Madina Xoliqova")).not.toBeInTheDocument());
    expect(within(table).getByText("Sevara Usmonova")).toBeInTheDocument();
  });

  it("oxirgi sahifadagi yagona operator o'chirilsa — mavjud oxirgi sahifaga qaytadi", async () => {
    rows = Array.from({ length: 21 }, (_, index) => ({
      ...OPERATORS[0],
      id: String(100 + index),
      name: `Operator ${String(index + 1).padStart(2, "0")}`,
    }));
    api.delete.mockImplementation((url: string) => {
      rows = (rows as { id: string }[]).filter((row) => `market-operators/${row.id}` !== url);
      return Promise.resolve({ data: { statusCode: 200, data: {} } });
    });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Operator 01");
    await user.click(screen.getAllByRole("button", { name: "Keyingi sahifa" })[0]);
    expect(await screen.findByText("Operator 21")).toBeInTheDocument();

    await openRowMenu(user, "Operator 21", "O'chirish");
    const dialog = await screen.findByRole("alertdialog", { name: "Operatorni o'chirish" });
    await user.click(within(dialog).getByRole("button", { name: "O'chirish" }));
    await waitFor(() =>
      expect(api.get).toHaveBeenLastCalledWith("market-operators", { params: { page: 1, limit: 20 } }),
    );
    expect(await screen.findByText("Operator 01")).toBeInTheDocument();
  });

  it("o'chirilgach fokus «Operator qo'shish» tugmasida (menyu tugmasi yo'qolgan)", async () => {
    api.delete.mockImplementation((url: string) => {
      rows = (rows as { id: string }[]).filter((row) => `market-operators/${row.id}` !== url);
      return Promise.resolve({ data: { statusCode: 200, data: {} } });
    });
    const user = userEvent.setup();
    renderPage();
    await openRowMenu(user, "Kamola Rasulova", "O'chirish");
    const dialog = await screen.findByRole("alertdialog", { name: "Operatorni o'chirish" });
    await user.click(within(dialog).getByRole("button", { name: "O'chirish" }));
    expect(await screen.findByText("Operator o'chirildi")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Kamola Rasulova")).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("button", { name: "Operator qo'shish" })).toHaveFocus());
  });

  it("birinchi operator qo'shilgach fokus sarlavhadagi «Operator qo'shish»da", async () => {
    rows = [];
    api.post.mockImplementationOnce(() => {
      rows = [{ ...OPERATORS[0], id: "46", name: "Lola Karimova" }];
      return Promise.resolve({
        data: { statusCode: 201, data: { id: "46", name: "Lola Karimova", phone_number: "+998901234567", status: "active", commission_type: null, commission_value: null } },
      });
    });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Hali operator yo'q");
    await user.click(screen.getByRole("button", { name: "Operator qo'shish" }));
    const dialog = await screen.findByRole("dialog", { name: "Operator qo'shish" });
    await user.type(within(dialog).getByLabelText(/Ism familiya/), "Lola Karimova");
    await user.type(within(dialog).getByLabelText(/Telefon/), "901234567");
    await user.type(within(dialog).getByLabelText(/^Parol/, { selector: "input" }), "lola25");
    await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }));

    expect(await screen.findByRole("table", { name: "Operatorlar ro'yxati" })).toBeInTheDocument();
    expect(screen.queryByText("Hali operator yo'q")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Operator qo'shish" })).toHaveFocus());
  });

  it("POST javobida id yo'q — komissiya saqlanmagan deb aytiladi, PATCH va «Belgilash» yo'q", async () => {
    api.post.mockResolvedValueOnce({ data: { statusCode: 201, data: { name: "Lola Karimova" } } });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Operator qo'shish" }));
    const dialog = await screen.findByRole("dialog", { name: "Operator qo'shish" });
    await user.type(within(dialog).getByLabelText(/Ism familiya/), "Lola Karimova");
    await user.type(within(dialog).getByLabelText(/Telefon/), "901234567");
    await user.type(within(dialog).getByLabelText(/^Parol/, { selector: "input" }), "lola25");
    await user.type(within(dialog).getByLabelText(/Komissiya/, { selector: "input" }), "4");
    await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }));

    expect(await screen.findByText("Operator qo'shildi, komissiya saqlanmadi")).toBeInTheDocument();
    expect(screen.queryByText("Operator qo'shildi")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Belgilash" })).not.toBeInTheDocument();
    expect(api.patch).not.toHaveBeenCalled();
  });

  it("POST 403 — «Market bloklangan», oyna ochiq qoladi", async () => {
    api.post.mockRejectedValueOnce(axiosError(403, "Market is blocked"));
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Operator qo'shish" }));
    const dialog = await screen.findByRole("dialog", { name: "Operator qo'shish" });
    await user.type(within(dialog).getByLabelText(/Ism familiya/), "Lola Karimova");
    await user.type(within(dialog).getByLabelText(/Telefon/), "901234567");
    await user.type(within(dialog).getByLabelText(/^Parol/, { selector: "input" }), "lola25");
    await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }));

    expect(await screen.findByText("Market bloklangan — operator qo'shib bo'lmaydi")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Operator qo'shish" })).toBeInTheDocument();
    expect(screen.queryByText(/Market is blocked/)).not.toBeInTheDocument();
  });

  it("komissiya PATCH 404 — «Operator topilmadi», oyna yopiladi", async () => {
    api.patch.mockRejectedValueOnce(axiosError(404, "Operator not found"));
    const user = userEvent.setup();
    renderPage();
    await openRowMenu(user, "Nodira Aliyeva", "Komissiya belgilash");
    const dialog = await screen.findByRole("dialog", { name: "Komissiya" });
    await user.type(within(dialog).getByLabelText(/^Foiz/), "4");
    await user.click(within(dialog).getByRole("button", { name: "Saqlash" }));
    expect(await screen.findByText("Operator topilmadi — ro'yxat yangilandi")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Komissiya" })).not.toBeInTheDocument());
  });

  it("komissiyani olib tashlash 404 — tasdiq oynasida «Operator topilmadi»", async () => {
    api.patch.mockRejectedValueOnce(axiosError(404, "Operator not found"));
    const user = userEvent.setup();
    renderPage();
    await openRowMenu(user, "Madina Xoliqova", "Komissiyani o'zgartirish");
    const dialog = await screen.findByRole("dialog", { name: "Komissiya" });
    await user.click(within(dialog).getByRole("button", { name: "Komissiyani olib tashlash" }));
    const confirm = await screen.findByRole("alertdialog", { name: "Komissiyani olib tashlaysizmi?" });
    await user.click(within(confirm).getByRole("button", { name: "Olib tashlash" }));
    expect(await within(confirm).findByText("Operator topilmadi — ro'yxat yangilandi")).toBeInTheDocument();
    expect(within(confirm).queryByText(/Qaytadan urinib/)).not.toBeInTheDocument();
  });
});
