import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AiAdvisorAlertDetail } from "../../../../entities/ai-advisor";
import { queryKeys } from "../../../../shared/config/queryKeys";
import { formatDateTimeLocalized } from "../../../../shared/lib/formatDateTime";
import {
  advisorEnvelope,
  advisorHttpError,
  createAdvisorFixtures,
  RESOLVE_NOTE,
} from "../../../../test/aiAdvisorFixtures";
import { renderWithProviders } from "../../../../test/test-utils";
import AlertDialog from "./AlertDialog";

/**
 * Ogohlantirish oynasi (`?alert=:id`; maketlar `superadmin-ai-assistant-alert-dialog` R1 va «Boshqa holatlar»,
 * `-alert-dialog-receipt` R7, `-alert-resolve-confirm`; shartnoma §7.3–7.5, D8, D9, D15, D16): qoida tanasi (faktlar,
 * dalillar jadvali), yopilgan va qaytgan holatlar, «Hal qilindi» (izoh tekshiruvi → tasdiq → PATCH → toast) va
 * «Ahamiyatsiz» (tasdiqsiz), AI izohi (so'rash → `pending` → poll → `ready`; 60 s; 429 oylik / kunlik; 503; 409),
 * topilmadi / xato holatlari.
 */

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
vi.mock("../../../../shared/api/api", () => ({
  api: { get: mocks.get, post: mocks.post, patch: mocks.patch, put: vi.fn(), delete: vi.fn() },
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));

const fx = createAdvisorFixtures();
const ok = (data: unknown, status = 200) => Promise.resolve({ data: advisorEnvelope(data, status) });
const fail = (status: number, body: Record<string, unknown>) => Promise.reject(advisorHttpError(status, body));

/** `GET ai/advisor/alerts/:id` — ketma-ket javoblar (oxirgisi takrorlanadi). */
let detailReplies: Array<() => Promise<unknown>>;
const replyDetail = (...replies: Array<AiAdvisorAlertDetail | (() => Promise<unknown>)>) => {
  detailReplies = replies.map((reply) => (typeof reply === "function" ? reply : () => ok(reply)));
};
const detailCalls = () => mocks.get.mock.calls.filter(([url]) => /^ai\/advisor\/alerts\/[^/]+$/.test(String(url)));

beforeEach(() => {
  replyDetail(fx.detail.r1);
  mocks.get.mockImplementation((url: string) => {
    if (/^ai\/advisor\/alerts\/[^/]+$/.test(url)) {
      const next = detailReplies.length > 1 ? detailReplies.shift()! : detailReplies[0];
      return next();
    }
    return Promise.reject(new Error(`kutilmagan GET ${url}`));
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

const LocationProbe = () => {
  const { search } = useLocation();
  return <span data-testid="search">{search}</span>;
};
const currentParams = () => new URLSearchParams(screen.getByTestId("search").textContent ?? "");

const open = (id = "1040") => {
  const result = renderWithProviders(
    <>
      <AlertDialog active />
      <LocationProbe />
    </>,
    { route: `/ai-assistant?tab=alerts&status=new&alert=${id}` },
  );
  // Nishon va ro'yxat keshda (oyna ularni birinchi javobdan keyin eskirtiradi — D16).
  result.queryClient.setQueryData(queryKeys.aiAdvisor.overview, { kind: "available", data: fx.overview });
  result.queryClient.setQueryData(queryKeys.aiAdvisor.alertList({ page: 1, limit: 10 }), fx.list);
  return result;
};

const dialog = () => screen.getByRole("dialog");
const findDialog = (name: string | RegExp) => screen.findByRole("dialog", { name });
const R1_TITLE = "Samarqand filiali kassasida 3 smena ketma-ket kamomad";

const PHONE_QUERY = "(max-width: 767px)";
const usePhoneViewport = () => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === PHONE_QUERY,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
};

describe("R1 «Smena kamomadi» (maket `superadmin-ai-assistant-alert-dialog`)", () => {
  it("sarlavha, belgilar, faktlar, dalillar jadvali, AI izohi, izoh maydoni va pastki qator; GET bir marta — nishon va ro'yxat eskiradi", async () => {
    const { queryClient } = open();
    const panel = await findDialog(R1_TITLE);

    expect(within(panel).getByText(/^Smena kamomadi · birinchi: .+ · oxirgi: Bugun, 13:45$/)).toBeInTheDocument();
    expect(within(panel).getByText("Diqqat")).toBeInTheDocument();
    expect(within(panel).getByText("Ko'rildi")).toBeInTheDocument();
    expect(within(panel).getByText("3 marta takrorlandi")).toBeInTheDocument();

    const facts = within(panel).getByLabelText("Asosiy ma'lumotlar");
    expect(within(facts).getAllByRole("term").map((node) => node.textContent)).toEqual([
      "Kassa",
      "Jami kamomad",
      "Qoida",
      "Smenani yopgan",
    ]);
    expect(within(facts).getAllByRole("definition").map((node) => node.textContent)).toEqual([
      "Samarqand filiali kassasi",
      "−445 000 so'm",
      "Bir smenada 50 000 so'mdan ko'p yoki 3 smena ketma-ket kamomad",
      "Sardor Mirzayev",
    ]);

    const table = within(panel).getByRole("table", { name: "Dalillar · 3 ta yozuv" });
    expect(within(panel).getByText("Uchala smenani Sardor Mirzayev yopgan")).toBeInTheDocument();
    expect(within(table).getAllByRole("columnheader").map((node) => node.textContent)).toEqual([
      "Smena",
      "Yopgan",
      "Kutilgan",
      "Sanalgan",
      "Farq",
      "Smena hisobotini ochish",
    ]);
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(5);
    expect(rows[1]).toHaveTextContent("4 860 000 so'm4 740 000 so'm−120 000 so'm");
    expect(rows[2]).toHaveTextContent(/^Kecha, 20:55Sardor Mirzayev/);
    expect(rows[3]).toHaveTextContent(/^Bugun, 13:40/);
    expect(rows[4]).toHaveTextContent("Jami−445 000 so'm");
    expect(within(rows[3]).getByRole("link", { name: "Bugun, 13:40 smena hisobotini ochish" })).toHaveAttribute(
      "href",
      "/payments/shifts/818",
    );

    const explanation = within(panel).getByRole("region", { name: "AI izohi" });
    expect(explanation).toHaveTextContent("Uchala kamomad ham «Humo virtual» kartasida");
    expect(explanation).toHaveTextContent("AI xato qilishi mumkin — muhim qarordan oldin manbani tekshiring.");
    expect(within(explanation).queryByRole("button")).not.toBeInTheDocument();

    const note = within(panel).getByRole("textbox", { name: "Izoh" });
    expect(note).toHaveAttribute("placeholder", "Nima qilindi? Masalan: kartadagi tushum keyingi kuni kelgan");
    expect(note).toHaveAttribute("maxlength", "500");
    expect(within(panel).getByText("«Hal qilindi» uchun majburiy · 3–500 belgi · faoliyat jurnaliga yoziladi")).toBeInTheDocument();

    expect(within(panel).getByRole("link", { name: "Smena hisobotiga o'tish" })).toHaveAttribute("href", "/payments/shifts/818");
    expect(within(panel).getByRole("button", { name: "Ahamiyatsiz" })).toBeEnabled();
    expect(within(panel).getByRole("button", { name: "Hal qilindi" })).toBeEnabled();

    // D16: yon ta'sirli GET — bitta; birinchi javobdan keyin nishon eskiradi, ro'yxat — oyna yopilgach
    // (`?status=new` da qator oyna ortida yo'qolmaydi, fokus o'z havolasiga qaytadi).
    expect(detailCalls()).toEqual([["ai/advisor/alerts/1040"]]);
    await waitFor(() => expect(queryClient.getQueryState(queryKeys.aiAdvisor.overview)?.isInvalidated).toBe(true));
    const listState = () => queryClient.getQueryState(queryKeys.aiAdvisor.alertList({ page: 1, limit: 10 }));
    expect(listState()?.isInvalidated).toBe(false);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(currentParams().get("alert")).toBeNull());
    await waitFor(() => expect(listState()?.isInvalidated).toBe(true));
  });

  it("telefonda: dalillar — kartalar «Kutilgan … · sanalgan …» va «Jami · 3 smena»; amallar ustma-ust («Hal qilindi», «Ahamiyatsiz», havola)", async () => {
    usePhoneViewport();
    open();
    const panel = await findDialog(R1_TITLE);

    expect(within(panel).queryByRole("table")).not.toBeInTheDocument();
    const list = within(panel).getByRole("list", { name: "Dalillar · 3 ta yozuv" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(4);
    expect(items[0]).toHaveTextContent("−120 000 so'm");
    expect(items[0]).toHaveTextContent("Kutilgan 4 860 000 · sanalgan 4 740 000 so'm");
    expect(within(items[0]).getByRole("link")).toHaveAttribute("href", "/payments/shifts/806");
    expect(items[3]).toHaveTextContent("Jami · 3 smena−445 000 so'm");

    // Maket: ustma-ust «Hal qilindi», «Ahamiyatsiz», havola — DOM (fokus) tartibi ham shunday.
    const footerControls = [
      within(panel).getByRole("button", { name: "Hal qilindi" }),
      within(panel).getByRole("button", { name: "Ahamiyatsiz" }),
      within(panel).getByRole("link", { name: "Smena hisobotiga o'tish" }),
    ];
    for (let index = 1; index < footerControls.length; index += 1) {
      expect(footerControls[index - 1].compareDocumentPosition(footerControls[index]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it("yopilgan («Hal qilindi»): izoh bloki «kim · qachon», faqat «Yopish»; izoh maydoni va «AI izohini olish» yo'q", async () => {
    replyDetail(fx.detail.r1Resolved);
    const user = userEvent.setup();
    open();
    const panel = await findDialog(R1_TITLE);

    expect(within(panel).getByText("Hal qilindi")).toBeInTheDocument();
    const resolution = within(panel).getByTestId("ai-alert-resolution");
    expect(resolution).toHaveTextContent(/^Shodiyor Ergashev · Bugun, 15:10/);
    expect(resolution).toHaveTextContent(RESOLVE_NOTE);
    expect(within(panel).queryByRole("textbox")).not.toBeInTheDocument();
    // Tayyor izoh qoladi, so'rash tugmasi — yo'q.
    expect(within(panel).getByRole("region", { name: "AI izohi" })).toHaveTextContent("Uchala kamomad ham");
    expect(within(panel).queryByRole("button", { name: "AI izohini olish" })).not.toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: "Hal qilindi" })).not.toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: "Ahamiyatsiz" })).not.toBeInTheDocument();
    expect(within(panel).queryByRole("link", { name: "Smena hisobotiga o'tish" })).not.toBeInTheDocument();

    const closeButtons = within(panel).getAllByRole("button", { name: "Yopish" });
    await user.click(closeButtons[closeButtons.length - 1]);
    await waitFor(() => expect(currentParams().get("alert")).toBeNull());
    expect(currentParams().get("tab")).toBe("alerts");
    expect(currentParams().get("status")).toBe("new");
  });

  it("yopilgan va izohsiz — «AI izohi» bloki chizilmaydi", async () => {
    replyDetail({ ...fx.detail.r1Resolved, explanation_status: "none", explanation_md: null, explained_at: null });
    open();
    const panel = await findDialog(R1_TITLE);
    expect(within(panel).queryByRole("region", { name: "AI izohi" })).not.toBeInTheDocument();
  });

  it("qaytgan muammo: «Hal qilingan muammo qaytdi — yangi ogohlantirish ochildi» va avvalgisining holati", async () => {
    replyDetail(fx.detail.r1Reopened);
    open("1045");
    const panel = await findDialog(R1_TITLE);
    expect(within(panel).getByText("Hal qilingan muammo qaytdi — yangi ogohlantirish ochildi")).toBeInTheDocument();
    expect(
      within(panel).getByText("Avvalgisi «Hal qilindi» holatida qoladi, yangisi «Yangi» bo'lib ro'yxat boshida turadi."),
    ).toBeInTheDocument();
  });
});

describe("R7 «Chek yoki karta farqi» (maket `superadmin-ai-assistant-alert-dialog-receipt`)", () => {
  it("chek: faktlar, «Chek tekshiruvi» belgilari va qatorlari, haftalik xulosa, «Operatsiyaga o'tish»", async () => {
    replyDetail(fx.detail.r7);
    open("1039");
    const panel = await findDialog("Chekda farq bor — Urgut filiali yoqilg'i xarajati");

    expect(within(panel).getByText("Jiddiy")).toBeInTheDocument();
    expect(within(panel).queryByText(/marta takrorlandi/)).not.toBeInTheDocument();
    const facts = within(panel).getByLabelText("Asosiy ma'lumotlar");
    expect(within(facts).getAllByRole("term").map((node) => node.textContent)).toEqual([
      "Operatsiya",
      "Kassa",
      "Kiritilgan",
      "Chekda",
      "Farq",
      "Kiritgan",
    ]);
    expect(within(facts).getAllByRole("definition").map((node) => node.textContent)).toEqual([
      "Qo'lda chiqim · Yoqilg'i",
      "Urgut filiali",
      "320 000 so'm",
      "302 000 so'm",
      "−18 000 so'm",
      "Ravshan Ortiqov · Bugun, 11:05",
    ]);

    const check = within(panel).getByRole("region", { name: "Chek tekshiruvi" });
    expect(within(check).getByText("Farq bor")).toBeInTheDocument();
    expect(within(check).getByText("Karta mos emas")).toBeInTheDocument();
    expect(within(check).getAllByRole("term").map((node) => node.textContent)).toEqual([
      "Chek sanasi",
      "Oluvchi",
      "To'lovchi",
      "Bank",
      "Tranzaksiya raqami",
      "Ishonch",
    ]);
    expect(within(check).getAllByRole("definition").map((node) => node.textContent)).toEqual([
      "Bugun, 10:52",
      // PII: backend oluvchi / to'lovchi ismini yubormaydi — faqat oxirgi 4 raqam.
      "··8840",
      "··3307filial kassasi kartasi emas",
      "Hamkorbank",
      "512 778 940 112",
      "89%",
    ]);
    expect(check).toHaveTextContent("Bu hafta 46 ta chek tekshirildi: 41 mos, 3 farq bor, 2 o'qib bo'lmadi.");
    expect(within(panel).getByRole("textbox", { name: "Izoh" })).toHaveAttribute(
      "placeholder",
      "Nima qilindi? Masalan: summa chek bo'yicha tuzatildi",
    );
    expect(within(panel).getByRole("link", { name: "Operatsiyaga o'tish" })).toHaveAttribute(
      "href",
      "/payments/cash-detail/12?type=branch&history=99120",
    );
  });

  it("karta qoldig'i: qatorlar «Asosiy kassa · Humo virtual», Smena, Tizimda, «AI o'qigan», Farq (tizimga nisbatan); chek AI o'chiq — izoh", async () => {
    replyDetail({ ...fx.detail.r7Card, facts: { ...(fx.detail.r7Card.facts as object), receipt_ai_enabled: false } } as AiAdvisorAlertDetail);
    open("1038");
    const panel = await findDialog("Karta qoldig'ida farq — Asosiy kassa");

    // Haqiqiy farq — AI o'qigan − tizimdagi (`system_difference`); kassir rasmdagini kiritgan — «Kiritilgan» yo'q.
    expect(within(panel).getAllByRole("term").map((node) => node.textContent)).toEqual([
      "Kassa",
      "Smena",
      "Tizimda",
      "AI o'qigan",
      "Farq",
    ]);
    expect(within(panel).getAllByRole("definition").map((node) => node.textContent)).toEqual([
      "Asosiy kassa · Humo virtual",
      fx.day(-1).split("-").reverse().join("."),
      "2 350 000 so'm",
      "2 310 000 so'm",
      "−40 000 so'm",
    ]);
    expect(within(panel).queryByRole("region", { name: "Chek tekshiruvi" })).not.toBeInTheDocument();
    expect(
      within(panel).getByText("Chek tekshiruvi yoqilmagan — bu turda faqat smena karta qoldig'i tekshiriladi."),
    ).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: "Smena hisobotiga o'tish" })).toHaveAttribute("href", "/payments/shifts/9001");
  });
});

describe("«Hal qilindi» / «Ahamiyatsiz» (D9; maket `-alert-resolve-confirm`)", () => {
  it("izohsiz «Hal qilindi» — «Izoh kamida 3 belgi bo'lsin», fokus maydonga, so'rov yo'q", async () => {
    const user = userEvent.setup();
    open();
    const panel = await findDialog(R1_TITLE);
    const note = within(panel).getByRole("textbox", { name: "Izoh" });

    await user.type(note, "  ab ");
    await user.click(within(panel).getByRole("button", { name: "Hal qilindi" }));

    expect(await within(panel).findByText("Izoh kamida 3 belgi bo'lsin")).toBeInTheDocument();
    expect(note).toHaveAttribute("aria-invalid", "true");
    expect(note).toHaveFocus();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(mocks.patch).not.toHaveBeenCalled();

    // Yozishni davom ettirsa — xato yo'qoladi.
    await user.type(note, "c");
    expect(within(panel).queryByText("Izoh kamida 3 belgi bo'lsin")).not.toBeInTheDocument();
  });

  it("izoh bilan: tasdiq oynasi (qisqa nom, summa, izoh, oqibatlar) → PATCH → toast, oyna yopiladi", async () => {
    mocks.patch.mockImplementation(() => ok(fx.detail.r1Resolved));
    const user = userEvent.setup();
    open();
    const panel = await findDialog(R1_TITLE);

    await user.type(within(panel).getByRole("textbox", { name: "Izoh" }), `  ${RESOLVE_NOTE}  `);
    await user.click(within(panel).getByRole("button", { name: "Hal qilindi" }));

    const confirm = await screen.findByRole("alertdialog", { name: "Ogohlantirish hal qilindimi?" });
    expect(confirm).toHaveAccessibleDescription("Samarqand filiali · smena kamomadi −445 000 so'm");
    expect(within(confirm).getByText("Izoh")).toBeInTheDocument();
    expect(within(confirm).getByText(RESOLVE_NOTE)).toBeInTheDocument();
    expect(within(confirm).getByText("Holat «Hal qilindi»ga o'tadi va faoliyat jurnaliga yoziladi.")).toBeInTheDocument();
    expect(within(confirm).getByText("Muammo qaytsa, yangi ogohlantirish ochiladi.")).toBeInTheDocument();
    expect(within(confirm).getByRole("button", { name: "Orqaga" })).toHaveFocus();
    expect(mocks.patch).not.toHaveBeenCalled();

    await user.click(within(confirm).getByRole("button", { name: "Hal qilindi deb belgilash" }));

    expect(mocks.patch).toHaveBeenCalledWith(
      "ai/advisor/alerts/1040",
      { status: "resolved", note: RESOLVE_NOTE },
      { silentNetworkError: true },
    );
    expect(await screen.findByText("Ogohlantirish hal qilindi")).toBeInTheDocument();
    expect(screen.getByText("Samarqand filiali · smena kamomadi. Faoliyat jurnaliga yozildi.")).toBeInTheDocument();
    await waitFor(() => expect(currentParams().get("alert")).toBeNull());
    expect(currentParams().get("status")).toBe("new");
  });

  it("«Orqaga» — so'rov yo'q, oyna va izoh joyida", async () => {
    const user = userEvent.setup();
    open();
    const panel = await findDialog(R1_TITLE);
    await user.type(within(panel).getByRole("textbox", { name: "Izoh" }), RESOLVE_NOTE);
    await user.click(within(panel).getByRole("button", { name: "Hal qilindi" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Orqaga" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(mocks.patch).not.toHaveBeenCalled();
    expect(within(dialog()).getByRole("textbox", { name: "Izoh" })).toHaveValue(RESOLVE_NOTE);
    expect(currentParams().get("alert")).toBe("1040");
  });

  it("409 `ALERT_CLOSED` (boshqa superadmin yopgan) — tasdiq oynasida izoh, tasdiq tugmasi o'chadi, tafsilot qayta o'qiladi", async () => {
    mocks.patch.mockImplementation(() => fail(409, fx.errors.closed));
    const user = userEvent.setup();
    open();
    const panel = await findDialog(R1_TITLE);
    await user.type(within(panel).getByRole("textbox", { name: "Izoh" }), RESOLVE_NOTE);
    await user.click(within(panel).getByRole("button", { name: "Hal qilindi" }));
    replyDetail(fx.detail.r1Resolved);
    const confirm = await screen.findByRole("alertdialog");
    await user.click(within(confirm).getByRole("button", { name: "Hal qilindi deb belgilash" }));

    const alert = await within(confirm).findByRole("alert");
    expect(alert).toHaveTextContent("Ogohlantirish allaqachon yopilgan");
    expect(alert).toHaveTextContent("Uni boshqa superadmin yopgan — oyna yangilandi.");
    expect(within(confirm).getByRole("button", { name: "Hal qilindi deb belgilash" })).toBeDisabled();
    await waitFor(() => expect(detailCalls()).toHaveLength(2));
  });

  it("400 `NOTE_INVALID` (server) — sababi bo'yicha matn tasdiq oynasida", async () => {
    mocks.patch.mockImplementation(() => fail(400, fx.errors.noteTooShort));
    const user = userEvent.setup();
    open();
    const panel = await findDialog(R1_TITLE);
    await user.type(within(panel).getByRole("textbox", { name: "Izoh" }), "abc");
    await user.click(within(panel).getByRole("button", { name: "Hal qilindi" }));
    const confirm = await screen.findByRole("alertdialog");
    await user.click(within(confirm).getByRole("button", { name: "Hal qilindi deb belgilash" }));
    expect(await within(confirm).findByRole("alert")).toHaveTextContent("Izoh kamida 3 belgi bo'lsin");
  });

  it("400 `NOTE_INVALID required` — «majburiy» matni (qisqalik emas)", async () => {
    mocks.patch.mockImplementation(() => fail(400, fx.errors.noteRequired));
    const user = userEvent.setup();
    open();
    const panel = await findDialog(R1_TITLE);
    await user.type(within(panel).getByRole("textbox", { name: "Izoh" }), "abc");
    await user.click(within(panel).getByRole("button", { name: "Hal qilindi" }));
    const confirm = await screen.findByRole("alertdialog");
    await user.click(within(confirm).getByRole("button", { name: "Hal qilindi deb belgilash" }));
    expect(await within(confirm).findByRole("alert")).toHaveTextContent("«Hal qilindi» uchun izoh majburiy");
  });

  it("izohdagi boshqaruv belgilari (backend `NO_CONTROL_CHARS`, kodsiz 400) — yuborishdan oldin olinadi; `\\n` qoladi", async () => {
    mocks.patch.mockImplementation(() => ok(fx.detail.r1Resolved));
    const user = userEvent.setup();
    open();
    const panel = await findDialog(R1_TITLE);
    await user.click(within(panel).getByRole("textbox", { name: "Izoh" }));
    await user.paste("Tekshirildi\u000B\u000C,\ntartibda\u0007");
    await user.click(within(panel).getByRole("button", { name: "Hal qilindi" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Hal qilindi deb belgilash" }));
    expect(mocks.patch).toHaveBeenCalledWith(
      "ai/advisor/alerts/1040",
      { status: "resolved", note: "Tekshirildi,\ntartibda" },
      { silentNetworkError: true },
    );
  });

  it("«Ahamiyatsiz» — tasdiqsiz; izoh bo'lmasa yuborilmaydi → toast, oyna yopiladi", async () => {
    mocks.patch.mockImplementation(() => ok({ ...fx.detail.r1, status: "dismissed" }));
    const user = userEvent.setup();
    open();
    const panel = await findDialog(R1_TITLE);
    await user.click(within(panel).getByRole("button", { name: "Ahamiyatsiz" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(mocks.patch).toHaveBeenCalledWith("ai/advisor/alerts/1040", { status: "dismissed" }, { silentNetworkError: true });
    expect(await screen.findByText("Ahamiyatsiz deb belgilandi")).toBeInTheDocument();
    expect(
      screen.getByText("Samarqand filiali · smena kamomadi. Qayta takrorlansa, yangi ogohlantirish ochiladi."),
    ).toBeInTheDocument();
    await waitFor(() => expect(currentParams().get("alert")).toBeNull());
  });

  it("«Ahamiyatsiz» izoh bilan — trim qilinib yuboriladi; xato — oynada", async () => {
    mocks.patch.mockImplementation(() => fail(500, { statusCode: 500, message: "Internal" }));
    const user = userEvent.setup();
    open();
    const panel = await findDialog(R1_TITLE);
    await user.type(within(panel).getByRole("textbox", { name: "Izoh" }), "  takror  ");
    await user.click(within(panel).getByRole("button", { name: "Ahamiyatsiz" }));

    expect(mocks.patch).toHaveBeenCalledWith(
      "ai/advisor/alerts/1040",
      { status: "dismissed", note: "takror" },
      { silentNetworkError: true },
    );
    expect(await within(panel).findByText("«Ahamiyatsiz» saqlanmadi — qayta urining.")).toBeInTheDocument();
    expect(currentParams().get("alert")).toBe("1040");
  });

  it("«Ahamiyatsiz»: oldingi «Hal qilindi» izoh xatosi tozalanadi; server `NOTE_INVALID too_long` — maydon ostida, umumiy xato yo'q", async () => {
    mocks.patch.mockImplementation(() => fail(400, fx.errors.noteTooLong));
    const user = userEvent.setup();
    open();
    const panel = await findDialog(R1_TITLE);
    const note = within(panel).getByRole("textbox", { name: "Izoh" });
    await user.type(note, "ab");
    await user.click(within(panel).getByRole("button", { name: "Hal qilindi" }));
    expect(await within(panel).findByText("Izoh kamida 3 belgi bo'lsin")).toBeInTheDocument();

    await user.click(within(panel).getByRole("button", { name: "Ahamiyatsiz" }));
    expect(within(panel).queryByText("Izoh kamida 3 belgi bo'lsin")).not.toBeInTheDocument();
    expect(await within(panel).findByText("Izoh 500 belgidan oshmasin")).toBeInTheDocument();
    expect(note).toHaveAttribute("aria-invalid", "true");
    expect(note).toHaveFocus();
    expect(within(panel).queryByText("«Ahamiyatsiz» saqlanmadi — qayta urining.")).not.toBeInTheDocument();
    expect(currentParams().get("alert")).toBe("1040");
  });
});

describe("AI izohi (D15)", () => {
  const r1None = fx.detail.r1None;
  const r1Pending = { ...fx.detail.r1Pending, explanation_poll_after_ms: 2_000 };

  it("so'ralmagan → «AI izohini olish» → 202 `pending` → poll (2 s) → `ready`", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    replyDetail(r1None);
    mocks.post.mockImplementation(() => ok(fx.explain.queued, 202));
    open();
    const panel = await findDialog(R1_TITLE);
    const region = within(panel).getByRole("region", { name: "AI izohi" });
    expect(region).toHaveTextContent("Izoh so'ralganda yoziladi — budjetdan sarflanadi.");

    replyDetail(r1Pending, fx.detail.r1);
    await user.click(within(region).getByRole("button", { name: "AI izohini olish" }));
    expect(mocks.post).toHaveBeenCalledWith("ai/advisor/alerts/1040/explain", {}, { silentNetworkError: true });
    expect(await within(region).findByText("AI izoh yozmoqda…")).toBeInTheDocument();
    expect(detailCalls()).toHaveLength(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_100);
    });
    await waitFor(() => expect(detailCalls()).toHaveLength(2));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_100);
    });
    expect(await within(region).findByText(/Uchala kamomad ham «Humo virtual» kartasida/)).toBeInTheDocument();
    const calls = detailCalls().length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6_000);
    });
    expect(detailCalls()).toHaveLength(calls);
  });

  it("60 s da tayyor bo'lmasa — «Izoh hali tayyor emas — keyinroq oching», poll to'xtaydi; «Qayta urinish» — qayta so'raydi", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    replyDetail(r1Pending);
    mocks.post.mockImplementation(() => ok(fx.explain.queued, 202));
    open();
    const panel = await findDialog(R1_TITLE);
    const region = within(panel).getByRole("region", { name: "AI izohi" });
    expect(within(region).getByText("AI izoh yozmoqda…")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000);
    });
    expect(await within(region).findByText("Izoh hali tayyor emas — keyinroq oching")).toBeInTheDocument();
    const calls = detailCalls().length;
    expect(calls).toBeGreaterThan(20);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(detailCalls()).toHaveLength(calls);

    await user.click(within(region).getByRole("button", { name: "Qayta urinish" }));
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(await within(region).findByText("AI izoh yozmoqda…")).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_100);
    });
    await waitFor(() => expect(detailCalls().length).toBeGreaterThan(calls));
  });

  it.each([
    [
      "oylik budjet (`advisor`, `month`)",
      fx.errors.budgetAdvisorMonth,
      /^Oylik AI budjeti tugagan — izohni \d{2}\.\d{2}\.\d{4}, 00:00 dan keyin olish mumkin\. Qoidalar va dalillar ishlayveradi\.$/,
    ],
    [
      "kunlik umumiy (`global`)",
      fx.errors.budgetGlobalDay,
      /^Bugungi umumiy AI chegarasi tugadi\. Faktlar va dalillar to'liq; izohni ertaga, 00:00 dan keyin so'rash mumkin \(Toshkent vaqti\)\.$/,
    ],
    [
      "yordamchining kunlik budjeti (`advisor`, `day`)",
      fx.errors.budgetAdvisorDay,
      /^Bugungi umumiy AI chegarasi tugadi\. Faktlar va dalillar/,
    ],
  ])("429 %s — matn va o'chiq tugma, holat o'zgarmaydi", async (_label, body, text) => {
    replyDetail(r1None);
    mocks.post.mockImplementation(() => fail(429, body));
    const user = userEvent.setup();
    open();
    const panel = await findDialog(R1_TITLE);
    const region = within(panel).getByRole("region", { name: "AI izohi" });
    await user.click(within(region).getByRole("button", { name: "AI izohini olish" }));

    expect(await within(region).findByText(text)).toBeInTheDocument();
    expect(within(region).getByRole("button", { name: "AI izohini olish" })).toBeDisabled();
    expect(detailCalls()).toHaveLength(1);
  });

  it("`failed` + `budget_exceeded` (yozish paytida, oylik) — server `explanation_retry_at` bilan", async () => {
    replyDetail({
      ...r1None,
      explanation_status: "failed",
      explanation_error: "budget_exceeded",
      explanation_error_scope: "advisor",
      explanation_retry_at: fx.at(17, 0, 0),
    });
    open();
    const panel = await findDialog(R1_TITLE);
    const region = within(panel).getByRole("region", { name: "AI izohi" });
    expect(region).toHaveTextContent(/Oylik AI budjeti tugagan — izohni \d{2}\.\d{2}\.\d{4}, 00:00 dan keyin olish mumkin/);
    expect(within(region).getByRole("button", { name: "AI izohini olish" })).toBeDisabled();
  });

  it("jiddiy ogohlantirish izohsiz ochildi (kunlik umumiy chegara) — maket `-courier-debt` matni", async () => {
    replyDetail(fx.detail.r2NoHandover);
    open("1042");
    const panel = await screen.findByRole("dialog", { name: /Farhod Ismoilov/ });
    expect(within(panel).getByRole("region", { name: "AI izohi" })).toHaveTextContent(
      "Bugungi umumiy AI chegarasi tugadi — jiddiy ogohlantirish izohsiz ochildi. Faktlar va dalillar to'liq; izohni ertaga, 00:00 dan keyin so'rash mumkin (Toshkent vaqti).",
    );
  });

  it("`failed` (xato) — «Izoh yozib bo'lmadi.» + «Qayta urinish» (qayta so'raydi)", async () => {
    replyDetail({ ...r1None, explanation_status: "failed", explanation_error: "error" });
    mocks.post.mockImplementation(() => ok(fx.explain.queued, 202));
    const user = userEvent.setup();
    open();
    const panel = await findDialog(R1_TITLE);
    const region = within(panel).getByRole("region", { name: "AI izohi" });
    expect(region).toHaveTextContent("Izoh yozib bo'lmadi.");
    replyDetail(r1Pending);
    await user.click(within(region).getByRole("button", { name: "Qayta urinish" }));
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(await within(region).findByText("AI izoh yozmoqda…")).toBeInTheDocument();
  });

  it("503 — «AI xizmati hozir o'chiq …», holat o'zgarmaydi", async () => {
    replyDetail(r1None);
    mocks.post.mockImplementation(() => fail(503, fx.errors.aiDisabled));
    const user = userEvent.setup();
    open();
    const panel = await findDialog(R1_TITLE);
    const region = within(panel).getByRole("region", { name: "AI izohi" });
    await user.click(within(region).getByRole("button", { name: "AI izohini olish" }));
    expect(await within(region).findByRole("alert")).toHaveTextContent(
      "AI xizmati hozir o'chiq — izoh olinmaydi. Qoidalar va dalillar ishlayveradi.",
    );
  });

  it("409 (ogohlantirish yopilgan) — tafsilot qayta o'qiladi, yopilgan ko'rinish", async () => {
    replyDetail(r1None);
    mocks.post.mockImplementation(() => fail(409, fx.errors.explainClosed));
    const user = userEvent.setup();
    open();
    const panel = await findDialog(R1_TITLE);
    replyDetail({ ...fx.detail.r1Resolved, explanation_status: "none", explanation_md: null, explained_at: null });
    await user.click(within(panel).getByRole("button", { name: "AI izohini olish" }));

    await waitFor(() => expect(detailCalls()).toHaveLength(2));
    expect(await within(panel).findByTestId("ai-alert-resolution")).toHaveTextContent(RESOLVE_NOTE);
    expect(within(panel).queryByRole("region", { name: "AI izohi" })).not.toBeInTheDocument();
    expect(within(panel).queryByRole("textbox")).not.toBeInTheDocument();
  });
});

