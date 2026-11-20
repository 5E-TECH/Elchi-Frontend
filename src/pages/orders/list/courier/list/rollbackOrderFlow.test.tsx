import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useOrders } from "../../../../../entities/orders";
import { resetRollbackKeys } from "../../../../../entities/orders/rollbackIdempotency";
import { renderWithProviders } from "../../../../../test/test-utils";
import { Button } from "../../../../../shared/ui/primitives";
import RollbackOrderDialog from "./RollbackOrderDialog";
import { getRollbackResultNotes, type ActionOrder } from "./orderActionModel";
import { useRollbackOrderFlow } from "./useRollbackOrderFlow";

/**
 * BE #738 — qaytarish oynasi oqimi (haqiqiy `RollbackOrder` mutatsiyasi + `RollbackOrderDialog`, soxta API):
 * `Idempotency-Key` har so'rovda va qayta urinishda o'sha; xato OYNA ICHIDA; `STATE_CHANGED` → buyurtma qayta
 * o'qiladi → qayta yuboriladi; 503 / 409 / 422 / javob kelmadi — «Qayta urinish»; aniq rad — tugma o'chiq.
 */

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("../../../../../shared/api/api", () => ({ api: apiMock, LONG_REQUEST_TIMEOUT_MS: 120000 }));

const ORDER: ActionOrder = {
  id: "10302",
  status: "sold",
  total_price: 96000,
  where_deliver: "address",
  market: { name: "Chilonzor Market" },
  customer: { name: "Malika Yusupova", phone_number: "+998998124011" },
  district: { name: "Jomboy tumani" },
};

const Harness = ({ ledgerNote = false }: { ledgerNote?: boolean }) => {
  const { RollbackOrder } = useOrders();
  const rollback = useRollbackOrderFlow<ActionOrder>({ mutation: RollbackOrder });
  return (
    <>
      <Button onClick={() => rollback.open(ORDER)}>Ochish</Button>
      <RollbackOrderDialog {...rollback.dialogProps} variant="manager" ledgerNote={ledgerNote} />
    </>
  );
};

const httpError = (status: number, data: Record<string, unknown>) =>
  Object.assign(new Error(`HTTP ${status}`), { isAxiosError: true, response: { status, data } });

const rollbackCalls = () => apiMock.post.mock.calls.filter(([url]) => String(url).startsWith("orders/rollback/"));
const keyOf = (call: unknown[]) => (call[2] as { headers: Record<string, string> }).headers["Idempotency-Key"];

const openDialog = async () => {
  const user = userEvent.setup();
  renderWithProviders(<Harness />);
  await user.click(screen.getByRole("button", { name: "Ochish" }));
  const dialog = await screen.findByRole("alertdialog", { name: "Buyurtmani qaytarish" });
  return { user, dialog };
};

