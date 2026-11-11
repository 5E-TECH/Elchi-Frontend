import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ShiftReportPage from ".";
import { PrepareImageError } from "../../../shared/lib/downscaleImage";
import { renderWithProviders } from "../../../test/test-utils";

/**
 * BE-B (ega qarori 2026-11-10, backend PR #629) — avtomatik yopilgan ASOSIY kassa smenasiga 24 soat ichida karta
 * rasmini keyin yuklash: hisobot qatoridagi `photo_status` / `late_upload_deadline` / `late_uploaded` /
 * `can_upload_late`, «Rasm yuklash» oynasi (multipart `photo`, `entered_balance`, `comment`) va xatolar (backend matni
 * aynan). Vaqtlar Toshkent mintaqasida (vitest sozlamasi): 13:00Z → 18:00.
 */

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
vi.mock("../../../shared/api/api", () => ({ api: http, API_TIMEOUT_MS: 20_000, LONG_REQUEST_TIMEOUT_MS: 120_000 }));

const prepareImageMock = vi.hoisted(() => vi.fn());
vi.mock("../../../shared/lib/downscaleImage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../shared/lib/downscaleImage")>()),
  prepareImage: prepareImageMock,
}));

const DEADLINE = "2026-11-12T13:00:00.000Z";

const card = (id: string, name: string, bank: string, last4: string) => ({
  id,
  name,
  bank_name: bank,
  last4,
  kind: "virtual_card",
  is_default: id === "1",
});

const row = (over: Record<string, unknown>) => ({
  expected_balance: 1_000_000,
  entered_balance: null,
  difference: null,
  has_photo: false,
  photo_url: null,
  ai_status: "not_required",
  ai_read_balance: null,
  ai_entered_ok: null,
  comment: null,
  comment_required: false,
  photo_required_snap: true,
  ai_enabled_snap: true,
  late_upload_deadline: DEADLINE,
  late_uploaded: false,
  can_upload_late: false,
  ...over,
});

const ACCOUNTS = [
  row({
    card_id: "1",
    card: card("1", "Asosiy karta", "Agrobank", "1234"),
    expected_balance: 2_140_000,
    entered_balance: 2_140_000,
    difference: 0,
    has_photo: true,
    photo_url: "https://files.example/signed/1",
    ai_status: "match",
    ai_read_balance: 2_140_000,
    ai_entered_ok: true,
    photo_status: "uploaded",
    late_uploaded: true,
    can_upload_late: true,
  }),
  row({
    card_id: "2",
    card: card("2", "Humo virtual", "Hamkorbank", "4417"),
    expected_balance: 1_850_000,
    photo_status: "pending",
    can_upload_late: true,
  }),
  row({ card_id: "3", card: card("3", "Visa virtual", "Kapitalbank", "0932"), photo_status: "missing" }),
  row({
    card_id: "4",
    card: card("4", "Hisob raqam", "Ipoteka bank", "2205"),
    photo_status: "not_required",
    photo_required_snap: false,
    ai_enabled_snap: false,
  }),
];

const reportWith = (accounts: unknown[]) => ({
  shift: {
    id: "31",
    status: "closed",
    opened_at: "2026-11-11T04:05:00.000Z",
    closed_at: "2026-11-11T13:00:00.000Z",
    opened_by_name: "Shodiyor Ergashev",
    closed_by_name: null,
  },
  cashbox_type: "main",
  close_reason: "auto",
  closed_by_system: true,
  auto_close: { closed_at: "2026-11-11T13:00:00.000Z", label: "Avtomatik yopildi — 18:00, kassir yopmagan" },
  cash: { opening_balance: 0, total_income: 0, total_expense: 0, expected_balance: 0, closing_balance: null, discrepancy: null },
  card: { opening_balance: 0, total_income: 0, total_expense: 0, expected_balance: 0, closing_balance: null, discrepancy: null },
  accounts,
  accounts_summary: null,
  operations: [],
});

