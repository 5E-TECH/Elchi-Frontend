import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import i18n from "../../../i18n";
import { handleFinanceEvent } from "../../../app/providers/realtimeFinance";
import { renderWithProviders } from "../../../test/test-utils";
import FinanceHistoryDetailPopup from "./FinanceHistoryDetailPopup";
import PaymentHistoryList from "./PaymentHistoryList";
import PaymentHistoryTable, { type PaymentRow } from "./patmentHistoryTable";

/**
 * QlLf33Ma, 8-bosqich — tarixda chek (TZ 4–6, 10, 12): tafsilotdagi «Chek» bo'limi (olti holat, `ai_stale`, bayroqlar),
 * ko'ruvchi (Moslash ↔ 100%, havola eskirsa qayta so'raladi), «Qayta tahlil» (`can_reanalyze`, tasdiq, xato oynada),
 * realtime `finance.receipt.checked` — sahifa yangilanmay natija, ro'yxat belgilari. Faqat HTTP qatlami almashtirilgan.
 */

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
vi.mock("../../../shared/api/api", () => ({ api: http, API_TIMEOUT_MS: 20_000, LONG_REQUEST_TIMEOUT_MS: 120_000 }));

const superadmin = { role: { id: "1", role: "superadmin", region: null, name: "SA" } } as never;
const manager = { role: { id: "198", role: "manager", region: null, name: "Menejer" } } as never;

const row: PaymentRow = {
  id: "11",
  amount: 145000,
  operation_type: "expense",
  source_type: "manual_expense",
  cashbox_type: "main",
  payment_method: "click",
  payment_date: "2026-10-06T09:50:00.000Z",
  receipt: { id: "501", ai_status: "mismatch" },
};

const ai = (patch: Record<string, unknown> = {}) => ({
  amount: 150000,
  difference: 5000,
  currency: "UZS",
  date: "2026-10-06T09:44:00.000Z",
  recipient: "Toza Makon MChJ",
  recipient_last4: "5521",
  payer: "Elchi Pochta MChJ",
  payer_last4: "1234",
  bank: "Agrobank",
  reference: "748221093551",
  confidence: 0.94,
  flags: [],
  checked_at: "2026-10-06T09:51:00.000Z",
  attempts: 1,
  max_attempts: 5,
  error_reason: null,
  ...patch,
});

const receipt = (patch: Record<string, unknown> = {}) => ({
  id: "501",
  kind: "manual_expense",
  history_id: "11",
  counter_history_id: null,
  entered_amount: 145000,
  payment_method: "click",
  photo_url: "https://api.example/files/signed/token-1",
  photo_url_expires_in: 300,
  uploaded_by: { id: "7", name: "Shodiyor Ergashev" },
  uploaded_at: "2026-10-06T09:48:00.000Z",
  ai_status: "mismatch",
  ai_stale: false,
  can_reanalyze: true,
  ai: ai(),
  ...patch,
});

let current: Record<string, unknown> = receipt();
let receiptFails = false;

const receiptReads = () => http.get.mock.calls.filter(([url]) => url === "finance/receipts/501").length;
const open = (preloadedState: never = superadmin, value: PaymentRow = row) =>
  renderWithProviders(<FinanceHistoryDetailPopup row={value} onClose={vi.fn()} />, { preloadedState });
const section = () => screen.findByTestId("receipt-section");

beforeEach(() => {
  current = receipt();
  receiptFails = false;
  Object.values(http).forEach((fn) => fn.mockReset());
  http.get.mockImplementation(async (url: string) => {
    if (url === "finance/receipts/501") {
      if (receiptFails) throw Object.assign(new Error("500"), { response: { status: 500, data: {} } });
      return { data: { statusCode: 200, data: current } };
    }
    if (url === "finance/history/11") {
      return { data: { statusCode: 200, data: { id: "11", amount: 145000, receipt: { id: "501", ai_status: "mismatch" } } } };
    }
    return { data: { statusCode: 200, data: {} } };
  });
  http.post.mockImplementation(async () => ({ data: { statusCode: 202, data: { receipt_id: "501", ai_status: "pending" } } }));
});

