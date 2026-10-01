import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import TransferCourierButton from "./TransferCourierButton";
import TransferCourierModal from "./TransferCourierModal";

// Backend parallel quriladi — so'rovlar `api` moduli darajasida soxtalashtiriladi.
const mocks = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }));
vi.mock("../../../shared/api/instance", () => ({
  api: { get: mocks.get, patch: mocks.patch },
}));

// SearchableSelect ochilganda variantni ko'rinishga aylantiradi — jsdom'da yo'q.
const scrollIntoView = Element.prototype.scrollIntoView;
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
afterAll(() => {
  Element.prototype.scrollIntoView = scrollIntoView;
});

const COURIER_ID = "263";
const CHECK_URL = `couriers/${COURIER_ID}/transfer-check`;
const DESTINATIONS_URL = "branches/dispatch-destinations";

const HQ_BRANCH = { id: "1", name: "Bosh ofis", type: "HQ" };
const SIRDARYO_BRANCH = { id: "15", name: "E2E Filial Sirdaryo", type: "REGIONAL" };
const SAMARQAND_BRANCH = { id: "7", name: "Samarqand", type: "REGIONAL" };

const CHECK_UNAVAILABLE =
  "Kuryer kassasi va qo'lidagi buyurtmalarni tekshirib bo'lmadi (xizmat javob bermadi). Birozdan so'ng qayta urinib ko'ring.";
const OK_TEXT = "Kuryerda pul va buyurtma yo'q — o'tkazish mumkin";
const BLOCKED_TEXT = "Hozircha o'tkazib bo'lmaydi";
const PLACEHOLDER = "Yangi filialni tanlang";

/** Shartnoma §1: GET /couriers/:id/transfer-check javobining `data` qismi. */
const checkData = (overrides: Record<string, unknown> = {}) => ({
  user_id: COURIER_ID,
  current_branch: HQ_BRANCH,
  hq_branch: { id: HQ_BRANCH.id, name: HQ_BRANCH.name },
  has_cashbox: true,
  balance: 0,
  balance_cash: 0,
  balance_card: 0,
  pending_settlement_count: 0,
  pending_settlement_amount: 0,
  carry_amount: 0,
  orders_in_hand: 0,
  orders_sample: [],
  open_return_posts: 0,
  return_posts_sample: [],
  pending_extra_cost_approvals: 0,
  reasons: [],
  can_transfer: true,
  ...overrides,
});

const blockedCheck = (reasons: string[], overrides: Record<string, unknown> = {}) =>
  checkData({ reasons, can_transfer: false, ...overrides });

const destination = (
  branch: { id: string; name: string; type: string },
  overrides: Record<string, unknown> = {},
) => ({
  id: branch.id,
  name: branch.name,
  code: branch.name.slice(0, 3).toUpperCase(),
  type: branch.type,
  status: "active",
  region_id: "12",
  region: { id: "12", name: "Sirdaryo" },
  has_manager: true,
  manager: { id: `m-${branch.id}`, name: `${branch.name} menejeri` },
  ...overrides,
});

// C5: faqat faol REGIONAL/HYBRID keladi; PICKUP qatori — himoya tekshiruvi uchun.
const DESTINATIONS = [
  destination(SIRDARYO_BRANCH),
  destination(SAMARQAND_BRANCH),
  destination({ id: "16", name: "Buxoro", type: "HYBRID" }, { has_manager: false, manager: null }),
  destination({ id: "30", name: "Chilonzor PICKUP", type: "PICKUP" }),
];

const ok = (data: unknown) => Promise.resolve({ data: { statusCode: 200, message: "ok", data } });

const httpError = (status: number, message: string) => ({
  isAxiosError: true,
  message: `Request failed with status code ${status}`,
  response: { status, data: { statusCode: status, message, trace_id: "t-1" } },
});

/** Har bir chaqiruvda navbatdagi tekshiruv javobi (oxirgisi takrorlanadi). */
const mockApi = (checks: Array<() => Promise<unknown>>) => {
  let call = 0;
  mocks.get.mockImplementation((url: string) => {
    if (url === CHECK_URL) {
      const next = checks[Math.min(call, checks.length - 1)];
      call += 1;
      return next();
    }
    if (url === DESTINATIONS_URL) {
      return ok({ items: DESTINATIONS, total: DESTINATIONS.length });
    }
    return Promise.reject(new Error(`kutilmagan GET ${url}`));
  });
};

