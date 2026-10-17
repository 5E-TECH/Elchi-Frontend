import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import MainCashbox from "./mainCashbox";
import { renderWithProviders } from "../../../test/test-utils";

/**
 * «Kassani to'ldirish» / «Kassadan xarajat» (dizayn v2):
 *  - pul harakati TASDIQ bilan: bekor qilinsa so'rov KETMAYDI, «Tasdiqlash» dan keyin payload eski shaklda
 *    aynan `{ amount, type, comment }`;
 *  - ega qarori D3 (2026-10-17): `Idempotency-Key` sarlavhasi — javob kelmagan (504) operatsiya qayta
 *    yuborilsa o'sha kalit, muvaffaqiyatdan keyingi yangi operatsiyaga yangi kalit; takroriy javob
 *    (`idempotent: true`) «muvaffaqiyatli» deb ko'rsatilmaydi;
 *  - yuborilayotganda ikkinchi yuborish yo'q.
 *
 * Haqiqiy `useCashBox` (react-query), haqiqiy oyna va `ConfirmHost` — faqat HTTP qatlami almashtirilgan.
 */

type PatchCall = [string, Record<string, unknown>, { headers?: Record<string, string> } | undefined];

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));

vi.mock("../../../shared/api/api", () => ({
  api: http,
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));
vi.mock("./lib/exportMainCashboxReport", () => ({ exportMainCashboxReport: vi.fn() }));
vi.mock("../../../entities/user/api/userApi", () => ({
  useUser: () => ({
    useGetUser: () => ({ data: undefined, isLoading: false }),
    useGetManagers: () => ({ data: undefined, isLoading: false }),
    useGetCouriers: () => ({ data: undefined, isLoading: false }),
  }),
}));
vi.mock("../../../entities/markets", () => ({
  useMarkets: () => ({ useGetMarkets: () => ({ data: undefined, isLoading: false }) }),
}));
vi.mock("../../../entities/branch/api/useBranches", () => ({
  useBranches: () => ({ data: undefined, isLoading: false }),
}));
vi.mock("./SalaryPaymentPopup", () => ({ default: () => null }));
vi.mock("./MainCashboxBalanceChart", () => ({ default: () => null }));

const FILL_URL = "finance/cashbox/fill";
const SPEND_URL = "finance/cashbox/spend";

const superadmin = { role: { id: "1", role: "superadmin", region: null, name: "Admin" } } as never;
const manager = {
  role: { id: "198", role: "manager", region: null, name: "Menejer" },
  user: {
    user: {
      id: "198",
      name: "Ravshan Ortiqov",
      role: "manager",
      branch: { id: "7", branch: { id: "7", name: "Urgut filiali" } },
    },
    isAuthenticated: true,
    accessToken: "token",
    loading: false,
    isAppInitializing: false,
    error: null,
  },
} as never;

const patches = (url: string) =>
  (http.patch.mock.calls as PatchCall[]).filter(([patchUrl]) => patchUrl === url);

const httpError = (status: number, message: string) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status, data: { statusCode: status, message } },
  });

const open = (preloadedState: never = superadmin) =>
  renderWithProviders(<MainCashbox />, { route: "/payments/main-cashbox", preloadedState });

/** Oynani ochib, maydonlarni to'ldiradi va «saqlash» ni bosadi (tasdiq oynasi ochiladi). */
const fillForm = async (
  user: ReturnType<typeof userEvent.setup>,
  { action, title, amount, type, comment }: { action: RegExp; title: string; amount: string; type: string; comment: string },
) => {
  await user.click(screen.getByRole("button", { name: action }));
  const dialog = await screen.findByRole("dialog", { name: title });
  await user.type(within(dialog).getByLabelText(/^Summa/), amount);
  await user.click(within(dialog).getByRole("radio", { name: type }));
  await user.type(within(dialog).getByLabelText(/^Izoh/), comment);
  return dialog;
};