describe("qaytarish oynasi — BE #738 oqimi", () => {
  beforeEach(() => {
    resetRollbackKeys();
    apiMock.get.mockReset();
    apiMock.post.mockReset();
    apiMock.get.mockResolvedValue({ data: { statusCode: 200, data: [] } });
  });

  it("⭐ muvaffaqiyat: Idempotency-Key bilan POST, oyna yopiladi, maqsad holatli xabar + hisob-kitob izohi", async () => {
    apiMock.post.mockResolvedValue({
      data: {
        statusCode: 200,
        message: "Order WAITING holatiga qaytarildi. Kuryer filialga topshirgan 96000 so'm uning keyingi topshirig'iga hisoblanadi",
        data: {},
      },
    });
    const { user, dialog } = await openDialog();
    await user.click(within(dialog).getByRole("button", { name: "Ha, qaytarish" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    const [call] = rollbackCalls();
    expect(call[0]).toBe("orders/rollback/10302");
    expect(call[1]).toEqual({ target_status: "waiting" });
    expect(keyOf(call)).toEqual(expect.any(String));
    expect(await screen.findByText("Buyurtma «Kutilmoqda» holatiga qaytarildi")).toBeInTheDocument();
    expect(
      screen.getByText(/Kuryer filialga topshirgan 96000 so'm uning keyingi topshirig'iga hisoblanadi/),
    ).toBeInTheDocument();
  });

  it("⭐ aniq rad (SUPERADMIN_ONLY): server matni oyna ichida, asosiy tugma o'chiq, toast yo'q", async () => {
    apiMock.post.mockRejectedValue(
      httpError(400, {
        statusCode: 400,
        code: "SUPERADMIN_ONLY",
        message: "Buyurtma puli bosh ofisga o'tgan — faqat superadmin qaytara oladi",
      }),
    );
    const { user, dialog } = await openDialog();
    await user.click(within(dialog).getByRole("button", { name: "Ha, qaytarish" }));

    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("Buyurtma puli bosh ofisga o'tgan — faqat superadmin qaytara oladi");
    expect(within(dialog).getByRole("button", { name: "Ha, qaytarish" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Orqaga" })).toBeEnabled();
    expect(rollbackCalls()).toHaveLength(1);
  });

  it("⭐ STATE_CHANGED → «Qayta urinish»: avval GET /orders/:id, so'ng AYNI kalit bilan qayta yuboriladi", async () => {
    apiMock.post
      .mockRejectedValueOnce(
        httpError(400, { statusCode: 400, code: "STATE_CHANGED", message: "Rollback holati o'zgargan — qayta urinib ko'ring" }),
      )
      .mockResolvedValueOnce({ data: { statusCode: 200, message: "Order WAITING holatiga qaytarildi", data: {} } });
    apiMock.get.mockImplementation(async (url: string) =>
      url === "orders/10302"
        ? { data: { statusCode: 200, data: { ...ORDER, rollback: { allowed: true, code: null, message: null } } } }
        : { data: { statusCode: 200, data: [] } },
    );
    const { user, dialog } = await openDialog();
    await user.click(within(dialog).getByRole("button", { name: "Ha, qaytarish" }));

    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("Rollback holati o'zgargan — qayta urinib ko'ring");
    expect(alert).toHaveTextContent("«Qayta urinish» buyurtmani yangidan o'qiydi va so'rovni qayta yuboradi.");
    apiMock.get.mockClear();
    await user.click(within(dialog).getByRole("button", { name: "Qayta urinish" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(apiMock.get).toHaveBeenCalledWith("orders/10302");
    const calls = rollbackCalls();
    expect(calls).toHaveLength(2);
    expect(keyOf(calls[1])).toBe(keyOf(calls[0]));
  });

  it("STATE_CHANGED → qayta o'qilgan buyurtmada ruxsat endi yo'q — sababi ko'rinadi, qayta yuborilmaydi", async () => {
    apiMock.post.mockRejectedValueOnce(
      httpError(400, { statusCode: 400, code: "STATE_CHANGED", message: "Rollback holati o'zgargan" }),
    );
    apiMock.get.mockResolvedValue({
      data: {
        statusCode: 200,
        data: {
          ...ORDER,
          rollback: {
            allowed: false,
            code: "SUPERADMIN_ONLY",
            message: "Buyurtmaning market ulushi filial kassasidan to'langan — faqat superadmin qaytara oladi",
          },
        },
      },
    });
    const { user, dialog } = await openDialog();
    await user.click(within(dialog).getByRole("button", { name: "Ha, qaytarish" }));
    await user.click(await within(dialog).findByRole("button", { name: "Qayta urinish" }));

    expect(await within(dialog).findByText(/filial kassasidan to'langan — faqat superadmin qaytara oladi/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Ha, qaytarish" })).toBeDisabled();
    expect(rollbackCalls()).toHaveLength(1);
  });

  it("⭐ 503: server matni + «pul ko'chmadi» izohi; «Qayta urinish» — ayni kalit", async () => {
    apiMock.post
      .mockRejectedValueOnce(
        httpError(503, { statusCode: 503, message: "Kassa ma'lumotini o'qib bo'lmadi — birozdan so'ng qayta urinib ko'ring" }),
      )
      .mockResolvedValueOnce({ data: { statusCode: 200, data: {} } });
    const { user, dialog } = await openDialog();
    await user.click(within(dialog).getByRole("button", { name: "Ha, qaytarish" }));

    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("Kassa ma'lumotini o'qib bo'lmadi");
    expect(alert).toHaveTextContent("Pul ko'chmadi. Birozdan so'ng qayta urinib ko'ring.");
    await user.click(within(dialog).getByRole("button", { name: "Qayta urinish" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    const calls = rollbackCalls();
    expect(keyOf(calls[1])).toBe(keyOf(calls[0]));
    // 503 da buyurtma qayta o'qilmaydi (pul ko'chmagan — to'g'ridan-to'g'ri qayta yuboriladi).
    expect(apiMock.get).not.toHaveBeenCalledWith("orders/10302");
  });

  it("409 (bajarilmoqda) — tushuntirish, «Qayta urinish» ayni kalit bilan; saqlangan natija — muvaffaqiyat", async () => {
    apiMock.post
      .mockRejectedValueOnce(
        httpError(409, { statusCode: 409, code: "IDEMPOTENCY_IN_PROGRESS", message: "Takroriy so'rov hali bajarilmoqda" }),
      )
      .mockResolvedValueOnce({ data: { statusCode: 200, data: {} } });
    const { user, dialog } = await openDialog();
    await user.click(within(dialog).getByRole("button", { name: "Ha, qaytarish" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Bu buyurtmani qaytarish so'rovi hali bajarilmoqda. Biroz kuting va qayta urinib ko'ring — amal ikki marta bajarilmaydi.",
    );
    await user.click(within(dialog).getByRole("button", { name: "Qayta urinish" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    const calls = rollbackCalls();
    expect(keyOf(calls[1])).toBe(keyOf(calls[0]));
  });

  it("422 (kalit boshqa tanaga bog'langan) — «Qayta urinish» YANGI kalit bilan", async () => {
    apiMock.post
      .mockRejectedValueOnce(httpError(422, { statusCode: 422, code: "IDEMPOTENCY_KEY_MISMATCH", message: "mismatch" }))
      .mockResolvedValueOnce({ data: { statusCode: 200, data: {} } });
    const { user, dialog } = await openDialog();
    await user.click(within(dialog).getByRole("button", { name: "Ha, qaytarish" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "So'rov avvalgi urinishdan farq qiladi. Qayta urinib ko'ring.",
    );
    await user.click(within(dialog).getByRole("button", { name: "Qayta urinish" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    const calls = rollbackCalls();
    expect(keyOf(calls[1])).not.toBe(keyOf(calls[0]));
  });

  it("javob kelmadi (timeout) — oynada «qaytarilgan bo'lishi mumkin», qayta urinish ayni kalit bilan", async () => {
    apiMock.post
      .mockRejectedValueOnce(Object.assign(new Error("timeout of 120000ms exceeded"), { isAxiosError: true, code: "ECONNABORTED" }))
      .mockResolvedValueOnce({ data: { statusCode: 200, data: {} } });
    const { user, dialog } = await openDialog();
    await user.click(within(dialog).getByRole("button", { name: "Ha, qaytarish" }));

    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("Server javob bermadi — buyurtma qaytarilgan bo'lishi mumkin.");
    expect(alert).toHaveTextContent("Qayta urinish xavfsiz: amal ikki marta bajarilmaydi.");
    await user.click(within(dialog).getByRole("button", { name: "Qayta urinish" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    const calls = rollbackCalls();
    expect(keyOf(calls[1])).toBe(keyOf(calls[0]));
  });

  it("maqsad holat almashtirilsa xato tozalanadi; superadmin oynasida daftar izohi", async () => {
    apiMock.post.mockRejectedValue(
      httpError(400, { statusCode: 400, code: "INVALID_TARGET", message: "Noto'g'ri rollback maqsadi" }),
    );
    const user = userEvent.setup();
    renderWithProviders(<Harness ledgerNote />);
    await user.click(screen.getByRole("button", { name: "Ochish" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Buyurtmani qaytarish" });
    expect(within(dialog).getByTestId("rollback-ledger-note")).toHaveTextContent(
      "Pul HQ'ga o'tgan yoki market to'langan bo'lsa — naqd ko'chmaydi",
    );
    await user.click(within(dialog).getByRole("button", { name: "Ha, qaytarish" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Noto'g'ri rollback maqsadi");

    await user.click(within(dialog).getByRole("radio", { name: "Bekor qilish" }));
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Ha, qaytarish" })).toBeEnabled();
  });
});

describe("getRollbackResultNotes", () => {
  it("texnik birinchi gapdan keyingi izohlar; izohsiz yoki boshqa shakl — null", () => {
    expect(
      getRollbackResultNotes({
        message:
          "Order CANCELLED holatiga qaytarildi. Filialga 50000 so'm keyingi HQ topshirig'iga hisoblanadi. Market 30000 so'm oldindan olgan — keyingi to'lovidan ayiriladi",
      }),
    ).toBe(
      "Filialga 50000 so'm keyingi HQ topshirig'iga hisoblanadi. Market 30000 so'm oldindan olgan — keyingi to'lovidan ayiriladi",
    );
    expect(getRollbackResultNotes({ message: "Order WAITING holatiga qaytarildi" })).toBeNull();
    expect(getRollbackResultNotes({ message: "Order bekor qilinib pochtaga qo'shildi" })).toBeNull();
    expect(getRollbackResultNotes(null)).toBeNull();
  });
});
