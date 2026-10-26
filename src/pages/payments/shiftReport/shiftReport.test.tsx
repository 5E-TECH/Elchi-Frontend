import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import ShiftReportPage from ".";
import { renderWithProviders } from "../../../test/test-utils";

/** kiZgTybn — smena hisoboti: `GET finance/shift/:id/report` → naqd, kartalar (AI holati, rasm), operatsiyalar. */

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
vi.mock("../../../shared/api/api", () => ({ api: http, API_TIMEOUT_MS: 20_000, LONG_REQUEST_TIMEOUT_MS: 120_000 }));

const card = (id: string, name: string, bank: string, last4: string) => ({
  id,
  name,
  bank_name: bank,
  last4,
  kind: "virtual_card",
  is_default: id === "1",
});

const REPORT = {
  shift: {
    id: "31",
    status: "closed",
    opened_at: "2026-10-23T09:05:00.000Z",
    closed_at: "2026-10-23T18:00:00.000Z",
    opened_by_name: "Shodiyor Ergashev",
  },
  cashbox_type: "main",
  cash: {
    opening_balance: 11_270_000,
    total_income: 8_450_000,
    total_expense: 1_480_000,
    expected_balance: 18_240_000,
    closing_balance: 18_240_000,
    discrepancy: 0,
  },
  card: {
    opening_balance: 6_275_000,
    total_income: 100_000,
    total_expense: 0,
    expected_balance: 6_375_000,
    closing_balance: 6_285_000,
    discrepancy: -90_000,
  },
  accounts: [
    {
      card_id: "1",
      card: card("1", "Asosiy karta", "Agrobank", "1234"),
      expected_balance: "2140000.00",
      entered_balance: "2140000.00",
      difference: 0,
      has_photo: true,
      photo_url: "https://files.example/signed/1",
      ai_status: "match",
      ai_read_balance: 2_140_000,
      ai_entered_ok: true,
      comment: null,
      comment_required: false,
    },
    {
      card_id: "2",
      card: card("2", "Humo virtual", "Hamkorbank", "4417"),
      expected_balance: 1_850_000,
      entered_balance: 1_760_000,
      difference: -90_000,
      has_photo: true,
      photo_url: "https://files.example/signed/2",
      ai_status: "mismatch",
      ai_read_balance: 1_760_000,
      ai_entered_ok: true,
      comment: "Bank komissiyasi",
      comment_required: true,
    },
    {
      card_id: "3",
      card: card("3", "Hisob raqam", "Ipoteka bank", "2205"),
      expected_balance: 1_450_000,
      entered_balance: 1_450_000,
      difference: 0,
      has_photo: false,
      photo_url: null,
      ai_status: "not_required",
      ai_read_balance: null,
      ai_entered_ok: null,
      comment: null,
      comment_required: false,
      photo_required_snap: false,
      ai_enabled_snap: false,
    },
  ],
  accounts_summary: { total: 3, match: 1, mismatch: 1, not_required: 1 },
  operations: [
    { operation_type: "income", payment_method: "cash", count: 14, total: 8_450_000 },
    { operation_type: "expense", payment_method: "click", count: 2, total: 1_480_000 },
  ],
};

const superadmin = { role: { id: "1", role: "superadmin", region: null, name: "SA" } } as never;
const manager = { role: { id: "198", role: "manager", region: null, name: "M" } } as never;

const render = (state: never, report: unknown = REPORT) => {
  http.get.mockReset();
  http.get.mockImplementation(async (url: string) => {
    if (url === "finance/shift/31/report") return { data: { statusCode: 200, data: report } };
    throw Object.assign(new Error("404"), { response: { status: 404, data: { message: "Smena topilmadi" } } });
  });
  return renderWithProviders(
    <Routes>
      <Route path="/payments/shifts/:id" element={<ShiftReportPage />} />
    </Routes>,
    { route: "/payments/shifts/31", preloadedState: state },
  );
};

