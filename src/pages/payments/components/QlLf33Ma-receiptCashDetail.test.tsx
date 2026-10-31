import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import CashDetail from "./cashDetail";

/**
 * QlLf33Ma, 7-bosqich — HQ'ga «O'tkazma» qabulida chek rasmi (TZ 7, 8): superadmin HQ kuryeri va filial sahifasida
 * «O'tkazma» tanlansa maydon bor; «Naqd», «Marketga o'tkazma» va menejerning kuryer qabulida YO'Q. `receipt_id` so'rov
 * tanasida, lekin idempotentlik barmoq izida emas. Rasmsiz yuborilmaydi; `RECEIPT_REQUIRED` maydon ostida.
 */

type PaymentArg = { data: Record<string, unknown>; idempotencyKey: string };

const state = vi.hoisted(() => ({ cashbox: undefined as unknown, hqBranches: undefined as unknown }));
const cashboxRefetch = vi.hoisted(() => vi.fn(async () => ({ data: state.cashbox })));
const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
const prepareImageMock = vi.hoisted(() => vi.fn());
const branchPayment = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }));
const courierPayment = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }));

vi.mock("../../../shared/api/api", () => ({ api: http, LONG_REQUEST_TIMEOUT_MS: 120_000, API_TIMEOUT_MS: 20_000 }));
vi.mock("../../../shared/lib/downscaleImage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../shared/lib/downscaleImage")>()),
  prepareImage: prepareImageMock,
}));
vi.mock("../../../entities/payments/financeDaily", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../entities/payments/financeDaily")>()),
  useFinanceHistoryDaily: () => ({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() }),
}));
vi.mock("../../../entities/payments", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../entities/payments")>()),
  useCashBox: () => ({
    useGetCurrentShift: () => ({
      isSuccess: true,
      isError: false,
      data: { data: { shift: { id: "5", status: "open", opened_by: "1" }, required: true } },
      refetch: vi.fn(),
    }),
    openShift: { mutateAsync: vi.fn(), isPending: false },
    useGetCashBoxMain: () => ({ isSuccess: false, data: undefined }),
    useGetCashBoxById: () => ({ data: state.cashbox, isLoading: false, refetch: cashboxRefetch }),
    useGetFinanceHistory: () => ({ data: undefined, isLoading: false, refetch: vi.fn(async () => ({ data: undefined })) }),
    useGetFinanceHistoryById: () => ({ data: undefined, isLoading: false, isError: false }),
    createPaymentCourier: courierPayment,
    createPaymentBranchToMain: branchPayment,
    createPaymentMarket: { mutateAsync: vi.fn(), isPending: false },
  }),
}));
vi.mock("../../../entities/payments/financeCoverage", () => ({
  useFinanceCoverage: () => ({
    useGetManagerPayableToHq: () => ({ data: undefined, isLoading: false, refetch: vi.fn(async () => ({ data: undefined })) }),
    useGetManagerSettlement: () => ({ data: undefined, isLoading: false, refetch: vi.fn() }),
  }),
}));
vi.mock("../../../entities/markets", () => ({
  useMarkets: () => ({ useGetMarkets: () => ({ data: undefined, isLoading: false }) }),
}));
vi.mock("../../../entities/user/api/userApi", () => ({
  useUser: () => ({
    useGetUser: () => ({ data: undefined, isLoading: false }),
    useGetUserById: () => ({ data: undefined }),
    useGetCouriers: () => ({ data: undefined, isLoading: false }),
  }),
}));
vi.mock("../../../entities/branch/api/useBranches", () => ({
  useBranches: () => ({ data: state.hqBranches, isLoading: false, refetch: vi.fn(async () => ({ data: state.hqBranches })) }),
}));

const superadmin = { role: { id: "1", role: "superadmin", region: null, name: "Admin" } } as never;
const manager = {
  role: { id: "210", role: "manager", region: null, name: "Menejer" },
  user: {
    user: { id: "210", name: "Menejer", role: "manager", branch: { id: "3", branch_id: "16", branch: { id: "16", name: "Samarqand" } } },
    isAuthenticated: true,
    accessToken: "token",
    loading: false,
    isAppInitializing: false,
    error: null,
  },
} as never;

const courierCashbox = {
  statusCode: 200,
  data: {
    cashbox: { id: "30", cashbox_type: "couriers", user_id: "77", balance: 1_155_000 },
    user: { id: "77", name: "Jasur", role: "courier" },
    history: [],
    can_receive: true,
    is_hq_courier: true,
  },
};
const branchCashbox = {
  statusCode: 200,
  data: { cashbox: { id: "31", cashbox_type: "branch", user_id: "15", balance: 4_250_000 }, history: [] },
};