const superadmin = { role: { id: "1", role: "superadmin", region: null, name: "SA" } } as never;
const manager = { role: { id: "198", role: "manager", region: null, name: "M" } } as never;

const server = { report: reportWith(ACCOUNTS) as Record<string, unknown> };
const reportReads = () => http.get.mock.calls.filter(([url]) => url === "finance/shift/31/report").length;

const render = (state: never = superadmin) =>
  renderWithProviders(
    <Routes>
      <Route path="/payments/shifts/:id" element={<ShiftReportPage />} />
    </Routes>,
    { route: "/payments/shifts/31", preloadedState: state },
  );

const httpError = (status: number, data: Record<string, unknown>) =>
  Object.assign(new Error(String(status)), { response: { status, data: { statusCode: status, ...data } } });

const mockPhone = () =>
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: query === "(max-width: 767px)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as unknown as MediaQueryList,
  );

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-11-11T15:00:00.000Z"), shouldAdvanceTime: true });
  server.report = reportWith(ACCOUNTS);
  http.get.mockReset();
  http.post.mockReset();
  http.get.mockImplementation(async (url: string) => {
    if (url === "finance/shift/31/report") return { data: { statusCode: 200, data: server.report } };
    throw httpError(404, { message: "Topilmadi" });
  });
  prepareImageMock.mockReset();
  prepareImageMock.mockImplementation(async (file: File) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new PrepareImageError("unsupported");
    return {
      media_type: "image/jpeg",
      data_base64: btoa("jpeg-bytes"),
      preview: "data:image/jpeg;base64,AAAA",
      name: file.name.replace(/\.[^.]+$/, ".jpg"),
      bytes: 10,
    };
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const statusCell = (cardId: string) => screen.getByTestId(`shift-photo-status-${cardId}`);

const openDialog = async (user: ReturnType<typeof userEvent.setup>, name = "Rasm yuklash: Humo virtual") => {
  await user.click(await screen.findByRole("button", { name }));
  return screen.findByRole("dialog", { name: "Rasmni keyin yuklash" });
};

const pickPhoto = async (user: ReturnType<typeof userEvent.setup>, type = "image/png") => {
  await user.upload(
    screen.getByTestId("late-photo-input"),
    new File(["png-bytes"], "IMG_2211.png", { type }),
  );
};

describe("ShiftReportPage — BE-B photo status", () => {
  it("renders each photo_status with its text, the deadline, «Keyin yuklandi» and the photo link", async () => {
    render();
    await screen.findByRole("table", { name: "Kartalar bo'yicha natijalar" });

    const uploaded = statusCell("1");
    expect(within(uploaded).getByText("Yuklangan")).toBeInTheDocument();
    expect(within(uploaded).getByText("Keyin yuklandi")).toBeInTheDocument();
    expect(within(uploaded).getByRole("link", { name: /Ochish/ })).toHaveAttribute("href", "https://files.example/signed/1");

    const pending = statusCell("2");
    expect(within(pending).getByText("Rasm kutilmoqda")).toBeInTheDocument();
    // Muddat ertaga 18:00 (Toshkent) — sana bilan.
    expect(within(pending).getByText("12.11.2026, 18:00 gacha")).toBeInTheDocument();

    const missing = statusCell("3");
    expect(within(missing).getByText("Rasm yuklanmagan")).toBeInTheDocument();
    // Muddat o'tgan / yuklab bo'lmaydigan qatorda muddat chizilmaydi.
    expect(within(missing).queryByText(/gacha$/)).not.toBeInTheDocument();

    expect(within(statusCell("4")).getByText("Talab qilinmagan")).toBeInTheDocument();
  });

  it("shows «Rasm yuklash» only where can_upload_late is true (re-upload on a photo row)", async () => {
    render();
    await screen.findByRole("table", { name: "Kartalar bo'yicha natijalar" });
    expect(within(statusCell("1")).getByRole("button", { name: "Qayta yuklash: Asosiy karta" })).toBeInTheDocument();
    expect(within(statusCell("2")).getByRole("button", { name: "Rasm yuklash: Humo virtual" })).toBeInTheDocument();
    expect(within(statusCell("3")).queryByRole("button")).not.toBeInTheDocument();
    expect(within(statusCell("4")).queryByRole("button")).not.toBeInTheDocument();
  });

  it("manager: status and deadline are shown, no upload button", async () => {
    server.report = reportWith(ACCOUNTS.map((item) => ({ ...item, can_upload_late: false })));
    render(manager);
    await screen.findByRole("table", { name: "Kartalar bo'yicha natijalar" });
    expect(within(statusCell("2")).getByText("Rasm kutilmoqda")).toBeInTheDocument();
    expect(within(statusCell("2")).getByText("12.11.2026, 18:00 gacha")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Rasm yuklash|Qayta yuklash/ })).not.toBeInTheDocument();
  });

  it("an older backend without photo_status renders the photo column as before", async () => {
    server.report = reportWith(
      ACCOUNTS.map((item) => {
        const rest: Record<string, unknown> = { ...item };
        for (const key of ["photo_status", "late_upload_deadline", "late_uploaded", "can_upload_late"]) delete rest[key];
        return rest;
      }),
    );
    render();
    const table = await screen.findByRole("table", { name: "Kartalar bo'yicha natijalar" });
    expect(screen.queryByTestId("shift-photo-status-2")).not.toBeInTheDocument();
    expect(within(table).getAllByText("Yuklanmagan").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Rasm yuklash/ })).not.toBeInTheDocument();
  });

  it("phone cards: status, deadline and a full-width upload button", async () => {
    mockPhone();
    render();
    const pending = await screen.findByTestId("shift-photo-status-2");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(within(pending).getByText("Rasm kutilmoqda")).toBeInTheDocument();
    expect(within(pending).getByText("12.11.2026, 18:00 gacha")).toBeInTheDocument();
    expect(within(pending).getByRole("button", { name: "Rasm yuklash: Humo virtual" })).toHaveClass("w-full");
  });
});

