import { useState } from "react";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Pencil, RotateCcw } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n";
import { Button, useConfirm } from "../../../shared/ui/primitives";
import { renderWithProviders } from "../../../test/test-utils";
import {
  describeCorrectionError,
  usePaymentCorrectionErrors,
  type CorrectionErrorContext,
  type CorrectionOpenShift,
} from "./errorView";
import { buildCorrectionTarget, deriveCorrectionShape, type CorrectionShape } from "./target";

/**
 * T6 N2 — xato kodi → tasdiq oynasidagi xato qutisi (maketlar `*-reverse-errors`, `*-correct-amount-errors`, ega
 * qarorlari 2026-11-03): matnlar maketdan aynan; qayta urinish befoyda bo'lsa tugma o'chiq; ALREADY_CORRECTED — neytral,
 * «Orqaga» oqimni yopadi; noma'lum natija — WifiOff; noma'lum kod — umumiy matn (backend matni emas).
 */

const http = (status: number, data: Record<string, unknown> = {}) =>
  Object.assign(new Error(`Request failed with status code ${status}`), { isAxiosError: true, response: { status, data }, request: {} });
const network = () => Object.assign(new Error("Network Error"), { isAxiosError: true, code: "ERR_NETWORK", request: {} });

const shapeOf = (transfer: unknown): CorrectionShape =>
  deriveCorrectionShape(
    buildCorrectionTarget({ id: "4512", amount: 1850000, title: "Kuryer to'lovi", paymentMethod: "cash", correctable: { allowed: true, transfer } })!,
  );

const courier = shapeOf({
  kind: "courier_payment",
  payment_method: "cash",
  amount: 1850000,
  receiver: { cashbox_type: "main", branch_id: null, name: null },
  courier: { id: "301", name: "Jasur Tursunov" },
  market: null,
});
const branchCourier = shapeOf({
  kind: "courier_payment",
  payment_method: "cash",
  amount: 1850000,
  receiver: { cashbox_type: "branch", branch_id: "15", name: "Urgut filiali" },
  courier: { id: "301", name: "Jasur Tursunov" },
  market: null,
});
const market = shapeOf({
  kind: "market_payment",
  payment_method: "click",
  amount: 2400000,
  receiver: { cashbox_type: "main", branch_id: null, name: null },
  courier: null,
  market: { id: "77", name: "Baraka Shop" },
});
const marketCash = shapeOf({
  kind: "market_payment",
  payment_method: "cash",
  amount: 2400000,
  receiver: { cashbox_type: "main", branch_id: null, name: null },
  courier: null,
  market: { id: "77", name: "Baraka Shop" },
});
const courierClick = shapeOf({
  kind: "courier_payment",
  payment_method: "click",
  amount: 1850000,
  receiver: { cashbox_type: "main", branch_id: null, name: null },
  courier: { id: "301", name: "Jasur Tursunov" },
  market: null,
});
const clickToMarket = shapeOf({
  kind: "courier_payment",
  payment_method: "click_to_market",
  amount: 1850000,
  receiver: { cashbox_type: "main", branch_id: null, name: null },
  courier: { id: "301", name: "Jasur Tursunov" },
  market: { id: "77", name: "Baraka Shop" },
});
const generic = shapeOf(null);

const t = i18n.getFixedT("uz", "payments");
const describeUz = (error: unknown, context: CorrectionErrorContext) => {
  const model = describeCorrectionError(error, context, t, "uz");
  return { ...model, title: model.title?.replace(/\u00a0/g, " ") ?? null, body: model.body.replace(/\u00a0/g, " ") };
};
const reverse = (shape: CorrectionShape = courier): CorrectionErrorContext => ({ action: "reverse", shape });
const edit = (shape: CorrectionShape = market): CorrectionErrorContext => ({ action: "edit", shape });