const renderAt = (type: "courier" | "branch", preloadedState: never = superadmin, cashboxHistory: unknown[] = []) => {
  const base = type === "courier" ? courierCashbox : branchCashbox;
  state.cashbox = { ...base, data: { ...base.data, cashboxHistory } };
  return renderWithProviders(
    <Routes>
      <Route path="/payments/cash-detail/:id" element={<CashDetail />} />
    </Routes>,
    {
      route: {
        pathname: `/payments/cash-detail/${type === "courier" ? "77" : "15"}`,
        state: { type, entity: { id: "15", name: "Filial", branch_name: "Urgut filiali", amount: 4_250_000 } },
      },
      preloadedState,
    },
  );
};

const photo = () => new File([new Uint8Array(1024)], "IMG_7782.jpg", { type: "image/jpeg" });
const chooseMethod = async (user: ReturnType<typeof userEvent.setup>, method: string) =>
  user.click(screen.getByRole("radio", { name: method }));
const setAmount = (amount: string) => fireEvent.change(screen.getByPlaceholderText("0"), { target: { value: amount } });
const SUBMIT = /qabul qilish$/i;
const uploadPhoto = async () => {
  fireEvent.change(await screen.findByTestId("receipt-file-input"), { target: { files: [photo()] } });
  await screen.findByText("Yuklandi", { exact: false });
};

beforeEach(() => {
  window.sessionStorage.clear();
  state.hqBranches = { data: { items: [{ id: "15", name: "Urgut filiali", berilishi_kerak: 4_250_000 }] } };
  cashboxRefetch.mockClear();
  branchPayment.mutateAsync.mockReset();
  courierPayment.mutateAsync.mockReset();
  branchPayment.mutateAsync.mockResolvedValue({ data: { statusCode: 200, data: { receipt: { id: "601", ai_status: "pending" } } } });
  courierPayment.mutateAsync.mockResolvedValue({ data: { statusCode: 200, data: { receipt: { id: "601", ai_status: "disabled" } } } });
  prepareImageMock.mockReset();
  prepareImageMock.mockResolvedValue({
    media_type: "image/jpeg",
    data_base64: btoa("jpeg"),
    preview: "data:image/jpeg;base64,AAAA",
    name: "IMG_7782.jpg",
    bytes: 1_100_000,
  });
  http.get.mockReset();
  http.post.mockReset();
  http.get.mockImplementation(async (url: string) =>
    url === "finance/receipt-settings"
      ? {
          data: {
            statusCode: 200,
            data: {
              manual_expense: { photo_required: true, ai_enabled: true },
              hq_transfer: { photo_required: true, ai_enabled: true },
            },
          },
        }
      : { data: { statusCode: 200, data: {} } },
  );
  http.post.mockImplementation(async () => ({
    data: { statusCode: 201, data: { receipt_id: "601", kind: "courier_to_hq", state: "draft", photo_url: null } },
  }));
});