describe("ShiftReportPage — BE-B late upload dialog", () => {
  it("blocks «Yuklash» until photo and balance; a difference makes the comment required", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render();
    const dialog = await openDialog(user);
    expect(within(dialog).getByText("Humo virtual · Hamkorbank · ··4417")).toBeInTheDocument();
    const summary = within(dialog).getByLabelText("Karta qoldig'i");
    expect(within(summary).getByText("1 850 000 so'm")).toBeInTheDocument();
    expect(within(summary).getByText("12.11.2026, 18:00 gacha")).toBeInTheDocument();
    const submit = within(dialog).getByRole("button", { name: "Yuklash" });
    expect(submit).toBeDisabled();
    expect(within(dialog).getByTestId("late-photo-block-reason")).toHaveTextContent(
      "Skrinshot tanlang va ilovadagi qoldiqni kiriting",
    );

    await pickPhoto(user);
    expect(await within(dialog).findByRole("img", { name: "Humo virtual skrinshoti" })).toHaveAttribute(
      "src",
      "data:image/jpeg;base64,AAAA",
    );
    expect(prepareImageMock).toHaveBeenCalledWith(expect.any(File), { maxBytes: 5 * 1024 * 1024 });
    expect(submit).toBeDisabled();
    expect(within(dialog).getByTestId("late-photo-block-reason")).toHaveTextContent("Ilovadagi qoldiqni kiriting");

    await user.type(within(dialog).getByLabelText(/Ilovadagi qoldiq/), "1760000");
    expect(submit).toBeEnabled();
    expect(within(dialog).getByText("−90 000 so'm")).toBeInTheDocument();
    // Farq bor — izoh majburiy, bo'sh izoh bilan so'rov ketmaydi.
    await user.click(submit);
    expect(await within(dialog).findByText("Farq bor — sababini izohga yozing")).toBeInTheDocument();
    expect(http.post).not.toHaveBeenCalled();
  });

  it("an unsupported file shows the type error and no preview", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime, applyAccept: false });
    render();
    const dialog = await openDialog(user);
    await pickPhoto(user, "image/gif");
    expect(await within(dialog).findByText("Faqat jpeg, png yoki webp rasm yuklang")).toBeInTheDocument();
    expect(within(dialog).queryByRole("img")).not.toBeInTheDocument();
  });

  it("sends multipart photo / entered_balance / comment; on 201 notifies, closes and patches the row", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render();
    const dialog = await openDialog(user);
    await pickPhoto(user);
    await user.type(within(dialog).getByLabelText(/Ilovadagi qoldiq/), "1760000");
    await user.type(within(dialog).getByLabelText(/Izoh/), "Bank komissiyasi");

    const updated = {
      ...ACCOUNTS[1],
      entered_balance: 1_760_000,
      difference: -90_000,
      has_photo: true,
      photo_url: "https://files.example/signed/2-late",
      ai_status: "pending",
      comment: "Bank komissiyasi",
      photo_status: "uploaded",
      late_uploaded: true,
    };
    http.post.mockResolvedValueOnce({
      data: { statusCode: 201, message: "Shift account late photo uploaded", data: updated },
    });
    // Qayta o'qishda server ham yangi qatorni beradi.
    server.report = reportWith([ACCOUNTS[0], updated, ACCOUNTS[2], ACCOUNTS[3]]);
    const reads = reportReads();
    await user.click(within(dialog).getByRole("button", { name: "Yuklash" }));

    await waitFor(() => expect(http.post).toHaveBeenCalledTimes(1));
    const [url, body, config] = http.post.mock.calls[0];
    expect(url).toBe("finance/shift/31/accounts/2/late-photo");
    expect(config).toEqual({ timeout: 120_000 });
    const form = body as FormData;
    expect([...form.keys()]).toEqual(["photo", "entered_balance", "comment"]);
    expect((form.get("photo") as File).type).toBe("image/jpeg");
    expect((form.get("photo") as File).name).toBe("IMG_2211.jpg");
    expect(form.get("entered_balance")).toBe("1760000");
    expect(form.get("comment")).toBe("Bank komissiyasi");

    expect(await screen.findByText("Rasm yuklandi")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Rasmni keyin yuklash" })).not.toBeInTheDocument());
    const cell = statusCell("2");
    expect(within(cell).getByText("Yuklangan")).toBeInTheDocument();
    expect(within(cell).getByText("Keyin yuklandi")).toBeInTheDocument();
    expect(within(cell).getByRole("link", { name: /Ochish/ })).toHaveAttribute("href", "https://files.example/signed/2-late");
    await waitFor(() => expect(reportReads()).toBeGreaterThan(reads));
  });

  it("no difference: comment is optional and not sent when empty; zero balance is a value", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    server.report = reportWith([ACCOUNTS[0], { ...ACCOUNTS[1], expected_balance: 0 }, ACCOUNTS[2], ACCOUNTS[3]]);
    render();
    const dialog = await openDialog(user);
    await pickPhoto(user);
    await user.type(within(dialog).getByLabelText(/Ilovadagi qoldiq/), "0");
    http.post.mockResolvedValueOnce({ data: { statusCode: 201, data: { ...ACCOUNTS[1], photo_status: "uploaded" } } });
    await user.click(within(dialog).getByRole("button", { name: "Yuklash" }));
    await waitFor(() => expect(http.post).toHaveBeenCalledTimes(1));
    const form = http.post.mock.calls[0][1] as FormData;
    expect([...form.keys()]).toEqual(["photo", "entered_balance"]);
    expect(form.get("entered_balance")).toBe("0");
  });

  it.each([
    [
      409,
      "SHIFT_LATE_PHOTO_EXPIRED",
      "Rasmni keyin yuklash muddati tugagan (smena yopilganidan 24 soat o'tdi)",
      { deadline: "2026-11-11T13:00:00.000Z" },
    ],
    [409, "SHIFT_LATE_PHOTO_NOT_AUTO_CLOSED", "Rasmni keyin yuklash faqat avtomatik yopilgan smena uchun", {}],
    [404, "SHIFT_LATE_PHOTO_CARD_NOT_IN_SHIFT", "Bu karta shu smena hisobotida yo'q", {}],
  ])(
    "%i %s: the backend message is shown verbatim, the dialog stays open and the report is re-read",
    async (status, code, message, extra) => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render();
      const dialog = await openDialog(user);
      await pickPhoto(user);
      await user.type(within(dialog).getByLabelText(/Ilovadagi qoldiq/), "1850000");
      http.post.mockRejectedValueOnce(httpError(status, { message, code, ...extra }));
      // Qayta o'qishda backend tugmani olib tashlaydi.
      server.report = reportWith(ACCOUNTS.map((item) => ({ ...item, can_upload_late: false })));
      const reads = reportReads();
      await user.click(within(dialog).getByRole("button", { name: "Yuklash" }));

      const alert = await within(dialog).findByTestId("late-photo-error");
      expect(alert).toHaveAttribute("role", "alert");
      expect(within(alert).getByText(message)).toBeInTheDocument();
      if ("deadline" in extra) expect(alert).toHaveTextContent("Muddat: Bugun, 18:00");
      expect(screen.getByRole("dialog", { name: "Rasmni keyin yuklash" })).toBeInTheDocument();
      // Qayta urinish foyda bermaydi — «Yuklash» o'chadi.
      expect(within(dialog).getByRole("button", { name: "Yuklash" })).toBeDisabled();
      await waitFor(() => expect(reportReads()).toBeGreaterThan(reads));
      await waitFor(() =>
        expect(screen.queryByRole("button", { name: "Rasm yuklash: Humo virtual" })).not.toBeInTheDocument(),
      );
    },
  );

  it("400 comment-required (cashier draft comment does not count): message verbatim, comment becomes required", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render();
    const dialog = await openDialog(user);
    await pickPhoto(user);
    await user.type(within(dialog).getByLabelText(/Ilovadagi qoldiq/), "1850000");
    const message = "«Humo virtual»: farq bor yoki AI natijasi mos emas — izoh majburiy";
    http.post.mockRejectedValueOnce(httpError(400, { message }));
    const reads = reportReads();
    await user.click(within(dialog).getByRole("button", { name: "Yuklash" }));
    expect(await within(dialog).findByText(message)).toBeInTheDocument();
    expect(within(dialog).getByText("Farq bor — sababini izohga yozing")).toBeInTheDocument();
    // 400 — qayta urinish mumkin (izoh yozilgach), hisobot qayta o'qilmaydi.
    expect(within(dialog).getByRole("button", { name: "Yuklash" })).toBeEnabled();
    expect(reportReads()).toBe(reads);

    await user.type(within(dialog).getByLabelText(/Izoh/), "Kassir yuklamagan");
    http.post.mockResolvedValueOnce({ data: { statusCode: 201, data: { ...ACCOUNTS[1], photo_status: "uploaded" } } });
    await user.click(within(dialog).getByRole("button", { name: "Yuklash" }));
    await waitFor(() => expect(http.post).toHaveBeenCalledTimes(2));
    expect((http.post.mock.calls[1][1] as FormData).get("comment")).toBe("Kassir yuklamagan");
  });

  it("403: the backend message is shown verbatim", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render();
    const dialog = await openDialog(user);
    await pickPhoto(user);
    await user.type(within(dialog).getByLabelText(/Ilovadagi qoldiq/), "1850000");
    http.post.mockRejectedValueOnce(httpError(403, { message: "Rasmni keyin faqat superadmin yoki admin yuklaydi" }));
    await user.click(within(dialog).getByRole("button", { name: "Yuklash" }));
    expect(await within(dialog).findByText("Rasmni keyin faqat superadmin yoki admin yuklaydi")).toBeInTheDocument();
  });
});
