import { screen, within } from "@testing-library/react";
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
