import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import MainCashbox from "./mainCashbox";
import { PrepareImageError } from "../../../shared/lib/downscaleImage";
import { renderWithProviders } from "../../../test/test-utils";

/**
 * QlLf33Ma, 7-bosqich — «Kassadan xarajat» oynasida chek rasmi (TZ qabul mezonlari 2, 3-UI):
 *  - rasm yoqiq: rasmsiz «saqlash» → maydon xatosi, so'rov KETMAYDI; rasm o'chiq → maydon va «Chek» qatori yo'q;
 *  - avval `POST finance/receipts` (multipart `kind`, `photo`), keyin `spend` tanasida `receipt_id`; tasdiqda «Biriktirildi»;
 *  - 12 MB surat brauzerda ≤ 5 MB bo'lib o'tadi; yuklanayotganda «Xarajatni saqlash» o'chiq;
 *  - `RECEIPT_REQUIRED` (forma ochiqligida rasm yoqildi) → maydon chiqadi, sozlama qayta o'qiladi; `RECEIPT_ALREADY_USED` →
 *    qoralama tozalanadi; boshqa rad → qoralama qoladi, takror yuborishda rasm QAYTA yuklanmaydi va kalit o'zgarmaydi.
 *
 * Haqiqiy `useCashBox`, `useReceiptField` va oyna — faqat HTTP qatlami va brauzer rasm kodlovchisi almashtirilgan.
 */

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
const prepareImageMock = vi.hoisted(() => vi.fn());

