import { onlineManager } from "@tanstack/react-query";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi, type MockInstance } from "vitest";
import { api } from "../../../shared/api/api";
import { renderWithProviders } from "../../../test/test-utils";
import NotificationDispatchForm from "./NotificationDispatchForm";

/**
 * KM-2 — «Auditoriya» rejimi (kampaniya): konstruktor, jonli son va holatlar, segmentlar, tasdiq, `Idempotency-Key`,
 * progress va bekor qilish. API — URL bo'yicha soxta (`api.get` / `api.post` / `api.delete`).
 */

const STAFF: Record<string, number> = {
  admin: 4,
  manager: 20,
  registrator: 6,
  courier: 212,
  logist: 4,
};

type Reply = { status?: number; body: unknown; network?: boolean; message?: string };
let previewReply: ((body: Record<string, unknown>) => Reply) | null;
let createReplies: Reply[];
let cancelReply: Reply | null;
let segmentReply: Reply | null;
let policyShifted: boolean;
/** Tungi taqiq javobi shu va'da bajarilguncha kutadi (`null` — darhol). */
let policyGate: Promise<void> | null;
let campaignState: {
  status: string;
  display_status: string;
  sent: number;
  total: number;
  can_cancel: boolean;
};
let getSpy: MockInstance<typeof api.get>;
let postSpy: MockInstance<typeof api.post>;
let deleteSpy: MockInstance<typeof api.delete>;

const httpError = (status: number, message = "raw backend text") =>
  Object.assign(new Error(message), {
    isAxiosError: true,
    response: { status, data: { message } },
  });

const networkError = () =>
  Object.assign(new Error("Network Error"), { isAxiosError: true, code: "ERR_NETWORK" });

const respond = (reply: Reply) =>
  reply.network
    ? Promise.reject(networkError())
    : reply.status && reply.status >= 400
    ? Promise.reject(httpError(reply.status, reply.message))
    : Promise.resolve({ status: reply.status ?? 200, data: reply.body });

const computedPreview = (body: Record<string, unknown>) => {
  const roles = Array.isArray(body.roles) ? (body.roles as string[]) : [];
  const byRole: Record<string, number> = {};
  if (body.include_customers) byRole.customer = 1186;
  if (roles.includes("market")) byRole.market = 98;
  for (const role of roles) if (STAFF[role]) byRole[role] = STAFF[role];
  const total = Object.values(byRole).reduce((sum, n) => sum + n, 0);
  return {
    data: {
      exact: true,
      total,
      by_role: byRole,
      by_channel: { push: 12 },
      limits: { dispatch_max: 5000, campaign_max: 20000 },
      campaign_allowed: total > 0,
      ...(body.with_sample
        ? {
            sample: [
              { id: "48211", role: "customer", phone: "***7434" },
              { id: "3120", role: "market", phone: null },
            ],
          }
        : {}),
    },
  };
};

const previews = () =>
  postSpy.mock.calls
    .filter(([url]) => url === "notifications/audience/preview")
    .map(([, body]) => body as Record<string, unknown>);
const campaignCalls = () => postSpy.mock.calls.filter(([url]) => url === "notifications/campaigns");

beforeEach(() => {
  previewReply = null;
  createReplies = [];
  cancelReply = null;
  segmentReply = null;
  policyShifted = false;
  policyGate = null;
  campaignState = {
    status: "running",
    display_status: "sending",
    sent: 40,
    total: 98,
    can_cancel: true,
  };
  getSpy = vi.spyOn(api, "get").mockImplementation((async (url: string) => {
    if (url === "notifications/audience/segments") {
      return {
        data: {
          data: {
            items: [
              {
                id: "3",
                name: "Toshkent — faol mijozlar",
                audience: {
                  roles: ["market", "courier"],
                  include_customers: true,
                  segment: { region_id: "1", min_orders: 2, max_orders: 10 },
                },
                last_total: 1496,
                last_counted_at: "2026-10-21T06:05:00.000Z",
              },
            ],
          },
        },
      };
    }
    if (url === "notifications/campaigns/schedule-policy") {
      if (policyGate) await policyGate;
      return {
        data: {
          data: {
            promo_quiet_hours: { start: "18:00", end: "09:00", enabled: true },
            check: policyShifted
              ? { shifted: true, effective_at: "2026-10-22T04:00:00.000Z" }
              : { shifted: false },
          },
        },
      };
    }
    if (url === "notifications/campaigns/7") {
      return {
        data: {
          data: {
            id: "7",
            title: "Yangi tariflar",
            failed: 0,
            skipped: 0,
            progress_pct: Math.round((campaignState.sent / campaignState.total) * 100),
            ...campaignState,
          },
        },
      };
    }
    if (url === "region") return { data: { data: [{ id: 1, name: "Toshkent sh." }] } };
    if (url === "district") return { data: { data: [] } };
    if (url === "markets") return { data: { data: { items: [], meta: { total: 0 } } } };
    return { data: { data: { items: [], meta: { total: 0 } } } };
  }) as never);
  postSpy = vi.spyOn(api, "post").mockImplementation((async (url: string, body?: unknown) => {
    if (url === "notifications/audience/preview") {
      const data = body as Record<string, unknown>;
      return respond(previewReply ? previewReply(data) : { body: computedPreview(data) });
    }
    if (url === "notifications/audience/segments") {
      return respond(
        segmentReply ?? {
          status: 201,
          body: { data: { id: "9", name: (body as { name: string }).name, audience: {} } },
        },
      );
    }
    if (url === "notifications/campaigns") {
      const next = createReplies.shift();
      if (next) return respond(next);
      return {
        status: 202,
        data: {
          data: {
            campaign_id: "7",
            status: "queued",
            total: 98,
            scheduled_at: null,
            duplicate: false,
          },
        },
      };
    }
    if (url === "notifications/campaigns/7/cancel") {
      if (cancelReply) return respond(cancelReply);
      campaignState = {
        ...campaignState,
        status: "cancelled",
        display_status: "cancelled",
        can_cancel: false,
      };
      return { data: { data: { id: "7", ...campaignState } } };
    }
    throw new Error(`unexpected POST ${url}`);
  }) as never);
  deleteSpy = vi.spyOn(api, "delete").mockResolvedValue({ data: { data: { id: "3" } } });
});

afterEach(() => {
  // Avval forma yechiladi: «onlayn» hodisasi ochiq so'rovlarni (masalan tungi taqiq siyosati) qayta yurgizmasin —
  // aks holda ular tiklangan (soxta bo'lmagan) `api` ga ketadi.
  cleanup();
  onlineManager.setOnline(true);
  getSpy.mockRestore();
  postSpy.mockRestore();
  deleteSpy.mockRestore();
});