describe("holatlar", () => {
  it("404 — «Ogohlantirish topilmadi» + «Yopish»", async () => {
    replyDetail(() => fail(404, fx.errors.notFound));
    const user = userEvent.setup();
    open("999999");
    const panel = await findDialog("Ogohlantirish");
    expect(await within(panel).findByText("Ogohlantirish topilmadi")).toBeInTheDocument();
    const closeButtons = within(panel).getAllByRole("button", { name: "Yopish" });
    await user.click(closeButtons[closeButtons.length - 1]);
    await waitFor(() => expect(currentParams().get("alert")).toBeNull());
  });

  it("noto'g'ri ID — so'rovsiz «Ogohlantirish topilmadi»", async () => {
    open("abc");
    const panel = await findDialog("Ogohlantirish");
    expect(within(panel).getByText("Ogohlantirish topilmadi")).toBeInTheDocument();
    expect(detailCalls()).toHaveLength(0);
  });

  it("xato — «Ogohlantirishni yuklab bo'lmadi» + «Qayta urinish»", async () => {
    replyDetail(() => fail(500, { statusCode: 500, message: "Internal" }), fx.detail.r1);
    const user = userEvent.setup();
    open();
    const panel = await findDialog("Ogohlantirish");
    expect(await within(panel).findByText("Ogohlantirishni yuklab bo'lmadi")).toBeInTheDocument();
    await user.click(within(panel).getByRole("button", { name: "Qayta urinish" }));
    expect(await findDialog(R1_TITLE)).toBeInTheDocument();
    expect(detailCalls()).toHaveLength(2);
  });

  it("yuklanish — skelet («Ogohlantirish yuklanmoqda»)", async () => {
    replyDetail(() => new Promise(() => undefined));
    open();
    const panel = await findDialog("Ogohlantirish");
    expect(within(panel).getByRole("status", { name: "Ogohlantirish yuklanmoqda" })).toBeInTheDocument();
  });
});

