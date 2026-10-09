import { fireEvent, screen } from "@testing-library/react";
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
} = { comment: null, items: [] };

// SellModal'ga uzatilgan `order` — qisman sotish payload'i shundan quriladi.
const sellModalProps = vi.hoisted(() => ({ last: null as null | { order: { items: unknown[] } | null } }));

const idleMutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };

vi.mock("../../../entities/orders", () => ({
  useOrders: () => ({
    useGetOrderById: () => ({
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
    }),
    updateNewOrder: idleMutation,
    SellOrder: idleMutation,
    PartlySellOrder: idleMutation,
    CancelOrder: idleMutation,
    RollbackOrder: idleMutation,
    scanMarketCancelledQr: idleMutation,
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
  OrderTracking: () => null,
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

// Galereyaning o'zi alohida testlangan — bu yerda faqat qaysi kalitlar uzatilgani.
vi.mock("../../../entities/order", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../entities/order")>();
  return {
    ...actual,
    ProofGallery: ({ keys }: { keys: string[] }) => <div data-testid="proof-gallery-mock">{keys.join("|")}</div>,
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

    expect(screen.getByRole("button", { name: "Raqamni nusxalash" })).toHaveTextContent("№1251175");
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
    await user.click(screen.getAllByRole("button", { name: "Tahrirlash" })[0]);
    await screen.findByText("Buyurtmani tahrirlash");

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

    const [productsEdit, addressEdit] = screen.getAllByRole("button", { name: "Tahrirlash" });
    expect(productsEdit).toBeEnabled();
    expect(addressEdit).toBeEnabled();

    await user.click(productsEdit);
    expect(await screen.findByText("Buyurtmani tahrirlash")).toBeInTheDocument();
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
    const customer = screen.getByText("Mijoz ma'lumotlari");
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
  // Hududiy menejer — tugmalar faqat shu rolga chiqadi.
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
            user: { id: "manager-1", role: "manager", branch: { id: "1", type: "REGIONAL" } },
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

  it("⭐ waiting + post_id — Sotish va Bekor qilish chiqadi", () => {
    orderState.status = "waiting";
    orderState.extra = { post_id: "90" };
    renderAsRegionalManager();
    expect(actionButtons()).toEqual(["Sotish", "Bekor qilish"]);
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