const checkCalls = () => mocks.get.mock.calls.filter(([url]) => url === CHECK_URL).length;

/** Oddiy bo'shliq bilan — Testing Library NBSP ni ham bo'shliqqa aylantiradi. */
const som = (amount: number) => `${amount.toLocaleString("uz-UZ")} so'm`.replace(/\s+/g, " ");

const roleState = (role: string) =>
  ({ role: { id: `${role}-1`, role, region: null, name: role } }) as never;

const renderModal = () => {
  const onClose = vi.fn();
  const utils = renderWithProviders(
    <TransferCourierModal open courierId={COURIER_ID} courierName="E2E Kuryer" onClose={onClose} />,
    { preloadedState: roleState("superadmin") },
  );
  return { ...utils, onClose };
};

const openTargets = async () => {
  const user = userEvent.setup();
  await screen.findByText(OK_TEXT);
  await user.click(screen.getByRole("button", { name: PLACEHOLDER }));
  return user;
};

describe("TransferCourierModal — kuryer holati", () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.patch.mockReset();
  });

  it("shows the current branch, the uz-UZ balance and the orders in hand", async () => {
    mockApi([
      () =>
        ok(
          blockedCheck(["kuryer qo'lida 150 000 so'm pul bor"], {
            current_branch: SIRDARYO_BRANCH,
            balance: 150000,
            orders_in_hand: 7,
            orders_sample: [101, 102, 103, 104, 105].map((id) => ({ id, status: "on the road" })),
          }),
        ),
    ]);
    renderModal();

    expect(await screen.findByText(som(150000))).toBeInTheDocument();
    expect(screen.getByText("E2E Filial Sirdaryo")).toBeInTheDocument();
    expect(screen.getByText("7 (#101, #102, #103, #104, #105, …)")).toBeInTheDocument();
    expect(screen.getByText("E2E Kuryer")).toBeInTheDocument();
    expect(mocks.get).toHaveBeenCalledWith(CHECK_URL);
  });

  it("says 'not assigned' for an orphan courier", async () => {
    mockApi([() => ok(checkData({ current_branch: null }))]);
    renderModal();

    expect(await screen.findByText("Filialga biriktirilmagan")).toBeInTheDocument();
  });

  it("lists every server reason verbatim and keeps the submit disabled", async () => {
    const reasons = [
      "kuryer qo'lida 150 000 so'm pul bor — avval uni 'E2E Filial Sirdaryo' filiali menejeri qabul qilib olsin.",
      "kuryer qo'lida 7 ta yakunlanmagan buyurtma bor (#101, #102, #103, #104, #105 va yana 2 ta) — avval ularni yetkazing yoki filialga qaytaring.",
      "kuryer topshirgan 1 ta bekor qilingan pochta hali qabul qilinmagan (#88) — avval filial ularni qabul qilsin.",
    ];
    mockApi([
      () => ok(blockedCheck(reasons, { current_branch: SIRDARYO_BRANCH, balance: 150000 })),
    ]);
    renderModal();

    expect(await screen.findByText(BLOCKED_TEXT)).toBeInTheDocument();
    for (const reason of reasons) {
      expect(screen.getByText(reason)).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "O'tkazish" })).toBeDisabled();
    expect(screen.getByRole("button", { name: PLACEHOLDER })).toBeDisabled();
    expect(screen.queryByText(OK_TEXT)).not.toBeInTheDocument();
  });

  it("an HQ courier with money gets a link to receive it into the main cashbox", async () => {
    mockApi([
      () =>
        ok(
          blockedCheck(
            [
              "kuryer qo'lida 50 000 so'm pul bor — avval uni Asosiy kassaga qabul qiling (To'lovlar → Qabul qilinishi kerak).",
            ],
            { balance: 50000 },
          ),
        ),
    ]);
    renderModal();

    const link = await screen.findByRole("link", { name: "Pulni qabul qilish" });
    expect(link).toHaveAttribute("href", "/payments/cash-detail/263?type=courier");
    expect(screen.queryByText(/filiali menejeri qabul qilishi kerak/)).not.toBeInTheDocument();
  });

  it("a branch courier with money gets the manager hint and NO payments link", async () => {
    mockApi([
      () =>
        ok(
          blockedCheck(
            [
              "kuryer qo'lida 150 000 so'm pul bor — avval uni 'E2E Filial Sirdaryo' filiali menejeri qabul qilib olsin.",
            ],
            { current_branch: SIRDARYO_BRANCH, balance: 150000 },
          ),
        ),
    ]);
    renderModal();

    expect(
      await screen.findByText("Pulni 'E2E Filial Sirdaryo' filiali menejeri qabul qilishi kerak"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Pulni qabul qilish" })).not.toBeInTheDocument();
  });

  it("refuses the move when the reply is malformed (can_transfer true, reasons missing)", async () => {
    const malformed = checkData();
    delete (malformed as Record<string, unknown>).reasons;
    mockApi([() => ok(malformed)]);
    renderModal();

    expect(await screen.findByText(BLOCKED_TEXT)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "O'tkazish" })).toBeDisabled();
  });
});