describe("sarlavha ostidagi vaqt (maketlar: takrorlanganda fakt oralig'i, bitta takrorda aniqlash vaqti)", () => {
  it("R3 (1 marta) — «G'ayrioddiy xarajat · {last_at}», «birinchi / oxirgi» yo'q", async () => {
    replyDetail(fx.detail.r3);
    open("1036");
    const panel = await findDialog(/odatdagidan 3,4 barobar/);
    const at = formatDateTimeLocalized(fx.detail.r3.last_at, { language: "uz" });
    expect(within(panel).getByText(`G'ayrioddiy xarajat · ${at}`)).toBeInTheDocument();
    expect(within(panel).queryByText(/birinchi:/)).not.toBeInTheDocument();
  });

  it("R6 (1 marta) — joy bilan: «Zarar · butun tizim · {last_at}» (davr boshi / oxiri emas)", async () => {
    replyDetail(fx.detail.r6);
    open("1031");
    const panel = await findDialog(/kuni zarar/);
    const at = formatDateTimeLocalized(fx.detail.r6.last_at, { language: "uz" });
    expect(within(panel).getByText(`Zarar · butun tizim · ${at}`)).toBeInTheDocument();
  });

  it("R4 (2 marta, epizodli) — aniqlash vaqtlari «birinchi: {first_at} · oxirgi: {last_at}», epizod boshi 00:00 emas", async () => {
    replyDetail(fx.detail.r4);
    open("1034");
    const panel = await findDialog(/9 kundan beri to'lov yo'q/);
    const first = formatDateTimeLocalized(fx.detail.r4.first_at, { language: "uz" });
    const last = formatDateTimeLocalized(fx.detail.r4.last_at, { language: "uz" });
    expect(within(panel).getByText(`Market to'lovi kechikmoqda · birinchi: ${first} · oxirgi: ${last}`)).toBeInTheDocument();
    const episodeStart = formatDateTimeLocalized(fx.detail.r4.first_fact_at, { language: "uz" });
    expect(panel.textContent).not.toContain(`birinchi: ${episodeStart}`);
  });
});