const renderForm = () =>
  renderWithProviders(
    <NotificationDispatchForm renderPreview={(notification) => <div>{notification.title}</div>} />,
  );

type User = ReturnType<typeof userEvent.setup>;

const openAudience = async (user: User) => {
  renderForm();
  await user.click(
    within(screen.getByRole("radiogroup", { name: "Qabul qiluvchilar turi" })).getByRole("radio", {
      name: "Auditoriya",
    }),
  );
};

const summary = () => screen.getByTestId("audience-summary");
const sendButton = () => screen.getByRole("button", { name: /^Yuborish/ });
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Market + sarlavha — yuborilmaydi (KM-3 vaqt tanlovi uchun). */
const fillMarkets = async (user: User, title: string) => {
  await user.click(screen.getByRole("checkbox", { name: "Market" }));
  await waitFor(() => expect(summary()).toHaveTextContent("Auditoriya: 98 ta"));
  await user.type(screen.getByRole("textbox", { name: "Sarlavha" }), title);
};

const sendMarkets = async (user: User, title = "Yangi tariflar") => {
  await user.click(screen.getByRole("checkbox", { name: "Market" }));
  await waitFor(() => expect(summary()).toHaveTextContent("Auditoriya: 98 ta"));
  await user.type(screen.getByRole("textbox", { name: "Sarlavha" }), title);
  await user.click(sendButton());
  const dialog = await screen.findByRole("alertdialog", { name: "Xabarni yuborishni tasdiqlang" });
  await user.click(within(dialog).getByRole("button", { name: /Ha, yuborish/ }));
  return dialog;
};

