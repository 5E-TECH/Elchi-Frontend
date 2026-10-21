import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, type MockInstance } from "vitest";
import { api } from "../../../shared/api/api";
import { renderWithProviders } from "../../../test/test-utils";
import NotificationDispatchForm from "./NotificationDispatchForm";

const USERS = [
  { id: "56", name: "Kuryer Ali", phone_number: "+998970000095", role: "courier" },
  { id: "3", name: "Yandex", phone_number: "+998900000001", role: "market" },
];
const ROLE_TOTALS: Record<string, number> = { courier: 12, market: 30, manager: 200, admin: 8 };

let getSpy: MockInstance<typeof api.get>;
let postSpy: MockInstance<typeof api.post>;
/** `GET notifications/sent/:id` javobi (natija kartasidagi «Yetkazilmaganlar» va tafsilot oynasi). */
let sentDetail: (id: string, params: Record<string, unknown>) => unknown;

const sentDetailBody = (id: string, overrides: Record<string, unknown> = {}) => ({
  statusCode: 200,
  data: {
    dispatch_id: id,
    status: "sent",
    title: "Ish vaqti",
    body: "Ertaga 9:00 dan",
    channels: ["in_app", "realtime"],
    dispatched: 1,
    skipped_by_preference: 0,
    channel_status: { in_app: { sent: 1 }, realtime: { emitted: 1 } },
    audience: { broadcast: true },
    created_by: { id: "1", name: "Bosh admin", role: "superadmin" },
    created_at: "2026-10-21T09:15:00.000Z",
    finished_at: "2026-10-21T09:15:02.000Z",
    undelivered: { items: [], meta: { page: 1, limit: 5, total: 0, totalPages: 1 } },
    ...overrides,
  },
});

beforeEach(() => {
  sentDetail = (id) => sentDetailBody(id);
  getSpy = vi.spyOn(api, "get").mockImplementation((async (
    url: string,
    config?: { params?: Record<string, unknown> },
  ) => {
    const params = config?.params ?? {};
    if (url.startsWith("notifications/sent/")) {
      return { data: sentDetail(decodeURIComponent(url.slice("notifications/sent/".length)), params) };
    }
    if (url === "users" && params.limit === 1) {
      // Rolsiz ro'yxatda backend `total` ni sahifa hajmi qilib qaytaradi (jonli xato) — ishlatilmasligi kerak.
      const total = params.role ? (ROLE_TOTALS[String(params.role)] ?? 0) : 1;
      return { data: { data: { items: [], meta: { total } } } };
    }
    if (url === "users") return { data: { data: { items: USERS, meta: { total: USERS.length } } } };
    if (url === "markets") return { data: { data: { items: [{ id: 3, name: "Yandex" }] } } };
    return { data: {} };
  }) as never);
  postSpy = vi.spyOn(api, "post").mockResolvedValue({
    data: {
      statusCode: 201,
      data: {
        dispatched: 1,
        recipient_ids: ["56"],
        channels: ["in_app", "realtime"],
        telegram: null,
        by_channel: { in_app: 1, realtime: 1 },
        channel_status: { in_app: { sent: 1 }, realtime: { emitted: 1 } },
      },
    },
  });
});

afterEach(() => {
  getSpy.mockRestore();
  postSpy.mockRestore();
});

const renderForm = () =>
  renderWithProviders(
    <NotificationDispatchForm
      renderPreview={(notification) => (
        <div data-testid="preview-card">
          {notification.title}|{notification.body ?? ""}|{notification.category}|
          {notification.priority}
        </div>
      )}
    />,
  );

type User = ReturnType<typeof userEvent.setup>;

/** Qabul qiluvchilar turi — v2 segment (`radiogroup` «Qabul qiluvchilar turi»). */
const chooseMode = async (user: User, name: string) =>
  user.click(
    within(screen.getByRole("radiogroup", { name: "Qabul qiluvchilar turi" })).getByRole("radio", {
      name,
    }),
  );

/** v2 `Select` (qidiruvli): maydonni ochib variantni bosadi. */
const pickOption = async (user: User, combobox: HTMLElement, name: RegExp | string) => {
  await user.click(combobox);
  await user.click(await screen.findByRole("option", { name }));
};

const titleInput = () => screen.getByRole("textbox", { name: "Sarlavha" });
const bodyInput = () => screen.getByRole("textbox", { name: "Matn" });

const fillContent = async (user: User, title = "Ish vaqti", body = "Ertaga 9:00 dan") => {
  await user.type(titleInput(), title);
  if (body) await user.type(bodyInput(), body);
};

const submitAndConfirm = async (user: User) => {
  await user.click(screen.getByRole("button", { name: /^Yuborish/ }));
  return screen.findByRole("alertdialog", { name: "Xabarni yuborishni tasdiqlang" });
};

const sentPayload = () => postSpy.mock.calls[0]?.[1] as Record<string, unknown>;
const sentRequestId = (call: number) =>
  (postSpy.mock.calls[call]?.[1] as Record<string, unknown> | undefined)?.client_request_id;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const httpError = (status: number, message: string) =>
  Object.assign(new Error(message), {
    isAxiosError: true,
    response: { status, data: { message } },
  });
const dispatched = (data: Record<string, unknown>) => ({ data: { statusCode: 201, data } });
/** Natija kartasi chiqdi: «Xabar N ta qabul qiluvchining … qutisiga yozildi.» */
const expectResult = async (inbox: number) => {
  const card = await screen.findByTestId("dispatch-result");
  expect(card).toHaveTextContent(`Xabar ${inbox} ta qabul qiluvchining Bildirishnomalar qutisiga yozildi.`);
  return card;
};
const sendButton = () => screen.queryByRole("button", { name: /^Yuborish/ });
const confirmInDialog = async (user: User) => {
  const dialog = await submitAndConfirm(user);
  await user.click(within(dialog).getByRole("button", { name: /Ha, yuborish/ }));
};

