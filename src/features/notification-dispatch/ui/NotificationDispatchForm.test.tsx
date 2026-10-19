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

beforeEach(() => {
  getSpy = vi.spyOn(api, "get").mockImplementation((async (
    url: string,
    config?: { params?: Record<string, unknown> },
  ) => {
    const params = config?.params ?? {};
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
    expect(await screen.findByText("Yuborildi: 1 ta qabul qiluvchi.")).toBeInTheDocument();
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
    expect(await screen.findByText("Yuborildi: 250 ta qabul qiluvchi.")).toBeInTheDocument();
    // Yuborilgan xabar shu formadan qayta yuborilmaydi.
    expect(screen.getByRole("button", { name: /^Yuborish/ })).toBeDisabled();
    expect(postSpy).toHaveBeenCalledTimes(1);
  });

  it("does not retry after a 504, warns that the outcome is unknown and blocks re-sending", async () => {
    const user = userEvent.setup();
    postSpy.mockRejectedValue(
      Object.assign(new Error("Gateway Timeout"), {
        isAxiosError: true,
        response: { status: 504, data: {} },
      }),
    );
    renderForm();
    await chooseMode(user, "Hamma");
    await fillContent(user);
    const dialog = await submitAndConfirm(user);

    await user.click(within(dialog).getByRole("button", { name: /Ha, yuborish/ }));

    expect(await screen.findByText(/Xabar baribir yuborilgan bo'lishi mumkin/)).toBeInTheDocument();
    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(sentRequestId(0)).toMatch(UUID_RE);
    expect(screen.getByRole("button", { name: /^Yuborish/ })).toBeDisabled();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(postSpy).toHaveBeenCalledTimes(1);

    // "Yangi xabar" — yangi forma, yangi guruh kaliti.
    await user.click(screen.getByRole("button", { name: "Yangi xabar" }));
    expect(screen.getByRole("button", { name: /^Yuborish/ })).not.toBeDisabled();
    expect(titleInput()).toHaveValue("");
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

    expect(await screen.findByText("Qabul qiluvchi topilmadi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Yuborish/ })).not.toBeDisabled();
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
    expect(await screen.findByText("Ichki xato")).toBeInTheDocument();
    expect(sentRequestId(0)).toMatch(UUID_RE);

    // Xuddi shu mazmun qayta yuboriladi — o'sha urinish, o'sha id (backend ikkinchi marta yubormaydi).
    await confirmInDialog(user);
    expect(await screen.findByText("Yuborildi: 250 ta qabul qiluvchi.")).toBeInTheDocument();
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
    expect(await screen.findByText("Yuborildi: 1 ta qabul qiluvchi.")).toBeInTheDocument();

    // Muvaffaqiyatdan keyin — yangi xabar, yangi urinish.
    await user.click(screen.getByRole("button", { name: "Yangi xabar" }));
    await chooseMode(user, "Hamma");
    await fillContent(user);
    await confirmInDialog(user);
    expect(await screen.findByText("Qabul qiluvchi topilmadi")).toBeInTheDocument();
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
    expect(await screen.findByText("Ichki xato")).toBeInTheDocument();
    await confirmInDialog(user);
    expect(await screen.findByText(/Avvalgi urinish xato bilan tugagan/)).toBeInTheDocument();
    expect(screen.queryByText(/^Yuborildi/)).not.toBeInTheDocument();
    expect(sentRequestId(1)).toBe(sentRequestId(0));
    expect(screen.getByRole("button", { name: /^Yuborish/ })).not.toBeDisabled();

    await confirmInDialog(user);
    expect(await screen.findByText("Yuborildi: 250 ta qabul qiluvchi.")).toBeInTheDocument();
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

    expect(await screen.findByText(/allaqachon yuborilmoqda/)).toBeInTheDocument();
    expect(screen.queryByText(/^Yuborildi/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Yuborish/ })).toBeDisabled();

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
    expect(await screen.findByText("Yuborildi: 7 ta qabul qiluvchi.")).toBeInTheDocument();
    expect(
      screen.getByText(/avvalgi urinishda yuborilgan — qayta yuborilmadi/),
    ).toBeInTheDocument();
  });
});
