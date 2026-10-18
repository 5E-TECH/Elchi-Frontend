import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, type AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { ExtraCostApprovals } from "./ExtraCostApprovals";

/**
 * Market dashboardidagi «Qo'shimcha xarajat tasdiqlari» v2 bloki (DuST9k8j, 1tnpaIqd).
 * API haqiqiy `useOrders` orqali — faqat axios instansiyasi almashtirilgan; tasdiq oynasi va
 * xabarlar haqiqiy UI (`renderWithProviders` — `ConfirmHost` + `Toaster`).
 */

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock("../../../shared/api/api", () => ({
  api: { get: http.get, post: http.post },
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));

type Action = "sell" | "partly_sell" | "cancel";

const approval = (id: string, action: Action, orderId: string, extra: Record<string, unknown> = {}) => ({
  id,
  order_id: orderId,
  market_id: "37",
  requested_by_user_id: "26",
  requested_by_role: "courier",
  requester_branch_id: "3",
  action,
  amount: 2000,
  proof_file_keys: [],
  status: "pending",
  decided_by_user_id: null,
  decided_at: null,
  decision_comment: null,
  auto_approved: false,
  reject_reason: null,
  createdAt: new Date().toISOString(),
  ...extra,
});

const listResponse = (items: unknown[]) => ({
  data: { statusCode: 200, message: "Extra cost approvals", data: items },
});

const httpError = (status: number, message: string) =>
  new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    data: { statusCode: status, message },
  } as AxiosResponse);

const renderBlock = (role = "market") =>
  renderWithProviders(<ExtraCostApprovals />, {
    preloadedState: { role: { id: "37", role, region: null, name: "Market" } },
  });