describe("NotificationDispatchForm — recipients", () => {
  it("sends recipient_id for one searched person", async () => {
    const user = userEvent.setup();
    renderForm();

    await pickOption(user, screen.getByRole("combobox", { name: "Bitta odam" }), /^Kuryer Ali/);
    await fillContent(user);
    const dialog = await submitAndConfirm(user);
    expect(within(dialog).getByText(/Kuryer Ali · \+998970000095 · courier/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: /Ha, yuborish/ }));

    await waitFor(() => expect(postSpy).toHaveBeenCalledTimes(1));
    expect(postSpy.mock.calls[0][0]).toBe("notifications/dispatch");
    expect(sentPayload()).toMatchObject({
      recipient_id: "56",
      title: "Ish vaqti",
      body: "Ertaga 9:00 dan",
      channels: ["in_app", "realtime"],
    });
    await expectResult(1);
  });

  it("sends a roles array, keeps customers disabled with the reason, and estimates the count", async () => {
    const user = userEvent.setup();
    renderForm();
    await chooseMode(user, "Rol");

    const customer = screen.getByRole("checkbox", { name: "Mijoz" });
    expect(customer).toBeDisabled();
    expect(customer).toHaveAccessibleDescription(/Mijozlarga bu yerdan yuborib bo'lmaydi/);

    await user.click(screen.getByRole("checkbox", { name: "Kuryer" }));
    await user.click(screen.getByRole("checkbox", { name: "Market" }));
    expect(await screen.findByTestId("recipient-estimate")).toHaveTextContent(
      "Taxminan 42 ta qabul qiluvchi",
    );

    await fillContent(user);
    const dialog = await submitAndConfirm(user);
    expect(within(dialog).getByTestId("confirm-count")).toHaveTextContent("taxminan 42 ta");
    expect(within(dialog).getByText("Kuryer, Market")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: /Ha, yuborish/ }));

    await waitFor(() => expect(sentPayload()).toMatchObject({ roles: ["courier", "market"] }));
    expect(sentPayload()).not.toHaveProperty("recipient_id");
  });

  it("shows a validation error when no role is picked", async () => {
    const user = userEvent.setup();
    renderForm();
    await chooseMode(user, "Rol");
    await fillContent(user);
    await user.click(screen.getByRole("button", { name: /^Yuborish/ }));

    expect(await screen.findByText("Kamida bitta rolni tanlang")).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("sends recipient_ids for a picked list and lets a picked person be removed", async () => {
    const user = userEvent.setup();
    renderForm();
    await chooseMode(user, "Tanlangan ro'yxat");

    const combobox = screen.getByRole("combobox", { name: "Tanlangan ro'yxat" });
    await pickOption(user, combobox, /^Kuryer Ali/);
    await pickOption(user, combobox, /^Yandex/);
    const chips = screen.getByRole("list", { name: "Tanlanganlar" });
    expect(within(chips).getAllByRole("listitem")).toHaveLength(2);

    await fillContent(user);
    const dialog = await submitAndConfirm(user);
    await user.click(within(dialog).getByRole("button", { name: /Ha, yuborish/ }));

    await waitFor(() => expect(sentPayload()).toMatchObject({ recipient_ids: ["56", "3"] }));
  });

  it("removes a person from the picked list with the chip button", async () => {
    const user = userEvent.setup();
    renderForm();
    await chooseMode(user, "Tanlangan ro'yxat");
    const combobox = screen.getByRole("combobox", { name: "Tanlangan ro'yxat" });
    await pickOption(user, combobox, /^Kuryer Ali/);
    await pickOption(user, combobox, /^Yandex/);

    await user.click(screen.getByRole("button", { name: "Kuryer Ali — ro'yxatdan olib tashlash" }));
    expect(
      within(screen.getByRole("list", { name: "Tanlanganlar" })).getAllByRole("listitem"),
    ).toHaveLength(1);

    await fillContent(user);
    const dialog = await submitAndConfirm(user);
    await user.click(within(dialog).getByRole("button", { name: /Ha, yuborish/ }));
    await waitFor(() => expect(sentPayload()).toMatchObject({ recipient_ids: ["3"] }));
  });

  it("sends broadcast: true for everyone; the confirm dialog warns in red and the button is red", async () => {
    const user = userEvent.setup();
    renderForm();
    await chooseMode(user, "Hamma");
    await fillContent(user);

    const dialog = await submitAndConfirm(user);
    expect(
      within(dialog).getByText("Diqqat: xabar barcha foydalanuvchilarga yuboriladi"),
    ).toBeInTheDocument();
    expect(within(dialog).getByTestId("confirm-count")).toHaveTextContent("taxminan 250 ta");
    const confirmButton = within(dialog).getByRole("button", { name: /Ha, yuborish/ });
    expect(confirmButton).toHaveAttribute("data-variant", "danger");
    await user.click(confirmButton);

    await waitFor(() => expect(sentPayload()).toMatchObject({ broadcast: true }));
  });
});