describe("describeCorrectionError — maket matnlari", () => {
  it("SHIFT_REQUIRED — «Smenani ochish» amali, tugma faol", () => {
    expect(describeUz(http(400, { code: "SHIFT_REQUIRED" }), reverse())).toMatchObject({
      kind: "SHIFT_REQUIRED",
      title: "Smena ochilmagan",
      body: "Tuzatish joriy smenaga yoziladi. Avval asosiy kassada smenani oching — hech narsa o'zgarmadi.",
      action: "openShift",
      blockConfirm: false,
      tone: "danger",
    });
  });

  it("INSUFFICIENT_BALANCE: qaytarish (naqd, asosiy) va tahrirlash (market, o'tkazma, «kerak»)", () => {
    expect(describeUz(http(409, { code: "INSUFFICIENT_BALANCE" }), reverse())).toMatchObject({
      title: "Kassada pul yetmaydi",
      body: "Asosiy kassadagi naqd pul qaytarish uchun yetmaydi. Hech narsa o'zgarmadi.",
    });
    expect(describeUz(http(409, { code: "INSUFFICIENT_BALANCE", required: 200000 }), edit()).body).toBe(
      "Asosiy kassada o'tkazma uchun yetarli pul yo'q (kerak: 200 000 so'm). Hech narsa o'zgarmadi.",
    );
    expect(describeUz(http(409, { code: "INSUFFICIENT_BALANCE", required: 1850000 }), reverse(branchCourier)).body).toBe(
      "Urgut filiali kassasidagi naqd pul qaytarish uchun yetmaydi (kerak: 1 850 000 so'm). Hech narsa o'zgarmadi.",
    );
    expect(describeUz(http(409, { code: "INSUFFICIENT_BALANCE" }), reverse(generic)).body).toBe(
      "Qabul qiluvchi kassada pul yetmaydi. Hech narsa o'zgarmadi.",
    );
  });

  it("BRANCH_SHIFT_REQUIRED, CARD_ARCHIVED", () => {
    expect(describeUz(http(400, { code: "BRANCH_SHIFT_REQUIRED" }), reverse(branchCourier))).toMatchObject({
      title: "Filial smenasi ochilmagan",
      body: "Pul Urgut filiali kassasidan o'tadi — smenani filial menejeri ochishi kerak. Hech narsa o'zgarmadi.",
      action: null,
    });
    expect(describeUz(http(409, { code: "CARD_ARCHIVED" }), reverse())).toMatchObject({
      title: "Karta arxivda",
      body: "To'lov tushgan karta arxivlangan — avval kartani faollashtiring.",
    });
  });

  it("ALREADY_CORRECTED (ega qarori): neytral, tugma o'chiq, «Orqaga» oqimni yopadi", () => {
    const model = describeUz(http(409, { code: "ALREADY_CORRECTED" }), reverse());
    expect(model).toMatchObject({
      kind: "ALREADY_CORRECTED",
      title: null,
      body: "To'lov allaqachon tuzatilgan. Ro'yxat yangilandi.",
      tone: "neutral",
      blockConfirm: true,
      closesFlow: true,
    });
    expect(model.icon.displayName).toBe("Info");
  });

  it("WINDOW_EXPIRED: sana va kunlar; maydonsiz — umumiy", () => {
    expect(
      describeUz(http(409, { code: "WINDOW_EXPIRED", deadline: "2026-11-07T09:32:00.000Z", window_days: 30 }), reverse()),
    ).toMatchObject({
      title: "Muddat tugagan: 07.11.2026, 14:32",
      body: "To'lovni 30 kun ichida qaytarish yoki summasini tahrirlash mumkin edi. Hech narsa o'zgarmadi.",
      blockConfirm: false,
    });
    expect(describeUz(http(409, { code: "WINDOW_EXPIRED" }), reverse())).toMatchObject({
      title: "Muddat tugagan",
      body: "Tuzatish muddati o'tgan. Hech narsa o'zgarmadi.",
    });
  });

  it("COURIER_MOVED (ega qarori): bitta jumla, tugma o'chiq", () => {
    expect(describeUz(http(409, { code: "COURIER_MOVED" }), edit(courier))).toMatchObject({
      title: null,
      body: "Tuzatib bo'lmaydi — kuryer boshqa filialga o'tgan.",
      blockConfirm: true,
      closesFlow: false,
    });
  });

  it("noma'lum natija (tarmoq, 504, 503): WifiOff, amalga mos matn, tugma faol", () => {
    const offline = describeUz(network(), reverse());
    expect(offline).toMatchObject({
      kind: "UNCERTAIN",
      title: "Internet aloqasi yo'q",
      body: "So'rov yetib bormadi yoki javob kelmadi. Aloqa tiklangach «Qaytarish»ni qayta bosing — to'lov ikki marta qaytarilmaydi.",
      blockConfirm: false,
    });
    expect(offline.icon.displayName).toBe("WifiOff");
    expect(describeUz(http(504, { message: "timeout" }), edit()).body).toBe(
      "So'rov yetib bormadi yoki javob kelmadi. Aloqa tiklangach «Tahrirlash»ni qayta bosing — summa ikki marta tuzatilmaydi.",
    );
    expect(describeUz(http(503), edit()).kind).toBe("UNCERTAIN");
  });

  it("AMOUNT_EXCEEDS (`max` bilan / siz), SAME_AMOUNT — tugma o'chiq, forma uchun `rejection`", () => {
    const exceeds = describeUz(http(409, { code: "AMOUNT_EXCEEDS", max: 7220000 }), edit());
    expect(exceeds).toMatchObject({
      title: "Ko'pi bilan 7 220 000 so'm",
      body: "Chegara — Baraka Shopga berilishi kerak qoldiq va joriy to'lov yig'indisi. «Orqaga»ni bosib summani o'zgartiring.",
      blockConfirm: true,
      rejection: { code: "AMOUNT_EXCEEDS", max: 7220000 },
    });
    expect(describeUz(http(409, { code: "AMOUNT_EXCEEDS" }), edit(courier))).toMatchObject({
      title: "Summa chegaradan oshdi",
      body: "Chegara — Jasur Tursunov kassasidagi qoldiq va joriy to'lov yig'indisi. «Orqaga»ni bosib summani o'zgartiring.",
      rejection: { code: "AMOUNT_EXCEEDS", max: null },
    });
    expect(describeUz(http(409, { code: "SAME_AMOUNT" }), edit())).toMatchObject({
      title: "Yangi summa joriy summa bilan bir xil",
      body: "«Orqaga»ni bosib summani o'zgartiring.",
      blockConfirm: true,
      rejection: { code: "SAME_AMOUNT", max: null },
    });
  });

  it("NOT_CORRECTABLE: sabab bo'yicha; tahrirlashda sababsiz — «Summani tuzatib bo'lmaydi»; LEGACY_UNLINKED", () => {
    expect(describeUz(http(409, { code: "NOT_CORRECTABLE", reason: "cashbox_deleted" }), reverse())).toMatchObject({
      title: "Tuzatib bo'lmaydi",
      body: "Kuryer kassasi o'chirilgan.",
    });
    // Backend qaysi kassa (yoki CLICK kartasi) ekanini aytmaydi — kassa faqat boshqasi bo'lishi mumkin bo'lmaganda nomlanadi.
    const deleted = (shape: CorrectionShape) =>
      describeUz(http(409, { code: "NOT_CORRECTABLE", reason: "cashbox_deleted" }), reverse(shape)).body;
    expect(deleted(marketCash)).toBe("Market kassasi o'chirilgan.");
    // CLICK: karta yo'q yoki boshqa kassada ham `cashbox_deleted` (assertFunds).
    expect(deleted(market)).toBe("To'lovdagi kassa yoki karta o'chirilgan.");
    expect(deleted(courierClick)).toBe("To'lovdagi kassa yoki karta o'chirilgan.");
    // Filial kassasi va click_to_market dagi market kassasi ham oyoq — umumiy.
    expect(deleted(branchCourier)).toBe("Kassa o'chirilgan.");
    expect(deleted(clickToMarket)).toBe("Kassa o'chirilgan.");
    expect(deleted(generic)).toBe("Kassa o'chirilgan.");
    expect(describeUz(http(409, { code: "NOT_CORRECTABLE", reason: "reversal_row" }), reverse()).body).toBe(
      "Teskari yozuvni qaytarib ham, tahrirlab ham bo'lmaydi.",
    );
    expect(
      describeUz(http(409, { code: "NOT_CORRECTABLE", message: "Summani tuzatib bo'lmaydi: kuryerda filialga tegishli …" }), edit(courier)),
    ).toMatchObject({
      title: "Summani tuzatib bo'lmaydi",
      body: "Kuryer bu summani hozir topshira olmaydi — to'lovni to'liq qaytaring.",
    });
    expect(describeUz(http(409, { code: "LEGACY_UNLINKED" }), reverse()).title).toBe("Eski yozuv");
  });

  it("NOT_FOUND — tugma o'chiq; kalit xatolari, 403, 500, noma'lum kod — umumiy matn (backend matni emas)", () => {
    expect(describeUz(http(404, { code: "NOT_FOUND" }), reverse())).toMatchObject({
      title: "Yozuv topilmadi",
      body: "To'lov yozuvi o'chirilgan yoki topilmadi. Ro'yxat yangilandi.",
      blockConfirm: true,
    });
    for (const error of [
      http(409, { code: "IDEMPOTENCY_KEY_REUSED", message: "Kalit boshqa so'rov bilan ishlatilgan" }),
      http(403, { message: "Bu amal uchun ruxsat yo'q" }),
      http(500),
      http(409, { code: "SOMETHING_NEW" }),
    ]) {
      expect(describeUz(error, reverse())).toMatchObject({
        kind: "GENERIC",
        title: null,
        body: "Amalni bajarib bo'lmadi. Qayta urinib ko'ring.",
        blockConfirm: false,
      });
    }
  });
});