describe("NotificationDispatchForm — «Auditoriya» (KM-2)", () => {
  it("validates the builder: a type, a staff role and a customer filter are required; nothing is counted meanwhile", async () => {
    const user = userEvent.setup();
    await openAudience(user);
    await user.type(screen.getByRole("textbox", { name: "Sarlavha" }), "Salom");
    await user.click(sendButton());
    expect(await screen.findByText("Kamida bitta turni tanlang")).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "Xodim" }));
    await user.click(sendButton());
    expect(await screen.findByText("Kamida bitta xodim rolini tanlang")).toBeInTheDocument();
    expect(screen.getByText("Superadmin va investor auditoriyaga kirmaydi")).toBeInTheDocument();
    // Faqat 5 xodim roli (KM-S2).
    const chips = within(screen.getByRole("group", { name: /Xodim rollari/ })).getAllByRole(
      "button",
    );
    expect(chips.map((chip) => chip.textContent)).toEqual([
      "Admin",
      "Menejer",
      "Registrator",
      "Kuryer",
      "Logist",
    ]);

    await user.click(screen.getByRole("checkbox", { name: "Xodim" }));
    await user.click(screen.getByRole("checkbox", { name: "Mijoz" }));
    expect(screen.getByText("Mijozlar uchun filtr tanlang")).toBeInTheDocument();
    await user.click(sendButton());
    expect(
      await screen.findByText("Mijozlar uchun filtr tanlang yoki «Filtrsiz» ni belgilang"),
    ).toBeInTheDocument();
    expect(previews()).toEqual([]);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("counts staff only by roles (breakdown by role) and hides customer filters", async () => {
    const user = userEvent.setup();
    await openAudience(user);
    await user.click(screen.getByRole("checkbox", { name: "Xodim" }));
    for (const name of ["Admin", "Menejer", "Kuryer"])
      await user.click(screen.getByRole("button", { name }));
    await waitFor(() => expect(summary()).toHaveTextContent("Auditoriya: 236 ta"));
    expect(summary()).toHaveTextContent("Xodim: Kuryer 212 · Menejer 20 · Admin 4");
    expect(screen.getByText(/Mijoz filtrlari yashirin/)).toBeInTheDocument();
    expect(screen.queryByText("Mijoz filtrlari")).not.toBeInTheDocument();
    expect(previews().at(-1)).toEqual({ roles: ["admin", "manager", "courier"] });
  });

  it("customers: «Filtrsiz» sends confirm_all_customers; a filter replaces it; an inverted range is an error, not a request", async () => {
    const user = userEvent.setup();
    await openAudience(user);
    await user.click(screen.getByRole("checkbox", { name: "Mijoz" }));
    await user.click(
      screen.getByRole("checkbox", { name: "Filtrsiz — barcha mijozlarga yuborish" }),
    );
    await waitFor(() => expect(summary()).toHaveTextContent("Auditoriya: 1 186 ta"));
    expect(previews().at(-1)).toEqual({ include_customers: true, confirm_all_customers: true });
    // Belgi ko'rinib turadi — qaytarib olish mumkin.
    expect(
      screen.getByRole("checkbox", { name: "Filtrsiz — barcha mijozlarga yuborish" }),
    ).toBeChecked();

    await user.type(screen.getByRole("textbox", { name: "Buyurtmalar soni — dan" }), "2");
    await user.type(screen.getByRole("textbox", { name: "Buyurtmalar soni — gacha" }), "10");
    await waitFor(() =>
      expect(previews().at(-1)).toEqual({
        include_customers: true,
        segment: { min_orders: 2, max_orders: 10 },
      }),
    );

    const count = previews().length;
    await user.clear(screen.getByRole("textbox", { name: "Buyurtmalar soni — dan" }));
    await user.type(screen.getByRole("textbox", { name: "Buyurtmalar soni — dan" }), "20");
    expect(await screen.findByText("«gacha» «dan» dan kichik bo'lmasin")).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(
      previews().filter(
        (body) => (body.segment as { min_orders?: number } | undefined)?.min_orders === 20,
      ),
    ).toEqual([]);
    expect(previews().length).toBeLessThanOrEqual(count + 1);
  });

  it("states: over the cap (send disabled), empty, error with retry — no raw backend text", async () => {
    const user = userEvent.setup();
    await openAudience(user);
    previewReply = () => ({
      body: {
        data: {
          exact: false,
          total: 24310,
          by_role: {},
          by_channel: { push: null },
          limits: { dispatch_max: 5000, campaign_max: 20000 },
          campaign_allowed: false,
        },
      },
    });
    await user.click(screen.getByRole("checkbox", { name: "Market" }));
    expect(
      await screen.findByText("Auditoriya: 24 310 ta — chegara 20 000 ta"),
    ).toBeInTheDocument();
    expect(sendButton()).toBeDisabled();
    expect(
      screen.getByText("Auditoriya chegaradan oshgan — yuborib bo'lmaydi"),
    ).toBeInTheDocument();

    previewReply = () => ({
      body: {
        data: {
          exact: true,
          total: 0,
          by_role: {},
          limits: { campaign_max: 20000 },
          campaign_allowed: false,
        },
      },
    });
    await user.click(screen.getByRole("checkbox", { name: "Xodim" }));
    await user.click(screen.getByRole("button", { name: "Logist" }));
    await waitFor(() => expect(summary()).toHaveTextContent("Auditoriya: 0 ta"));
    expect(screen.getByText("Auditoriya bo'sh — yuborib bo'lmaydi")).toBeInTheDocument();

    previewReply = () => ({ status: 503, body: {} });
    await user.click(screen.getByRole("button", { name: "Admin" }));
    expect(
      await screen.findByText("Server javob bermadi. Filtrlar saqlanib qoldi."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/raw backend/)).not.toBeInTheDocument();
    previewReply = null;
    await user.click(within(summary()).getByRole("button", { name: "Qayta urinish" }));
    await waitFor(() => expect(summary()).toHaveTextContent("Auditoriya: 106 ta"));
    expect(sendButton()).toBeEnabled();
  });

  it("campaign channels: in-app, open screens, push (users count); Telegram off, no SMS, no group key", async () => {
    const user = userEvent.setup();
    await openAudience(user);
    await user.click(screen.getByRole("checkbox", { name: "Market" }));
    await waitFor(() => expect(summary()).toHaveTextContent("Push: 12 ta foydalanuvchi"));
    expect(screen.getByRole("checkbox", { name: "Ochiq ekranga" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Push" })).toHaveAccessibleDescription(
      "12 ta foydalanuvchida yoqilgan",
    );
    expect(screen.getByRole("checkbox", { name: "Telegram" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Telegram" })).toHaveAccessibleDescription(
      "Kampaniyada yo'q",
    );
    // KM-5: SMS — kampaniyada bor, sukut o'chiq; tanlanmaguncha preview'ga `channels` ketmaydi.
    expect(screen.getByRole("checkbox", { name: "SMS" })).not.toBeChecked();
    expect(previews().every((body) => !("channels" in body))).toBe(true);
    expect(screen.queryByRole("textbox", { name: "Guruh kaliti" })).not.toBeInTheDocument();
    expect(screen.getByText("Darhol · kampaniya · 98 ta qabul qiluvchi")).toBeInTheDocument();
  });

  it("confirm → POST campaigns with an Idempotency-Key; progress every 3 s; cancel with a confirmation", async () => {
    const user = userEvent.setup();
    await openAudience(user);
    await user.click(screen.getByRole("checkbox", { name: "Market" }));
    await waitFor(() => expect(summary()).toHaveTextContent("Auditoriya: 98 ta"));
    await user.type(screen.getByRole("textbox", { name: "Sarlavha" }), "Yangi tariflar");
    await user.click(screen.getByRole("checkbox", { name: "Push" }));
    await user.click(sendButton());
    const dialog = await screen.findByRole("alertdialog", {
      name: "Xabarni yuborishni tasdiqlang",
    });
    expect(within(dialog).getByText("Market")).toBeInTheDocument();
    expect(within(dialog).getByTestId("confirm-count")).toHaveTextContent("98 ta");
    expect(within(dialog).getByText("Ilova ichida, Ochiq ekranga, Push")).toBeInTheDocument();
    expect(within(dialog).getByText("Darhol")).toBeInTheDocument();
    expect(
      within(dialog).getByText("Yuborish tugaguncha kampaniyani bekor qilish mumkin."),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: /Ha, yuborish/ }));

    await waitFor(() => expect(campaignCalls()).toHaveLength(1));
    const [, payload, config] = campaignCalls()[0] as [
      string,
      Record<string, unknown>,
      { headers: Record<string, string> },
    ];
    expect(payload).toEqual({
      roles: ["market"],
      type: "system.manual",
      category: "system",
      priority: "normal",
      title: "Yangi tariflar",
      channels: ["in_app", "realtime", "push"],
    });
    expect(config.headers["Idempotency-Key"]).toMatch(UUID_RE);
    expect(postSpy.mock.calls.some(([url]) => url === "notifications/dispatch")).toBe(false);

    const progress = await screen.findByTestId("campaign-progress");
    await waitFor(() =>
      expect(within(progress).getByTestId("campaign-counts")).toHaveTextContent(
        "40 / 98 yuborildi",
      ),
    );
    expect(within(progress).getByText("Yuborilmoqda")).toBeInTheDocument();
    expect(within(progress).getByText("Har 2–3 soniyada yangilanadi")).toBeInTheDocument();
    expect(screen.getByTestId("dispatch-locked")).toHaveTextContent("Kampaniya navbatga qo'yildi");
    expect(screen.getByRole("textbox", { name: "Sarlavha" })).toBeDisabled();

    await user.click(within(progress).getByRole("button", { name: "Bekor qilish" }));
    const cancel = await screen.findByRole("alertdialog", { name: "Kampaniyani bekor qilasizmi?" });
    expect(cancel).toHaveTextContent("Qolgan 58 ta qabul qiluvchiga yuborilmaydi");
    await user.click(within(cancel).getByRole("button", { name: "Kampaniyani bekor qilish" }));
    expect(await screen.findByText("Kampaniya bekor qilindi")).toBeInTheDocument();
    await waitFor(() => expect(within(progress).getByText("Bekor qilingan")).toBeInTheDocument());
    expect(
      within(progress).queryByRole("button", { name: "Bekor qilish" }),
    ).not.toBeInTheDocument();

    // «Yangi xabar» — forma va konstruktor boshidan.
    await user.click(within(progress).getByRole("button", { name: "Yangi xabar" }));
    expect(screen.queryByTestId("campaign-progress")).not.toBeInTheDocument();
    await user.click(
      within(screen.getByRole("radiogroup", { name: "Qabul qiluvchilar turi" })).getByRole(
        "radio",
        { name: "Auditoriya" },
      ),
    );
    expect(screen.getByRole("checkbox", { name: "Market" })).not.toBeChecked();
  });

  it("cancel 409 — the campaign already finished: an error toast and a refreshed status", async () => {
    const user = userEvent.setup();
    await openAudience(user);
    await sendMarkets(user);
    const progress = await screen.findByTestId("campaign-progress");
    await waitFor(() =>
      expect(within(progress).getByTestId("campaign-counts")).toHaveTextContent("40 / 98"),
    );
    cancelReply = { status: 409, body: {} };
    campaignState = {
      status: "done",
      display_status: "sent",
      sent: 98,
      total: 98,
      can_cancel: false,
    };
    await user.click(within(progress).getByRole("button", { name: "Bekor qilish" }));
    const cancel = await screen.findByRole("alertdialog", { name: "Kampaniyani bekor qilasizmi?" });
    await user.click(within(cancel).getByRole("button", { name: "Kampaniyani bekor qilish" }));
    expect(
      await screen.findByText("Kampaniya allaqachon yakunlangan — bekor qilib bo'lmadi"),
    ).toBeInTheDocument();
    await waitFor(() => expect(within(progress).getByText("Yuborilgan")).toBeInTheDocument());
    expect(within(progress).getByTestId("campaign-counts")).toHaveTextContent("98 / 98 yuborildi");
  });

  it("504 — unknown result, the form locks; «Qayta urinish» resends the SAME Idempotency-Key", async () => {
    const user = userEvent.setup();
    createReplies = [{ status: 504, body: {} }];
    await openAudience(user);
    await sendMarkets(user);
    const unknown = await screen.findByTestId("campaign-progress");
    expect(within(unknown).getByText("Javob kelmadi")).toBeInTheDocument();
    expect(screen.getByTestId("dispatch-locked")).toHaveTextContent("Natija noma'lum");
    await user.click(within(unknown).getByRole("button", { name: "Qayta urinish" }));
    await waitFor(() => expect(campaignCalls()).toHaveLength(2));
    const key = (call: number) =>
      (campaignCalls()[call][2] as { headers: Record<string, string> }).headers["Idempotency-Key"];
    expect(key(1)).toBe(key(0));
    expect(await screen.findByText("Yuborilmoqda")).toBeInTheDocument();
  });

  it("504 → «Qayta urinish» 409 (ayni kalit) — «qaytadan yozing» emas: tarixdan tekshirish, forma qulfli", async () => {
    const user = userEvent.setup();
    createReplies = [
      { status: 504, body: {} },
      { status: 409, body: { message: "Idempotency-Key boshqa so'rov bilan ishlatilgan" } },
    ];
    await openAudience(user);
    await sendMarkets(user);
    const unknown = await screen.findByTestId("campaign-progress");
    await user.click(within(unknown).getByRole("button", { name: "Qayta urinish" }));
    await waitFor(() => expect(campaignCalls()).toHaveLength(2));
    expect(
      await within(unknown).findByText(
        "Kampaniya birinchi urinishda yaratilgan bo'lishi mumkin — qaytadan yubormang, «Kampaniyalar tarixi»da tekshiring",
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId("dispatch-locked")).toHaveTextContent("Natija noma'lum");
    expect(screen.queryByText(/boshqa so'rov bilan ishlatilgan/)).toBeNull();
  });

  it("400 — a clear text from the preview limits, the form stays editable; a new attempt after a change uses a new key", async () => {
    const user = userEvent.setup();
    createReplies = [{ status: 400, body: {} }];
    await openAudience(user);
    await sendMarkets(user);
    expect(await screen.findByText("Kampaniya yaratilmadi")).toBeInTheDocument();
    expect(screen.getByText(/Server kampaniyani rad etdi/)).toBeInTheDocument();
    expect(screen.queryByText(/raw backend/)).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Sarlavha" })).toBeEnabled();

    await user.type(screen.getByRole("textbox", { name: "Sarlavha" }), " 2");
    await user.click(sendButton());
    const dialog = await screen.findByRole("alertdialog", {
      name: "Xabarni yuborishni tasdiqlang",
    });
    await user.click(within(dialog).getByRole("button", { name: /Ha, yuborish/ }));
    await waitFor(() => expect(campaignCalls()).toHaveLength(2));
    const key = (call: number) =>
      (campaignCalls()[call][2] as { headers: Record<string, string> }).headers["Idempotency-Key"];
    expect(key(1)).not.toBe(key(0));
  });

  it("advertising at night: the confirmation says when it will actually go", async () => {
    // 20:00 Toshkent — taqiq ichida (ogohlantirish jonli soatdan ham hisoblanadi; test real soatga bog'liq bo'lmasin).
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-21T15:00:00Z"));
    onTestFinished(() => void vi.useRealTimers());
    const user = userEvent.setup();
    policyShifted = true;
    await openAudience(user);
    await user.click(screen.getByRole("checkbox", { name: "Market" }));
    await waitFor(() => expect(summary()).toHaveTextContent("Auditoriya: 98 ta"));
    await user.type(screen.getByRole("textbox", { name: "Sarlavha" }), "Chegirma");
    await user.click(screen.getByRole("combobox", { name: "Kategoriya" }));
    await user.click(await screen.findByRole("option", { name: "Reklama" }));
    await user.click(sendButton());
    const dialog = await screen.findByRole("alertdialog", {
      name: "Xabarni yuborishni tasdiqlang",
    });
    // Toshkent vaqtida, gap o'rtasida — «ertaga, 09:00» (brauzer mintaqasidagi sana emas).
    expect(await within(dialog).findByText("Reklama ertaga, 09:00 da yuboriladi")).toBeInTheDocument();
    expect(within(dialog).getByText(/18:00–09:00 oralig'ida yuborilmaydi/)).toBeInTheDocument();
    // Formaning o'z so'rovi (`?category=`) ham bor — tasdiqdagi tekshiruv `scheduled_at` bilan.
    const policyCall = getSpy.mock.calls.find(
      ([url, config]) =>
        url === "notifications/campaigns/schedule-policy" &&
        Boolean((config as { params?: { scheduled_at?: string } } | undefined)?.params?.scheduled_at),
    );
    expect(policyCall?.[1]).toMatchObject({
      params: { category: "marketing", scheduled_at: expect.stringMatching(/\+05:00$/) },
    });
  });

  it("saved segments: choosing one fills the builder; deleting asks first", async () => {
    const user = userEvent.setup();
    await openAudience(user);
    await user.click(screen.getByRole("combobox", { name: "Saqlangan segment" }));
    await user.click(await screen.findByRole("option", { name: /Toshkent — faol mijozlar/ }));
    expect(screen.getByRole("checkbox", { name: "Mijoz" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Market" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Kuryer" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("textbox", { name: "Buyurtmalar soni — gacha" })).toHaveValue("10");
    await waitFor(() =>
      expect(previews().at(-1)).toEqual({
        roles: ["market", "courier"],
        include_customers: true,
        segment: { region_id: "1", min_orders: 2, max_orders: 10 },
      }),
    );

    await user.click(
      screen.getByRole("button", { name: "«Toshkent — faol mijozlar» segmentini o'chirish" }),
    );
    const confirm = await screen.findByRole("alertdialog", { name: "Segmentni o'chirasizmi?" });
    expect(confirm).toHaveTextContent("Yuborilgan kampaniyalarga ta'sir qilmaydi");
    await user.click(within(confirm).getByRole("button", { name: "Segmentni o'chirish" }));
    expect(deleteSpy).toHaveBeenCalledWith("notifications/audience/segments/3");
    expect(await screen.findByText("Segment o'chirildi")).toBeInTheDocument();
  });

  it("save segment: name required, 409 → field error, then saved", async () => {
    const user = userEvent.setup();
    await openAudience(user);
    await user.click(screen.getByRole("checkbox", { name: "Market" }));
    await waitFor(() => expect(summary()).toHaveTextContent("Auditoriya: 98 ta"));
    await user.click(within(summary()).getByRole("button", { name: "Segmentni saqlash" }));
    const dialog = await screen.findByRole("dialog", { name: "Segmentni saqlash" });
    expect(dialog).toHaveTextContent("Hozir");
    expect(dialog).toHaveTextContent("98 ta");
    await user.click(within(dialog).getByRole("button", { name: "Saqlash" }));
    expect(await within(dialog).findByText("Nomini kiriting")).toBeInTheDocument();

    segmentReply = { status: 409, body: {} };
    await user.type(within(dialog).getByRole("textbox", { name: /Nomi/ }), "Marketlar");
    await user.click(within(dialog).getByRole("button", { name: "Saqlash" }));
    expect(
      await within(dialog).findByText("Bu nomli segment allaqachon bor — boshqa nom yozing"),
    ).toBeInTheDocument();
    expect(postSpy).toHaveBeenCalledWith("notifications/audience/segments", {
      roles: ["market"],
      name: "Marketlar",
    });

    segmentReply = null;
    await user.click(within(dialog).getByRole("button", { name: "Saqlash" }));
    expect(await screen.findByText("Segment saqlandi")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Segmentni saqlash" })).not.toBeInTheDocument(),
    );
  });

  it("sample: 20 masked rows (role and last 4 digits only)", async () => {
    const user = userEvent.setup();
    await openAudience(user);
    await user.click(screen.getByRole("checkbox", { name: "Market" }));
    await waitFor(() => expect(summary()).toHaveTextContent("Auditoriya: 98 ta"));
    await user.click(within(summary()).getByRole("button", { name: "Namunani ko'rish" }));
    const dialog = await screen.findByRole("dialog", { name: "Auditoriya namunasi" });
    expect(await within(dialog).findByText("***7434")).toBeInTheDocument();
    expect(dialog).toHaveTextContent("98 ta qabul qiluvchidan 2 tasi");
    expect(previews().at(-1)).toEqual({ roles: ["market"], with_sample: true });
  });

  it("400 — the audience is recounted: a clear text from the NEW count, the summary and «Yuborish» follow it", async () => {
    const user = userEvent.setup();
    createReplies = [{ status: 400, body: {} }];
    await openAudience(user);
    await user.click(screen.getByRole("checkbox", { name: "Market" }));
    await waitFor(() => expect(summary()).toHaveTextContent("Auditoriya: 98 ta"));
    await user.type(screen.getByRole("textbox", { name: "Sarlavha" }), "Yangi tariflar");
    await user.click(sendButton());
    const dialog = await screen.findByRole("alertdialog", { name: "Xabarni yuborishni tasdiqlang" });
    // Tasdiqdan keyin auditoriya o'sdi — backend yaratishda qayta sanab, 400 qaytaradi.
    previewReply = () => ({
      body: {
        data: {
          exact: true,
          total: 24310,
          by_role: { market: 24310 },
          by_channel: { push: 10 },
          limits: { dispatch_max: 5000, campaign_max: 20000 },
          campaign_allowed: false,
        },
      },
    });
    const before = previews().length;
    await user.click(within(dialog).getByRole("button", { name: /Ha, yuborish/ }));

    expect(
      await screen.findByText("Kampaniya auditoriyasi 24 310 — chegara 20 000. Hech kimga yuborilmadi."),
    ).toBeInTheDocument();
    expect(previews().length).toBe(before + 1);
    expect(previews().at(-1)).toEqual({ roles: ["market"] });
    expect(summary()).toHaveTextContent("Auditoriya: 24 310 ta — chegara 20 000 ta");
    expect(sendButton()).toBeDisabled();
    expect(campaignCalls()).toHaveLength(1);
  });

  it("400 → recount returns 0: «Auditoriya bo'sh» instead of the generic rejection", async () => {
    const user = userEvent.setup();
    createReplies = [{ status: 400, body: {} }];
    await openAudience(user);
    await user.click(screen.getByRole("checkbox", { name: "Market" }));
    await waitFor(() => expect(summary()).toHaveTextContent("Auditoriya: 98 ta"));
    await user.type(screen.getByRole("textbox", { name: "Sarlavha" }), "Salom");
    await user.click(sendButton());
    const dialog = await screen.findByRole("alertdialog", { name: "Xabarni yuborishni tasdiqlang" });
    previewReply = () => ({
      body: { data: { exact: true, total: 0, by_role: {}, limits: { campaign_max: 20000 }, campaign_allowed: false } },
    });
    await user.click(within(dialog).getByRole("button", { name: /Ha, yuborish/ }));
    expect(await screen.findByText("Auditoriya bo'sh — hech kimga yuborilmadi.")).toBeInTheDocument();
    expect(sendButton()).toBeDisabled();
  });

  it("«Filtrsiz» keeps keyboard focus when toggled (the checkbox is not re-created)", async () => {
    const user = userEvent.setup();
    await openAudience(user);
    await user.click(screen.getByRole("checkbox", { name: "Mijoz" }));
    const box = screen.getByRole("checkbox", { name: "Filtrsiz — barcha mijozlarga yuborish" });
    box.focus();
    await user.keyboard(" ");
    expect(box).toBeChecked();
    expect(box).toHaveFocus();
    await waitFor(() => expect(summary()).toHaveTextContent("Auditoriya: 1 186 ta"));
    expect(box).toHaveFocus();
    await user.keyboard(" ");
    expect(box).not.toBeChecked();
    expect(box).toHaveFocus();
    expect(screen.getByText("Mijozlar uchun filtr tanlang")).toBeInTheDocument();
  });

  it("«Filtrsiz» needs a fresh tick after «Mijoz» is unticked or a filter was added", async () => {
    const user = userEvent.setup();
    await openAudience(user);
    const allBox = () =>
      screen.getByRole("checkbox", { name: "Filtrsiz — barcha mijozlarga yuborish" });
    await user.click(screen.getByRole("checkbox", { name: "Mijoz" }));
    await user.click(allBox());
    expect(allBox()).toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: "Mijoz" }));
    await user.click(screen.getByRole("checkbox", { name: "Mijoz" }));
    expect(allBox()).not.toBeChecked();
    expect(screen.getByText("Mijozlar uchun filtr tanlang")).toBeInTheDocument();

    await user.click(allBox());
    const from = screen.getByRole("textbox", { name: "Buyurtmalar soni — dan" });
    await user.type(from, "3");
    await user.clear(from);
    expect(allBox()).not.toBeChecked();
    expect(screen.getByText("Mijozlar uchun filtr tanlang")).toBeInTheDocument();
  });

  it("«dan 1» alone is not a filter: no request, «Filtrsiz» still required", async () => {
    const user = userEvent.setup();
    await openAudience(user);
    await user.click(screen.getByRole("checkbox", { name: "Mijoz" }));
    await user.type(screen.getByRole("textbox", { name: "Buyurtmalar soni — dan" }), "1");
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(screen.getByText("Mijozlar uchun filtr tanlang")).toBeInTheDocument();
    expect(previews()).toEqual([]);
  });

  it("the progress card is not a live region (no announcement every 3 s); only the status is announced", async () => {
    const user = userEvent.setup();
    await openAudience(user);
    await sendMarkets(user);
    const progress = await screen.findByTestId("campaign-progress");
    const counts = within(progress).getByTestId("campaign-counts");
    await waitFor(() => expect(counts).toHaveTextContent("40 / 98 yuborildi"));
    expect(progress).not.toHaveAttribute("aria-live");
    expect(counts.closest('[aria-live], [role="status"], [role="alert"]')).toBeNull();
    const live = within(progress).getByTestId("campaign-status-live");
    expect(live).toHaveAttribute("role", "status");
    expect(live).toHaveTextContent("Kampaniya holati: Yuborilmoqda");
  });

  it("offline: the count says «Internet aloqasi yo'q» (not endless counting), then counts when back online", async () => {
    const user = userEvent.setup();
    await openAudience(user);
    onlineManager.setOnline(false);
    await user.click(screen.getByRole("checkbox", { name: "Market" }));
    await waitFor(() => expect(summary()).toHaveTextContent("Internet aloqasi yo'q"));
    expect(sendButton()).toBeDisabled();
    expect(sendButton()).toHaveAccessibleDescription("Internet aloqasi yo'q — auditoriya sanalmadi");
    onlineManager.setOnline(true);
    await waitFor(() => expect(summary()).toHaveTextContent("Auditoriya: 98 ta"));
    expect(sendButton()).toBeEnabled();
  });

  it("offline: the sample dialog shows «Internet aloqasi yo'q» instead of an endless skeleton", async () => {
    const user = userEvent.setup();
    await openAudience(user);
    await user.click(screen.getByRole("checkbox", { name: "Market" }));
    await waitFor(() => expect(summary()).toHaveTextContent("Auditoriya: 98 ta"));
    onlineManager.setOnline(false);
    await user.click(within(summary()).getByRole("button", { name: "Namunani ko'rish" }));
    const dialog = await screen.findByRole("dialog", { name: "Auditoriya namunasi" });
    expect(await within(dialog).findByText("Internet aloqasi yo'q")).toBeInTheDocument();
    onlineManager.setOnline(true);
    expect(await within(dialog).findByText("***7434")).toBeInTheDocument();
  });

  it("offline create fails fast into «Javob kelmadi» (the confirmation does not hang busy)", async () => {
    const user = userEvent.setup();
    createReplies = [{ network: true, body: {} }];
    await openAudience(user);
    await user.click(screen.getByRole("checkbox", { name: "Market" }));
    await waitFor(() => expect(summary()).toHaveTextContent("Auditoriya: 98 ta"));
    await user.type(screen.getByRole("textbox", { name: "Sarlavha" }), "Salom");
    await user.click(sendButton());
    const dialog = await screen.findByRole("alertdialog", { name: "Xabarni yuborishni tasdiqlang" });
    onlineManager.setOnline(false);
    await user.click(within(dialog).getByRole("button", { name: /Ha, yuborish/ }));
    const unknown = await screen.findByTestId("campaign-progress");
    expect(within(unknown).getByText("Javob kelmadi")).toBeInTheDocument();
    expect(campaignCalls()).toHaveLength(1);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("advertising: «Ha, yuborish» waits for the night-ban check", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-21T15:00:00Z"));
    onTestFinished(() => void vi.useRealTimers());
    const user = userEvent.setup();
    policyShifted = true;
    let release = () => {};
    policyGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await openAudience(user);
    await user.click(screen.getByRole("checkbox", { name: "Market" }));
    await waitFor(() => expect(summary()).toHaveTextContent("Auditoriya: 98 ta"));
    await user.type(screen.getByRole("textbox", { name: "Sarlavha" }), "Chegirma");
    await user.click(screen.getByRole("combobox", { name: "Kategoriya" }));
    await user.click(await screen.findByRole("option", { name: "Reklama" }));
    await user.click(sendButton());
    const dialog = await screen.findByRole("alertdialog", { name: "Xabarni yuborishni tasdiqlang" });
    const confirmButton = within(dialog).getByRole("button", { name: /Ha, yuborish/ });
    expect(confirmButton).toBeDisabled();
    release();
    expect(await within(dialog).findByText(/^Reklama .* da yuboriladi$/)).toBeInTheDocument();
    expect(confirmButton).toBeEnabled();
  });

  it("push hint: the user count also in the big state; the fallback speaks of users, not devices", async () => {
    const user = userEvent.setup();
    await openAudience(user);
    expect(screen.getByRole("checkbox", { name: "Push" })).toHaveAccessibleDescription(
      "Bildirishnomani yoqqan foydalanuvchilarga",
    );
    previewReply = () => ({
      body: {
        data: {
          exact: true,
          total: 8640,
          by_role: { market: 8640 },
          by_channel: { push: 314 },
          limits: { dispatch_max: 5000, campaign_max: 20000 },
          campaign_allowed: true,
        },
      },
    });
    await user.click(screen.getByRole("checkbox", { name: "Market" }));
    await waitFor(() => expect(summary()).toHaveAttribute("data-state", "big"));
    expect(screen.getByRole("checkbox", { name: "Push" })).toHaveAccessibleDescription(
      "314 ta foydalanuvchida yoqilgan",
    );
  });

  it("«Yuborish» points at the note only when there is one", async () => {
    const user = userEvent.setup();
    await openAudience(user);
    expect(sendButton()).not.toHaveAttribute("aria-describedby");
    await user.click(screen.getByRole("checkbox", { name: "Market" }));
    await waitFor(() =>
      expect(sendButton()).toHaveAccessibleDescription("Darhol · kampaniya · 98 ta qabul qiluvchi"),
    );
  });

  it("deleting a segment that is already gone (404) says so", async () => {
    const user = userEvent.setup();
    deleteSpy.mockRejectedValueOnce(httpError(404));
    await openAudience(user);
    await user.click(screen.getByRole("combobox", { name: "Saqlangan segment" }));
    await user.click(await screen.findByRole("option", { name: /Toshkent — faol mijozlar/ }));
    await user.click(
      screen.getByRole("button", { name: "«Toshkent — faol mijozlar» segmentini o'chirish" }),
    );
    const confirm = await screen.findByRole("alertdialog", { name: "Segmentni o'chirasizmi?" });
    await user.click(within(confirm).getByRole("button", { name: "Segmentni o'chirish" }));
    expect(await screen.findByText("Segment allaqachon o'chirilgan")).toBeInTheDocument();
    expect(screen.queryByText("Segment o'chirildi")).not.toBeInTheDocument();
  });

  it("save dialog: the note field is marked optional", async () => {
    const user = userEvent.setup();
    await openAudience(user);
    await user.click(screen.getByRole("checkbox", { name: "Market" }));
    await waitFor(() => expect(summary()).toHaveTextContent("Auditoriya: 98 ta"));
    await user.click(within(summary()).getByRole("button", { name: "Segmentni saqlash" }));
    const dialog = await screen.findByRole("dialog", { name: "Segmentni saqlash" });
    expect(within(dialog).getByText("Izoh")).toHaveTextContent("Izoh (ixtiyoriy)");
  });

  // ─────────────────────────── KM-3: «Yuborish vaqti» ───────────────────────────

  describe("KM-3 — «Belgilangan vaqtda» (2026-10-21 10:05 Toshkent)", () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-21T05:05:00Z"));
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("«Rejalashtirish» → tasdiq oynasi (vaqt Toshkentda) → scheduled_at +05:00 → «Rejalashtirilgan»", async () => {
      const user = userEvent.setup();
      createReplies = [
        {
          status: 202,
          body: {
            data: {
              campaign_id: "7",
              status: "queued",
              total: 98,
              scheduled_at: "2026-10-22T05:00:00.000Z",
              display_status: "scheduled",
              duplicate: false,
              quiet_hours_shifted: false,
            },
          },
        },
      ];
      campaignState = { status: "queued", display_status: "scheduled", sent: 0, total: 98, can_cancel: true };
      await openAudience(user);
      await fillMarkets(user, "Kuzgi chegirma");
      const card = screen.getByTestId("campaign-schedule");
      await user.click(within(card).getByRole("radio", { name: /Belgilangan vaqtda/ }));
      expect(card).toHaveTextContent("Ertaga, 10:00 da yuboriladi");
      expect(screen.getByText("Ertaga, 10:00 · 98 ta qabul qiluvchi")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Rejalashtirish" }));

      const dialog = await screen.findByRole("alertdialog", { name: "Kampaniyani rejalashtirishni tasdiqlang" });
      expect(dialog).toHaveTextContent("98 ta qabul qiluvchiga yuboriladi");
      expect(dialog).toHaveTextContent("Ertaga, 10:00 da yuboriladi");
      expect(dialog).toHaveTextContent("22.10.2026, 10:00 · Toshkent vaqti");
      expect(dialog).not.toHaveTextContent("Yuborish vaqti");
      expect(dialog).toHaveTextContent("Yuborilguncha «Kampaniyalar tarixi»da bekor qilish mumkin.");
      await user.click(within(dialog).getByRole("button", { name: "Rejalashtirish" }));

      await waitFor(() => expect(campaignCalls()).toHaveLength(1));
      expect(campaignCalls()[0][1]).toMatchObject({ scheduled_at: "2026-10-22T10:00:00+05:00" });
      const progress = await screen.findByTestId("campaign-progress");
      expect(progress).toHaveAttribute("data-status", "scheduled");
      expect(progress).toHaveTextContent("Kampaniya ertaga, 10:00 da yuboriladi");
    });

    it("tasdiq oynasi ochiq turganda vaqt o'tsa — yuborilmaydi: oyna yopiladi, kartada «Bu vaqt o'tib ketdi»", async () => {
      const user = userEvent.setup();
      await openAudience(user);
      await fillMarkets(user, "Kuzgi chegirma");
      const card = screen.getByTestId("campaign-schedule");
      await user.click(within(card).getByRole("radio", { name: /Belgilangan vaqtda/ }));
      await user.click(screen.getByRole("button", { name: "Rejalashtirish" }));
      const dialog = await screen.findByRole("alertdialog", { name: "Kampaniyani rejalashtirishni tasdiqlang" });
      // Ertangi 10:00 o'tib ketdi (oyna ochiq qoldirilgan).
      vi.setSystemTime(new Date("2026-10-22T05:01:00Z"));
      await user.click(within(dialog).getByRole("button", { name: "Rejalashtirish" }));
      await waitFor(() =>
        expect(screen.queryByRole("alertdialog", { name: "Kampaniyani rejalashtirishni tasdiqlang" })).toBeNull(),
      );
      expect(campaignCalls()).toHaveLength(0);
      expect(await within(card).findByText("Bu vaqt o'tib ketdi — keyingi soatni tanlang")).toBeInTheDocument();
      // Izoh «Darhol» demaydi — vaqt tanlanmagan.
      expect(screen.queryByText(/^Darhol · kampaniya/)).toBeNull();
      expect(screen.getByText("Yuborish vaqtini tanlang · 98 ta qabul qiluvchi")).toBeInTheDocument();
    });

    it("reklamaga o'zgartirilsa taqiq soati — xato, yuborilmaydi; «Darhol» da scheduled_at yo'q", async () => {
      const user = userEvent.setup();
      await openAudience(user);
      await fillMarkets(user, "Chegirma");
      const card = screen.getByTestId("campaign-schedule");
      await user.click(within(card).getByRole("radio", { name: /Belgilangan vaqtda/ }));
      await user.click(within(card).getByRole("combobox", { name: "Soat" }));
      await user.click(await screen.findByRole("option", { name: /^20:00/ }));
      await user.click(screen.getByRole("combobox", { name: "Kategoriya" }));
      await user.click(await screen.findByRole("option", { name: "Reklama" }));
      expect(
        await within(card).findByText("Reklama 18:00–09:00 oralig'ida yuborilmaydi — boshqa soatni tanlang"),
      ).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Rejalashtirish" }));
      expect(screen.queryByRole("alertdialog")).toBeNull();

      await user.click(within(card).getByRole("radio", { name: /Darhol/ }));
      await user.click(sendButton());
      const dialog = await screen.findByRole("alertdialog", { name: "Xabarni yuborishni tasdiqlang" });
      await waitFor(() => expect(within(dialog).getByRole("button", { name: /Ha, yuborish/ })).toBeEnabled());
      await user.click(within(dialog).getByRole("button", { name: /Ha, yuborish/ }));
      await waitFor(() => expect(campaignCalls()).toHaveLength(1));
      expect(campaignCalls()[0][1]).not.toHaveProperty("scheduled_at");
    });
  });
});

describe("NotificationDispatchForm — kampaniyada SMS kanali (KM-5, 9D1Gl9MS)", () => {
  /** Preview'ning `sms` bloki (backend `audience-preview.service.ts`): bo'laklar matndan, narx = tarif × bo'lak × rozilik. */
  const smsBlock = (body: Record<string, unknown>, patch: Record<string, unknown> = {}) => {
    const text = [body.title, body.body].filter(Boolean).join(": ");
    const parts = text.length > 40 ? 2 : 1;
    return {
      exact: true,
      message_class: "promo",
      recipients: 60,
      blocked_no_consent: 30,
      skipped_invalid_phone: 8,
      with_valid_phone: 90,
      encoding: "GSM-7",
      parts,
      text_provided: Boolean(text),
      tariff: 175,
      estimated_cost: 175 * parts * 60,
      max_fanout: 20000,
      fanout_exceeded: false,
      sms_enabled: true,
      opt_out_configured: true,
      quiet_hours: { start: 1080, end: 540 },
      ...patch,
    };
  };
  const withSms = (patch: Record<string, unknown> = {}) => {
    previewReply = (body) => {
      const base = computedPreview(body);
      const channels = Array.isArray(body.channels) ? (body.channels as string[]) : [];
      return {
        body: channels.includes("sms")
          ? { data: { ...base.data, by_channel: { ...base.data.by_channel, sms: 60 }, sms: smsBlock(body, patch) } }
          : base,
      };
    };
  };

  const pickMarketsWithSms = async (user: User, title = "Yangi tariflar") => {
    await user.click(screen.getByRole("checkbox", { name: "Market" }));
    await waitFor(() => expect(summary()).toHaveTextContent("Auditoriya: 98 ta"));
    await user.type(screen.getByRole("textbox", { name: "Sarlavha" }), title);
    await user.click(screen.getByRole("checkbox", { name: "SMS" }));
  };

  it("SMS ticked: preview asks for the consent split (no text while typing), shows it; confirm counts cost with the final text; POST has sms", async () => {
    withSms();
    const user = userEvent.setup();
    await openAudience(user);
    await pickMarketsWithSms(user);
    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: "SMS" })).toHaveAccessibleDescription("60 ta raqamda rozilik bor"),
    );
    expect(previews().at(-1)).toEqual({ roles: ["market"], channels: ["in_app", "sms"] });
    const split = screen.getByTestId("campaign-sms-split");
    expect(split).toHaveTextContent("SMS reklama sifatida ketadi");
    expect(split).toHaveTextContent("Rozilik bor: 60 ta · Rozilik yo'q: 30 ta · Raqam noto'g'ri: 8 ta");
    expect(split).toHaveTextContent("18:00–09:00 oralig'ida yuborilmaydi — 09:00 ga suriladi");
    expect(sendButton()).toBeEnabled();

    await user.type(screen.getByRole("textbox", { name: "Matn" }), "Barcha tariflar 1-noyabrdan yangilanadi");
    await user.click(sendButton());
    const dialog = await screen.findByRole("alertdialog", { name: "Xabarni yuborishni tasdiqlang" });
    await waitFor(() => expect(within(dialog).getByTestId("confirm-sms-recipients")).toHaveTextContent("60 ta"));
    expect(previews().at(-1)).toEqual({
      roles: ["market"],
      channels: ["in_app", "sms"],
      title: "Yangi tariflar",
      body: "Barcha tariflar 1-noyabrdan yangilanadi",
    });
    // 175 × 2 bo'lak × 60 = 21 000.
    expect(within(dialog).getByTestId("confirm-sms-cost")).toHaveTextContent(/21\s000 so'm \(2 bo'lak\)/);
    expect(within(dialog).getByText("SMS: rozilik yo'q").nextSibling).toHaveTextContent("30 ta");
    expect(within(dialog).getByText("SMS: raqam noto'g'ri").nextSibling).toHaveTextContent("8 ta");
    expect(within(dialog).getByText("Ilova ichida, Ochiq ekranga, SMS")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: /Ha, yuborish/ }));
    await waitFor(() => expect(campaignCalls()).toHaveLength(1));
    expect((campaignCalls()[0][1] as { channels: string[] }).channels).toEqual(["in_app", "realtime", "sms"]);
  });

  it("blocks sending with a clear reason: SMS off, opt-out not configured, fan-out over SMS_MAX_FANOUT (prod 2)", async () => {
    withSms({ fanout_exceeded: true, max_fanout: 2 });
    const user = userEvent.setup();
    await openAudience(user);
    await pickMarketsWithSms(user);
    const reason = "SMS uchun auditoriya 2 tadan oshmasligi kerak — nishonni toraytiring yoki SMS kanalisiz yuboring.";
    await waitFor(() => expect(screen.getByTestId("campaign-sms-block")).toHaveTextContent(reason));
    expect(sendButton()).toBeDisabled();
    expect(screen.getByText(reason, { selector: "#campaign-send-note" })).toBeInTheDocument();

    // SMS olib tashlansa — yuborish mumkin.
    await user.click(screen.getByRole("checkbox", { name: "SMS" }));
    await waitFor(() => expect(sendButton()).toBeEnabled());
    expect(screen.queryByTestId("campaign-sms-block")).not.toBeInTheDocument();
  });

  it("SMS disabled / opt-out missing in the preview → disabled with its own text", async () => {
    withSms({ sms_enabled: false });
    const user = userEvent.setup();
    await openAudience(user);
    await pickMarketsWithSms(user);
    await waitFor(() =>
      expect(screen.getByTestId("campaign-sms-block")).toHaveTextContent("SMS o'chiq yoki sozlanmagan"),
    );
    expect(sendButton()).toBeDisabled();
  });

  it("409 sms_disabled from create → the SMS text (backend message is not shown)", async () => {
    withSms();
    createReplies = [
      {
        status: 409,
        body: null,
        message: "SMS o'chiq (SMS_ENABLED=false) — SMS kanali bilan kampaniya yaratilmadi (sms_disabled)",
      },
    ];
    const user = userEvent.setup();
    await openAudience(user);
    await pickMarketsWithSms(user);
    await waitFor(() => expect(sendButton()).toBeEnabled());
    await user.click(sendButton());
    const dialog = await screen.findByRole("alertdialog", { name: "Xabarni yuborishni tasdiqlang" });
    await waitFor(() => expect(within(dialog).getByRole("button", { name: /Ha, yuborish/ })).toBeEnabled());
    await user.click(within(dialog).getByRole("button", { name: /Ha, yuborish/ }));
    expect(
      await screen.findByText(
        "SMS o'chiq yoki sozlanmagan — kampaniya yaratilmadi. SMS kanalisiz yuboring. Hech kimga yuborilmadi.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/SMS_ENABLED/)).not.toBeInTheDocument();
  });
});