describe("TransferCourierModal — yangi filial tanlovi", () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.patch.mockReset();
  });

  it("offers HQ plus the dispatch destinations, without the current branch or PICKUP", async () => {
    mockApi([() => ok(checkData({ current_branch: SAMARQAND_BRANCH }))]);
    renderModal();
    await openTargets();

    expect(
      await screen.findByRole("button", { name: "E2E Filial Sirdaryo · Viloyat" }),
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: "Bosh ofis · HQ" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Buxoro · Aralash (menejer yo'q)" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /^Samarqand/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /PICKUP/ })).not.toBeInTheDocument();
    expect(mocks.get).toHaveBeenCalledWith(DESTINATIONS_URL, { params: undefined });
  });

  it("does not offer HQ to a courier who is already at HQ", async () => {
    mockApi([() => ok(checkData())]);
    renderModal();
    await openTargets();

    expect(
      await screen.findByRole("button", { name: "E2E Filial Sirdaryo · Viloyat" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bosh ofis · HQ" })).not.toBeInTheDocument();
  });

  it("keeps the submit disabled until a target is chosen", async () => {
    mockApi([() => ok(checkData())]);
    renderModal();

    expect(await screen.findByText(OK_TEXT)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "O'tkazish" })).toBeDisabled();
  });
});

describe("TransferCourierModal — o'tkazish", () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.patch.mockReset();
  });

  it("PATCHes branch_id with the long timeout, toasts success, closes and refreshes the lists", async () => {
    mockApi([() => ok(checkData())]);
    mocks.patch.mockResolvedValue({
      data: {
        statusCode: 200,
        message: "Kuryer 'E2E Filial Sirdaryo' filialiga o'tkazildi",
        data: { user_id: COURIER_ID, from_branch_id: "1", to_branch_id: "15", region_id: "12" },
      },
    });
    const { onClose, queryClient } = renderModal();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    const user = await openTargets();
    await user.click(await screen.findByRole("button", { name: "E2E Filial Sirdaryo · Viloyat" }));
    await user.click(screen.getByRole("button", { name: "O'tkazish" }));

    await waitFor(() => expect(mocks.patch).toHaveBeenCalledTimes(1));
    expect(mocks.patch).toHaveBeenCalledWith(
      "couriers/263/branch",
      { branch_id: "15" },
      expect.objectContaining({ timeout: 120000 }),
    );
    expect(
      await screen.findByText("E2E Kuryer 'E2E Filial Sirdaryo' filialiga o'tkazildi"),
    ).toBeInTheDocument();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));

    const invalidatedKeys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(invalidatedKeys).toEqual(
      expect.arrayContaining([
        ["branches"],
        ["couriers"],
        ["user"],
        ["users"],
        ["mails", "couriers-by-region"],
        ["courier-transfer"],
      ]),
    );
  });

  it("shows the 409 reason verbatim, stays open and re-checks so fresh reasons appear", async () => {
    const newReason =
      "kuryer qo'lida 1 ta yakunlanmagan buyurtma bor (#555) — avval ularni yetkazing yoki filialga qaytaring.";
    const reverted = `Kuryer o'tkazilmadi — o'tkazish paytida kuryerda yangi buyurtma yoki pul paydo bo'ldi, o'zgarish bekor qilindi: ${newReason}`;
    mockApi([() => ok(checkData()), () => ok(blockedCheck([newReason]))]);
    mocks.patch.mockRejectedValue(httpError(409, reverted));
    const { onClose } = renderModal();

    const user = await openTargets();
    await user.click(await screen.findByRole("button", { name: "E2E Filial Sirdaryo · Viloyat" }));
    await user.click(screen.getByRole("button", { name: "O'tkazish" }));

    expect(await screen.findByText(reverted)).toBeInTheDocument();
    await waitFor(() => expect(checkCalls()).toBe(2));
    expect(await screen.findByText(newReason)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "O'tkazish" })).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("a 503 from the transfer is shown verbatim and the check is refreshed too", async () => {
    const txFailed =
      "Kuryerni o'tkazishda ma'lumotlar bazasi xatosi — o'tkazish bajarilmadi. Qayta urinib ko'ring";
    mockApi([() => ok(checkData())]);
    mocks.patch.mockRejectedValue(httpError(503, txFailed));
    const { onClose } = renderModal();

    const user = await openTargets();
    await user.click(await screen.findByRole("button", { name: "E2E Filial Sirdaryo · Viloyat" }));
    await user.click(screen.getByRole("button", { name: "O'tkazish" }));

    expect(await screen.findByText(txFailed)).toBeInTheDocument();
    await waitFor(() => expect(checkCalls()).toBe(2));
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("TransferCourierModal — tekshiruv yiqilsa", () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.patch.mockReset();
  });

  it("shows the 503 message inline with a retry that re-checks", async () => {
    mockApi([() => Promise.reject(httpError(503, CHECK_UNAVAILABLE)), () => ok(checkData())]);
    renderModal();

    expect(await screen.findByText(CHECK_UNAVAILABLE)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "O'tkazish" })).toBeDisabled();

    await userEvent.setup().click(screen.getByRole("button", { name: "Qayta tekshirish" }));

    expect(await screen.findByText(OK_TEXT)).toBeInTheDocument();
    expect(checkCalls()).toBe(2);
    expect(screen.queryByText(CHECK_UNAVAILABLE)).not.toBeInTheDocument();
  });

  it("falls back to the generic text when there is no server message (network)", async () => {
    mockApi([() => Promise.reject({ isAxiosError: true, message: "Network Error" })]);
    renderModal();

    expect(
      await screen.findByText("Tekshirib bo'lmadi — birozdan so'ng qayta urinib ko'ring"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Network Error")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "O'tkazish" })).toBeDisabled();
  });
});