describe("ExtraCostApprovals — market dashboardidagi tasdiqlar bloki", () => {
  beforeEach(() => {
    http.get.mockReset();
    http.post.mockReset();
  });

  it("kutilayotgan so'rovlarni chizadi: amal, №, summa, so'rovchi, isbot, tasdiq oqibati", async () => {
    http.get.mockResolvedValue(
      listResponse([
        approval("ap-1", "sell", "53", { proof_file_keys: ["proof/a.jpg", "proof/b.jpg"] }),
        approval("ap-2", "partly_sell", "54", { requested_by_role: "manager" }),
        approval("ap-3", "cancel", "55"),
      ]),
    );
    renderBlock();

    const list = await screen.findByRole("list", { name: "Kutilayotgan so'rovlar" });
    expect(http.get).toHaveBeenCalledWith("orders/extra-cost-approvals", { params: { status: "pending" } });
    expect(screen.getByRole("heading", { name: "Qo'shimcha xarajat tasdiqlari" })).toBeInTheDocument();
    expect(screen.getByText("3 ta so'rov kutilmoqda")).toBeInTheDocument();

    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(3);

    const sell = screen.getByRole("listitem", { name: "Sotishdagi qo'shimcha xarajat, buyurtma №53" });
    expect(within(sell).getByRole("link", { name: "№53" })).toHaveAttribute("href", "/orders/edit/53");
    expect(within(sell).getByText("2 000 so'm")).toBeInTheDocument();
    expect(within(sell).getByText("#26")).toBeInTheDocument();
    expect(within(sell).getByText(/Kuryer/)).toBeInTheDocument();
    expect(within(sell).getByText("2 ta")).toBeInTheDocument();
    expect(within(sell).getByText(/^Bugun, \d{2}:\d{2}$/)).toBeInTheDocument();

    const partly = screen.getByRole("listitem", { name: "Qisman sotishdagi qo'shimcha xarajat, buyurtma №54" });
    expect(within(partly).getByText(/Menejer/)).toBeInTheDocument();
    expect(within(partly).getByText("Yo'q")).toBeInTheDocument();

    // fix3b M3: tasdiq AYNAN shu amalni bajaradi — oqibati har so'rovda ko'rinadi.
    expect(screen.getByTestId("approval-consequence-ap-1")).toHaveTextContent("Tasdiqlansa — buyurtma sotiladi");
    expect(screen.getByTestId("approval-consequence-ap-2")).toHaveTextContent("Tasdiqlansa — buyurtma qisman sotiladi");
    expect(screen.getByTestId("approval-consequence-ap-3")).toHaveTextContent("Tasdiqlansa — buyurtma bekor qilinadi");

    expect(within(sell).getByRole("button", { name: "Tasdiqlash" })).toBeInTheDocument();
    expect(within(sell).getByRole("button", { name: "Rad etish" })).toBeInTheDocument();
  });

  it("kutilayotgan so'rov yo'q — blok chizilmaydi", async () => {
    http.get.mockResolvedValue(listResponse([]));
    const { container } = renderBlock();

    await waitFor(() => expect(container.querySelector('[data-query-state="empty"]')).not.toBeNull());
    expect(screen.queryByRole("heading", { name: "Qo'shimcha xarajat tasdiqlari" })).not.toBeInTheDocument();
    expect(screen.queryByText("Ma'lumot yo'q")).not.toBeInTheDocument();
  });

  it("tasdiqlash — avval tasdiq oynasi (№, summa, oqibat), keyin POST", async () => {
    const user = userEvent.setup();
    http.get.mockResolvedValue(listResponse([approval("ap-1", "sell", "53")]));
    http.post.mockResolvedValue({ data: { statusCode: 200, data: {} } });
    renderBlock();

    await user.click(await screen.findByRole("button", { name: "Tasdiqlash" }));

    const dialog = await screen.findByRole("alertdialog", { name: "Qo'shimcha xarajatni tasdiqlang" });
    expect(http.post).not.toHaveBeenCalled();
    expect(within(dialog).getByText(/№53 buyurtmaga qo'shimcha xarajat yoziladi/)).toBeInTheDocument();
    expect(within(dialog).getByText("So'ralgan summa")).toBeInTheDocument();
    expect(within(dialog).getByText("2 000")).toBeInTheDocument();
    expect(within(dialog).getByText("Tasdiqlansa — buyurtma sotiladi")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Tasdiqlash" }));

    await waitFor(() =>
      expect(http.post).toHaveBeenCalledWith("orders/extra-cost-approvals/ap-1/approve", { comment: undefined }),
    );
    expect(await screen.findByText("Qo'shimcha xarajat tasdiqlandi")).toBeInTheDocument();
  });

  it("tasdiq oynasida «Bekor qilish» — so'rov yuborilmaydi", async () => {
    const user = userEvent.setup();
    http.get.mockResolvedValue(listResponse([approval("ap-1", "sell", "53")]));
    renderBlock();

    await user.click(await screen.findByRole("button", { name: "Tasdiqlash" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Qo'shimcha xarajatni tasdiqlang" });
    await user.click(within(dialog).getByRole("button", { name: "Bekor qilish" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(http.post).not.toHaveBeenCalled();
  });

  it("tasdiqlash rad etilsa — backend sababi xabarda (fix3 FE-ORD-02)", async () => {
    const user = userEvent.setup();
    http.get.mockResolvedValue(listResponse([approval("ap-1", "sell", "53")]));
    http.post.mockRejectedValue(httpError(403, "Bu qo'shimcha xarajat so'rovini tasdiqlash mumkin emas"));
    renderBlock();

    await user.click(await screen.findByRole("button", { name: "Tasdiqlash" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Qo'shimcha xarajatni tasdiqlang" });
    await user.click(within(dialog).getByRole("button", { name: "Tasdiqlash" }));

    expect(await screen.findByText("Bu qo'shimcha xarajat so'rovini tasdiqlash mumkin emas")).toBeInTheDocument();
  });

  it("rad etish — sabab yopiq ro'yxatdan tanlanadi va izoh bilan yuboriladi", async () => {
    const user = userEvent.setup();
    http.get.mockResolvedValue(listResponse([approval("ap-1", "sell", "53")]));
    http.post.mockResolvedValue({ data: { statusCode: 200, data: {} } });
    renderBlock();

    await user.click(await screen.findByRole("button", { name: "Rad etish" }));

    const dialog = await screen.findByRole("dialog", { name: "So'rovni rad etish" });
    const submit = within(dialog).getByRole("button", { name: "Rad etish" });
    // Sabab tanlanmaguncha yuborib bo'lmaydi.
    expect(submit).toBeDisabled();

    await user.click(within(dialog).getByRole("combobox", { name: /Rad etish sababi/ }));
    for (const label of ["Juda qimmat", "Kelishilmagan", "Isbot yo'q", "Takroriy so'rov"]) {
      expect(await screen.findByRole("option", { name: label })).toBeInTheDocument();
    }
    await user.click(screen.getByRole("option", { name: "Isbot yo'q" }));
    await user.type(within(dialog).getByRole("textbox", { name: /Izoh/ }), "  chek yo'q  ");
    await user.click(submit);

    await waitFor(() =>
      expect(http.post).toHaveBeenCalledWith("orders/extra-cost-approvals/ap-1/reject", {
        reason: "NO_PROOF",
        comment: "chek yo'q",
      }),
    );
    expect(await screen.findByText("So'rov rad etildi")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "So'rovni rad etish" })).not.toBeInTheDocument());
  });

  it("rad etish izohsiz — faqat sabab yuboriladi", async () => {
    const user = userEvent.setup();
    http.get.mockResolvedValue(listResponse([approval("ap-1", "cancel", "55")]));
    http.post.mockResolvedValue({ data: { statusCode: 200, data: {} } });
    renderBlock();

    await user.click(await screen.findByRole("button", { name: "Rad etish" }));
    const dialog = await screen.findByRole("dialog", { name: "So'rovni rad etish" });
    await user.click(within(dialog).getByRole("combobox", { name: /Rad etish sababi/ }));
    await user.click(await screen.findByRole("option", { name: "Takroriy so'rov" }));
    await user.click(within(dialog).getByRole("button", { name: "Rad etish" }));

    await waitFor(() =>
      expect(http.post).toHaveBeenCalledWith("orders/extra-cost-approvals/ap-1/reject", { reason: "DUPLICATE" }),
    );
  });

  it.each([
    ["409", httpError(409, "Conflict")],
    ["400 «allaqachon yakunlangan»", httpError(400, "Bu so'rov allaqachon yakunlangan")],
  ])("boshqa joyda (Telegram) hal qilingan so'rov — %s: ro'yxat yangilanadi, xato emas, xabar", async (_label, error) => {
    const user = userEvent.setup();
    http.get
      .mockResolvedValueOnce(listResponse([approval("ap-1", "sell", "53")]))
      .mockResolvedValue(listResponse([]));
    http.post.mockRejectedValue(error);
    renderBlock();

    await user.click(await screen.findByRole("button", { name: "Tasdiqlash" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Qo'shimcha xarajatni tasdiqlang" });
    await user.click(within(dialog).getByRole("button", { name: "Tasdiqlash" }));

    expect(await screen.findByText("So'rov allaqachon hal qilingan")).toBeInTheDocument();
    expect(screen.queryByText("Xatolik")).not.toBeInTheDocument();
    await waitFor(() => expect(http.get).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "Qo'shimcha xarajat tasdiqlari" })).not.toBeInTheDocument(),
    );
  });

  it("rad etishda «allaqachon yakunlangan» — oyna yopiladi va ro'yxat yangilanadi", async () => {
    const user = userEvent.setup();
    http.get
      .mockResolvedValueOnce(listResponse([approval("ap-1", "sell", "53")]))
      .mockResolvedValue(listResponse([]));
    http.post.mockRejectedValue(httpError(400, "Bu so'rov allaqachon yakunlangan"));
    renderBlock();

    await user.click(await screen.findByRole("button", { name: "Rad etish" }));
    const dialog = await screen.findByRole("dialog", { name: "So'rovni rad etish" });
    await user.click(within(dialog).getByRole("combobox", { name: /Rad etish sababi/ }));
    await user.click(await screen.findByRole("option", { name: "Juda qimmat" }));
    await user.click(within(dialog).getByRole("button", { name: "Rad etish" }));

    expect(await screen.findByText("So'rov allaqachon hal qilingan")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "So'rovni rad etish" })).not.toBeInTheDocument());
    await waitFor(() => expect(http.get).toHaveBeenCalledTimes(2));
  });

  it("market operatori — ro'yxatni ko'radi, qaror tugmalari yo'q, izoh bor", async () => {
    http.get.mockResolvedValue(listResponse([approval("ap-1", "sell", "53")]));
    renderBlock("market_operator");

    expect(await screen.findByRole("listitem", { name: "Sotishdagi qo'shimcha xarajat, buyurtma №53" })).toBeInTheDocument();
    expect(screen.getByText("Faqat market egasi qaror qiladi")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tasdiqlash" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rad etish" })).not.toBeInTheDocument();
  });

  it("ro'yxat yuklanmasa — xato holati va «Qayta urinish»", async () => {
    const user = userEvent.setup();
    http.get.mockRejectedValueOnce(httpError(500, "Server xatosi")).mockResolvedValue(listResponse([]));
    renderBlock();

    expect(await screen.findByRole("heading", { name: "Qo'shimcha xarajat tasdiqlari" })).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Qayta urinish" }));
    await waitFor(() => expect(http.get).toHaveBeenCalledTimes(2));
  });
});