describe("NotificationDispatchForm — channels, preview, confirm", () => {
  it("keeps in_app on and locked; SMS and push are real (off by default, can be ticked)", async () => {
    const user = userEvent.setup();
    renderForm();

    const inApp = screen.getByRole("checkbox", { name: "Ilova ichida" });
    expect(inApp).toBeChecked();
    expect(inApp).toBeDisabled();
    expect(inApp).toHaveAccessibleDescription(
      "Doim yoqiq — xabar Bildirishnomalar qutisida saqlanadi",
    );
    const sms = screen.getByRole("checkbox", { name: "SMS" });
    expect(sms).not.toBeDisabled();
    expect(sms).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Push" })).not.toBeDisabled();
    expect(screen.queryByText(/SMS pullik/)).not.toBeInTheDocument();
    await user.click(sms);
    expect(screen.getByText(/SMS pullik/)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Darhol (ochiq ekranga)" })).not.toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Telegram" })).not.toBeDisabled();
  });

  it("Telegram without a market is allowed — sent to personal chats, no telegram target (TgYRqaTk)", async () => {
    const user = userEvent.setup();
    renderForm();

    await pickOption(user, screen.getByRole("combobox", { name: "Bitta odam" }), /^Kuryer Ali/);
    await user.click(screen.getByRole("checkbox", { name: "Telegram" }));
    expect(screen.getByRole("combobox", { name: "Telegram guruhi (market)" })).toBeInTheDocument();
    expect(
      screen.getByText(/tanlanmasa — har bir qabul qiluvchining shaxsiy Telegram'iga/),
    ).toBeInTheDocument();

    await fillContent(user);
    const dialog = await submitAndConfirm(user);
    await user.click(within(dialog).getByRole("button", { name: /Ha, yuborish/ }));

    await waitFor(() => expect(postSpy).toHaveBeenCalledTimes(1));
    expect(sentPayload()).toMatchObject({
      recipient_id: "56",
      channels: ["in_app", "realtime", "telegram"],
    });
    expect(sentPayload()).not.toHaveProperty("telegram");
    expect(screen.queryByText("Telegram uchun marketni tanlang")).not.toBeInTheDocument();
  });

  it("Telegram with a chosen market targets that market's group", async () => {
    const user = userEvent.setup();
    renderForm();

    await pickOption(user, screen.getByRole("combobox", { name: "Bitta odam" }), /^Kuryer Ali/);
    await user.click(screen.getByRole("checkbox", { name: "Telegram" }));
    await pickOption(
      user,
      screen.getByRole("combobox", { name: "Telegram guruhi (market)" }),
      "Yandex",
    );

    await fillContent(user);
    const dialog = await submitAndConfirm(user);
    await user.click(within(dialog).getByRole("button", { name: /Ha, yuborish/ }));

    await waitFor(() => expect(postSpy).toHaveBeenCalledTimes(1));
    expect(sentPayload()).toMatchObject({
      channels: ["in_app", "realtime", "telegram"],
      telegram: { market_id: "3" },
    });
  });

  it("a chosen Telegram market can be cleared back to personal chats", async () => {
    const user = userEvent.setup();
    renderForm();
    await chooseMode(user, "Hamma");
    await user.click(screen.getByRole("checkbox", { name: "Telegram" }));
    const market = screen.getByRole("combobox", { name: "Telegram guruhi (market)" });
    await pickOption(user, market, "Yandex");
    expect(market).toHaveTextContent("Yandex");

    await user.click(screen.getByRole("button", { name: "Tozalash" }));
    expect(market).not.toHaveTextContent("Yandex");

    await fillContent(user);
    const dialog = await submitAndConfirm(user);
    await user.click(within(dialog).getByRole("button", { name: /Ha, yuborish/ }));
    await waitFor(() => expect(postSpy).toHaveBeenCalledTimes(1));
    expect(sentPayload()).toMatchObject({ channels: ["in_app", "realtime", "telegram"] });
    expect(sentPayload()).not.toHaveProperty("telegram");
  });

  it("updates the preview with the title, text, category and priority as they are typed", async () => {
    const user = userEvent.setup();
    renderForm();

    await fillContent(user, "Yangi tarif", "1-oktabrdan");
    await pickOption(user, screen.getByRole("combobox", { name: "Muhimlik" }), "Yuqori");

    expect(screen.getByTestId("preview-card")).toHaveTextContent(
      "Yangi tarif|1-oktabrdan|system|high",
    );
    expect(screen.getByText("11 / 255")).toBeInTheDocument();
  });

  it("shows the full text in the confirm dialog and sends nothing on cancel", async () => {
    const user = userEvent.setup();
    renderForm();
    await chooseMode(user, "Hamma");
    await fillContent(user, "Sarlavha matni", "Birinchi qator\nIkkinchi qator");

    const dialog = await submitAndConfirm(user);
    expect(within(dialog).getByTestId("confirm-title")).toHaveTextContent("Sarlavha matni");
    expect(within(dialog).getByTestId("confirm-body").textContent).toBe(
      "Birinchi qator\nIkkinchi qator",
    );
    expect(within(dialog).getByText("Yuborilgan xabarni qaytarib bo'lmaydi.")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Bekor qilish" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(postSpy).not.toHaveBeenCalled();
  });

  it("shows validation errors for a title over 255 and a text over 4096 characters", async () => {
    const user = userEvent.setup();
    renderForm();
    await chooseMode(user, "Hamma");

    fireEvent.change(titleInput(), { target: { value: "a".repeat(256) } });
    fireEvent.change(bodyInput(), { target: { value: "b".repeat(4097) } });
    await user.click(screen.getByRole("button", { name: /^Yuborish/ }));

    expect(await screen.findByText("255 belgidan oshmasin")).toBeInTheDocument();
    expect(screen.getByText("4096 belgidan oshmasin")).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});

describe("NotificationDispatchForm — sending", () => {
  it("keeps the button loading and blocked while sending", async () => {
    const user = userEvent.setup();
    let resolvePost: (value: unknown) => void = () => undefined;
    postSpy.mockReturnValue(
      new Promise((resolve) => {
        resolvePost = resolve;
      }) as never,
    );
    renderForm();
    await chooseMode(user, "Hamma");
    await fillContent(user);
    const dialog = await submitAndConfirm(user);

    const confirmButton = within(dialog).getByRole("button", { name: /Ha, yuborish/ });
    await user.click(confirmButton);
    // Yuklanayotgan tugma — `aria-busy`, ikkinchi bosish so'rov yubormaydi.
    const busyButton = within(dialog).getByRole("button", { name: /Yuborilmoqda/ });
    expect(busyButton).toHaveAttribute("aria-busy", "true");
    await user.click(busyButton);
    expect(within(dialog).getByRole("button", { name: "Bekor qilish" })).toBeDisabled();
    expect(postSpy).toHaveBeenCalledTimes(1);

    resolvePost({ data: { data: { dispatched: 250, recipient_ids: [], channels: ["in_app"] } } });
    await expectResult(250);
    // Yuborilgan xabar shu formadan qayta yuborilmaydi: «Yuborish» o'rnida qulf izohi, maydonlar o'chiq.
    expect(sendButton()).not.toBeInTheDocument();
    expect(screen.getByTestId("dispatch-locked")).toHaveTextContent("Xabar yuborilgan — forma qulflandi.");
    expect(titleInput()).toBeDisabled();
    expect(postSpy).toHaveBeenCalledTimes(1);
  });

  it("504: the outcome is unknown — no auto retry, the form locks; «Qayta urinish» resends the SAME client_request_id (S5)", async () => {
    const user = userEvent.setup();
    postSpy
      .mockRejectedValueOnce(httpError(504, "Gateway Timeout"))
      .mockResolvedValueOnce(
        dispatched({
          dispatched: 250,
          recipient_ids: [],
          channels: ["in_app", "realtime"],
          by_channel: { in_app: 250, realtime: 250 },
        }),
      );
    renderForm();
    await chooseMode(user, "Hamma");
    await fillContent(user);
    await confirmInDialog(user);

    const unknown = await screen.findByTestId("dispatch-unknown");
    expect(within(unknown).getByText("Noma'lum — tarixdan tekshiring")).toBeInTheDocument();
    expect(within(unknown).getByText("Noma'lum")).toBeInTheDocument();
    expect(within(unknown).getByText(/Xabar baribir yuborilgan bo'lishi mumkin/)).toBeInTheDocument();
    expect(within(unknown).getAllByRole("listitem")).toHaveLength(3);
    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(sentRequestId(0)).toMatch(UUID_RE);
    // Forma qulflangan, avtomatik qayta yuborilmaydi.
    expect(sendButton()).not.toBeInTheDocument();
    expect(screen.getByTestId("dispatch-locked")).toHaveTextContent(/Natija noma'lum/);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(postSpy).toHaveBeenCalledTimes(1);

    await user.click(within(unknown).getByRole("button", { name: "Qayta urinish" }));
    await expectResult(250);
    expect(postSpy).toHaveBeenCalledTimes(2);
    expect(sentRequestId(1)).toBe(sentRequestId(0));
    expect(screen.queryByTestId("dispatch-unknown")).not.toBeInTheDocument();
  });

  it("504 → «Tarixdan tekshirish» opens the detail by client_request_id; «Yangi xabar» starts over", async () => {
    const user = userEvent.setup();
    postSpy.mockRejectedValueOnce(httpError(504, "Gateway Timeout"));
    sentDetail = (id) =>
      sentDetailBody(id, {
        status: "running",
        title: "Ish vaqti",
        finished_at: null,
        channels: ["in_app", "telegram"],
        channel_status: { in_app: { sent: 12 }, telegram: { sent: 4, queued: 8 } },
      });
    renderForm();
    await chooseMode(user, "Hamma");
    await fillContent(user);
    await confirmInDialog(user);
    const unknown = await screen.findByTestId("dispatch-unknown");

    await user.click(within(unknown).getByRole("button", { name: "Tarixdan tekshirish" }));
    const dialog = await screen.findByRole("dialog", { name: "Ish vaqti" });
    expect(await within(dialog).findByText("Yuborish hali tugamagan — raqamlar o'zgarib turadi")).toBeInTheDocument();
    expect(getSpy).toHaveBeenCalledWith(`notifications/sent/${sentRequestId(0)}`, {
      params: { page: 1, limit: 10 },
    });
    await user.click(within(dialog).getAllByRole("button", { name: "Yopish" }).at(-1)!);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(within(unknown).getByRole("button", { name: "Yangi xabar" }));
    expect(screen.queryByTestId("dispatch-unknown")).not.toBeInTheDocument();
    expect(sendButton()).not.toBeDisabled();
    expect(titleInput()).toHaveValue("");
  });

  it("«Qayta urinish» that is rejected shows a clear error in the unknown card (no raw backend text)", async () => {
    const user = userEvent.setup();
    postSpy
      .mockRejectedValueOnce(httpError(504, "Gateway Timeout"))
      .mockRejectedValueOnce(httpError(500, "QueryFailedError: duplicate key value"));
    renderForm();
    await chooseMode(user, "Hamma");
    await fillContent(user);
    await confirmInDialog(user);
    const unknown = await screen.findByTestId("dispatch-unknown");

    await user.click(within(unknown).getByRole("button", { name: "Qayta urinish" }));
    expect(await within(unknown).findByText("Qayta urinib bo'lmadi")).toBeInTheDocument();
    expect(within(unknown).getByText(/Serverda xatolik yuz berdi/)).toBeInTheDocument();
    expect(screen.queryByText(/QueryFailedError/)).not.toBeInTheDocument();
    expect(sentRequestId(1)).toBe(sentRequestId(0));
  });

  it("shows a 4xx backend error in the form and keeps the form editable", async () => {
    const user = userEvent.setup();
    postSpy.mockRejectedValue(
      Object.assign(new Error("Bad Request"), {
        isAxiosError: true,
        response: { status: 400, data: { message: "Qabul qiluvchi topilmadi" } },
      }),
    );
    renderForm();
    await chooseMode(user, "Hamma");
    await fillContent(user);
    const dialog = await submitAndConfirm(user);
    await user.click(within(dialog).getByRole("button", { name: /Ha, yuborish/ }));

    // Xom backend matni ko'rsatilmaydi (ega S4) — faqat tushunarli matn.
    expect(await screen.findByText(/Server so'rovni rad etdi/)).toBeInTheDocument();
    expect(screen.getByText("Xabarni yuborib bo'lmadi")).toBeInTheDocument();
    expect(screen.queryByText("Qabul qiluvchi topilmadi")).not.toBeInTheDocument();
    expect(sendButton()).not.toBeDisabled();
  });
});

describe("NotificationDispatchForm — client_request_id (takror himoyasi)", () => {
  it("sends a UUID; a retry of the same message after an error reuses it", async () => {
    const user = userEvent.setup();
    postSpy
      .mockRejectedValueOnce(httpError(500, "Ichki xato"))
      .mockResolvedValueOnce(
        dispatched({ dispatched: 250, recipient_ids: [], channels: ["in_app"] }),
      );
    renderForm();
    await chooseMode(user, "Hamma");
    await fillContent(user);

    await confirmInDialog(user);
    expect(await screen.findByText(/Serverda xatolik yuz berdi/)).toBeInTheDocument();
    expect(screen.queryByText("Ichki xato")).not.toBeInTheDocument();
    expect(sentRequestId(0)).toMatch(UUID_RE);

    // Xuddi shu mazmun qayta yuboriladi — o'sha urinish, o'sha id (backend ikkinchi marta yubormaydi).
    await confirmInDialog(user);
    await expectResult(250);
    expect(postSpy).toHaveBeenCalledTimes(2);
    expect(sentRequestId(1)).toBe(sentRequestId(0));
  });

  it("uses a new id after a successful send («Yangi xabar») and when the message changes", async () => {
    const user = userEvent.setup();
    postSpy
      .mockResolvedValueOnce(dispatched({ dispatched: 1, recipient_ids: [], channels: ["in_app"] }))
      .mockRejectedValueOnce(httpError(400, "Qabul qiluvchi topilmadi"))
      .mockResolvedValueOnce(
        dispatched({ dispatched: 1, recipient_ids: [], channels: ["in_app"] }),
      );
    renderForm();
    await chooseMode(user, "Hamma");
    await fillContent(user);
    await confirmInDialog(user);
    await expectResult(1);

    // Muvaffaqiyatdan keyin — yangi xabar, yangi urinish.
    await user.click(screen.getByRole("button", { name: "Yangi xabar" }));
    await chooseMode(user, "Hamma");
    await fillContent(user);
    await confirmInDialog(user);
    expect(await screen.findByText(/Server so'rovni rad etdi/)).toBeInTheDocument();
    expect(sentRequestId(1)).toMatch(UUID_RE);
    expect(sentRequestId(1)).not.toBe(sentRequestId(0));

    // Mazmun o'zgardi — bu boshqa xabar, boshqa id.
    await user.type(titleInput(), " (tuzatildi)");
    await confirmInDialog(user);
    await waitFor(() => expect(postSpy).toHaveBeenCalledTimes(3));
    expect(sentRequestId(2)).toMatch(UUID_RE);
    expect(sentRequestId(2)).not.toBe(sentRequestId(1));
  });

  it("a duplicate of a failed attempt is an error, not «Yuborildi»; the next send is a new attempt", async () => {
    const user = userEvent.setup();
    postSpy
      .mockRejectedValueOnce(httpError(500, "Ichki xato"))
      .mockResolvedValueOnce({
        data: {
          statusCode: 200,
          data: { duplicate: true, status: "failed", dispatched: 0, channels: ["in_app"] },
        },
      })
      .mockResolvedValueOnce(
        dispatched({ dispatched: 250, recipient_ids: [], channels: ["in_app"] }),
      );
    renderForm();
    await chooseMode(user, "Hamma");
    await fillContent(user);

    await confirmInDialog(user);
    expect(await screen.findByText(/Serverda xatolik yuz berdi/)).toBeInTheDocument();
    await confirmInDialog(user);
    expect(await screen.findByText("Avvalgi urinish xato bilan tugagan")).toBeInTheDocument();
    expect(screen.getByText(/formadagi «Yuborish» ni bosing/)).toBeInTheDocument();
    expect(screen.queryByTestId("dispatch-result")).not.toBeInTheDocument();
    expect(sentRequestId(1)).toBe(sentRequestId(0));
    expect(sendButton()).not.toBeDisabled();

    await confirmInDialog(user);
    await expectResult(250);
    expect(sentRequestId(2)).toMatch(UUID_RE);
    expect(sentRequestId(2)).not.toBe(sentRequestId(0));
  });

  it("a duplicate that is still running locks the form; a sent duplicate shows the stored result", async () => {
    const user = userEvent.setup();
    postSpy.mockResolvedValueOnce({
      data: {
        statusCode: 200,
        data: { duplicate: true, status: "running", dispatched: 0, channels: ["in_app"] },
      },
    });
    renderForm();
    await chooseMode(user, "Hamma");
    await fillContent(user);
    await confirmInDialog(user);

    const unknown = await screen.findByTestId("dispatch-unknown");
    expect(within(unknown).getByText("Hali yuborilmoqda")).toBeInTheDocument();
    expect(within(unknown).getByText(/allaqachon yuborilmoqda/)).toBeInTheDocument();
    expect(screen.queryByTestId("dispatch-result")).not.toBeInTheDocument();
    expect(sendButton()).not.toBeInTheDocument();

    postSpy.mockResolvedValueOnce({
      data: {
        statusCode: 200,
        data: { duplicate: true, status: "sent", dispatched: 7, channels: ["in_app"] },
      },
    });
    await user.click(screen.getByRole("button", { name: "Yangi xabar" }));
    await chooseMode(user, "Hamma");
    await fillContent(user);
    await confirmInDialog(user);
    const card = await expectResult(7);
    expect(within(card).getByText("Avval yuborilgan")).toBeInTheDocument();
    expect(within(card).getByText(/avvalgi urinishda yuborilgan — qayta yuborilmadi/)).toBeInTheDocument();
    // Takror javobidagi tarix holati — belgi.
    expect(within(card).getByText("Yuborildi")).toBeInTheDocument();
  });
});

describe("NotificationDispatchForm — natija kartasi (NS-1)", () => {
  const UNDELIVERED = [
    {
      notification_id: "901",
      recipient_id: "3",
      name: "Baraka Shop",
      role: "market",
      failures: [{ channel: "telegram", status: "skipped", reason: "no_telegram_id" }],
    },
    {
      notification_id: "902",
      recipient_id: "56",
      name: "Jasur Tursunov",
      role: "courier",
      failures: [
        { channel: "telegram", status: "failed", reason: "Forbidden: bot was blocked by the user" },
        { channel: "sms", status: "skipped", reason: "no_phone" },
      ],
    },
  ];

  const partialResponse = dispatched({
    dispatch_id: "b2c4d6e8-0000-4000-8000-000000000001",
    dispatched: 148,
    recipient_ids: [],
    channels: ["in_app", "realtime", "telegram", "sms"],
    by_channel: { in_app: 148, realtime: 148, telegram: 131, sms: 0 },
    no_provider: [],
    skipped_by_preference: 3,
    channel_status: {
      in_app: { sent: 148 },
      realtime: { emitted: 148 },
      telegram: { queued: 131, skipped: 17 },
      sms: { queued: 139, skipped: 9 },
    },
  });

  it("shows the status, stats (recipients = dispatched + skipped), channels and the first 5 undelivered right away (S1)", async () => {
    const user = userEvent.setup();
    postSpy.mockResolvedValueOnce(partialResponse);
    sentDetail = (id, params) =>
      sentDetailBody(id, {
        status: "partial",
        undelivered: { items: UNDELIVERED, meta: { page: 1, limit: Number(params.limit), total: 25 } },
      });
    renderForm();
    await chooseMode(user, "Hamma");
    await fillContent(user);
    await confirmInDialog(user);

    const card = await expectResult(148);
    // SMS hech kimga ketmagan (by_channel.sms = 0) — backend qoidasi bo'yicha «Qisman yuborildi».
    expect(within(card).getByText("Qisman yuborildi")).toBeInTheDocument();
    expect(card).toHaveTextContent("Telegram va SMS navbatga qo'yildi, ba'zilariga esa umuman ketmaydi — ro'yxat pastda.");
    expect(card).toHaveTextContent("Qabul qiluvchilar151 ta");
    expect(card).toHaveTextContent("Bildirishnomani o'chirganlar3 ta");

    const channels = within(card).getByRole("list", { name: "Kanallar bo'yicha natija" });
    const telegram = channels.querySelector('[data-channel="telegram"]') as HTMLElement;
    expect(telegram).toHaveTextContent("148 ta · shaxsiy chatga");
    expect(within(telegram).getByText("Navbatda", { selector: "span" })).toBeInTheDocument();
    expect(within(telegram).getByRole("img", { name: "Telegram: navbatda 131, o'tkazib yuborildi 17" })).toBeInTheDocument();
    expect(telegram).toHaveTextContent(/bot yuborgach/);
    const realtime = channels.querySelector('[data-channel="realtime"]') as HTMLElement;
    expect(realtime).toHaveTextContent("Ilovasi ochiq bo'lganlarga uzatildi");

    // «Yetkazilmaganlar» — qo'shimcha so'rov, limit 5.
    expect(getSpy).toHaveBeenCalledWith("notifications/sent/b2c4d6e8-0000-4000-8000-000000000001", {
      params: { page: 1, limit: 5 },
    });
    const toggle = await within(card).findByRole("button", { name: /Yetkazilmaganlar/ });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveTextContent("25 ta");
    expect(within(card).getByText("Baraka Shop")).toBeInTheDocument();
    expect(within(card).getByText("Telegram ulanmagan")).toBeInTheDocument();
    expect(within(card).getByText("Telefon raqami yo'q")).toBeInTheDocument();
    // Xom sabab ko'rsatilmaydi (S4) — kanal bo'yicha tushunarli matn.
    expect(within(card).getByText("Telegram xatosi")).toBeInTheDocument();
    expect(screen.queryByText(/bot was blocked/)).not.toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);

    // «Barcha 25 tasini ko'rish» — tafsilot oynasi (10 tadan).
    await user.click(within(card).getByRole("button", { name: "Barcha 25 tasini ko'rish" }));
    const dialog = await screen.findByRole("dialog", { name: "Ish vaqti" });
    await waitFor(() =>
      expect(getSpy).toHaveBeenCalledWith("notifications/sent/b2c4d6e8-0000-4000-8000-000000000001", {
        params: { page: 1, limit: 10 },
      }),
    );
    expect(await within(dialog).findByText("25 ta qabul qiluvchiga kamida bitta kanal yetmadi")).toBeInTheDocument();
  });

  it("no undelivered — a short success line, no list", async () => {
    const user = userEvent.setup();
    renderForm();
    await chooseMode(user, "Hamma");
    await fillContent(user);
    await confirmInDialog(user);
    const card = await expectResult(1);
    expect(await within(card).findByText("Hozircha yetkazilmaganlar yo'q")).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: /Yetkazilmaganlar/ })).not.toBeInTheDocument();
    // Natija belgisi (sarlavha yonida) — «Yuborildi».
    expect(within(card).getByRole("heading", { name: "Yuborish natijasi" }).parentElement).toHaveTextContent(
      "Yuborildi",
    );
  });

  it("the undelivered list fails to load — the result stays, a retry is offered", async () => {
    const user = userEvent.setup();
    let fail = true;
    sentDetail = (id, params) => {
      if (fail) throw httpError(500, "boom");
      return sentDetailBody(id, {
        undelivered: { items: UNDELIVERED.slice(0, 1), meta: { page: 1, limit: Number(params.limit), total: 1 } },
      });
    };
    renderForm();
    await chooseMode(user, "Hamma");
    await fillContent(user);
    await confirmInDialog(user);
    const card = await expectResult(1);
    expect(await within(card).findByText("Ro'yxatni olib bo'lmadi")).toBeInTheDocument();
    expect(within(card).getByText(/faqat yetkazilmaganlar ro'yxati yuklanmadi/)).toBeInTheDocument();
    // NS-2: xatoda «Yuborilganlar» sahifasiga havola ham bor.
    expect(within(card).getByRole("link", { name: "Yuborilganlar" })).toHaveAttribute("href", "/notifications/sent");

    fail = false;
    await user.click(within(card).getByRole("button", { name: "Qayta urinish" }));
    expect(await within(card).findByText("Baraka Shop")).toBeInTheDocument();
  });

  it("SMS provider not connected — «Faqat ilova ichida», SMS row is grey and never says «Yuborildi»", async () => {
    const user = userEvent.setup();
    postSpy.mockResolvedValueOnce(
      dispatched({
        dispatched: 12,
        recipient_ids: [],
        channels: ["in_app", "sms"],
        by_channel: { in_app: 12, sms: 0 },
        no_provider: ["sms"],
        skipped_by_preference: 0,
        channel_status: { in_app: { sent: 12 }, sms: { no_provider: 12 } },
      }),
    );
    renderForm();
    await chooseMode(user, "Hamma");
    await user.click(screen.getByRole("checkbox", { name: "SMS" }));
    await fillContent(user);
    await confirmInDialog(user);

    const card = await screen.findByTestId("dispatch-result");
    expect(within(card).getByText("Faqat ilova ichida")).toBeInTheDocument();
    expect(card).toHaveTextContent("tashqi kanallarning hech biri ketmadi");
    const sms = card.querySelector('[data-channel="sms"]') as HTMLElement;
    expect(within(sms).getAllByText("Provayder ulanmagan").length).toBeGreaterThan(0);
    expect(within(sms).queryByText("Yuborildi")).not.toBeInTheDocument();
    expect(sms).toHaveTextContent(/SMS provayderi ulanmagan/);
  });
});

describe("NotificationDispatchForm — natija: fokus, qayta urinish, holatlar (NS-1 review)", () => {
  /** Natija/noma'lum kartasining o'rami (`tabIndex=-1`) — tasdiq oynasidan keyin fokus shu yerda. */
  const outcomeWrapper = (card: HTMLElement) => card.parentElement as HTMLElement;

  it("after a successful send the focus moves to the result, not to <body>", async () => {
    const user = userEvent.setup();
    renderForm();
    await chooseMode(user, "Hamma");
    await fillContent(user);
    await confirmInDialog(user);
    const card = await expectResult(1);
    await waitFor(() => expect(outcomeWrapper(card)).toHaveFocus());
    // Desktop: vaqt sarlavha qatorining o'ng tomonida (amallar), izoh qatorida emas.
    expect(within(card).getByTestId("dispatch-time").closest("p")).toBeNull();
  });

  it("504 → the unknown card gets the focus; «Qayta urinish» → the result card gets it", async () => {
    const user = userEvent.setup();
    postSpy.mockRejectedValueOnce(httpError(504, "Gateway Timeout"));
    renderForm();
    await chooseMode(user, "Hamma");
    await fillContent(user);
    await confirmInDialog(user);
    const unknown = await screen.findByTestId("dispatch-unknown");
    await waitFor(() => expect(outcomeWrapper(unknown)).toHaveFocus());

    await user.click(within(unknown).getByRole("button", { name: "Qayta urinish" }));
    const card = await expectResult(1);
    await waitFor(() => expect(outcomeWrapper(card)).toHaveFocus());
  });

  it("«Yangi xabar» is blocked while «Qayta urinish» runs; afterwards a new message can still be sent", async () => {
    const user = userEvent.setup();
    let resolveRetry: (value: unknown) => void = () => undefined;
    postSpy
      .mockRejectedValueOnce(httpError(504, "Gateway Timeout"))
      .mockImplementationOnce(() => new Promise((resolve) => (resolveRetry = resolve)) as never);
    renderForm();
    await chooseMode(user, "Hamma");
    await fillContent(user);
    await confirmInDialog(user);
    const unknown = await screen.findByTestId("dispatch-unknown");

    await user.click(within(unknown).getByRole("button", { name: "Qayta urinish" }));
    expect(within(unknown).getByRole("button", { name: "Yangi xabar" })).toBeDisabled();
    resolveRetry(
      dispatched({ dispatched: 1, recipient_ids: [], channels: ["in_app"], by_channel: { in_app: 1 } }),
    );
    const card = await expectResult(1);
    expect(postSpy).toHaveBeenCalledTimes(2);

    await user.click(within(card).getByRole("button", { name: "Yangi xabar" }));
    await chooseMode(user, "Hamma");
    await fillContent(user, "Ikkinchi xabar", "");
    await confirmInDialog(user);
    await waitFor(() => expect(postSpy).toHaveBeenCalledTimes(3));
    expect(sentRequestId(2)).not.toBe(sentRequestId(0));
    await expectResult(1);
  });

  it("unknown card icons follow the maket: clock for «Noma'lum», loader for «Hali yuborilmoqda» (no steps there)", async () => {
    const user = userEvent.setup();
    postSpy
      .mockRejectedValueOnce(httpError(504, "Gateway Timeout"))
      .mockResolvedValueOnce(dispatched({ duplicate: true, status: "running", dispatched: 0, recipient_ids: [], channels: ["in_app"] }));
    renderForm();
    await chooseMode(user, "Hamma");
    await fillContent(user);
    await confirmInDialog(user);
    let unknown = await screen.findByTestId("dispatch-unknown");
    expect(unknown.querySelector("svg.lucide-clock")).not.toBeNull();
    expect(within(unknown).getAllByRole("listitem")).toHaveLength(3);

    await user.click(within(unknown).getByRole("button", { name: "Qayta urinish" }));
    expect(await screen.findByText("Hali yuborilmoqda")).toBeInTheDocument();
    unknown = screen.getByTestId("dispatch-unknown");
    expect(unknown.querySelector("svg.lucide-loader-circle")).not.toBeNull();
    // «Tarixda yo'q bo'lsa — Qayta urinish» qadami bu holatga zid — qadamlar yo'q.
    expect(within(unknown).queryAllByRole("listitem")).toHaveLength(0);
  });

  it("504 → «Tarixdan tekshirish» → 404: the text points to «Qayta urinish» on the card", async () => {
    const user = userEvent.setup();
    postSpy.mockRejectedValueOnce(httpError(504, "Gateway Timeout"));
    sentDetail = () => {
      throw httpError(404, "Dispatch topilmadi");
    };
    renderForm();
    await chooseMode(user, "Hamma");
    await fillContent(user);
    await confirmInDialog(user);
    const unknown = await screen.findByTestId("dispatch-unknown");
    await user.click(within(unknown).getByRole("button", { name: "Tarixdan tekshirish" }));
    const dialog = await screen.findByRole("dialog", { name: "Yuborilgan xabar" });
    expect(await within(dialog).findByText(/serverga yetmagan/)).toBeInTheDocument();
    expect(within(dialog).queryByText(/havola eskirgan/)).not.toBeInTheDocument();
  });

  it("the «Yetkazilmaganlar» header uses the Users icon (UserX means «Nofaol qilish»)", async () => {
    const user = userEvent.setup();
    sentDetail = (id, params) =>
      sentDetailBody(id, {
        undelivered: {
          items: [{ notification_id: "1", recipient_id: "3", name: "Baraka Shop", role: "market", failures: [{ channel: "telegram", status: "skipped", reason: "no_telegram_id" }] }],
          meta: { page: 1, limit: Number(params.limit), total: 1 },
        },
      });
    renderForm();
    await chooseMode(user, "Hamma");
    await fillContent(user);
    await confirmInDialog(user);
    const card = await expectResult(1);
    const toggle = await within(card).findByRole("button", { name: /Yetkazilmaganlar/ });
    expect(toggle.querySelector("svg.lucide-users")).not.toBeNull();
    expect(card.querySelector("svg.lucide-user-x")).toBeNull();
  });

  it("all external channels queued, nobody missed — the maket sentence «…va Telegram'ga uzatildi»", async () => {
    const user = userEvent.setup();
    postSpy.mockResolvedValueOnce(
      dispatched({
        dispatched: 62,
        recipient_ids: [],
        channels: ["in_app", "realtime", "telegram"],
        by_channel: { in_app: 62, realtime: 62, telegram: 62 },
        no_provider: [],
        skipped_by_preference: 0,
        channel_status: { in_app: { sent: 62 }, realtime: { emitted: 62 }, telegram: { queued: 62 } },
      }),
    );
    renderForm();
    await chooseMode(user, "Hamma");
    await fillContent(user);
    await confirmInDialog(user);
    const card = await screen.findByTestId("dispatch-result");
    expect(card).toHaveTextContent("Xabar 62 ta qabul qiluvchining qutisiga yozildi va Telegram'ga uzatildi.");
  });

  it("the undelivered list stays live while channels are queued (later failures show up on the card)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      let calls = 0;
      sentDetail = (id, params) => {
        if (params.limit === 5) calls += 1;
        return calls <= 1
          ? sentDetailBody(id, { status: "sent", channels: ["in_app", "telegram"], channel_status: { in_app: { sent: 1 }, telegram: { queued: 1 } } })
          : sentDetailBody(id, {
              status: "partial",
              channels: ["in_app", "telegram"],
              channel_status: { in_app: { sent: 1 }, telegram: { failed: 1 } },
              undelivered: {
                items: [{ notification_id: "1", recipient_id: "56", name: "Kuryer Ali", role: "courier", failures: [{ channel: "telegram", status: "failed", reason: "bot_blocked" }] }],
                meta: { page: 1, limit: 5, total: 1 },
              },
            });
      };
      renderForm();
      await chooseMode(user, "Hamma");
      await fillContent(user);
      await confirmInDialog(user);
      const card = await screen.findByTestId("dispatch-result");
      expect(await within(card).findByText("Hozircha yetkazilmaganlar yo'q")).toBeInTheDocument();
      await vi.advanceTimersByTimeAsync(5_100);
      expect(await within(card).findByText("Botni bloklagan")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("phone: the time sits under the title, not in the header actions", async () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes("max-width: 767px"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as typeof window.matchMedia;
    try {
      const user = userEvent.setup();
      renderForm();
      await chooseMode(user, "Hamma");
      await fillContent(user);
      await confirmInDialog(user);
      const card = await expectResult(1);
      expect(within(card).getByTestId("dispatch-time").closest("p")).not.toBeNull();
    } finally {
      window.matchMedia = original;
    }
  });
});