describe("TransferCourierButton", () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.patch.mockReset();
    mockApi([() => ok(checkData())]);
  });

  it.each(["superadmin", "admin"])("%s opens the modal from the header button", async (role) => {
    renderWithProviders(
      <TransferCourierButton variant="header" courierId={COURIER_ID} courierName="E2E Kuryer" />,
      { preloadedState: roleState(role) },
    );

    expect(mocks.get).not.toHaveBeenCalled();
    await userEvent.setup().click(screen.getByRole("button", { name: "Filialni o'zgartirish" }));

    expect(await screen.findByText("Kuryerni boshqa filialga o'tkazish")).toBeInTheDocument();
    expect(await screen.findByText(OK_TEXT)).toBeInTheDocument();
    expect(mocks.get).toHaveBeenCalledWith(CHECK_URL);
  });

  it("the row variant is an icon button named for screen readers", () => {
    renderWithProviders(<TransferCourierButton variant="row" courierId={COURIER_ID} />, {
      preloadedState: roleState("superadmin"),
    });

    expect(screen.getByRole("button", { name: "Boshqa filialga o'tkazish" })).toBeInTheDocument();
  });

  it.each(["manager", "registrator", "courier", "market"])("%s never sees it", (role) => {
    renderWithProviders(<TransferCourierButton variant="header" courierId={COURIER_ID} />, {
      preloadedState: roleState(role),
    });

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(mocks.get).not.toHaveBeenCalled();
  });
});
