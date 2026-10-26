import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import NewOrderUpdate from "./new_orderUpdate";
import { renderWithProviders } from "../../../test/test-utils";

const order = {
  id: "1251175",
  status: "waiting",
  where_deliver: "address",
  total_price: 100000,
  to_be_paid: 100000,
  paid_amount: 0,
  comment: null,
  customer: { id: "c1", name: "Ali Valiyev", phone_number: "+998901234567" },
  items: [],
};

const orderState: {
  comment: string | null;
  items: unknown[];
  status?: string;
  /** Qo'shimcha maydonlar (proof_files, market...) — test o'zi qo'yadi. */
  extra?: Record<string, unknown>;
  /** `useGetOrderById` natijasini butunlay almashtirish (bo'sh javob, xato). */
  query?: Record<string, unknown>;
} = { comment: null, items: [] };

// SellModal'ga uzatilgan `order` — qisman sotish payload'i shundan quriladi.
const sellModalProps = vi.hoisted(() => ({ last: null as null | { order: { items: unknown[] } | null } }));

const idleMutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };
const rollbackMutation = vi.hoisted(() => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }));
// hfkhYrGk №6: `DELETE /orders/:id` — superadmin ombor buyurtmasini tafsilotdan o'chiradi.
const deleteMutation = vi.hoisted(() => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }));

vi.mock("../../../entities/orders", () => ({
  useOrders: () => ({
    useGetOrderById: () =>
      orderState.query ?? {
        data: {
          data: {
            ...order,
            ...orderState.extra,
            status: orderState.status ?? order.status,
            comment: orderState.comment,
            items: orderState.items,
          },
        },
        isLoading: false,
      },
    updateNewOrder: idleMutation,
    SellOrder: idleMutation,
    PartlySellOrder: idleMutation,
    CancelOrder: idleMutation,
    RollbackOrder: rollbackMutation,
    deleteOrder: deleteMutation,
    scanMarketCancelledQr: idleMutation,
    verifyMarketCancelledPin: idleMutation,
  }),
}));

vi.mock("../../../entities/user/api/userApi", () => ({
  useUser: () => ({ updateUser: idleMutation }),
}));

vi.mock("../../../entities/logistics/api/logisticsApi", () => ({
  useLogistics: () => ({
    useGetRegions: () => ({ data: undefined }),
    useGetDistricts: () => ({ data: undefined }),
  }),
}));

vi.mock("../../../widgets/order-tracking", () => ({
  OrderTracking: ({ defaultCollapsed, context }: { defaultCollapsed?: boolean; context?: { hqName?: string | null } }) => (
    <div
      data-testid="order-tracking-stub"
      data-default-collapsed={String(Boolean(defaultCollapsed))}
      data-hq-name={context?.hqName ?? ""}
    />
  ),
}));

vi.mock("../../orders/list/courier/list/SellModal", () => ({
  default: (props: { order: { items: unknown[] } | null }) => {
    sellModalProps.last = props;
    return null;
  },
}));
const cancelModalProps = vi.hoisted(() => ({ last: null as null | { order: Record<string, unknown> | null } }));
vi.mock("../../orders/list/courier/list/CancelModal", () => ({
  default: (props: { order: Record<string, unknown> | null }) => {
    cancelModalProps.last = props;
    return null;
  },
}));

// «Qaytarish yo'li» tarixi (`GET orders/:id/tracking`) — test o'zi hodisalar beradi.
const returnPathEvents = vi.hoisted(() => ({ list: [] as unknown[] }));

// Galereyaning o'zi alohida testlangan — bu yerda faqat qaysi kalitlar uzatilgani.
vi.mock("../../../entities/order", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../entities/order")>();
  return {
    ...actual,
    ProofGallery: ({ keys }: { keys: string[] }) => <div data-testid="proof-gallery-mock">{keys.join("|")}</div>,
    orderActivityLogApi: {
      getByOrderId: vi.fn(() =>
        Promise.resolve({ data: { data: returnPathEvents.list, total: returnPathEvents.list.length } }),
      ),
    },
  };
});

// fix3b FE-ORD-12: buyurtma tahrirlash oynasi (PATCH /orders/:id/full) faqat
// superadmin/admin/registratorga ochiq — oynani ochadigan test rol beradi.
const renderPage = (role?: string) =>
  renderWithProviders(
    <Routes>
      <Route path="/orders/edit/:orderId" element={<NewOrderUpdate />} />
    </Routes>,
    {
      route: "/orders/edit/1251175",
      ...(role
        ? { preloadedState: { role: { id: `${role}-1`, role, region: null, name: role } } as never }
        : {}),
    },
  );

describe("NewOrderUpdate comment", () => {
  afterEach(() => {
    orderState.comment = null;
  });

  it("shows the order comment on the detail page itself, keeping its line breaks", () => {
    orderState.comment = "!!! Bu buyurtmadan qo'shimcha 10000 miqdorda pul ushlab qolingan\nKuryer: Ali";
    renderPage();

    const text = screen.getByText(/Bu buyurtmadan qo'shimcha 10000 miqdorda pul ushlab qolingan/);
    expect(text.textContent).toBe("!!! Bu buyurtmadan qo'shimcha 10000 miqdorda pul ushlab qolingan\nKuryer: Ali");
    expect(text).toHaveClass("whitespace-pre-line");
  });

  it.each([null, "", "   ", "\n\n"])("renders no comment card for an empty comment (%j)", (comment) => {
    orderState.comment = comment;
    const { container } = renderPage();

    expect(container.querySelector(".whitespace-pre-line")).toBeNull();
  });
});

describe("NewOrderUpdate header", () => {
  it("shows the order number on the detail page, matching the list's №id", () => {
    renderPage();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("№1251175");
    expect(screen.getByRole("button", { name: "Raqamni nusxalash" })).toBeInTheDocument();
  });

  it("«← Buyurtmalar» — tarix bo'lmasa ro'yxatga qaytaradi", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <Routes>
        <Route path="/orders/edit/:orderId" element={<NewOrderUpdate />} />
        <Route path="/orders" element={<p>ORDERS LIST</p>} />
      </Routes>,
      { route: "/orders/edit/1251175" },
    );

    await user.click(screen.getByRole("button", { name: "Buyurtmalar" }));
    expect(await screen.findByText("ORDERS LIST")).toBeInTheDocument();
  });

  it("copies the order number and confirms it with a notification", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Raqamni nusxalash" }));

    expect(await navigator.clipboard.readText()).toBe("1251175");
    expect(await screen.findByText("Buyurtma raqami nusxalandi")).toBeInTheDocument();
  });
});