beforeEach(() => {
  window.sessionStorage.clear();
  http.get.mockReset();
  http.post.mockReset();
  http.patch.mockReset();
  http.get.mockImplementation(async () => ({ data: { statusCode: 200, message: "success", data: {} } }));
  http.patch.mockImplementation(async () => ({ data: { statusCode: 200, message: "ok", data: { id: "900" } } }));
});

describe("Main cashbox — fill / spend (v2 form + confirmation)", () => {
  it("fill: mockup texts; empty save shows the field errors and sends nothing", async () => {
    const user = userEvent.setup();
    open();

    await user.click(screen.getByRole("button", { name: /Kassani to'ldirish/ }));
    const dialog = await screen.findByRole("dialog", { name: "Kassani to'ldirish" });
    expect(within(dialog).getByText("Kirim operatsiyasi · Asosiy kassa")).toBeInTheDocument();
    expect(within(dialog).getByPlaceholderText("Masalan: bank hisobidan naqd olindi")).toBeInTheDocument();
    expect(within(dialog).getByRole("radio", { name: "Naqd" })).toBeInTheDocument();
    expect(within(dialog).getByRole("radio", { name: "Karta (Click)" })).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Kirimni saqlash" }));

    expect(await within(dialog).findByText("Summa majburiy")).toBeInTheDocument();
    expect(within(dialog).getByText("To'lov turini tanlang")).toBeInTheDocument();
    expect(within(dialog).getByText("Izoh majburiy — pul qayerdan kelganini yozing")).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(http.patch).not.toHaveBeenCalled();
  });

  it("fill: cancelling the confirmation sends nothing; confirming sends exactly { amount, type, comment } with an Idempotency-Key", async () => {
    const user = userEvent.setup();
    open();

    const dialog = await fillForm(user, {
      action: /Kassani to'ldirish/,
      title: "Kassani to'ldirish",
      amount: "2000000",
      type: "Naqd",
      comment: "  Bank hisobidan naqd olindi ",
    });
    expect(within(dialog).getByLabelText(/^Summa/)).toHaveValue("2 000 000");

    await user.click(within(dialog).getByRole("button", { name: "Kirimni saqlash" }));
    let confirm = await screen.findByRole("alertdialog", { name: "Kirimni tasdiqlang" });
    expect(within(confirm).getByText("Tekshirib chiqing — tasdiqlangach, summa kassada darhol aks etadi.")).toBeInTheDocument();
    expect(within(confirm).getByText(/2 000 000/)).toBeInTheDocument();
    expect(within(confirm).getByText("Naqd")).toBeInTheDocument();
    expect(within(confirm).getByText("Asosiy kassa")).toBeInTheDocument();
    expect(within(confirm).getByText("Bank hisobidan naqd olindi")).toBeInTheDocument();

    await user.click(within(confirm).getByRole("button", { name: "Bekor qilish" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(http.patch).not.toHaveBeenCalled();
    // Forma qiymatlari joyida — qayta tasdiqlash mumkin.
    expect(within(dialog).getByLabelText(/^Summa/)).toHaveValue("2 000 000");

    await user.click(within(dialog).getByRole("button", { name: "Kirimni saqlash" }));
    confirm = await screen.findByRole("alertdialog", { name: "Kirimni tasdiqlang" });
    await user.click(within(confirm).getByRole("button", { name: "Tasdiqlash" }));

    await waitFor(() => expect(patches(FILL_URL)).toHaveLength(1));
    const [, body, config] = patches(FILL_URL)[0];
    expect(body).toEqual({ amount: 2_000_000, type: "cash", comment: "Bank hisobidan naqd olindi" });
    expect(config?.headers?.["Idempotency-Key"]).toEqual(expect.any(String));
    expect(config?.headers?.["Idempotency-Key"]).not.toHaveLength(0);
    expect(patches(SPEND_URL)).toHaveLength(0);
    expect(await screen.findByText("Kassa muvaffaqiyatli to'ldirildi")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Kassani to'ldirish" })).not.toBeInTheDocument());
  });

  it("spend: card payment goes to /spend with type=click after «Xarajatni tasdiqlang»", async () => {
    const user = userEvent.setup();
    open();

    const dialog = await fillForm(user, {
      action: /Kassadan xarajat/,
      title: "Kassadan xarajat",
      amount: "150000",
      type: "Karta (Click)",
      comment: "Ofis ijarasi, oktabr",
    });
    expect(within(dialog).getByText("Chiqim operatsiyasi · Asosiy kassa")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Xarajatni saqlash" }));
    const confirm = await screen.findByRole("alertdialog", { name: "Xarajatni tasdiqlang" });
    await user.click(within(confirm).getByRole("button", { name: "Tasdiqlash" }));

    await waitFor(() => expect(patches(SPEND_URL)).toHaveLength(1));
    expect(patches(SPEND_URL)[0][1]).toEqual({ amount: 150_000, type: "click", comment: "Ofis ijarasi, oktabr" });
    expect(patches(SPEND_URL)[0][2]?.headers?.["Idempotency-Key"]).toEqual(expect.any(String));
    expect(patches(FILL_URL)).toHaveLength(0);
    expect(await screen.findByText("Xarajat muvaffaqiyatli saqlandi")).toBeInTheDocument();
  });

  it("504 keeps the key: the retry of the same operation reuses it; the next new operation gets a new key", async () => {
    http.patch.mockImplementationOnce(async () => {
      throw httpError(504, "Gateway Timeout");
    });
    const user = userEvent.setup();
    open();

    const dialog = await fillForm(user, {
      action: /Kassani to'ldirish/,
      title: "Kassani to'ldirish",
      amount: "500000",
      type: "Naqd",
      comment: "Kassaga maydalash uchun naqd",
    });
    const save = within(dialog).getByRole("button", { name: "Kirimni saqlash" });
    await user.click(save);
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Tasdiqlash" }));

    await waitFor(() => expect(patches(FILL_URL)).toHaveLength(1));
    expect(await screen.findByText(/Server javob bermadi — operatsiya o'tgan bo'lishi mumkin/)).toBeInTheDocument();
    // Oyna ochiq qoladi — aynan shu operatsiyani qayta yuborish mumkin.
    expect(screen.getByRole("dialog", { name: "Kassani to'ldirish" })).toBeInTheDocument();
    const firstKey = patches(FILL_URL)[0][2]?.headers?.["Idempotency-Key"];

    await user.click(within(dialog).getByRole("button", { name: "Kirimni saqlash" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Tasdiqlash" }));
    await waitFor(() => expect(patches(FILL_URL)).toHaveLength(2));
    expect(patches(FILL_URL)[1][2]?.headers?.["Idempotency-Key"]).toBe(firstKey);
    expect(patches(FILL_URL)[1][1]).toEqual(patches(FILL_URL)[0][1]);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Kassani to'ldirish" })).not.toBeInTheDocument());

    // Muvaffaqiyatdan keyin xuddi shunday yangi operatsiya — YANGI kalit (ikkinchi haqiqiy kirim yutilmasin).
    const again = await fillForm(user, {
      action: /Kassani to'ldirish/,
      title: "Kassani to'ldirish",
      amount: "500000",
      type: "Naqd",
      comment: "Kassaga maydalash uchun naqd",
    });
    await user.click(within(again).getByRole("button", { name: "Kirimni saqlash" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Tasdiqlash" }));
    await waitFor(() => expect(patches(FILL_URL)).toHaveLength(3));
    expect(patches(FILL_URL)[2][2]?.headers?.["Idempotency-Key"]).not.toBe(firstKey);
  });

  it("an idempotent replay is not reported as a new success", async () => {
    http.patch.mockImplementationOnce(async () => ({
      data: { statusCode: 200, message: "Kassa chiqimi allaqachon bajarilgan (takroriy so'rov)", data: { idempotent: true } },
    }));
    const user = userEvent.setup();
    open();

    const dialog = await fillForm(user, {
      action: /Kassadan xarajat/,
      title: "Kassadan xarajat",
      amount: "120000",
      type: "Naqd",
      comment: "Kanselyariya tovarlari",
    });
    await user.click(within(dialog).getByRole("button", { name: "Xarajatni saqlash" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Tasdiqlash" }));

    expect(await screen.findByText(/Bu operatsiya allaqachon yozilgan/)).toBeInTheDocument();
    expect(screen.queryByText("Xarajat muvaffaqiyatli saqlandi")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Kassadan xarajat" })).not.toBeInTheDocument());
  });

  it("a definite backend error keeps the form open and shows the backend message", async () => {
    http.patch.mockImplementationOnce(async () => {
      throw httpError(400, "Kassada ochiq smena yo'q");
    });
    const user = userEvent.setup();
    open();

    const dialog = await fillForm(user, {
      action: /Kassadan xarajat/,
      title: "Kassadan xarajat",
      amount: "120000",
      type: "Naqd",
      comment: "Kanselyariya tovarlari",
    });
    await user.click(within(dialog).getByRole("button", { name: "Xarajatni saqlash" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Tasdiqlash" }));

    expect(await screen.findByText("Kassada ochiq smena yo'q")).toBeInTheDocument();
    expect(screen.queryByText(/Server javob bermadi/)).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Kassadan xarajat" })).toBeInTheDocument();
  });

  it("while the request is in flight a second save sends nothing more", async () => {
    let release: (value: unknown) => void = () => undefined;
    http.patch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const user = userEvent.setup();
    open();

    const dialog = await fillForm(user, {
      action: /Kassani to'ldirish/,
      title: "Kassani to'ldirish",
      amount: "300000",
      type: "Naqd",
      comment: "Qaytim uchun",
    });
    await user.click(within(dialog).getByRole("button", { name: "Kirimni saqlash" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Tasdiqlash" }));
    await waitFor(() => expect(patches(FILL_URL)).toHaveLength(1));

    // Tugma yuklanishda (`aria-busy`) — bosish ham, Enter ham qayta yubormaydi; tasdiq qayta ochilmaydi.
    const busyButton = within(dialog).getByRole("button", { name: /Saqlanmoqda/ });
    expect(busyButton).toHaveAttribute("aria-busy", "true");
    await user.click(busyButton);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(patches(FILL_URL)).toHaveLength(1);

    release({ data: { statusCode: 200, data: { id: "901" } } });
    expect(await screen.findByText("Kassa muvaffaqiyatli to'ldirildi")).toBeInTheDocument();
    expect(patches(FILL_URL)).toHaveLength(1);
  });

  it("manager: the confirmation names the own branch cashbox; the payload is unchanged", async () => {
    const user = userEvent.setup();
    open(manager);

    const dialog = await fillForm(user, {
      action: /Kassadan xarajat/,
      title: "Kassadan xarajat",
      amount: "120000",
      type: "Naqd",
      comment: "Kanselyariya tovarlari",
    });
    await user.click(within(dialog).getByRole("button", { name: "Xarajatni saqlash" }));
    const confirm = await screen.findByRole("alertdialog", { name: "Xarajatni tasdiqlang" });
    expect(within(confirm).getByText("Urgut filiali")).toBeInTheDocument();
    await user.click(within(confirm).getByRole("button", { name: "Tasdiqlash" }));

    await waitFor(() => expect(patches(SPEND_URL)).toHaveLength(1));
    expect(patches(SPEND_URL)[0][1]).toEqual({ amount: 120_000, type: "cash", comment: "Kanselyariya tovarlari" });
  });
});