/** Haqiqiy tasdiq oynasi orqali (`useConfirm` + `errorView`): quti, ikonka, tugma holati, «Smenani ochish». */
const Flow = ({
  error,
  context,
  onOpenShift,
}: {
  error: unknown;
  context: CorrectionErrorContext;
  onOpenShift: CorrectionOpenShift;
}) => {
  const confirm = useConfirm();
  const errors = usePaymentCorrectionErrors();
  const [result, setResult] = useState<string>("");
  const reverseAction = context.action === "reverse";
  return (
    <>
      <Button
        onClick={async () => {
          const ok = await confirm({
            tone: reverseAction ? "danger" : "primary",
            icon: reverseAction ? RotateCcw : Pencil,
            title: reverseAction ? "To'lovni qaytarishni tasdiqlang" : "Summani tahrirlashni tasdiqlang",
            consequences: [{ text: "Oqibat" }],
            cancelLabel: "Orqaga",
            confirmLabel: reverseAction ? "Qaytarish" : "Tahrirlash",
            compactOnError: true,
            errorView: (caught, controls) => errors.view(caught, { ...context, onOpenShift }, controls),
            onConfirm: () => Promise.reject(error),
          });
          setResult(ok ? "ok" : "back");
        }}
      >
        Ochish
      </Button>
      <output>{result}</output>
    </>
  );
};