describe("NewOrderUpdate partial-sell items", () => {
  afterEach(() => {
    orderState.items = [];
  });

  it("passes the catalog product_id to SellModal and never substitutes the order-item id", () => {
    orderState.items = [
      // Hamkor posilkasi (prod #120): katalogsiz qator.
      { id: "124", quantity: 2, product_id: null, product_name: "tv", product: null },
      // Katalogdagi mahsulot, lekin `product` obyekti kelmagan.
      { id: "1251136", quantity: 3, product_id: "8", product_name: "psarinorm", product: null },
    ];
    renderPage();

    expect(sellModalProps.last?.order?.items).toEqual([
      expect.objectContaining({ id: "124", product_id: null, product: expect.objectContaining({ id: null, name: "tv" }) }),
      expect.objectContaining({ id: "1251136", product_id: "8", product: expect.objectContaining({ id: "8", name: "psarinorm" }) }),
    ]);
  });
});

describe("NewOrderUpdate catalog-less product names", () => {
  // Jonli #1251134: tashqi buyurtma — `product` ham, `product_id` ham null, nom `product_name` da.
  const externalItems = [
    { id: "i1", quantity: 1, product_id: null, product: null, product_name: "Telefon ushlagich magnitli" },
    { id: "i2", quantity: 1, product_id: null, product: null, product_name: "Avtomobil qoplamasi" },
    { id: "i3", quantity: 1, product_id: null, product: null, product_name: "Oyna tozalagich suyuqlik" },
    { id: "i4", quantity: 1, product_id: null, product: null, product_name: "Avto changyutgich" },
  ];
  const names = externalItems.map((item) => item.product_name);

  afterEach(() => {
    orderState.items = [];
    orderState.status = undefined;
  });

  it("shows each product_name on the detail page instead of a generic \"Mahsulot\"", () => {
    orderState.items = externalItems;
    renderPage();

    for (const name of names) expect(screen.getByText(name)).toBeInTheDocument();
    // Faqat ustun sarlavhasi qoladi — ilgari har qator uchun yana "Mahsulot" (jami 5 ta).
    expect(screen.getAllByText("Mahsulot")).toHaveLength(1);
  });

  it("shows the same names in the edit popup instead of \"—\"", async () => {
    const user = userEvent.setup();
    orderState.items = externalItems;
    // Mahsulotlarni faqat qabul qilinmagan buyurtmada tahrirlash mumkin.
    orderState.status = "new";
    renderPage("registrator");

    const dashesBefore = screen.queryAllByText("—").length;
    await user.click(screen.getByRole("button", { name: /^Buyurtmani tahrirlash/ }));
    await screen.findByRole("dialog", { name: "Buyurtmani tahrirlash" });

    // Har nom endi ikki joyda: detal ro'yxati + tahrirlash oynasi (ilgari oynada "—").
    for (const name of names) expect(screen.getAllByText(name)).toHaveLength(2);
    expect(screen.queryAllByText("—")).toHaveLength(dashesBefore);
  });

  it("keeps the catalog name for catalog products and falls back to #product_id without any name", () => {
    orderState.items = [
      { id: "c1", quantity: 2, product_id: "6", product: { id: "6", name: "Televizor" }, product_name: "eski nom" },
      { id: "c2", quantity: 1, product_id: "8", product: null, product_name: null },
    ];
    renderPage();

    expect(screen.getByText("Televizor")).toBeInTheDocument();
    expect(screen.queryByText("eski nom")).not.toBeInTheDocument();
    expect(screen.getByText("#8")).toBeInTheDocument();
  });
});

// fix #2: backend endi menejerga o'z filialidagi NEW buyurtmani (PATCH /orders/:id
// va /:id/full) tahrirlashga ruxsat beradi — oldin tugma o'chiq edi.
describe("NewOrderUpdate manager edit (fix #2)", () => {
  afterEach(() => {
    orderState.status = undefined;
  });

  it("lets a manager open the order edit popup for a NEW order", async () => {
    const user = userEvent.setup();
    orderState.status = "new";
    renderPage("manager");

    const productsEdit = screen.getByRole("button", { name: /^Buyurtmani tahrirlash/ });
    const addressEdit = screen.getByRole("button", { name: /^Manzilni tahrirlash/ });
    expect(productsEdit).toBeEnabled();
    expect(addressEdit).toBeEnabled();

    await user.click(productsEdit);
    expect(await screen.findByRole("dialog", { name: "Buyurtmani tahrirlash" })).toBeInTheDocument();
  });
});

// PATCH /orders/:id/full `items` ni TO'LIQ almashtiradi — payload'da yo'q qator bazadan o'chadi.
describe("NewOrderUpdate — mahsulot sonini tahrirlash erkin-matnli qatorni saqlaydi", () => {
  afterEach(() => {
    orderState.items = [];
    orderState.status = undefined;
    idleMutation.mutateAsync.mockClear();
  });

  it("⭐ katalog mahsuloti sonini oshirish — so'rovdagi items'da erkin-matnli qator ham bor", async () => {
    const user = userEvent.setup();
    orderState.status = "new";
    orderState.items = [
      { id: "c1", quantity: 2, product_id: "6", product: { id: "6", name: "Televizor" }, product_name: null },
      { id: "f1", quantity: 1, product_id: null, product: null, product_name: "Ipak ro'mol" },
    ];
    renderPage("registrator");

    await user.click(screen.getByRole("button", { name: /^Buyurtmani tahrirlash/ }));
    await screen.findByRole("dialog", { name: "Buyurtmani tahrirlash" });
    await user.click(screen.getByRole("button", { name: "Televizor sonini oshirish" }));
    await user.click(screen.getByRole("button", { name: "Saqlash" }));

    expect(idleMutation.mutateAsync).toHaveBeenCalledWith({
      orderId: "1251175",
      data: {
        items: [
          { product_id: "6", quantity: 3 },
          { product_id: null, product_name: "Ipak ro'mol", quantity: 1 },
        ],
      },
    });
  });
});

