import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import NewOrderUpdate from "./new_orderUpdate";
import { renderWithProviders } from "../../../test/test-utils";

/**
 * fix3b FE-ORD-12 — manzil va buyurtma/mahsulotlar oynasi PATCH
 * /orders/:id/full orqali saqlanadi (faqat SUPERADMIN/ADMIN/REGISTRATOR).
 * Boshqa rollarga tugma o'chiq va sababi title'da.
 * fix3b LC-04 — REGIONAL menejer kuryer qo'lidagi buyurtmani sotmaydi.
 */

const ROLE_LOCK = "Buyurtmani faqat superadmin, admin, menejer yoki registrator o'zgartira oladi.";

const orderState: Record<string, unknown> = {};

const baseOrder = {
  id: "1251175",
  status: "new",
  where_deliver: "address",
  total_price: 100000,
  to_be_paid: 100000,
  paid_amount: 0,
  comment: null,
  address: "Mustaqillik 1",
  customer: { id: "c1", name: "Ali Valiyev", phone_number: "+998901234567" },
  items: [{ id: "i1", quantity: 2, product_id: "8", product: { id: "8", name: "Krossovka" } }],
};

const idleMutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };

vi.mock("../../../entities/orders", () => ({
  useOrders: () => ({
    useGetOrderById: () => ({ data: { data: { ...baseOrder, ...orderState } }, isLoading: false }),
    updateNewOrder: idleMutation,
    SellOrder: idleMutation,
    PartlySellOrder: idleMutation,
    CancelOrder: idleMutation,
    RollbackOrder: idleMutation,
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

vi.mock("../../../widgets/order-tracking", () => ({ OrderTracking: () => null }));
vi.mock("../../orders/list/courier/list/SellModal", () => ({ default: () => null }));
vi.mock("../../orders/list/courier/list/CancelModal", () => ({ default: () => null }));

const renderAs = (role: string, branchType?: string) =>
  renderWithProviders(
    <Routes>
      <Route path="/orders/edit/:orderId" element={<NewOrderUpdate />} />
    </Routes>,
    {
      route: "/orders/edit/1251175",
      preloadedState: {
        role: { id: `${role}-1`, role, region: null, name: role },
        user: {
          user: { id: `${role}-1`, role, ...(branchType ? { branch: { id: "15", type: branchType } } : {}) },
          isAuthenticated: true,
          accessToken: null,
          loading: false,
          isAppInitializing: false,
          error: null,
        },
      } as never,
    },
  );

// Tartib: [0] — mahsulotlar oynasi, [1] — manzil oynasi (mijoz tugmasi matnsiz).
const editButtons = () => screen.getAllByRole("button", { name: "Tahrirlash" });

describe("NewOrderUpdate — buyurtmani tahrirlash huquqi (fix3b FE-ORD-12)", () => {
  afterEach(() => {
    Object.keys(orderState).forEach((key) => delete orderState[key]);
  });

  // fix #2: market va kuryer hanuz tahrirlay olmaydi — tugma o'chiq, sababi title'da.
  it.each(["market", "courier"])("%s — ikkala tahrirlash tugmasi o'chiq, sababi title'da", (role) => {
    renderAs(role);

    const [productsEdit, addressEdit] = editButtons();
    expect(productsEdit).toBeDisabled();
    expect(productsEdit).toHaveAttribute("title", ROLE_LOCK);
    expect(addressEdit).toBeDisabled();
    expect(addressEdit).toHaveAttribute("title", ROLE_LOCK);
  });

  // fix #2: menejer endi (superadmin/admin/registrator qatorida) yangi buyurtmani
  // tahrirlay oladi — backend o'z filialidagi NEW buyurtma uchun ruxsat beradi.
  it.each(["superadmin", "admin", "registrator", "manager"])("%s — buyurtma va manzil oynasi ochiladi", async (role) => {
    const user = userEvent.setup();
    renderAs(role);

    const [productsEdit, addressEdit] = editButtons();
    expect(productsEdit).toBeEnabled();
    expect(addressEdit).toBeEnabled();

    await user.click(productsEdit);
    expect(await screen.findByText("Buyurtmani tahrirlash")).toBeInTheDocument();
  });

  it("registrator — manzil oynasi ham ochiladi", async () => {
    const user = userEvent.setup();
    renderAs("registrator");

    await user.click(editButtons()[1]);
    expect(await screen.findByText("Manzilni tahrirlash")).toBeInTheDocument();
  });

  it("qabul qilingan buyurtmada avvalgi qulf sababi saqlanadi (rol emas)", () => {
    orderState.status = "received";
    renderAs("registrator");

    const [productsEdit] = editButtons();
    expect(productsEdit).toBeDisabled();
    expect(productsEdit).toHaveAttribute(
      "title",
      "HQ qabul qilgandan keyin summa va mahsulotlarni o'zgartirib bo'lmaydi.",
    );
  });
});

describe("NewOrderUpdate — menejer kuryerdagi buyurtmani sotmaydi (fix3b LC-04)", () => {
  afterEach(() => {
    Object.keys(orderState).forEach((key) => delete orderState[key]);
  });

  it("kuryer qo'lidagi WAITING buyurtmada 'Sotish' yo'q, 'Bekor qilish' bor", () => {
    Object.assign(orderState, { status: "waiting", holder_type: "COURIER", holder_courier_id: "289", courier_id: "289" });
    renderAs("manager", "REGIONAL");

    expect(screen.queryByRole("button", { name: "Sotish" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bekor qilish" })).toBeInTheDocument();
  });

  it("filialda turgan WAITING buyurtmada 'Sotish' avvalgidek", () => {
    Object.assign(orderState, { status: "waiting", holder_type: "BRANCH", holder_courier_id: null, courier_id: null });
    renderAs("manager", "REGIONAL");

    expect(screen.getByRole("button", { name: "Sotish" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bekor qilish" })).toBeInTheDocument();
  });
});