describe("usePaymentCorrectionErrors().view — tasdiq oynasida", () => {
  const open = async (error: unknown, context: CorrectionErrorContext) => {
    const user = userEvent.setup();
    const onOpenShift = vi.fn<CorrectionOpenShift>();
    renderWithProviders(<Flow error={error} context={context} onOpenShift={onOpenShift} />);
    await user.click(screen.getByRole("button", { name: "Ochish" }));
    const dialog = await screen.findByRole("alertdialog");
    return { user, dialog, onOpenShift };
  };

  it("SHIFT_REQUIRED: qizil quti, CircleX 20, «Smenani ochish» — sahifa oqimi; tugma faol", async () => {
    const { user, dialog, onOpenShift } = await open(http(400, { code: "SHIFT_REQUIRED" }), reverse());
    await user.click(within(dialog).getByRole("button", { name: "Qaytarish" }));
    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveAttribute("data-tone", "danger");
    expect(within(alert).getByText("Smena ochilmagan")).toHaveClass("font-bold");
    const icon = alert.querySelector("svg")!;
    expect(icon).toHaveClass("lucide-circle-x");
    expect(icon).toHaveAttribute("width", "20");
    await user.click(within(alert).getByRole("button", { name: "Smenani ochish" }));
    expect(onOpenShift).toHaveBeenCalledTimes(1);
    expect(within(dialog).getByRole("button", { name: "Qaytarish" })).toBeEnabled();
    expect(within(dialog).getByRole("list")).toHaveClass("max-md:hidden");
    // Sahifa smenani ochdi — «Smena ochilmagan» qutisi olib tashlanadi, oqibatlar yana ko'rinadi.
    act(() => onOpenShift.mock.calls[0][0].onOpened());
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("list")).not.toHaveClass("max-md:hidden");
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Orqaga" })).toHaveFocus());
  });

  it("ALREADY_CORRECTED: neytral quti, tugma o'chiq va xatoga bog'langan; «Orqaga» — `false`", async () => {
    const { user, dialog } = await open(http(409, { code: "ALREADY_CORRECTED" }), reverse());
    await user.click(within(dialog).getByRole("button", { name: "Qaytarish" }));
    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveAttribute("data-tone", "neutral");
    expect(alert).toHaveTextContent("To'lov allaqachon tuzatilgan. Ro'yxat yangilandi.");
    const confirmButton = within(dialog).getByRole("button", { name: "Qaytarish" });
    await waitFor(() => expect(confirmButton).toBeDisabled());
    expect(confirmButton).toHaveAttribute("aria-describedby", alert.id);
    await user.click(within(dialog).getByRole("button", { name: "Orqaga" }));
    await waitFor(() => expect(document.querySelector("output")).toHaveTextContent("back"));
  });

  it("AMOUNT_EXCEEDS: «Tahrirlash» o'chiq, pul bo'linmaydi; oflayn — WifiOff", async () => {
    const { user, dialog } = await open(http(409, { code: "AMOUNT_EXCEEDS", max: 7220000 }), edit());
    await user.click(within(dialog).getByRole("button", { name: "Tahrirlash" }));
    const alert = await within(dialog).findByRole("alert");
    expect(within(alert).getByText("Ko'pi bilan 7 220 000 so'm").textContent).toContain("7\u00a0220\u00a0000\u00a0so'm");
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Tahrirlash" })).toBeDisabled());
  });

  it("oflayn: WifiOff ikonka, tugma faol (o'sha kalit bilan qayta yuboriladi)", async () => {
    const { user, dialog } = await open(network(), edit());
    await user.click(within(dialog).getByRole("button", { name: "Tahrirlash" }));
    const alert = await within(dialog).findByRole("alert");
    expect(alert.querySelector("svg")).toHaveClass("lucide-wifi-off");
    expect(alert).toHaveTextContent("Internet aloqasi yo'q");
    expect(within(dialog).getByRole("button", { name: "Tahrirlash" })).toBeEnabled();
  });
});