describe("«Chek» bo'limi (QlLf33Ma)", () => {
  it("TC5: «Farq bor» — chekda 150 000, kiritilgan 145 000, farq +5 000; AI maydonlari va yuklagan xodim", async () => {
    open();
    const box = await section();

    expect(await within(box).findByText("Farq bor")).toBeInTheDocument();
    const compare = within(box).getByRole("group", { name: "Summalar solishtiruvi" });
    expect(compare).toHaveTextContent("Chekda150 000 so'm");
    expect(compare).toHaveTextContent("Kiritilgan145 000 so'm");
    expect(compare).toHaveTextContent("Farq+5 000 so'm");
    expect(within(box).getByText("Agrobank")).toBeInTheDocument();
    expect(within(box).getByText("··5521")).toBeInTheDocument();
    expect(within(box).getByText("748221093551")).toBeInTheDocument();
    expect(within(box).getByText("94%")).toBeInTheDocument();
    expect(within(box).getByText(/^Yukladi: Shodiyor Ergashev · /)).toBeInTheDocument();
    expect(within(box).getByText(/^AI tekshirdi: /)).toBeInTheDocument();
    expect(within(box).getByRole("button", { name: "Qayta tahlil" })).toBeEnabled();
  });

  it("«Mos keldi» — qayta tahlil yo'q", async () => {
    current = receipt({ ai_status: "match", can_reanalyze: false, ai: ai({ amount: 145000, difference: 0 }) });
    open();
    const box = await section();

    expect(await within(box).findByText("Mos keldi")).toBeInTheDocument();
    expect(within(box).getByRole("group", { name: "Summalar solishtiruvi" })).toHaveTextContent("Farq0 so'm");
    expect(within(box).queryByRole("button", { name: "Qayta tahlil" })).not.toBeInTheDocument();
  });

  it("TC6: AI o'chiq — izoh, solishtiruv va qayta tahlil yo'q", async () => {
    current = receipt({ ai_status: "disabled", can_reanalyze: false, ai: null });
    open();
    const box = await section();

    expect(await within(box).findByText("AI o'chiq")).toBeInTheDocument();
    expect(within(box).getByText("Chek saqlanganda AI tahlili o'chiq edi — summa solishtirilmagan.")).toBeInTheDocument();
    expect(within(box).queryByRole("group", { name: "Summalar solishtiruvi" })).not.toBeInTheDocument();
    expect(within(box).queryByRole("button", { name: "Qayta tahlil" })).not.toBeInTheDocument();
  });

  it("o'qib bo'lmadi va xato — izoh + qayta tahlil", async () => {
    current = receipt({ ai_status: "unreadable", ai: ai({ amount: null, difference: null, confidence: 0.32 }) });
    const first = open();
    const box = await section();
    expect(await within(box).findByText("O'qib bo'lmadi")).toBeInTheDocument();
    expect(
      within(box).getByText("AI chekdagi summani o'qiy olmadi: rasm xira, qirqilgan yoki chek emas. Rasmni ko'z bilan tekshiring."),
    ).toBeInTheDocument();
    expect(within(box).getByRole("button", { name: "Qayta tahlil" })).toBeInTheDocument();
    first.unmount();

    current = receipt({ ai_status: "error", ai: ai({ amount: null, difference: null }) });
    open();
    const next = await section();
    expect(await within(next).findByText("AI tahlili ishlamadi: xizmat javob bermadi. Qayta tahlilni boshlang.")).toBeInTheDocument();
    expect(within(next).getByText("Xato")).toBeInTheDocument();
  });

  it("`ai_stale` — «Natija kelmadi» va qayta tahlil", async () => {
    current = receipt({ ai_status: "pending", ai_stale: true, ai: null });
    open();
    const box = await section();

    expect(await within(box).findByText("Natija kelmadi")).toBeInTheDocument();
    expect(within(box).getByText("AI natijasi kelmadi — tahlil 3 daqiqadan oshdi. Qayta tahlilni boshlang.")).toBeInTheDocument();
    expect(within(box).getByRole("button", { name: "Qayta tahlil" })).toBeInTheDocument();
  });

  it("bayroqlar — to'rttasi ham ogohlantirish, holatni o'zgartirmaydi", async () => {
    current = receipt({
      kind: "branch_to_hq",
      ai_status: "match",
      can_reanalyze: false,
      ai: ai({
        difference: 0,
        recipient_last4: "9902",
        date: "2026-10-01T10:40:00.000Z",
        flags: ["duplicate_photo", "duplicate_reference", "date_far", "card_mismatch"],
      }),
    });
    open();
    const box = await section();

    expect(await within(box).findByText("AI ogohlantirishlari · 4 ta")).toBeInTheDocument();
    expect(within(box).getByText("Takroriy rasm")).toBeInTheDocument();
    expect(within(box).getByText("Takroriy tranzaksiya raqami")).toBeInTheDocument();
    expect(within(box).getByText("Sana uzoq")).toBeInTheDocument();
    expect(within(box).getByText(/Oluvchi kartasi \(··9902\) HQ kartalariga mos emas/)).toBeInTheDocument();
    expect(within(box).getByText("Mos keldi")).toBeInTheDocument();
  });

  it("urinishlar tugadi — tugma o'chiq, «5 / 5»", async () => {
    current = receipt({ can_reanalyze: false, ai: ai({ attempts: 5 }) });
    open();
    const box = await section();

    expect(await within(box).findByText("Urinishlar tugadi: 5 / 5")).toBeInTheDocument();
    expect(within(box).getByRole("button", { name: "Qayta tahlil" })).toBeDisabled();
  });

  it("TC10: menejerda qayta tahlil yo'q (tugatilgan urinishda ham)", async () => {
    current = receipt({ can_reanalyze: false, ai: ai({ attempts: 5 }) });
    open(manager);
    const box = await section();

    await within(box).findByText("Farq bor");
    expect(within(box).queryByRole("button", { name: "Qayta tahlil" })).not.toBeInTheDocument();
  });

  it("kuryer / market javobida `receipt` yo'q — bo'lim chiqmaydi", async () => {
    http.get.mockImplementation(async () => ({ data: { statusCode: 200, data: { id: "11", amount: 145000 } } }));
    open({ role: { id: "9", role: "courier", region: null, name: "K" } } as never, { ...row, receipt: undefined });

    await waitFor(() => expect(http.get).toHaveBeenCalled());
    expect(screen.queryByTestId("receipt-section")).not.toBeInTheDocument();
    expect(receiptReads()).toBe(0);
  });

  it("ma'lumot yuklanmadi — xato + «Qayta urinish»", async () => {
    receiptFails = true;
    open();
    const box = await section();

    expect(await within(box).findByText("Chek ma'lumotini yuklab bo'lmadi")).toBeInTheDocument();
    receiptFails = false;
    await userEvent.setup().click(within(box).getByRole("button", { name: "Qayta urinish" }));
    expect(await within(box).findByText("Farq bor")).toBeInTheDocument();
  });

  it("TC4: `pending` → realtime `finance.receipt.checked` → natija sahifa yangilanmay ko'rinadi", async () => {
    current = receipt({ ai_status: "pending", can_reanalyze: false, ai: null });
    const { queryClient } = open();
    const box = await section();
    expect(await within(box).findByText("Tahlilda")).toBeInTheDocument();
    expect(within(box).getByText(/^AI chekni o'qimoqda…/)).toBeInTheDocument();

    current = receipt({ ai_status: "match", can_reanalyze: false, ai: ai({ amount: 145000, difference: 0 }) });
    await act(async () => {
      handleFinanceEvent(queryClient, i18n.t.bind(i18n), "finance.receipt.checked", {
        receipt_id: "501",
        history_id: "11",
        kind: "manual_expense",
        ai_status: "match",
      });
    });

    expect(await within(box).findByText("Mos keldi")).toBeInTheDocument();
    expect(within(box).queryByText("Tahlilda")).not.toBeInTheDocument();
  });

  it("`pending` da 5 s da qayta o'qiladi, `ai_stale` kelsa to'xtaydi", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      current = receipt({ ai_status: "pending", can_reanalyze: false, ai: null });
      open();
      await section();
      await waitFor(() => expect(receiptReads()).toBe(1));

      current = receipt({ ai_status: "pending", ai_stale: true, ai: null });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5100);
      });
      await waitFor(() => expect(receiptReads()).toBe(2));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(15000);
      });
      expect(receiptReads()).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("Qayta tahlil (QlLf33Ma, TC12)", () => {
  const start = async (user: ReturnType<typeof userEvent.setup>) => {
    open();
    const box = await section();
    await user.click(await within(box).findByRole("button", { name: "Qayta tahlil" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Qayta tahlilni tasdiqlang" });
    return { box, dialog };
  };

  it("tasdiq → POST → xabar, bo'lim «Tahlilda»", async () => {
    const user = userEvent.setup();
    const { box, dialog } = await start(user);

    expect(within(dialog).getByText("145 000 so'm")).toBeInTheDocument();
    expect(within(dialog).getByText("1 / 5")).toBeInTheDocument();
    expect(within(dialog).getByText("Farq bor")).toBeInTheDocument();

    current = receipt({ ai_status: "pending", can_reanalyze: false, ai: null });
    await user.click(within(dialog).getByRole("button", { name: "Qayta tahlil" }));

    await waitFor(() => expect(http.post).toHaveBeenCalledWith("finance/receipts/501/reanalyze"));
    expect(await screen.findByText("Chek qayta tahlilga yuborildi — natija tarixda yangilanadi.")).toBeInTheDocument();
    expect(await within(box).findByText("Tahlilda")).toBeInTheDocument();
  });

  it("bekor qilinsa so'rov ketmaydi", async () => {
    const user = userEvent.setup();
    const { dialog } = await start(user);

    await user.click(within(dialog).getByRole("button", { name: "Bekor qilish" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(http.post).not.toHaveBeenCalled();
  });

  it("429 — xato oyna ichida, oyna ochiq qoladi", async () => {
    http.post.mockImplementationOnce(async () => {
      throw Object.assign(new Error("429"), {
        response: { status: 429, data: { statusCode: 429, code: "RECEIPT_AI_ATTEMPTS_EXHAUSTED", message: "x" } },
      });
    });
    const user = userEvent.setup();
    const { dialog } = await start(user);

    await user.click(within(dialog).getByRole("button", { name: "Qayta tahlil" }));

    expect(await within(dialog).findByText("Urinishlar tugadi")).toBeInTheDocument();
    expect(within(dialog).getByText("Bu chek 5 marta tahlil qilindi — boshqa urinish yo'q.")).toBeInTheDocument();
  });

  it("javob kelmadi (tarmoq) — «Internet aloqasi yo'q»", async () => {
    http.post.mockImplementationOnce(async () => {
      throw new Error("Network Error");
    });
    const user = userEvent.setup();
    const { dialog } = await start(user);

    await user.click(within(dialog).getByRole("button", { name: "Qayta tahlil" }));
    expect(await within(dialog).findByText("Internet aloqasi yo'q")).toBeInTheDocument();
  });
});

describe("Chek ko'ruvchisi (QlLf33Ma)", () => {
  const openViewer = async (user: ReturnType<typeof userEvent.setup>) => {
    open();
    const box = await section();
    await user.click(await within(box).findByRole("button", { name: "Chek rasmini kattalashtirish" }));
    return screen.findByRole("dialog", { name: "Chek rasmi" });
  };

  it("Moslash ↔ 100%, «Yangi oynada ochish», havola eskirsa qayta so'raladi", async () => {
    const user = userEvent.setup();
    const viewer = await openViewer(user);
    const image = within(viewer).getByRole("img", { name: "Chek rasmi", hidden: true });
    fireEvent.load(image);

    expect(within(viewer).getByRole("link", { name: "Yangi oynada ochish" })).toHaveAttribute(
      "href",
      "https://api.example/files/signed/token-1",
    );
    expect(image.className).toContain("object-contain");
    await user.click(within(viewer).getByRole("radio", { name: "100%" }));
    expect(image.className).toContain("max-w-none");
    await user.click(within(viewer).getByRole("radio", { name: "Moslash" }));
    expect(image.className).toContain("object-contain");

    fireEvent.error(image);
    expect(await within(viewer).findByText("Rasmni ochib bo'lmadi")).toBeInTheDocument();
    current = receipt({ photo_url: "https://api.example/files/signed/token-2" });
    const reads = receiptReads();
    await user.click(within(viewer).getByRole("button", { name: "Qayta urinish" }));

    await waitFor(() => expect(receiptReads()).toBe(reads + 1));
    await waitFor(() =>
      expect(within(viewer).getByRole("img", { name: "Chek rasmi", hidden: true })).toHaveAttribute(
        "src",
        "https://api.example/files/signed/token-2",
      ),
    );
  });
});

describe("Ro'yxatdagi «Chek» belgisi (QlLf33Ma)", () => {
  const rows: PaymentRow[] = [
    row,
    { ...row, id: "12", receipt: { id: "502", ai_status: "pending" } },
    { ...row, id: "13", receipt: null },
  ];

  it("jadval: belgi faqat cheki bor qatorda, tugma nomi holatni aytadi", () => {
    renderWithProviders(<PaymentHistoryTable data={rows} viewerRole="superadmin" />, { preloadedState: superadmin });

    expect(screen.getAllByTitle("Chek: Farq bor").length).toBeGreaterThan(0);
    expect(screen.getAllByTitle("Chek: Tahlilda").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /chek: Farq bor/i }).length).toBeGreaterThan(0);
    expect(document.querySelectorAll("[data-receipt-status]").length % 2).toBe(0);
  });

  it("kassa ro'yxati: belgi va tugma nomi", () => {
    renderWithProviders(<PaymentHistoryList data={rows} withContainer={false} />, { preloadedState: superadmin });

    expect(screen.getByTitle("Chek: Farq bor")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Chek: Tahlilda/ })).toBeInTheDocument();
  });
});