describe("ShiftReportPage (kiZgTybn)", () => {
  it("renders cash, per-card results (AI status, photo links, comments) and the operations summary", async () => {
    render(superadmin);
    expect(await screen.findByRole("heading", { level: 1, name: "Smena hisoboti" })).toBeInTheDocument();
    const table = await screen.findByRole("table", { name: "Kartalar bo'yicha natijalar" });
    const rows = within(table).getAllByRole("row");
    // sarlavha + 3 karta
    expect(rows).toHaveLength(4);
    expect(within(rows[1]).getByText("Asosiy karta")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Mos keldi")).toBeInTheDocument();
    expect(within(rows[1]).getByText("AI o'qidi: 2 140 000 so'm")).toBeInTheDocument();
    expect(within(rows[1]).getByRole("link", { name: /Ochish/ })).toHaveAttribute("href", "https://files.example/signed/1");
    expect(within(rows[2]).getByText("Mos kelmadi")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Rasmda 1 760 000 so'm")).toBeInTheDocument();
    expect(within(rows[2]).getByText("−90 000 so'm")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Bank komissiyasi")).toBeInTheDocument();
    expect(within(rows[3]).getByText("Yuklanmagan")).toBeInTheDocument();
    expect(within(rows[3]).getByText("Sozlamada o'chirilgan")).toBeInTheDocument();
    expect(screen.getByText("3 ta · 2 tasi AI bilan tekshirildi")).toBeInTheDocument();

    expect(screen.getByText("Operatsiyalar xulosasi")).toBeInTheDocument();
    expect(screen.getByText("+8 450 000 so'm")).toBeInTheDocument();
    expect(screen.getByText("14 ta")).toBeInTheDocument();
    expect(screen.getByText("+6 970 000 so'm")).toBeInTheDocument(); // sof oqim
    // Superadmin — sozlamalar havolasi.
    expect(screen.getByRole("link", { name: /Sozlamalar/ })).toHaveAttribute("href", "/payments/shift-settings");
  });

  it("manager: no settings link; a shift without card checks shows the empty state", async () => {
    render(manager, { ...REPORT, accounts: [], accounts_summary: null });
    expect(await screen.findByText("Kartalar tekshirilmagan")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Sozlamalar/ })).not.toBeInTheDocument();
  });

  it("an open shift shows the info banner", async () => {
    render(superadmin, { ...REPORT, shift: { ...REPORT.shift, status: "open", closed_at: null } });
    expect(await screen.findByText("Smena hali ochiq — natijalar yopilguncha o'zgarishi mumkin.")).toBeInTheDocument();
  });
});

/** y8Tqm9Ap + gWI4gYkw — avtomatik yopilgan smena banneri, «Hisobot kimlarga yuborildi», fayl va qayta yuborish. */
describe("ShiftReportPage — auto close and report deliveries (y8Tqm9Ap, gWI4gYkw)", () => {
  const delivery = (over: Record<string, unknown>) => ({
    round: 1,
    status: "sent",
    failed_reason: null,
    sent_at: "2026-10-23T18:01:00.000Z",
    created_at: "2026-10-23T18:00:30.000Z",
    ...over,
  });
  const AUTO_REPORT = {
    ...REPORT,
    shift: { ...REPORT.shift, closed_by_name: null },
    cash: { ...REPORT.cash, closing_balance: null, discrepancy: null },
    close_reason: "auto",
    closed_by_system: true,
    auto_close: { closed_at: "2026-10-23T18:00:00.000Z", label: "Avtomatik yopildi — 23:00, kassir yopmagan" },
    report: { status: "sent", round: 2, file_format: "pdf", has_file: true, file_url: "https://files.example/report-31.pdf" },
    deliveries: [
      // Eski raund — hisobga kirmaydi.
      delivery({ round: 1, recipient_id: "1", recipient_name: "Shodiyor Ergashev", recipient_kind: "superadmin", channel: "telegram", status: "failed" }),
      delivery({ round: 2, recipient_id: "1", recipient_name: "Shodiyor Ergashev", recipient_kind: "superadmin", channel: "telegram" }),
      delivery({ round: 2, recipient_id: "1", recipient_name: "Shodiyor Ergashev", recipient_kind: "superadmin", channel: "in_app" }),
      delivery({ round: 2, recipient_id: "7", recipient_name: "Bekzod Aliyev", recipient_kind: "courier", channel: "telegram", status: "failed", failed_reason: "Telegram ulanmagan", sent_at: null }),
      delivery({ round: 2, recipient_id: "7", recipient_name: "Bekzod Aliyev", recipient_kind: "courier", channel: "in_app" }),
      delivery({ round: 2, recipient_id: "8", recipient_name: "Ali Valiyev", recipient_kind: "courier", channel: "telegram" }),
      delivery({ round: 2, recipient_id: "8", recipient_name: "Ali Valiyev", recipient_kind: "courier", channel: "in_app" }),
      delivery({ round: 2, recipient_id: "21", recipient_name: "Baraka Shop", recipient_kind: "market", channel: "telegram_group", status: "queued", sent_at: null }),
      delivery({ round: 2, recipient_id: "21", recipient_name: "Baraka Shop", recipient_kind: "market", channel: "in_app", status: "skipped", sent_at: null }),
    ],
  };

  // Vaqtlar Toshkent mintaqasida (vitest sozlamasi): 18:00Z → 23:00.
  it("auto-closed shift: yellow banner, deliveries grouped by recipient (latest round), file link", async () => {
    render(superadmin, AUTO_REPORT);
    const banner = await screen.findByTestId("shift-auto-closed");
    expect(banner).toHaveTextContent("Avtomatik yopildi — 23:00, kassir yopmagan");
    expect(banner).toHaveTextContent("Shodiyor Ergashev 14:05 da ochgan smenani yopmagan");

    const list = screen.getByRole("list", { name: "Hisobot kimlarga yuborildi" });
    expect(screen.getByText("23:01 · 4 ta qabul qiluvchi · 2-raund")).toBeInTheDocument();
    const admin = within(list).getByTestId("shift-delivery-superadmin");
    expect(admin).toHaveTextContent("Shodiyor Ergashev · to'liq hisobot va PDF");
    expect(within(admin).getByText("Telegram")).toBeInTheDocument();
    const couriers = within(list).getByTestId("shift-delivery-courier");
    expect(couriers).toHaveTextContent("Kuryerlar · 2 ta");
    expect(within(couriers).getByText("Telegram 1 / 2")).toBeInTheDocument();
    expect(within(couriers).getByText("Tizim 2 / 2")).toBeInTheDocument();
    expect(couriers).toHaveTextContent("Bekzod Aliyev — Telegram: Telegram ulanmagan");
    const markets = within(list).getByTestId("shift-delivery-market");
    // Tizim kanali sozlamada o'chiq (skipped) — chizilmaydi; guruhga yuborish hali navbatda.
    expect(markets).toHaveTextContent("Telegram 0 / 1 · yuborilmoqda");
    expect(within(markets).queryByText(/Tizim/)).not.toBeInTheDocument();

    expect(screen.getByRole("link", { name: "PDF" })).toHaveAttribute("href", "https://files.example/report-31.pdf");
  });

  it("superadmin resends the report after confirming; the report is re-read", async () => {
    const user = userEvent.setup();
    render(superadmin, AUTO_REPORT);
    http.post.mockReset();
    http.post.mockResolvedValueOnce({ data: { statusCode: 200, data: { round: 3, status: "sent", deliveries: [] } } });
    await user.click(await screen.findByRole("button", { name: "Hisobotni qayta yuborish" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Hisobotni qayta yuborasizmi?" });
    expect(http.post).not.toHaveBeenCalled();
    const reads = http.get.mock.calls.length;
    await user.click(within(dialog).getByRole("button", { name: "Qayta yuborish" }));
    await waitFor(() => expect(http.post).toHaveBeenCalledWith("finance/shift/31/report/resend"));
    expect(await screen.findByText("Hisobot qayta yuborildi")).toBeInTheDocument();
    await waitFor(() => expect(http.get.mock.calls.length).toBeGreaterThan(reads));
  });

  it("a rejected resend (400 — already sending) shows the backend message", async () => {
    const user = userEvent.setup();
    render(superadmin, AUTO_REPORT);
    http.post.mockReset();
    http.post.mockRejectedValueOnce(
      Object.assign(new Error("400"), { response: { status: 400, data: { message: "Hisobot hozir yuborilmoqda" } } }),
    );
    await user.click(await screen.findByRole("button", { name: "Hisobotni qayta yuborish" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Qayta yuborish" }));
    expect(await screen.findByText("Hisobot hozir yuborilmoqda")).toBeInTheDocument();
  });

  it("while the report is being sent the resend button is disabled; no deliveries yet → queue text", async () => {
    render(superadmin, { ...AUTO_REPORT, report: { ...AUTO_REPORT.report, status: "processing" }, deliveries: [] });
    expect(await screen.findByRole("button", { name: "Hisobotni qayta yuborish" })).toBeDisabled();
    expect(screen.getByText("Hisobot navbatda — tez orada yuboriladi.")).toBeInTheDocument();
  });

  it("manager: the banner is shown, but no deliveries card, file or resend (superadmin only)", async () => {
    render(manager, { ...AUTO_REPORT, deliveries: [], report: { ...AUTO_REPORT.report, file_url: null } });
    expect(await screen.findByTestId("shift-auto-closed")).toBeInTheDocument();
    expect(screen.queryByText("Hisobot kimlarga yuborildi")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hisobotni qayta yuborish" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "PDF" })).not.toBeInTheDocument();
  });

  it("a manually closed shift has no auto-close banner", async () => {
    render(superadmin, { ...REPORT, close_reason: "manual", auto_close: null });
    await screen.findByRole("table", { name: "Kartalar bo'yicha natijalar" });
    expect(screen.queryByTestId("shift-auto-closed")).not.toBeInTheDocument();
  });
});
