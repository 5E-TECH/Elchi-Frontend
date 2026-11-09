import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { buildCorrectionTarget, type CorrectionTarget } from "../model/target";
import { CorrectAmountDialog } from "./CorrectAmountDialog";
import { ReversePaymentDialog } from "./ReversePaymentDialog";

/**
 * T6 N2 — «To'lovni qaytarish» va «Summani tahrirlash» oynalari haqiqiy UI orqali (`useConfirm`, `notify` — mock
 * qilinmaydi; faqat HTTP): forma holatlari, tasdiq mazmuni (to'lov turi bo'yicha, `transfer` yo'q — umumiy matn),
 * har xato kodi tasdiq oynasida qoladi, AMOUNT_EXCEEDS / SAME_AMOUNT — tugma o'chiq va «Orqaga» dan keyin maydon xatosi,
 * ALREADY_CORRECTED — «Orqaga» oqimni yopadi, muvaffaqiyat — xabar + yangilash + `onDone`, 504 — oflayn matn, yangilash
 * va o'sha `Idempotency-Key` bilan qayta yuborish.
 */

const mocks = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("../../../shared/api/api", () => ({
  api: { get: vi.fn(() => new Promise(() => {})), post: mocks.post, patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));

const http = (status: number, data: Record<string, unknown> = {}) =>
  Object.assign(new Error(`Request failed with status code ${status}`), { isAxiosError: true, response: { status, data }, request: {} });

const created = (action: "reverse" | "edit", idempotent = false) => ({
  data: {
    statusCode: idempotent ? 200 : 201,
    message: "ok",
    data: {
      correction: { id: "12", action, original_amount: 1, new_amount: action === "edit" ? 2 : null },
      cashboxes: [],
      idempotent,
    },
  },
});

const PAID_AT = "2026-10-06T09:32:00.000Z"; // «06.10.2026, 14:32» (Asia/Tashkent)
const DEADLINE = "2026-11-07T09:32:00.000Z"; // «07.11.2026, 14:32»
const REASON = "Boshqa kuryer tanlab yuborilgan";

const courierTransfer = {
  kind: "courier_payment",
  payment_method: "cash",
  amount: 1_850_000,
  receiver: { cashbox_type: "main", branch_id: null, name: null },
  courier: { id: "263", name: "Jasur Tursunov" },
  market: null,
};
const marketTransfer = {
  kind: "market_payment",
  payment_method: "click",
  amount: 2_400_000,
  receiver: { cashbox_type: "main", branch_id: null, name: null },
  courier: null,
  market: { id: "101", name: "Baraka Shop" },
};

const targetOf = (transfer: unknown, overrides: Partial<{ id: string; amount: number; title: string }> = {}) =>
  buildCorrectionTarget({
    id: overrides.id ?? "4512",
    amount: overrides.amount ?? 1_850_000,
    title: overrides.title ?? "Kuryer to'lovi",
    createdAt: PAID_AT,
    paymentMethod: "cash",
    correctable: { allowed: true, deadline: DEADLINE, window_days: 30, root_history_id: overrides.id ?? "4512", transfer },
  })!;

const courierTarget = () => targetOf(courierTransfer);
const marketTarget = () => targetOf(marketTransfer, { id: "4498", amount: 2_400_000, title: "Market to'lovi" });

const render = (kind: "reverse" | "edit", target: CorrectionTarget) => {
  const onCancel = vi.fn();
  const onDone = vi.fn();
  const onOpenShift = vi.fn();
  const Component = kind === "reverse" ? ReversePaymentDialog : CorrectAmountDialog;
  const utils = renderWithProviders(
    <Component open target={target} onCancel={onCancel} onDone={onDone} onOpenShift={onOpenShift} />,
  );
  utils.queryClient.setQueryData(["finance-history", target.id], { id: target.id });
  const stale = () => Boolean(utils.queryClient.getQueryState(["finance-history", target.id])?.isInvalidated);
  return { ...utils, onCancel, onDone, onOpenShift, stale, user: userEvent.setup() };
};

const post = (index: number) => {
  const [url, body, config] = mocks.post.mock.calls[index] as [string, unknown, { headers: Record<string, string> }];
  return { url, body, key: config.headers["Idempotency-Key"] };
};

const typeReason = async (user: ReturnType<typeof userEvent.setup>, value = REASON) => {
  const field = screen.getByRole("textbox", { name: /^Sabab/ });
  await user.clear(field);
  await user.type(field, value);
  return field;
};

const openReverseConfirm = async (target = courierTarget()) => {
  const utils = render("reverse", target);
  await typeReason(utils.user);
  await utils.user.click(screen.getByRole("button", { name: "Davom etish" }));
  const confirm = await screen.findByRole("alertdialog", { name: "To'lovni qaytarishni tasdiqlang" });
  return { ...utils, confirm };
};

const openCorrectConfirm = async (amount = "2000000", target = marketTarget()) => {
  const utils = render("edit", target);
  await utils.user.type(screen.getByRole("textbox", { name: /^To'g'ri summa/ }), amount);
  await typeReason(utils.user, "Marketga 2 000 000 so'm o'tkazilgan");
  await utils.user.click(screen.getByRole("button", { name: "Davom etish" }));
  const confirm = await screen.findByRole("alertdialog", { name: "Summani tahrirlashni tasdiqlang" });
  return { ...utils, confirm };
};

afterEach(() => mocks.post.mockReset());

describe("ReversePaymentDialog — forma", () => {
  it("xulosa, izoh, «Sabab» holatlari (bo'sh · qisqa · to'g'ri) va hisoblagich", async () => {
    const { user } = render("reverse", courierTarget());
    const dialog = screen.getByRole("dialog", { name: "To'lovni qaytarish" });
    expect(dialog).toHaveTextContent("#4512 · Kuryer to'lovi · 06.10.2026, 14:32");
    expect(dialog).toHaveTextContent("Qaytariladigan to'lov");
    expect(dialog).toHaveTextContent("1 850 000");
    expect(within(dialog).getByText("Naqd")).toBeInTheDocument();
    expect(within(dialog).getByText("Kuryer kassasi")).toBeInTheDocument();
    expect(within(dialog).getByText("Jasur Tursunov")).toBeInTheDocument();
    expect(within(dialog).getByText("Asosiy kassa")).toBeInTheDocument();
    expect(dialog).toHaveTextContent(
      "Pul teskari yo'nalishda qaytadi: asosiy kassadan Jasur Tursunov kassasiga. Asl yozuv o'chirilmaydi — teskari yozuv qo'shiladi.",
    );

    const field = screen.getByRole("textbox", { name: /^Sabab/ });
    expect(field).toHaveFocus();
    expect(field).toHaveAttribute("maxlength", "500");
    expect(field).toHaveAttribute("placeholder", "Nima uchun qaytaryapsiz?");
    expect(within(dialog).getByText("Kamida 5 ta belgi")).toBeInTheDocument();
    expect(within(dialog).getByText("0 / 500")).toBeInTheDocument();
    const next = within(dialog).getByRole("button", { name: "Davom etish" });
    expect(next).toBeDisabled();
    expect(next).toHaveAttribute("aria-haspopup", "dialog");

    await user.type(field, "Xato");
    expect(within(dialog).queryByText("Kamida 5 ta belgi yozing")).not.toBeInTheDocument();
    await user.tab();
    expect(within(dialog).getByText("Kamida 5 ta belgi yozing")).toBeInTheDocument();
    expect(within(dialog).getByText("4 / 500")).toBeInTheDocument();
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(next).toBeDisabled();

    await user.type(field, " — boshqa kuryer");
    expect(next).toBeEnabled();
    expect(within(dialog).getByText("Jurnalga yoziladi; kuryer ilovada ko'radi, Telegram xabariga kirmaydi")).toBeInTheDocument();
    expect(within(dialog).getByText("20 / 500")).toBeInTheDocument();
  });

  it("«Bekor qilish» — tafsilotga qaytish (`onCancel`), so'rov yo'q", async () => {
    const { user, onCancel, onDone } = render("reverse", courierTarget());
    await user.click(screen.getByRole("button", { name: "Bekor qilish" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
  });
});

describe("ReversePaymentDialog — tasdiq va natija", () => {
  it("kuryer → asosiy kassa: teskari yo'nalish, sabab, oqibatlar; muvaffaqiyat — xabar, yangilash, `onDone`", async () => {
    mocks.post.mockResolvedValueOnce(created("reverse"));
    const { confirm, user, onDone, stale } = await openReverseConfirm();
    expect(confirm).toHaveTextContent("#4512 · Kuryer to'lovi · 06.10.2026, 14:32");
    expect(confirm).toHaveTextContent("Summa");
    expect(confirm).toHaveTextContent("1 850 000");
    const [from, to] = [within(confirm).getByText("Qayerdan").parentElement!, within(confirm).getByText("Qayerga").parentElement!];
    expect(from).toHaveTextContent("Asosiy kassa");
    expect(to).toHaveTextContent("Kuryer kassasiJasur Tursunov");
    expect(within(confirm).getByText("Sabab").nextElementSibling).toHaveTextContent(REASON);
    expect(within(confirm).getAllByRole("listitem").map((item) => item.textContent?.replace(/\s+/g, " "))).toEqual([
      "Asosiy kassadan 1 850 000 so'm naqd chiqim yoziladi — joriy smenaga",
      "Jasur Tursunov kassasiga 1 850 000 so'm qaytadi — u pulni yana topshirishi kerak bo'ladi",
      "Kuryerga xabar boradi: ilovada, Telegram ulangan bo'lsa unda ham. Sabab faqat ilovada ko'rinadi",
      "Asl yozuv o'chirilmaydi — ro'yxatda «Qaytarildi» va «Teskari yozuv» bo'lib qoladi",
    ]);
    expect(confirm).toHaveTextContent("Qaytarishni bekor qilib bo'lmaydi.");
    expect(within(confirm).getByRole("button", { name: "Orqaga" })).toBeInTheDocument();

    await user.click(within(confirm).getByRole("button", { name: "Qaytarish" }));
    expect(await screen.findByText("To'lov qaytarildi")).toBeInTheDocument();
    expect(screen.getByText(/1 850 000 so'm Jasur Tursunov kassasiga qaytdi\. Kuryerga xabar yuborildi\./)).toBeInTheDocument();
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(stale()).toBe(true);
    const sent = post(0);
    expect(sent.url).toBe("finance/history/4512/reverse");
    expect(sent.body).toEqual({ reason: REASON });
    expect(sent.key).toMatch(/\S{8,}/);
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });

  it("market to'lovi: market kassasi → asosiy kassa, «… berilishi kerak summa … ortadi», buyurtmalar qatori", async () => {
    const { confirm } = await openReverseConfirm(marketTarget());
    expect(within(confirm).getByText("Qayerdan").parentElement).toHaveTextContent("Market kassasiBaraka Shop");
    expect(within(confirm).getByText("Qayerga").parentElement).toHaveTextContent("Asosiy kassa");
    expect(confirm).toHaveTextContent("Baraka Shopga berilishi kerak summa 2 400 000 so'mga ortadi");
    expect(confirm).toHaveTextContent("Oxirgi to'langan buyurtmalar «Qisman to'langan» yoki «Sotilgan» holatiga qaytadi");
    expect(within(confirm).getByText("O'tkazma")).toBeInTheDocument();
  });

  it("`correctable.transfer` yo'q (eski backend): umumiy matn, qayerdan → qayerga yo'q, nom o'ylab topilmaydi", async () => {
    const target = targetOf(undefined, { title: "Kuryer to'lovi" });
    const { user } = render("reverse", target);
    const dialog = screen.getByRole("dialog", { name: "To'lovni qaytarish" });
    expect(within(dialog).queryByText("Qayerdan")).not.toBeInTheDocument();
    expect(dialog).toHaveTextContent("Pul teskari yo'nalishda qaytadi. Asl yozuv o'chirilmaydi — teskari yozuv qo'shiladi.");
    await typeReason(user);
    expect(dialog).toHaveTextContent("Jurnalga yoziladi, Telegram xabariga kirmaydi");
    await user.click(screen.getByRole("button", { name: "Davom etish" }));
    const confirm = await screen.findByRole("alertdialog", { name: "To'lovni qaytarishni tasdiqlang" });
    expect(within(confirm).queryByText("Qayerdan")).not.toBeInTheDocument();
    expect(confirm).toHaveTextContent("Pul kassalarga teskari yo'nalishda qaytadi — joriy smenaga");
    expect(confirm).not.toHaveTextContent("Jasur");
  });

  const stays: Array<[string, unknown, RegExp, boolean]> = [
    ["SHIFT_REQUIRED", http(400, { code: "SHIFT_REQUIRED" }), /Smena ochilmagan/, false],
    ["INSUFFICIENT_BALANCE", http(409, { code: "INSUFFICIENT_BALANCE", required: 1_850_000 }), /Kassada pul yetmaydi.*\(kerak: 1 850 000 so'm\)/, false],
    ["BRANCH_SHIFT_REQUIRED", http(400, { code: "BRANCH_SHIFT_REQUIRED" }), /Filial smenasi ochilmagan/, false],
    ["CARD_ARCHIVED", http(409, { code: "CARD_ARCHIVED" }), /Karta arxivda/, false],
    ["WINDOW_EXPIRED", http(409, { code: "WINDOW_EXPIRED", deadline: DEADLINE, window_days: 30 }), /Muddat tugagan: 07\.11\.2026, 14:32/, false],
    ["LEGACY_UNLINKED", http(409, { code: "LEGACY_UNLINKED" }), /Eski yozuv/, false],
    ["NOT_CORRECTABLE", http(409, { code: "NOT_CORRECTABLE", reason: "cashbox_deleted" }), /Tuzatib bo'lmaydi.*Kuryer kassasi o'chirilgan\./, false],
    ["COURIER_MOVED", http(409, { code: "COURIER_MOVED" }), /^Tuzatib bo'lmaydi — kuryer boshqa filialga o'tgan\.$/, true],
    ["NOT_FOUND", http(404, { code: "NOT_FOUND" }), /Yozuv topilmadi/, true],
    ["500", http(500, { message: "Internal server error" }), /^Amalni bajarib bo'lmadi\. Qayta urinib ko'ring\.$/, false],
  ];
  it.each(stays)("%s: xato tasdiq oynasida qoladi (oyna ochiq, `onDone` yo'q)", async (_code, error, text, blocked) => {
    mocks.post.mockRejectedValueOnce(error);
    const { confirm, user, onDone, onCancel } = await openReverseConfirm();
    await user.click(within(confirm).getByRole("button", { name: "Qaytarish" }));
    const alert = await within(confirm).findByRole("alert");
    expect(alert.textContent?.replace(/\s+/g, " ")).toMatch(text);
    expect(alert).toHaveAttribute("data-tone", "danger");
    expect(alert).not.toHaveTextContent("Internal server error");
    const button = within(confirm).getByRole("button", { name: "Qaytarish" });
    if (blocked) await waitFor(() => expect(button).toBeDisabled());
    else expect(button).toBeEnabled();
    // Telefonda oqibatlar yashirinadi (xato ekran ostida qolmasin).
    expect(within(confirm).getByRole("list")).toHaveClass("max-md:hidden");
    expect(screen.getByRole("alertdialog")).toBe(confirm);
    expect(onDone).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("SHIFT_REQUIRED: «Smenani ochish» sahifa oqimini ochadi", async () => {
    mocks.post.mockRejectedValueOnce(http(400, { code: "SHIFT_REQUIRED" }));
    const { confirm, user, onOpenShift } = await openReverseConfirm();
    await user.click(within(confirm).getByRole("button", { name: "Qaytarish" }));
    const alert = await within(confirm).findByRole("alert");
    await user.click(within(alert).getByRole("button", { name: "Smenani ochish" }));
    expect(onOpenShift).toHaveBeenCalledTimes(1);
  });

  it("«Orqaga» — formaga, qiymat saqlanadi; qayta «Davom etish»", async () => {
    const { confirm, user, onCancel } = await openReverseConfirm();
    await user.click(within(confirm).getByRole("button", { name: "Orqaga" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(screen.getByRole("textbox", { name: /^Sabab/ })).toHaveValue(REASON);
    expect(onCancel).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("ALREADY_CORRECTED (ega qarori): neytral quti, tugma o'chiq, ro'yxat yangilanadi, «Orqaga» butun oqimni yopadi", async () => {
    mocks.post.mockRejectedValueOnce(http(409, { code: "ALREADY_CORRECTED" }));
    const { confirm, user, onDone, onCancel, stale } = await openReverseConfirm();
    await user.click(within(confirm).getByRole("button", { name: "Qaytarish" }));
    const alert = await within(confirm).findByRole("alert");
    expect(alert).toHaveAttribute("data-tone", "neutral");
    expect(alert).toHaveTextContent(/^To'lov allaqachon tuzatilgan\. Ro'yxat yangilandi\.$/);
    await waitFor(() => expect(within(confirm).getByRole("button", { name: "Qaytarish" })).toBeDisabled());
    expect(stale()).toBe(true);
    await user.click(within(confirm).getByRole("button", { name: "Orqaga" }));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("504: «Internet aloqasi yo'q» (WifiOff), ro'yxat yangilanadi; qayta bosish — o'sha kalit va tana, 200 idempotent — muvaffaqiyat", async () => {
    mocks.post.mockRejectedValueOnce(http(504)).mockResolvedValueOnce(created("reverse", true));
    const { confirm, user, onDone, stale } = await openReverseConfirm();
    await user.click(within(confirm).getByRole("button", { name: "Qaytarish" }));
    const alert = await within(confirm).findByRole("alert");
    expect(alert).toHaveTextContent("Internet aloqasi yo'q");
    expect(alert).toHaveTextContent("Aloqa tiklangach «Qaytarish»ni qayta bosing — to'lov ikki marta qaytarilmaydi.");
    expect(alert.querySelector("svg")).toHaveClass("lucide-wifi-off");
    expect(stale()).toBe(true);
    await user.click(within(confirm).getByRole("button", { name: "Qaytarish" }));
    expect(await screen.findByText("To'lov qaytarildi")).toBeInTheDocument();
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(post(1).key).toBe(post(0).key);
    expect(post(1).body).toEqual(post(0).body);
  });

  it("tarmoq xatosidan keyin sabab o'zgarsa — yangi kalit", async () => {
    mocks.post
      .mockRejectedValueOnce(Object.assign(new Error("Network Error"), { isAxiosError: true, code: "ERR_NETWORK", request: {} }))
      .mockResolvedValueOnce(created("reverse"));
    const { confirm, user } = await openReverseConfirm();
    await user.click(within(confirm).getByRole("button", { name: "Qaytarish" }));
    await within(confirm).findByRole("alert");
    await user.click(within(confirm).getByRole("button", { name: "Orqaga" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    await typeReason(user, "Pul boshqa kuryerdan olingan");
    await user.click(screen.getByRole("button", { name: "Davom etish" }));
    const again = await screen.findByRole("alertdialog", { name: "To'lovni qaytarishni tasdiqlang" });
    await user.click(within(again).getByRole("button", { name: "Qaytarish" }));
    await screen.findByText("To'lov qaytarildi");
    expect(post(1).body).toEqual({ reason: "Pul boshqa kuryerdan olingan" });
    expect(post(1).key).not.toBe(post(0).key);
  });
});

describe("CorrectAmountDialog", () => {
  it("forma: joriy summa, «To'g'ri summa» holatlari (0 · bir xil · to'g'ri), «Farq» va izohi", async () => {
    const { user } = render("edit", marketTarget());
    const dialog = screen.getByRole("dialog", { name: "Summani tahrirlash" });
    expect(dialog).toHaveTextContent("#4498 · Market to'lovi · Baraka Shop · 06.10.2026, 14:32");
    expect(dialog).toHaveTextContent("Joriy summa");
    expect(within(dialog).getByText("Market kassasi")).toBeInTheDocument();
    const amount = screen.getByRole("textbox", { name: /^To'g'ri summa/ });
    expect(amount).toHaveFocus();
    expect(within(dialog).getByText("0 dan katta va joriy summadan farqli")).toBeInTheDocument();
    const next = within(dialog).getByRole("button", { name: "Davom etish" });
    expect(next).toBeDisabled();

    await user.type(amount, "0");
    expect(within(dialog).getByText("0 dan katta summa kiriting")).toBeInTheDocument();
    expect(dialog.querySelector("[data-correction-diff]")).toBeNull();
    await user.clear(amount);
    await user.type(amount, "2400000");
    expect(within(dialog).getByText("Yangi summa joriy summa bilan bir xil")).toBeInTheDocument();
    expect(dialog.querySelector("[data-correction-diff]")).toBeNull();
    await user.clear(amount);
    await user.type(amount, "2000000");
    const diff = dialog.querySelector("[data-correction-diff]")!;
    expect(diff).toHaveTextContent("Farq");
    expect(diff).toHaveTextContent("−400 000 so'm");
    expect(diff).toHaveTextContent(
      "Asosiy kassaga 400 000 so'm qaytadi, Baraka Shopga berilishi kerak summa 400 000 so'mga ortadi",
    );
    expect(diff.parentElement).toHaveAttribute("aria-live", "polite");
    expect(next).toBeDisabled(); // sabab hali yo'q
    await typeReason(user, "Marketga 2 000 000 so'm o'tkazilgan");
    expect(within(dialog).getByText("Jurnalga yoziladi; market ilovada ko'radi, Telegram xabariga kirmaydi")).toBeInTheDocument();
    expect(next).toBeEnabled();
  });

  it("tasdiq: Joriy · To'g'ri · Farq · Sabab, oqibatlar, eslatma; tana `{ new_amount, reason }`; «Summa tuzatildi»", async () => {
    mocks.post.mockResolvedValueOnce(created("edit"));
    const { confirm, user, onDone, stale } = await openCorrectConfirm();
    expect(confirm).toHaveTextContent("#4498 · Market to'lovi · Baraka Shop");
    expect(confirm).not.toHaveTextContent("14:32 ·");
    expect(within(confirm).getByText("Joriy summa").nextElementSibling).toHaveTextContent("2 400 000 so'm");
    const next = within(confirm).getByText("To'g'ri summa").nextElementSibling!;
    expect(next).toHaveTextContent("2 000 000 so'm");
    expect(next.querySelector(".text-base.font-bold")).not.toBeNull();
    expect(within(confirm).getByText("Farq").nextElementSibling).toHaveTextContent("−400 000 so'm");
    expect(within(confirm).getByText("Sabab").nextElementSibling).toHaveTextContent("Marketga 2 000 000 so'm o'tkazilgan");
    const items = within(confirm).getAllByRole("listitem").map((item) => item.textContent?.replace(/\s+/g, " "));
    expect(items).toEqual([
      "Asosiy kassaga 400 000 so'm qaytadi — joriy smenaga",
      "Baraka Shopga berilishi kerak summa 400 000 so'mga ortadi; oxirgi to'langan buyurtmalar qayta hisoblanadi",
      "Asl yozuv o'chirilmaydi: teskari yozuv (+2 400 000 so'm) va yangi to'lov (−2 000 000 so'm) qo'shiladi",
      "Market egasiga xabar boradi: ilovada, Telegram ulangan bo'lsa unda ham. Sabab faqat ilovada ko'rinadi",
    ]);
    expect(confirm.textContent?.replace(/\s+/g, " ")).toContain(
      "Kerak bo'lsa, yangi to'lovni 07.11.2026, 14:32 gacha yana tuzatish mumkin.",
    );
    expect(confirm).not.toHaveTextContent("bekor qilib bo'lmaydi");

    await user.click(within(confirm).getByRole("button", { name: "Tahrirlash" }));
    expect(await screen.findByText("Summa tuzatildi")).toBeInTheDocument();
    expect(screen.getByText(/^#4498: 2 400 000 → 2 000 000 so'm\. Marketga xabar yuborildi\.$/)).toBeInTheDocument();
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(stale()).toBe(true);
    expect(post(0)).toMatchObject({
      url: "finance/history/4498/correct-amount",
      body: { new_amount: 2_000_000, reason: "Marketga 2 000 000 so'm o'tkazilgan" },
    });
  });

  it("AMOUNT_EXCEEDS: «Tahrirlash» o'chiq; «Orqaga» dan keyin maydonda «Ko'pi bilan …», qiymat o'zgarguncha «Davom etish» o'chiq", async () => {
    mocks.post.mockRejectedValueOnce(http(409, { code: "AMOUNT_EXCEEDS", max: 7_220_000 }));
    const { confirm, user, onDone } = await openCorrectConfirm("20000000");
    await user.click(within(confirm).getByRole("button", { name: "Tahrirlash" }));
    const alert = await within(confirm).findByRole("alert");
    expect(alert.textContent?.replace(/\s+/g, " ")).toBe(
      "Ko'pi bilan 7 220 000 so'mChegara — Baraka Shopga berilishi kerak qoldiq va joriy to'lov yig'indisi. «Orqaga»ni bosib summani o'zgartiring.",
    );
    const button = within(confirm).getByRole("button", { name: "Tahrirlash" });
    await waitFor(() => expect(button).toBeDisabled());
    expect(button).toHaveAttribute("aria-describedby", alert.id);
    await user.click(within(confirm).getByRole("button", { name: "Orqaga" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(onDone).not.toHaveBeenCalled();

    const dialog = screen.getByRole("dialog", { name: "Summani tahrirlash" });
    const amount = within(dialog).getByRole("textbox", { name: /^To'g'ri summa/ });
    expect(amount).toHaveAttribute("aria-invalid", "true");
    expect(within(dialog).getByText("Ko'pi bilan 7 220 000 so'm")).toBeInTheDocument();
    const next = within(dialog).getByRole("button", { name: "Davom etish" });
    expect(next).toBeDisabled();
    await user.clear(amount);
    await user.type(amount, "9000000");
    expect(next).toBeDisabled(); // chegaradan katta
    await user.clear(amount);
    await user.type(amount, "7000000");
    expect(within(dialog).queryByText("Ko'pi bilan 7 220 000 so'm")).not.toBeInTheDocument();
    expect(next).toBeEnabled();
  });

  it("SAME_AMOUNT (server poygasi): tugma o'chiq, «Orqaga» dan keyin «Yangi summa joriy summa bilan bir xil»", async () => {
    mocks.post.mockRejectedValueOnce(http(409, { code: "SAME_AMOUNT" }));
    const { confirm, user } = await openCorrectConfirm("2000000");
    await user.click(within(confirm).getByRole("button", { name: "Tahrirlash" }));
    await within(confirm).findByRole("alert");
    await waitFor(() => expect(within(confirm).getByRole("button", { name: "Tahrirlash" })).toBeDisabled());
    await user.click(within(confirm).getByRole("button", { name: "Orqaga" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    const dialog = screen.getByRole("dialog", { name: "Summani tahrirlash" });
    expect(within(dialog).getByText("Yangi summa joriy summa bilan bir xil")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Davom etish" })).toBeDisabled();
  });

  it("kuryer to'lovi kamaysa: «Farq» izohi va oqibatlar kuryer tomonidan; oflayn — «Tahrirlash»ni qayta bosing", async () => {
    mocks.post.mockRejectedValueOnce(Object.assign(new Error("timeout"), { isAxiosError: true, code: "ECONNABORTED", request: {} }));
    const { user } = render("edit", targetOf({ ...courierTransfer, amount: 500_000 }, { id: "4470", amount: 500_000 }));
    await user.type(screen.getByRole("textbox", { name: /^To'g'ri summa/ }), "50000");
    expect(document.querySelector("[data-correction-diff]")).toHaveTextContent(
      "Jasur Tursunov kassasiga 450 000 so'm qaytadi, asosiy kassadan 450 000 so'm chiqadi",
    );
    await typeReason(user);
    await user.click(screen.getByRole("button", { name: "Davom etish" }));
    const confirm = await screen.findByRole("alertdialog", { name: "Summani tahrirlashni tasdiqlang" });
    expect(confirm).toHaveTextContent("Jasur Tursunov kassasiga 450 000 so'm qaytadi");
    expect(confirm).toHaveTextContent("Asosiy kassadan 450 000 so'm naqd chiqadi");
    await user.click(within(confirm).getByRole("button", { name: "Tahrirlash" }));
    const alert = await within(confirm).findByRole("alert");
    expect(alert).toHaveTextContent("Aloqa tiklangach «Tahrirlash»ni qayta bosing — summa ikki marta tuzatilmaydi.");
    expect(within(confirm).getByRole("button", { name: "Tahrirlash" })).toBeEnabled();
  });
});