vi.mock("../../../shared/api/api", () => ({
  api: http,
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));
vi.mock("../../../shared/lib/downscaleImage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../shared/lib/downscaleImage")>()),
  prepareImage: prepareImageMock,
}));
vi.mock("./lib/exportMainCashboxReport", () => ({ exportMainCashboxReport: vi.fn() }));
vi.mock("../../../entities/user/api/userApi", () => ({
  useUser: () => ({
    useGetUser: () => ({ data: undefined, isLoading: false }),
    useGetUserById: () => ({ data: undefined, isLoading: false }),
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

const SPEND_URL = "finance/cashbox/spend";
const RECEIPTS_URL = "finance/receipts";
const SETTINGS_URL = "finance/receipt-settings";
const ON = { photo_required: true, ai_enabled: true };
const OFF = { photo_required: false, ai_enabled: false };

let manualExpense: typeof ON = ON;

const superadmin = { role: { id: "1", role: "superadmin", region: null, name: "Admin" } } as never;
const admin = { role: { id: "2", role: "admin", region: null, name: "Admin" } } as never;

const receiptError = (status: number, code: string, message = "Rad etildi") =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status, data: { statusCode: status, code, message } },
  });

const spendCalls = () => http.patch.mock.calls.filter(([url]) => url === SPEND_URL);
const uploads = () => http.post.mock.calls.filter(([url]) => url === RECEIPTS_URL);
const settingsReads = () => http.get.mock.calls.filter(([url]) => url === SETTINGS_URL).length;

const photoFile = (name = "IMG_4471.jpg", size = 1024) =>
  new File([new Uint8Array(size)], name, { type: "image/jpeg" });

const openDialog = async (user: ReturnType<typeof userEvent.setup>, preloadedState: never = superadmin) => {
  renderWithProviders(<MainCashbox />, { preloadedState });
  await user.click(await screen.findByRole("button", { name: /Kassadan xarajat/ }));
  const dialog = await screen.findByRole("dialog", { name: "Kassadan xarajat" });
  await user.type(within(dialog).getByLabelText(/^Summa/), "145000");
  await user.click(within(dialog).getByRole("radio", { name: "Naqd" }));
  await user.click(within(dialog).getByRole("combobox", { name: /Xarajat kategoriyasi/ }));
  await user.click(await screen.findByRole("option", { name: /Kanselyariya/ }));
  return dialog;
};

const fileInput = (dialog: HTMLElement) => within(dialog).findByTestId("receipt-file-input") as Promise<HTMLInputElement>;
const pick = async (dialog: HTMLElement, file: File) => {
  fireEvent.change(await fileInput(dialog), { target: { files: [file] } });
};
const saveButton = (dialog: HTMLElement) => within(dialog).getByRole("button", { name: "Xarajatni saqlash" });

beforeEach(() => {
  window.sessionStorage.clear();
  manualExpense = ON;
  Object.values(http).forEach((fn) => fn.mockReset());
  prepareImageMock.mockReset();
  prepareImageMock.mockImplementation(async (file: File) => ({
    media_type: "image/jpeg",
    data_base64: btoa("jpeg-bytes"),
    preview: "data:image/jpeg;base64,AAAA",
    name: file.name.replace(/\.[^.]+$/, ".jpg"),
    bytes: 1_153_434,
  }));
  http.get.mockImplementation(async (url: string) => {
    if (url === "finance/shift/current") {
      return {
        data: {
          statusCode: 200,
          data: { shift: { id: "12", opened_by: "1", status: "open", opened_at: "2026-10-01T04:00:00.000Z" }, required: true },
        },
      };
    }
    if (url === "finance/cashbox/expense-categories") {
      return { data: { statusCode: 200, data: { items: [{ id: "3", name: "Kanselyariya", description: null, sort_order: 1 }] } } };
    }
    if (url === SETTINGS_URL) {
      return { data: { statusCode: 200, data: { manual_expense: manualExpense, hq_transfer: ON } } };
    }
    return { data: { statusCode: 200, message: "success", data: {} } };
  });
  http.post.mockImplementation(async (url: string) =>
    url === RECEIPTS_URL
      ? {
          data: {
            statusCode: 201,
            data: { receipt_id: "501", kind: "manual_expense", state: "draft", photo_url: "https://cdn/signed/1", photo_url_expires_in: 300 },
          },
        }
      : { data: { statusCode: 200, data: {} } },
  );
  http.patch.mockImplementation(async () => ({
    data: { statusCode: 200, message: "ok", data: { id: "900", receipt: { id: "501", ai_status: "pending" } } },
  }));
});

describe("Kassadan xarajat — chek rasmi (QlLf33Ma)", () => {
  it("TC2: rasm yoqiq — rasmsiz saqlash maydon xatosini beradi, so'rov ketmaydi", async () => {
    const user = userEvent.setup();
    const dialog = await openDialog(user);

    await within(dialog).findByRole("button", { name: /Chek rasmini yuklash/ });
    expect(within(dialog).getByText("JPG, PNG yoki WEBP · 5 MB gacha")).toBeInTheDocument();
    expect(within(dialog).getByText("Saqlangach AI chekdagi summani kiritilgan summa bilan solishtiradi")).toBeInTheDocument();

    await user.click(saveButton(dialog));

    expect(await within(dialog).findByText("Chek rasmini yuklang")).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(spendCalls()).toHaveLength(0);
  });

  it("TC2: rasm o'chiq — maydon va «Chek» qatori yo'q, `receipt_id` yuborilmaydi", async () => {
    manualExpense = OFF;
    const user = userEvent.setup();
    const dialog = await openDialog(user);

    await waitFor(() => expect(settingsReads()).toBeGreaterThan(0));
    await waitFor(() => expect(within(dialog).queryByTestId("receipt-field-loading")).not.toBeInTheDocument());
    expect(within(dialog).queryByText("Chek rasmi")).not.toBeInTheDocument();

    await user.click(saveButton(dialog));
    const confirm = await screen.findByRole("alertdialog", { name: "Xarajatni tasdiqlang" });
    expect(within(confirm).queryByText("Chek")).not.toBeInTheDocument();
    await user.click(within(confirm).getByRole("button", { name: "Tasdiqlash" }));

    await waitFor(() => expect(spendCalls()).toHaveLength(1));
    expect(spendCalls()[0][1]).not.toHaveProperty("receipt_id");
  });

  it("TC3: 12 MB surat ≤ 5 MB bo'lib yuklanadi, tasdiqda «Biriktirildi», chiqimda `receipt_id`, xabarda AI", async () => {
    const user = userEvent.setup();
    const dialog = await openDialog(user);

    await pick(dialog, photoFile("IMG_4471.heic.jpg", 12 * 1024 * 1024));

    expect(await within(dialog).findByText("Yuklandi", { exact: false })).toBeInTheDocument();
    expect(prepareImageMock).toHaveBeenCalledWith(expect.any(File), { maxBytes: 5 * 1024 * 1024 });
    const [, form] = uploads()[0] as [string, FormData];
    expect(form.get("kind")).toBe("manual_expense");
    const sent = form.get("photo") as File;
    expect(sent.type).toBe("image/jpeg");
    expect(sent.size).toBeLessThanOrEqual(5 * 1024 * 1024);

    await user.click(saveButton(dialog));
    const confirm = await screen.findByRole("alertdialog", { name: "Xarajatni tasdiqlang" });
    expect(within(confirm).getByText("Chek")).toBeInTheDocument();
    expect(within(confirm).getByText("Biriktirildi")).toBeInTheDocument();
    await user.click(within(confirm).getByRole("button", { name: "Tasdiqlash" }));

    await waitFor(() => expect(spendCalls()).toHaveLength(1));
    expect(spendCalls()[0][1]).toMatchObject({ amount: 145000, type: "cash", expense_category_id: "3", receipt_id: "501" });
    expect(
      await screen.findByText("Xarajat muvaffaqiyatli saqlandi. Chek AI tahlilida — natija tarixda ko'rinadi."),
    ).toBeInTheDocument();
  });

  it("yuklanayotganda «Xarajatni saqlash» o'chiq, «To'xtatish» bo'sh holatga qaytaradi", async () => {
    let finish: (value: unknown) => void = () => undefined;
    http.post.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
    const user = userEvent.setup();
    const dialog = await openDialog(user);

    await pick(dialog, photoFile());
    expect(await within(dialog).findByRole("progressbar", { name: "Chek rasmi yuklanmoqda" })).toBeInTheDocument();
    await waitFor(() => expect(saveButton(dialog)).toBeDisabled());

    await user.click(within(dialog).getByRole("button", { name: "Yuklashni to'xtatish" }));
    expect(await within(dialog).findByRole("button", { name: /Chek rasmini yuklash/ })).toBeInTheDocument();
    await act(async () => finish({ data: { data: { receipt_id: "777" } } }));
    expect(within(dialog).queryByText("Yuklandi", { exact: false })).not.toBeInTheDocument();
  });

  it("yuklash xatosi — «Yuklab bo'lmadi» + «Qayta urinish», HEIC va format — aniq matn", async () => {
    http.post.mockImplementationOnce(async () => {
      throw Object.assign(new Error("boom"), { response: { status: 500, data: {} } });
    });
    const user = userEvent.setup();
    const dialog = await openDialog(user);

    await pick(dialog, photoFile());
    expect(await within(dialog).findByText("Yuklab bo'lmadi")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Qayta urinish" }));
    expect(await within(dialog).findByText("Yuklandi", { exact: false })).toBeInTheDocument();
    expect(uploads()).toHaveLength(2);

    await user.click(within(dialog).getByRole("button", { name: "Chek rasmini olib tashlash" }));
    prepareImageMock.mockRejectedValueOnce(new PrepareImageError("heic_unsupported"));
    await pick(dialog, photoFile("IMG_5520.HEIC"));
    expect(await within(dialog).findByText("HEIC rasmni o'qib bo'lmadi — JPG yoki PNG yuklang")).toBeInTheDocument();

    prepareImageMock.mockRejectedValueOnce(new PrepareImageError("unsupported"));
    await pick(dialog, photoFile("hisob.pdf"));
    expect(await within(dialog).findByText("Faqat JPG, PNG yoki WEBP rasm yuklang")).toBeInTheDocument();

    prepareImageMock.mockRejectedValueOnce(new PrepareImageError("over_limit"));
    await pick(dialog, photoFile("chek_skan.png"));
    expect(await within(dialog).findByText("Rasm hajmi 5 MB dan oshmasin")).toBeInTheDocument();
    expect(uploads()).toHaveLength(2);
  });

  it("forma ochiqligida rasm yoqildi: `RECEIPT_REQUIRED` → maydon chiqadi, sozlama qayta o'qiladi, xabar maydonda", async () => {
    manualExpense = OFF;
    http.patch.mockImplementationOnce(async () => {
      throw receiptError(400, "RECEIPT_REQUIRED", "Chek rasmini yuklang");
    });
    const user = userEvent.setup();
    const dialog = await openDialog(user);
    await waitFor(() => expect(settingsReads()).toBe(1));
    await waitFor(() => expect(within(dialog).queryByTestId("receipt-field-loading")).not.toBeInTheDocument());

    manualExpense = ON;
    await user.click(saveButton(dialog));
    const confirm = await screen.findByRole("alertdialog", { name: "Xarajatni tasdiqlang" });
    await user.click(within(confirm).getByRole("button", { name: "Tasdiqlash" }));

    expect(await within(dialog).findByRole("button", { name: /Chek rasmini yuklash/ })).toBeInTheDocument();
    expect(within(dialog).getByText("Chek rasmini yuklang")).toBeInTheDocument();
    await waitFor(() => expect(settingsReads()).toBe(2));
    expect(screen.getByRole("dialog", { name: "Kassadan xarajat" })).toBeInTheDocument();
  });

  it("`RECEIPT_ALREADY_USED` → qoralama tozalanadi, maydonda aniq xabar", async () => {
    http.patch.mockImplementationOnce(async () => {
      throw receiptError(409, "RECEIPT_ALREADY_USED");
    });
    const user = userEvent.setup();
    const dialog = await openDialog(user);
    await pick(dialog, photoFile());
    await within(dialog).findByText("Yuklandi", { exact: false });

    await user.click(saveButton(dialog));
    const confirm = await screen.findByRole("alertdialog", { name: "Xarajatni tasdiqlang" });
    await user.click(within(confirm).getByRole("button", { name: "Tasdiqlash" }));

    expect(
      await within(dialog).findByText("Chek topilmadi yoki boshqa operatsiyaga biriktirilgan — rasmni qayta yuklang"),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /Chek rasmini yuklash/ })).toBeInTheDocument();
    expect(within(dialog).queryByText("Yuklandi", { exact: false })).not.toBeInTheDocument();
  });

  it("boshqa rad (400): qoralama qoladi — takror yuborishda rasm qayta yuklanmaydi, `Idempotency-Key` o'sha", async () => {
    http.patch.mockImplementationOnce(async () => {
      throw Object.assign(new Error("400"), { response: { status: 400, data: { statusCode: 400, message: "Kassada mablag' yetarli emas" } } });
    });
    const user = userEvent.setup();
    const dialog = await openDialog(user);
    await pick(dialog, photoFile());
    await within(dialog).findByText("Yuklandi", { exact: false });

    await user.click(saveButton(dialog));
    await user.click(within(await screen.findByRole("alertdialog", { name: "Xarajatni tasdiqlang" })).getByRole("button", { name: "Tasdiqlash" }));
    expect(await screen.findByText("Kassada mablag' yetarli emas")).toBeInTheDocument();

    await user.click(saveButton(dialog));
    await user.click(within(await screen.findByRole("alertdialog", { name: "Xarajatni tasdiqlang" })).getByRole("button", { name: "Tasdiqlash" }));

    await waitFor(() => expect(spendCalls()).toHaveLength(2));
    expect(uploads()).toHaveLength(1);
    const [first, second] = spendCalls();
    expect(first[1].receipt_id).toBe("501");
    expect(second[1].receipt_id).toBe("501");
    expect(first[2].headers["Idempotency-Key"]).toBe(second[2].headers["Idempotency-Key"]);
  });

  it("rasm almashsa ham `Idempotency-Key` o'zgarmaydi (`receipt_id` barmoq iziga kirmaydi)", async () => {
    http.patch.mockImplementationOnce(async () => {
      throw Object.assign(new Error("504"), { response: { status: 504, data: { statusCode: 504, message: "timeout" } } });
    });
    const user = userEvent.setup();
    const dialog = await openDialog(user);
    await pick(dialog, photoFile());
    await within(dialog).findByText("Yuklandi", { exact: false });
    await user.click(saveButton(dialog));
    await user.click(within(await screen.findByRole("alertdialog", { name: "Xarajatni tasdiqlang" })).getByRole("button", { name: "Tasdiqlash" }));
    await waitFor(() => expect(spendCalls()).toHaveLength(1));

    http.post.mockImplementationOnce(async () => ({ data: { statusCode: 201, data: { receipt_id: "502", photo_url: null } } }));
    await pick(dialog, photoFile("IMG_2.jpg"));
    await within(dialog).findByText("IMG_2.jpg");
    await within(dialog).findByText("Yuklandi", { exact: false });
    await user.click(saveButton(dialog));
    await user.click(within(await screen.findByRole("alertdialog", { name: "Xarajatni tasdiqlang" })).getByRole("button", { name: "Tasdiqlash" }));

    await waitFor(() => expect(spendCalls()).toHaveLength(2));
    const [first, second] = spendCalls();
    expect(second[1].receipt_id).toBe("502");
    expect(first[2].headers["Idempotency-Key"]).toBe(second[2].headers["Idempotency-Key"]);
  });

  it("superadminda «Sozlamalar» havolasi bor, adminda yo'q; AI o'chiq — izoh", async () => {
    manualExpense = { photo_required: true, ai_enabled: false };
    const user = userEvent.setup();
    const dialog = await openDialog(user, admin);

    await within(dialog).findByRole("button", { name: /Chek rasmini yuklash/ });
    expect(within(dialog).queryByRole("link", { name: "Sozlamalar" })).not.toBeInTheDocument();
    expect(within(dialog).getByText("AI tahlili o'chiq — chek faqat saqlanadi")).toBeInTheDocument();
  });

  it("sozlama o'qilmadi — maydon majburiy deb ko'rsatiladi", async () => {
    const original = http.get.getMockImplementation();
    http.get.mockImplementation(async (url: string, ...rest: unknown[]) => {
      if (url === SETTINGS_URL) throw Object.assign(new Error("500"), { response: { status: 500, data: {} } });
      return original?.(url, ...rest);
    });
    const user = userEvent.setup();
    const dialog = await openDialog(user);

    const superadminLink = await within(dialog).findByRole("link", { name: "Sozlamalar" });
    expect(superadminLink).toHaveAttribute("href", "/payments/shift-settings");
    await user.click(saveButton(dialog));
    expect(await within(dialog).findByText("Chek rasmini yuklang")).toBeInTheDocument();
    expect(spendCalls()).toHaveLength(0);
  });

  it("internet yo'q — tugma o'chiq, izoh «Internet yo'q»", async () => {
    const onLine = vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    const user = userEvent.setup();
    const dialog = await openDialog(user);

    const trigger = await within(dialog).findByRole("button", { name: /Chek rasmini yuklash/ });
    expect(trigger).toBeDisabled();
    expect(within(dialog).getByText("Internet yo'q — aloqa tiklangach rasmni yuklang")).toBeInTheDocument();
    onLine.mockRestore();
  });

  it("«Kassani to'ldirish» da chek maydoni va sozlama so'rovi yo'q", async () => {
    const user = userEvent.setup();
    renderWithProviders(<MainCashbox />, { preloadedState: superadmin });
    await user.click(await screen.findByRole("button", { name: /Kassani to'ldirish/ }));
    const dialog = await screen.findByRole("dialog", { name: "Kassani to'ldirish" });

    expect(within(dialog).queryByText("Chek rasmi")).not.toBeInTheDocument();
    expect(settingsReads()).toBe(0);
  });
});