describe("HQ'ga «O'tkazma» qabuli — chek rasmi (QlLf33Ma)", () => {
  it("tarix qatorida «Chek» belgisi (cashDetail qatorni qayta quradi — `receipt` yo'qolmasin)", async () => {
    renderAt("courier", superadmin, [
      {
        id: "9",
        amount: 100000,
        operation_type: "expense",
        source_type: "courier_payment",
        payment_method: "click",
        createdAt: "2026-10-06T09:50:00.000Z",
        receipt: { id: "601", ai_status: "mismatch" },
      },
    ]);

    expect(await screen.findByTitle("Chek: Farq bor")).toBeInTheDocument();
  });

  it("TC7: superadmin HQ kuryeri — «O'tkazma» da maydon bor, «Naqd» va «Marketga o'tkazma» da yo'q", async () => {
    const user = userEvent.setup();
    renderAt("courier");

    await chooseMethod(user, "Naqd");
    expect(screen.queryByText("Chek rasmi")).not.toBeInTheDocument();

    await chooseMethod(user, "O'tkazma");
    expect(await screen.findByRole("button", { name: /Chek rasmini yuklash/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sozlamalar" })).toBeInTheDocument();

    await chooseMethod(user, "Marketga o'tkazma");
    expect(screen.queryByText("Chek rasmi")).not.toBeInTheDocument();
  });

  it("TC7: menejerning kuryer qabulida maydon ham, sozlama so'rovi ham yo'q", async () => {
    const user = userEvent.setup();
    renderAt("courier", manager);

    await chooseMethod(user, "O'tkazma");
    expect(screen.queryByText("Chek rasmi")).not.toBeInTheDocument();
    expect(http.get.mock.calls.filter(([url]) => url === "finance/receipt-settings")).toHaveLength(0);
  });

  it("rasmsiz «O'tkazma» yuborilmaydi; naqd — cheksiz o'tadi va `receipt_id` yo'q", async () => {
    const user = userEvent.setup();
    renderAt("courier");
    setAmount("100000");

    await chooseMethod(user, "O'tkazma");
    await screen.findByRole("button", { name: /Chek rasmini yuklash/ });
    await user.click(screen.getByRole("button", { name: SUBMIT }));
    expect(await screen.findByText("Chek rasmini yuklang")).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(courierPayment.mutateAsync).not.toHaveBeenCalled();

    await chooseMethod(user, "Naqd");
    await user.click(screen.getByRole("button", { name: SUBMIT }));
    const confirm = await screen.findByRole("alertdialog", { name: "To'lovni tasdiqlang" });
    expect(within(confirm).queryByText("Chek")).not.toBeInTheDocument();
    await user.click(within(confirm).getByRole("button", { name: /Tasdiqlash/ }));
    await waitFor(() => expect(courierPayment.mutateAsync).toHaveBeenCalledTimes(1));
    expect((courierPayment.mutateAsync.mock.calls[0][0] as PaymentArg).data).not.toHaveProperty("receipt_id");
  });

  it("TC7: kuryer «O'tkazma» — `courier_to_hq` yuklanadi, `receipt_id` tanada, tasdiqda «Biriktirildi»", async () => {
    const user = userEvent.setup();
    renderAt("courier");
    setAmount("100000");
    await chooseMethod(user, "O'tkazma");
    await uploadPhoto();

    const [url, form] = http.post.mock.calls[0] as [string, FormData];
    expect(url).toBe("finance/receipts");
    expect(form.get("kind")).toBe("courier_to_hq");

    await user.click(screen.getByRole("button", { name: SUBMIT }));
    const confirm = await screen.findByRole("alertdialog", { name: "To'lovni tasdiqlang" });
    expect(within(confirm).getByText("Biriktirildi")).toBeInTheDocument();
    await user.click(within(confirm).getByRole("button", { name: /Tasdiqlash/ }));

    await waitFor(() => expect(courierPayment.mutateAsync).toHaveBeenCalledTimes(1));
    const { data } = courierPayment.mutateAsync.mock.calls[0][0] as PaymentArg;
    expect(data).toMatchObject({ courier_id: "77", amount: 100000, payment_method: "click", receipt_id: "601" });
  });

  it("TC8: filial → HQ — `branch_to_hq`, muvaffaqiyatda AI xabari va forma tozalanadi", async () => {
    const user = userEvent.setup();
    renderAt("branch");
    setAmount("4250000");
    await chooseMethod(user, "O'tkazma");
    await uploadPhoto();

    expect((http.post.mock.calls[0] as [string, FormData])[1].get("kind")).toBe("branch_to_hq");
    await user.click(screen.getByRole("button", { name: SUBMIT }));
    const confirm = await screen.findByRole("alertdialog", { name: "To'lovni tasdiqlang" });
    await user.click(within(confirm).getByRole("button", { name: /Tasdiqlash/ }));

    await waitFor(() => expect(branchPayment.mutateAsync).toHaveBeenCalledTimes(1));
    expect((branchPayment.mutateAsync.mock.calls[0][0] as PaymentArg).data).toMatchObject({
      branch_id: "15",
      payment_method: "click",
      receipt_id: "601",
    });
    expect(
      await screen.findByText("Asosiy filialga to'lov muvaffaqiyatli o'tkazildi. Chek AI tahlilida — natija tarixda ko'rinadi."),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Chek rasmi")).not.toBeInTheDocument());
  });

  it("`receipt_id` barmoq iziga kirmaydi: rasm almashsa ham kalit o'sha; `RECEIPT_ALREADY_USED` maydon ostida", async () => {
    courierPayment.mutateAsync.mockRejectedValueOnce(
      Object.assign(new Error("409"), {
        response: { status: 409, data: { statusCode: 409, code: "RECEIPT_ALREADY_USED", message: "Chek ishlatilgan" } },
      }),
    );
    const user = userEvent.setup();
    renderAt("courier");
    setAmount("100000");
    await chooseMethod(user, "O'tkazma");
    await uploadPhoto();

    await user.click(screen.getByRole("button", { name: SUBMIT }));
    await user.click(within(await screen.findByRole("alertdialog", { name: "To'lovni tasdiqlang" })).getByRole("button", { name: /Tasdiqlash/ }));
    expect(
      await screen.findByText("Chek topilmadi yoki boshqa operatsiyaga biriktirilgan — rasmni qayta yuklang"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Chek ishlatilgan")).not.toBeInTheDocument();

    http.post.mockImplementationOnce(async () => ({ data: { statusCode: 201, data: { receipt_id: "602" } } }));
    await uploadPhoto();
    await user.click(screen.getByRole("button", { name: SUBMIT }));
    await user.click(within(await screen.findByRole("alertdialog", { name: "To'lovni tasdiqlang" })).getByRole("button", { name: /Tasdiqlash/ }));

    await waitFor(() => expect(courierPayment.mutateAsync).toHaveBeenCalledTimes(2));
    const [first, second] = courierPayment.mutateAsync.mock.calls.map(([arg]) => arg as PaymentArg);
    expect(second.data.receipt_id).toBe("602");
    expect(second.idempotencyKey).toBe(first.idempotencyKey);
  });
});
