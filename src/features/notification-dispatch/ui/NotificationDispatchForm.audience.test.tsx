import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
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

type Reply = { status?: number; body: unknown };
let previewReply: ((body: Record<string, unknown>) => Reply) | null;
let createReplies: Reply[];
let cancelReply: Reply | null;
let segmentReply: Reply | null;
let policyShifted: boolean;
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

const respond = (reply: Reply) =>
  reply.status && reply.status >= 400
    ? Promise.reject(httpError(reply.status))
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
    expect(screen.queryByRole("checkbox", { name: "SMS" })).not.toBeInTheDocument();
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
    expect(await within(dialog).findByText(/^Reklama .* da yuboriladi$/)).toBeInTheDocument();
    expect(within(dialog).getByText(/18:00–09:00 oralig'ida yuborilmaydi/)).toBeInTheDocument();
    const policyCall = getSpy.mock.calls.find(
      ([url]) => url === "notifications/campaigns/schedule-policy",
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
});