/**
 * Yopish va brauzer «Orqaga» (`BrowserRouter`, jsdom `window.history`): ro'yxatdan ochilgan oyna (`push` +
 * `ALERT_FROM_LIST_STATE`) yopilganda o'sha ro'yxat yozuviga qaytadi — tarixda ikki bir xil yozuv qolmaydi va keyingi
 * «Orqaga» tabdan chiqadi. Chuqur havola (state'siz) — `alert` olinadi, yozuv almashtiriladi.
 */
describe("yopish va brauzer tarixi", () => {
  const LIST = "/ai-assistant?tab=alerts&status=new";
  const renderBrowser = () =>
    renderWithProviders(
      <>
        <AlertDialog active />
        <LocationProbe />
      </>,
      { history: "browser" },
    );

  it("ro'yxatdan ochilgan — Esc tarixda orqaga qaytadi (yangi yozuv yo'q, ro'yxat yozuvi o'sha)", async () => {
    window.history.replaceState({ usr: null, key: "list", idx: 0 }, "", LIST);
    window.history.pushState({ usr: { aiAlertFromList: true }, key: "alert", idx: 1 }, "", `${LIST}&alert=1040`);
    const length = window.history.length;
    renderBrowser();
    await findDialog(R1_TITLE);

    const popped = new Promise<void>((resolve) => window.addEventListener("popstate", () => resolve(), { once: true }));
    await userEvent.keyboard("{Escape}");
    await act(async () => {
      await popped;
    });

    await waitFor(() => expect(currentParams().get("alert")).toBeNull());
    expect(window.location.search).toBe("?tab=alerts&status=new");
    expect(window.history.state).toMatchObject({ key: "list", idx: 0 });
    expect(window.history.length).toBe(length);
  });

  it("chuqur havola (state'siz) — `alert` olinadi, joriy yozuv almashtiriladi (orqada ro'yxat yo'q)", async () => {
    window.history.replaceState(null, "", "/");
    window.history.pushState(null, "", `${LIST}&alert=1040`);
    const length = window.history.length;
    renderBrowser();
    await findDialog(R1_TITLE);

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(currentParams().get("alert")).toBeNull());
    expect(window.location.pathname).toBe("/ai-assistant");
    expect(window.location.search).toBe("?tab=alerts&status=new");
    expect(window.history.length).toBe(length);
  });
});