describe("NewOrderUpdate — dalillar (proof_files) va dalil majburiyati", () => {
  afterEach(() => {
    orderState.extra = undefined;
  });

  it("⭐ proof_files bo'lmasa yoki bo'sh bo'lsa \"Dalillar\" kartasi UMUMAN chiqmaydi", () => {
    renderPage();
    expect(screen.queryByTestId("order-proof-card")).not.toBeInTheDocument();
    expect(screen.queryByText("Dalillar")).not.toBeInTheDocument();
  });

  it("bo'sh massiv ham karta chiqarmaydi", () => {
    orderState.extra = { proof_files: [] };
    renderPage();
    expect(screen.queryByTestId("order-proof-card")).not.toBeInTheDocument();
  });

  it("⭐ proof_files: null (masalan #109) — karta UMUMAN chiqmaydi", () => {
    orderState.extra = { proof_files: null };
    renderPage();
    expect(screen.queryByTestId("order-proof-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("proof-gallery-mock")).not.toBeInTheDocument();
  });

  it("⭐ proof_files bo'lsa \"Dalillar\" kartasi chiqadi va galereyaga kalitlar uzatiladi", () => {
    orderState.extra = {
      proof_files: [
        "proof-1784557173685-10818f3a-6482-4bb3-b092-f85b18057d9b-Screenshot.png",
        "proof-1784557173686-20818f3a-6482-4bb3-b092-f85b18057d9b-video.mp4",
      ],
    };
    renderPage();
    const card = screen.getByTestId("order-proof-card");
    expect(card).toHaveTextContent("Dalillar");
    expect(card).toHaveTextContent("Kuryer sotish yoki bekor qilishda biriktirgan rasm va videolar");
    expect(screen.getByTestId("proof-gallery-mock").textContent).toBe(
      "proof-1784557173685-10818f3a-6482-4bb3-b092-f85b18057d9b-Screenshot.png|proof-1784557173686-20818f3a-6482-4bb3-b092-f85b18057d9b-video.mp4",
    );
  });

  it("⭐ Sell va Cancel modallariga HAQIQIY market uzatiladi (dalil sharti oldindan ko'rinsin)", () => {
    orderState.extra = {
      market: { id: "m1", name: "Zamon Market", expense_proof_conditions: ["sell_any", "cancel_any"] },
    };
    renderPage();
    const expected = { name: "Zamon Market", expense_proof_conditions: ["sell_any", "cancel_any"] };
    expect((sellModalProps.last?.order as unknown as { market: unknown }).market).toEqual(expected);
    expect(cancelModalProps.last?.order?.market).toEqual(expected);
  });

  it("market kelmasa — avvalgidek \"-\" (yiqilmaydi, backend baribir tekshiradi)", () => {
    renderPage();
    expect((sellModalProps.last?.order as unknown as { market: unknown }).market).toEqual({
      name: "-",
      expense_proof_conditions: null,
    });
  });
});

describe("NewOrderUpdate — buyurtma ma'lumotlari (OrderMeta)", () => {
  afterEach(() => {
    orderState.extra = undefined;
  });

  it("⭐ o'ng ustunda Mijoz kartasidan YUQORIDA turadi", () => {
    orderState.extra = { post_id: "78", courier_id: null, holder_type: "HQ", branch: { id: "1", name: "HQ Toshkent" } };
    renderPage();
    const meta = screen.getByTestId("order-meta");
    const customer = screen.getByRole("heading", { name: "Mijoz" });
    // Bitta ustun (RIGHT): widgetning ota elementi Mijoz kartasini ham o'z ichiga oladi,
    // va widget ustunning BIRINCHI bolasi — Mijozdan oldin.
    const rightColumn = meta.parentElement!;
    expect(rightColumn.contains(customer)).toBe(true);
    expect(rightColumn.firstElementChild).toBe(meta);
    expect(meta.compareDocumentPosition(customer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId("meta-holder")).toHaveTextContent("Bosh ofisda (HQ)");
  });

  it("⭐ parent_order_id bo'lsa sahifada banner va asosiy buyurtma havolasi", () => {
    orderState.extra = { parent_order_id: "95" };
    renderPage();
    const banner = screen.getByTestId("order-parent-banner");
    expect(banner).toHaveTextContent("#95");
    expect(banner.querySelector("a")!.getAttribute("href")).toBe("/orders/edit/95");
  });

  it("parent_order_id yo'q — banner yo'q", () => {
    renderPage();
    expect(screen.queryByTestId("order-parent-banner")).not.toBeInTheDocument();
  });
});


describe("NewOrderUpdate — Sotish/Bekor qilish tugmalari (backend: WAITING + post_id)", () => {
  // Hududiy menejer (`can_sell_cancel` yoqilgan) — tugmalar faqat shu rolga chiqadi.
  const renderAsRegionalManager = () =>
    renderWithProviders(
      <Routes>
        <Route path="/orders/edit/:orderId" element={<NewOrderUpdate />} />
      </Routes>,
      {
        route: "/orders/edit/1251175",
        preloadedState: {
          role: { id: "manager-1", role: "manager", region: null, name: "manager" },
          user: {
            user: {
              id: "manager-1",
              role: "manager",
              branch: { id: "1", type: "REGIONAL" },
              can_sell_cancel: true,
            },
            isAuthenticated: true,
            accessToken: null,
            loading: false,
            isAppInitializing: false,
          },
        } as never,
      },
    );
  const actionButtons = () =>
    Array.from(document.querySelectorAll("button"))
      .map((button) => button.textContent?.trim())
      .filter((text) => text === "Sotish" || text === "Bekor qilish");

  afterEach(() => {
    orderState.status = undefined;
    orderState.extra = undefined;
  });

  it("⭐ waiting + post_id — Bekor qilish va Sotish chiqadi (maket tartibi, asosiy amal oxirida)", () => {
    orderState.status = "waiting";
    orderState.extra = { post_id: "90" };
    renderAsRegionalManager();
    expect(actionButtons()).toEqual(["Bekor qilish", "Sotish"]);
  });

  it.each(["on the road", "new", "received"])(
    "⭐ %s (post_id bor) — tugmalar YO'Q (backend 400 \"not in waiting status\")",
    (status) => {
      orderState.status = status;
      orderState.extra = { post_id: "90" };
      renderAsRegionalManager();
      expect(actionButtons()).toEqual([]);
    },
  );

  it("⭐ waiting, lekin post_id yo'q — tugmalar YO'Q (backend 400 \"Order has no post\")", () => {
    orderState.status = "waiting";
    orderState.extra = { post_id: null };
    renderAsRegionalManager();
    expect(actionButtons()).toEqual([]);
  });
});

describe("NewOrderUpdate — marketga qaytarish (initiate-return / mark-returned-to-market)", () => {
  afterEach(() => {
    orderState.status = undefined;
    orderState.extra = undefined;
  });
  const button = (testId: string) => document.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`);

  it.each(["superadmin", "admin", "registrator"])("⭐ %s — waiting buyurtmada \"Marketga qaytarish\" → sabab oynasi", (role) => {
    orderState.status = "waiting";
    renderPage(role);
    expect(button("initiate-return-button")).toHaveTextContent("Marketga qaytarish");
    expect(button("mark-returned-button")).toBeNull();

    fireEvent.click(button("initiate-return-button")!);
    expect(screen.getByTestId("initiate-return-modal")).toBeInTheDocument();
    expect(screen.getByTestId("return-reason-input")).toBeInTheDocument();
  });

  it("⭐ waiting_customer da ham chiqadi; new / sold da yo'q", () => {
    orderState.status = "waiting_customer";
    const first = renderPage("admin");
    expect(button("initiate-return-button")).not.toBeNull();
    first.unmount();

    for (const status of ["new", "sold"]) {
      orderState.status = status;
      const view = renderPage("admin");
      expect(button("initiate-return-button"), status).toBeNull();
      view.unmount();
    }
  });

  it("manager / courier / market — \"Marketga qaytarish\" yo'q (backend 403)", () => {
    orderState.status = "waiting";
    for (const role of ["manager", "courier", "market"]) {
      const view = renderPage(role);
      expect(button("initiate-return-button"), role).toBeNull();
      view.unmount();
    }
  });

  it("⭐ return_requested — sarlavhada amber badge (sabab bilan), qaytarish tugmasi takrorlanmaydi", () => {
    orderState.status = "waiting";
    orderState.extra = { return_requested: true, return_reason: "Mijoz rad etdi" };
    renderPage("admin");
    const badge = screen.getByTestId("return-requested-badge");
    expect(badge).toHaveTextContent("Qaytarish so'ralgan");
    expect(badge).toHaveAttribute("aria-label", "Qaytarish so'ralgan. Sabab: Mijoz rad etdi");
    expect(button("initiate-return-button")).toBeNull();
    // Topshirish — filial roli, admin emas.
    expect(button("mark-returned-button")).toBeNull();
  });

  it.each(["manager", "registrator"])("⭐ %s — return_requested bo'lsa \"Marketga topshirildi\" → QR oynasi", (role) => {
    orderState.status = "waiting";
    orderState.extra = { return_requested: true, return_reason: "Sabab" };
    renderPage(role);
    expect(button("mark-returned-button")).toHaveTextContent("Marketga topshirildi");

    fireEvent.click(button("mark-returned-button")!);
    expect(screen.getByTestId("mark-returned-modal")).toBeInTheDocument();
    expect(screen.getByTestId("mark-returned-qr-input")).toBeInTheDocument();
  });

  it("return_requested false (GET /orders/95) — badge ham, topshirish tugmasi ham yo'q", () => {
    orderState.status = "waiting";
    orderState.extra = { return_requested: false, return_reason: null };
    renderPage("manager");
    expect(screen.queryByTestId("return-requested-badge")).not.toBeInTheDocument();
    expect(button("mark-returned-button")).toBeNull();
  });
});

// ─── Dizayn v2: holatlar, rollar bo'yicha ko'rinish, amallar ──────────────────
const renderAsUser = (role: string, user: Record<string, unknown> = {}) =>
  renderWithProviders(
    <Routes>
      <Route path="/orders/edit/:orderId" element={<NewOrderUpdate />} />
    </Routes>,
    {
      route: "/orders/edit/1251175",
      preloadedState: {
        role: { id: `${role}-1`, role, region: null, name: role },
        user: {
          user: { id: `${role}-1`, role, ...user },
          isAuthenticated: true,
          accessToken: null,
          loading: false,
          isAppInitializing: false,
          error: null,
        },
      } as never,
    },
  );

describe("NewOrderUpdate — so'rov holatlari (dizayn v2)", () => {
  afterEach(() => {
    orderState.query = undefined;
    orderState.extra = undefined;
    orderState.status = undefined;
  });

  it("⭐ bo'sh javob `{}` (mock API) — sahifa yiqilmaydi, «Buyurtma topilmadi» (D-13)", () => {
    orderState.query = { data: {}, isLoading: false };
    renderPage("manager");
    expect(screen.getByText("Buyurtma topilmadi")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Buyurtmalarga qaytish" })).toHaveAttribute("href", "/orders");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("№1251175");
  });

  it("⭐ 404 — «Buyurtma topilmadi», backend matni yo'q, «Qayta urinish» o'rniga «Buyurtmalarga qaytish» (D-13)", () => {
    const refetch = vi.fn();
    orderState.query = {
      data: undefined,
      isLoading: false,
      isError: true,
      error: { response: { status: 404, data: { message: "Order #1251175 topilmadi" } } },
      refetch,
    };
    renderPage("admin");

    expect(screen.getByText("Buyurtma topilmadi")).toBeInTheDocument();
    expect(screen.getByText(/№1251175 raqamli buyurtma yo'q/)).toBeInTheDocument();
    expect(screen.queryByText(/Order #/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Qayta urinish" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Buyurtmalarga qaytish" })).toHaveAttribute("href", "/orders");
    // Raqamni nusxalash — buyurtma yo'q, tugma ham yo'q.
    expect(screen.queryByRole("button", { name: "Raqamni nusxalash" })).not.toBeInTheDocument();
  });

  it("404 — «Qabul va yaratish» ichida (`/new-orders/:marketId/edit/:orderId`) qaytish market ro'yxatiga", () => {
    orderState.query = { data: undefined, isLoading: false, isError: true, error: { response: { status: 404 } } };
    renderWithProviders(
      <Routes>
        <Route path="/new-orders/:marketId/edit/:orderId" element={<NewOrderUpdate />} />
      </Routes>,
      { route: "/new-orders/121/edit/1251175" },
    );

    expect(screen.getByText("Buyurtma topilmadi")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Buyurtmalarga qaytish" })).toHaveAttribute("href", "/new-orders/121");
  });

  it("⭐ xato — ErrorState va «Qayta urinish» so'rovni qayta yuboradi (ilgari «topilmadi» chiqardi)", async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    orderState.query = { data: undefined, isLoading: false, isError: true, error: { response: { status: 500 } }, refetch };
    renderPage("admin");

    expect(screen.queryByText("Buyurtma topilmadi")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Qayta urinish" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("summa matn bo'lib kelsa (\"150000.00\") — 150 000 so'm, 15 000 000 emas", () => {
    orderState.extra = { total_price: "150000.00", to_be_paid: "150000.00", paid_amount: "0.00" };
    renderPage("admin");
    const total = document.querySelector('[data-payment="total"] dd');
    expect(total?.textContent).toMatch(/^150\s000 so'm$/);
  });

  it.each([
    ["returned_to_market", "Marketga topshirildi"],
    ["processing", "Jarayonda"],
    ["completed", "Tayyor"],
    ["waiting", "Kutilmoqda"],
  ])("holat %s — sarlavhada «%s»", (status, label) => {
    orderState.status = status;
    renderPage("admin");
    const header = screen.getByRole("banner");
    expect(within(header).getByText(label)).toBeInTheDocument();
  });

  it("izohda yaratilgan vaqt va market: «Yaratilgan: … · Zamon Market»", () => {
    orderState.extra = { createdAt: "2026-07-20T08:38:49.865Z", market: { id: "m1", name: "Zamon Market" } };
    renderPage("admin");
    expect(screen.getByRole("banner")).toHaveTextContent(/Yaratilgan: \d{2}\.\d{2}\.2026, \d{2}:\d{2} · Zamon Market/);
  });
});

describe("NewOrderUpdate — mijoz havolasi va rol ko'rinishlari", () => {
  afterEach(() => {
    orderState.extra = undefined;
    orderState.status = undefined;
    orderState.items = [];
  });

  it("superadmin — ism /all-users/:id havolasi («Profilni ko'rish uchun bosing»)", () => {
    renderAsUser("superadmin");
    const link = screen.getByRole("link", { name: /Ali Valiyev/ });
    expect(link).toHaveAttribute("href", "/all-users/c1");
    expect(link).toHaveTextContent("Profilni ko'rish uchun bosing");
  });

  it("market — ism havola emas, mahsulotlarda yetkazish turi yo'q (u Manzil kartasida)", () => {
    orderState.items = [{ id: "i1", quantity: 2, product_id: null, product: null, product_name: "Ipak ro'mol" }];
    renderAsUser("market");
    expect(screen.queryByRole("link", { name: /Ali Valiyev/ })).not.toBeInTheDocument();
    const products = screen.getByRole("region", { name: "Mahsulotlar" });
    expect(within(products).queryByText("Yetkazish turi")).not.toBeInTheDocument();
    expect(within(products).getByText("Katalogdan tashqari")).toBeInTheDocument();
    expect(within(products).getByText("2 ta")).toBeInTheDocument();
    const address = screen.getByRole("region", { name: "Manzil" });
    expect(within(address).getByText("Yetkazish turi")).toBeInTheDocument();
    expect(within(address).getByText("Uygacha")).toBeInTheDocument();
  });

  it("kuryer — «Mijoz va manzil», qo'ng'iroq tel: havolasi, «To'lanishi kerak» katta raqam", () => {
    renderAsUser("courier");
    const call = screen.getByRole("link", { name: "Ali Valiyevga qo'ng'iroq qilish, +998 90 123 45 67" });
    expect(call).toHaveAttribute("href", "tel:+998901234567");
    expect(screen.getByRole("region", { name: "Mijoz va manzil" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "To'lov" })).toHaveTextContent("To'lanishi kerak");
    // Kuryerda sarlavha amallari va tahrirlash yo'q.
    expect(screen.queryByText("Tahrirlash")).not.toBeInTheDocument();
  });

  it("⭐ kutilayotgan market tasdig'i — sarlavha ostida ogohlantirish", async () => {
    const { recordPendingExtraCostApproval, clearPendingExtraCostApproval } = await import(
      "../../../entities/orders/extraCostApproval"
    );
    recordPendingExtraCostApproval({
      orderId: "1251175",
      action: "sell",
      amount: 20000,
      requestedAt: new Date().toISOString(),
      orderStatus: "waiting",
    });
    try {
      renderAsUser("manager", { branch: { id: "1", type: "REGIONAL" } });
      const alert = screen
        .getAllByRole("status")
        .find((node) => node.textContent?.includes("Market tasdig'i kutilmoqda."));
      expect(alert).toBeTruthy();
      expect(alert).toHaveTextContent(/Sotish: 20\s000 so'm qo'shimcha xarajat Bugun, \d{2}:\d{2} da market tasdig'iga yuborilgan\. Market tasdiqlasa, amal avtomatik bajariladi\./);
    } finally {
      clearPendingExtraCostApproval("1251175");
    }
  });
});

describe("NewOrderUpdate — sotilgan buyurtmani qaytarish (RollbackOrderDialog)", () => {
  afterEach(() => {
    orderState.status = undefined;
    rollbackMutation.mutate.mockReset();
  });

  it("⭐ hududiy menejer: «Qaytarish» → v2 tasdiq oynasi → so'rov → muvaffaqiyat xabari", async () => {
    const user = userEvent.setup();
    orderState.status = "sold";
    rollbackMutation.mutate.mockImplementation((_id: string, options: { onSuccess?: () => void }) => options.onSuccess?.());
    renderAsUser("manager", { branch: { id: "1", type: "REGIONAL" }, can_sell_cancel: true });

    await user.click(screen.getByRole("button", { name: "Qaytarish" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Buyurtmani qaytarish" });
    await user.click(within(dialog).getByRole("button", { name: "Ha, qaytarish" }));

    expect(rollbackMutation.mutate).toHaveBeenCalledWith({ orderId: "1251175", targetStatus: "waiting" }, expect.anything());
    expect(await screen.findByText("Buyurtma qayta tiklandi")).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("HQ menejeri yoki admin — «Qaytarish» yo'q (bayroq bo'lsa ham)", () => {
    orderState.status = "sold";
    const hq = renderAsUser("manager", { branch: { id: "1", type: "HQ" }, can_sell_cancel: true });
    expect(screen.queryByRole("button", { name: "Qaytarish" })).not.toBeInTheDocument();
    hq.unmount();
    renderAsUser("admin");
    expect(screen.queryByRole("button", { name: "Qaytarish" })).not.toBeInTheDocument();
  });
});

describe("NewOrderUpdate — bekor bosqichi va «Qaytarish yo'li» (maketlar *-orders-detail-cancelled)", () => {
  afterEach(() => {
    orderState.extra = undefined;
    orderState.status = undefined;
    returnPathEvents.list = [];
  });

  it("menejer: «Bekor · HQ'da» + «Toshkent HQ · 3 kun», «Qaytarish yo'li» kutilayotgan qadam bilan, qulf matni", async () => {
    orderState.status = "cancelled";
    orderState.extra = {
      holder_type: "HQ",
      post_id: "78",
      branch: { id: "1", name: "Toshkent HQ" },
      market: { id: "m7", name: "Nur Elektronika" },
      last_handover_at: new Date(Date.now() - 3 * 86_400_000 - 60_000).toISOString(),
    };
    returnPathEvents.list = [
      {
        id: "e1",
        order_id: "1251175",
        action: "cancelled",
        from_status: "waiting",
        to_status: "cancelled",
        new_value: { status: "cancelled" },
        old_value: { status: "waiting" },
        changed_by: "5",
        changed_by_role: "courier",
        actor: { name: "Jasur Tursunov", role: "courier" },
        created_at: "2026-10-05T14:20:00+05:00",
      },
      {
        id: "e2",
        order_id: "1251175",
        action: "cancelled_post_received",
        from_status: "cancelled (sent)",
        to_status: "cancelled",
        changed_by: "9",
        changed_by_role: "registrator",
        actor: { name: "Bobur Xolmatov", role: "registrator" },
        metadata: { canceled_post_id: "2107", received_by_hq: true },
        note: "Canceled order received by HQ and held for market handover",
        created_at: "2026-10-05T23:40:00+05:00",
      },
    ];
    renderPage("manager");

    const header = screen.getByRole("banner");
    expect(within(header).getByText("Bekor · HQ'da")).toHaveAttribute("data-cancel-stage", "hq");
    expect(within(header).getByTestId("detail-stage-place")).toHaveTextContent("Toshkent HQ · 3 kun");
    expect(screen.getByText(/Buyurtma bekor qilingan — mijoz, manzil/)).toBeInTheDocument();

    const card = await screen.findByTestId("order-return-path");
    expect(within(card).getByRole("heading", { name: "Qaytarish yo'li" })).toBeInTheDocument();
    expect(await within(card).findAllByTestId("return-path-step")).toHaveLength(2);
    expect(card).toHaveTextContent("Kuryer Jasur Tursunov");
    expect(card).toHaveTextContent("Toshkent HQ · Ro'yxatchi Bobur Xolmatov");
    expect(within(card).getByTestId("return-path-pending")).toHaveTextContent(
      "Nur Elektronika olib ketishi kutilmoqda · Toshkent HQ · 3 kun",
    );
  });

  it("qabulgacha bekor qilingan (holder HQ, `post_id` yo'q): bosqich yo'q — «Bekor qilingan», qulf «bekor qilingan»", async () => {
    orderState.status = "cancelled";
    orderState.extra = { holder_type: "HQ", post_id: null, branch: { id: "1", name: "Toshkent HQ" } };
    renderPage("superadmin");

    const header = screen.getByRole("banner");
    expect(within(header).getByText("Bekor qilingan")).toBeInTheDocument();
    expect(within(header).queryByText("Bekor · HQ'da")).toBeNull();
    expect(within(header).queryByTestId("detail-stage-place")).toBeNull();
    expect(screen.getByText(/Buyurtma bekor qilingan — mijoz, manzil/)).toBeInTheDocument();
    expect(screen.queryByText(/filialga jo'natilgan/)).toBeNull();
    expect(screen.queryByTestId("order-return-path")).toBeNull();
  });

  it("superadmin: «Marketga topshirildi» (neytral) + «… · QR orqali» sarlavhada, zanjir yopildi", async () => {
    orderState.status = "returned_to_market";
    orderState.extra = {
      holder_type: "MARKET",
      branch: { id: "1", name: "Toshkent HQ" },
      market: { name: "Baraka Shop" },
      // Eski custody vaqti (`mark-returned-to-market` uni yangilamaydi) — sarlavha vaqtni tarixdan oladi.
      last_handover_at: "2026-10-01T09:00:00+05:00",
    };
    returnPathEvents.list = [
      {
        id: "r1",
        order_id: "1251175",
        action: "cancelled_post_received",
        from_status: "cancelled (sent)",
        to_status: "cancelled",
        changed_by: "9",
        changed_by_role: "registrator",
        actor: { name: "Bobur Xolmatov", role: "registrator" },
        metadata: { canceled_post_id: "2115", destination_branch: null, received_by_hq: true },
        created_at: "2026-10-05T23:40:00+05:00",
      },
      {
        id: "h1",
        order_id: "1251175",
        from_status: "cancelled",
        to_status: "returned_to_market",
        new_value: { status: "returned_to_market" },
        changed_by: "9",
        changed_by_role: "registrator",
        actor: { name: "Bobur Xolmatov", role: "registrator" },
        note: "Bekor qilingan order market 7ga QR tasdiqi bilan topshirildi",
        created_at: "2026-10-06T11:20:00+05:00",
      },
    ];
    renderPage("superadmin");

    const header = screen.getByRole("banner");
    expect(within(header).getByText("Marketga topshirildi")).toHaveClass("bg-sunken", "text-text-muted");
    // «Toshkent HQ · <topshirilgan vaqt> · QR orqali» — usul tarixdan kelgach qo'shiladi.
    expect(await within(header).findByText(/^Toshkent HQ · 06\.10\.2026, \d{2}:\d{2} · QR orqali$/)).toBeInTheDocument();
    expect(within(header).queryByText(/01\.10\.2026/)).toBeNull();
    // «Hozir kimda» ham tarixdagi vaqt bilan.
    expect(screen.getByTestId("meta-holder")).toHaveTextContent(/06\.10\.2026/);
    // Tarix jumlasidagi HQ nomi «Qaytarish yo'li» bilan bir xil; «Buyurtma tarixi» bu sahifada yig'ilgan.
    const trackingStub = screen.getByTestId("order-tracking-stub");
    expect(trackingStub).toHaveAttribute("data-default-collapsed", "true");
    await waitFor(() => expect(trackingStub).toHaveAttribute("data-hq-name", "Toshkent HQ"));
    expect(screen.getByText(/Buyurtma marketga topshirilgan — mijoz, manzil/)).toBeInTheDocument();
    const card = await screen.findByTestId("order-return-path");
    expect(card).toHaveTextContent("Zanjir yopildi — posilka marketga qaytdi");
    expect(within(card).getByTestId("return-path-method")).toHaveTextContent("QR orqali");
    expect(within(card).queryByTestId("return-path-pending")).toBeNull();
  });

  it("market: «Posilka hozir: Toshkent HQ — olib ketishingiz mumkin» va «QR kodni ochish» havolasi", async () => {
    orderState.status = "cancelled";
    orderState.extra = { holder_type: "HQ", post_id: "78", market_id: "m7", branch: { id: "1", name: "Toshkent HQ" } };
    renderPage("market");

    const card = await screen.findByTestId("order-return-path");
    expect(card).toHaveTextContent("Posilka hozir: Toshkent HQ — olib ketishingiz mumkin");
    expect(within(card).getByRole("link", { name: "QR kodni ochish" })).toHaveAttribute("href", "/new-orders/cancelled/m7");
    expect(within(card).getByTestId("return-path-pending")).toHaveTextContent("Olib ketishingiz kutilmoqda");
  });

  it("bekor bo'lmagan buyurtmada karta yo'q va tarix so'ralmaydi", () => {
    renderPage("superadmin");
    expect(screen.queryByTestId("order-return-path")).toBeNull();
  });
});

describe("NewOrderUpdate — ombor buyurtmasi: qulf matnlari va o'chirish (hfkhYrGk №3, №4, №6)", () => {
  const WAREHOUSE = {
    fulfillment_source: "WAREHOUSE",
    warehouse: { id: "3", name: "Samarqand filiali ombori", branch_id: "11" },
    branch: { id: "11", name: "Samarqand filiali" },
    holder_type: "BRANCH",
    market: { id: "121", name: "Baraka Shop" },
    district: { id: "45", name: "Urgut tumani" },
  };

  afterEach(() => {
    orderState.extra = undefined;
    orderState.status = undefined;
    returnPathEvents.list = [];
    deleteMutation.mutateAsync.mockReset();
  });

  it("№3: omborga qaytgan (returned_to_market + WAREHOUSE) — «Mahsulot omborga qaytarilgan», «marketga topshirilgan» emas", () => {
    orderState.status = "returned_to_market";
    orderState.extra = { ...WAREHOUSE, holder_type: "MARKET" };
    renderPage("superadmin");

    const lock = document.getElementById("edit-lock")!;
    expect(lock).toHaveTextContent("Tahrirlash yopiq.");
    expect(lock).toHaveTextContent(
      "Mahsulot omborga qaytarilgan — mijoz, manzil, summa va mahsulotlarni o'zgartirib bo'lmaydi.",
    );
    expect(screen.queryByText(/Buyurtma marketga topshirilgan/)).toBeNull();
  });

  it("№3: HQ buyurtmasi marketga topshirilgan — matn avvalgidek", () => {
    orderState.status = "returned_to_market";
    orderState.extra = { holder_type: "MARKET", fulfillment_source: "HQ" };
    renderPage("superadmin");
    expect(screen.getByText(/Buyurtma marketga topshirilgan — mijoz, manzil/)).toBeInTheDocument();
    expect(screen.queryByText(/omborga qaytarilgan/)).toBeNull();
  });

  it("№4: viloyat ombori buyurtmasi (received) — «omborda band qilingan», «HQ qabul qilgandan keyin» emas", () => {
    orderState.status = "received";
    orderState.extra = { ...WAREHOUSE };
    renderPage("superadmin");

    const lock = document.getElementById("products-lock")!;
    expect(lock).toHaveTextContent("Mahsulotlar va summa qulflangan.");
    expect(lock).toHaveTextContent("Mahsulotlar omborda band qilingan — ularni o'zgartirib bo'lmaydi.");
    expect(screen.queryByText(/HQ qabul qilgandan keyin/)).toBeNull();
    // O'chiq «Tahrirlash» izohi ham ombor sababini aytadi.
    expect(screen.getByRole("button", { name: "Buyurtmani tahrirlash — qulflangan" })).toHaveAttribute(
      "title",
      "Mahsulotlar omborda band qilingan — summa va mahsulotlarni o'zgartirib bo'lmaydi.",
    );
  });

  it("№4: Markaziy ombor (warehouse.kind HQ) va HQ buyurtmasi — «HQ qabul qilgandan keyin» qoladi", () => {
    orderState.status = "received";
    orderState.extra = { ...WAREHOUSE, warehouse: { id: "1", name: "Markaziy ombor", kind: "HQ" } };
    const central = renderPage("superadmin");
    expect(document.getElementById("products-lock")).toHaveTextContent("HQ qabul qilgandan keyin ularni o'zgartirib bo'lmaydi.");
    central.unmount();

    orderState.extra = { fulfillment_source: "HQ" };
    renderPage("superadmin");
    expect(document.getElementById("products-lock")).toHaveTextContent("HQ qabul qilgandan keyin ularni o'zgartirib bo'lmaydi.");
    expect(screen.queryByText(/omborda band qilingan/)).toBeNull();
  });

  it("№6: «O'chirish» — faqat superadmin; admin, registrator, menejer, HQ buyurtmasi va kuryerdagisida yo'q", () => {
    orderState.status = "received";
    orderState.extra = { ...WAREHOUSE };
    const superadmin = renderPage("superadmin");
    expect(screen.getByTestId("delete-order-button")).toHaveTextContent("O'chirish");
    superadmin.unmount();

    for (const role of ["admin", "registrator", "manager"]) {
      const view = renderPage(role);
      expect(screen.queryByTestId("delete-order-button"), role).toBeNull();
      view.unmount();
    }

    orderState.extra = { ...WAREHOUSE, holder_type: "COURIER" };
    const held = renderPage("superadmin");
    expect(screen.queryByTestId("delete-order-button")).toBeNull();
    held.unmount();

    orderState.extra = { fulfillment_source: "HQ" };
    renderPage("superadmin");
    expect(screen.queryByTestId("delete-order-button")).toBeNull();
  });

  it("№6: tasdiq oynasi → DELETE → «Buyurtma №… o'chirildi» va ro'yxatga qaytadi; bekor qilinsa so'rov yo'q", async () => {
    const user = userEvent.setup();
    orderState.status = "received";
    orderState.extra = { ...WAREHOUSE };
    deleteMutation.mutateAsync.mockResolvedValue({});
    renderWithProviders(
      <Routes>
        <Route path="/orders/edit/:orderId" element={<NewOrderUpdate />} />
        <Route path="/orders" element={<p>ORDERS LIST</p>} />
      </Routes>,
      {
        route: "/orders/edit/1251175",
        preloadedState: { role: { id: "superadmin-1", role: "superadmin", region: null, name: "superadmin" } } as never,
      },
    );

    // Bekor qilish — so'rov yuborilmaydi.
    await user.click(screen.getByTestId("delete-order-button"));
    let dialog = await screen.findByRole("alertdialog", { name: "Buyurtmani o'chirish" });
    expect(dialog).toHaveTextContent("Buyurtma o'chiriladi, ombordagi band bo'shatiladi.");
    expect(dialog).toHaveTextContent("№1251175 · Ali Valiyev");
    expect(dialog).toHaveTextContent("Baraka Shop");
    expect(dialog).toHaveTextContent("Urgut tumani");
    expect(dialog).toHaveTextContent("100 000 so'm");
    expect(dialog).toHaveTextContent("Bu amalni qaytarib bo'lmaydi.");
    await user.click(within(dialog).getByRole("button", { name: "Bekor qilish" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(deleteMutation.mutateAsync).not.toHaveBeenCalled();

    // Tasdiqlash — DELETE, xabar, ro'yxatga qaytish.
    await user.click(screen.getByTestId("delete-order-button"));
    dialog = await screen.findByRole("alertdialog", { name: "Buyurtmani o'chirish" });
    await user.click(within(dialog).getByRole("button", { name: "O'chirish" }));
    await waitFor(() => expect(deleteMutation.mutateAsync).toHaveBeenCalledWith("1251175"));
    expect(await screen.findByText("Buyurtma №1251175 o'chirildi")).toBeInTheDocument();
    expect(await screen.findByText("ORDERS LIST")).toBeInTheDocument();
  });

  it("№6: backend xatosi — oynada ko'rinadi, oyna ochiq qoladi, sahifa joyida", async () => {
    const user = userEvent.setup();
    orderState.status = "received";
    orderState.extra = { ...WAREHOUSE };
    deleteMutation.mutateAsync.mockRejectedValue(
      Object.assign(new Error("409"), {
        isAxiosError: true,
        response: { status: 409, data: { message: "Pochtadagi buyurtmani faqat jo'natilmagan va to'lovsiz holatda o'chirish mumkin" } },
      }),
    );
    renderPage("superadmin");

    await user.click(screen.getByTestId("delete-order-button"));
    const dialog = await screen.findByRole("alertdialog", { name: "Buyurtmani o'chirish" });
    await user.click(within(dialog).getByRole("button", { name: "O'chirish" }));
    expect(await within(dialog).findByText(/faqat jo'natilmagan va to'lovsiz holatda/)).toBeInTheDocument();
    expect(screen.getByRole("alertdialog", { name: "Buyurtmani o'chirish" })).toBeInTheDocument();
    expect(screen.queryByText(/o'chirildi/)).toBeNull();
  });
});
