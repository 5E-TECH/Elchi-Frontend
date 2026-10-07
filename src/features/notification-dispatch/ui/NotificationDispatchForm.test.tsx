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
  getSpy = vi.spyOn(api, "get").mockImplementation((async (url: string, config?: { params?: Record<string, unknown> }) => {
    const params = config?.params ?? {};
    if (url === "users" && params.limit === 1) {
      // Rolsiz ro'yxatda backend `total` ni sahifa hajmi qilib qaytaradi (jonli xato) — ishlatilmasligi kerak.
      const total = params.role ? ROLE_TOTALS[String(params.role)] ?? 0 : 1;
      return { data: { data: { items: [], meta: { total } } } };
    }
    if (url === "users") return { data: { data: { items: USERS, meta: { total: USERS.length } } } };
    if (url === "markets") return { data: { data: { items: [{ id: 3, name: "Yandex" }] } } };
    return { data: {} };
  }) as never);
  postSpy = vi.spyOn(api, "post").mockResolvedValue({
    data: { statusCode: 201, data: { dispatched: 1, recipient_ids: ["56"], channels: ["in_app", "realtime"], telegram: null } },
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
          {notification.title}|{notification.body ?? ""}|{notification.category}|{notification.priority}
        </div>
      )}
    />,
  );

const chooseMode = async (user: ReturnType<typeof userEvent.setup>, name: string) =>
  user.click(screen.getByRole("radio", { name }));

const pickOption = async (combobox: HTMLElement, title: string) => {
  fireEvent.mouseDown(combobox);
  fireEvent.click(await screen.findByTitle(title));
};

const fillContent = async (user: ReturnType<typeof userEvent.setup>, title = "Ish vaqti", body = "Ertaga 9:00 dan") => {
  await user.type(screen.getByLabelText("Sarlavha"), title);
  if (body) await user.type(screen.getByLabelText("Matn"), body);
};

const submitAndConfirm = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: /Yuborish/ }));
  // antd test muhitida `aria-labelledby` "test-id" bo'ladi — sarlavha matn bo'yicha tekshiriladi.
  const dialog = await screen.findByRole("dialog");
  expect(dialog).toHaveTextContent("Xabarni yuborishni tasdiqlang");
  return dialog;
};

const sentPayload = () => postSpy.mock.calls[0]?.[1] as Record<string, unknown>;

describe("NotificationDispatchForm — recipients", () => {
  it("sends recipient_id for one searched person", async () => {
    const user = userEvent.setup();
    renderForm();

    await pickOption(screen.getByRole("combobox", { name: "Bitta odam" }), "Kuryer Ali · +998970000095 · courier");
    await fillContent(user);
    const dialog = await submitAndConfirm(user);
    await user.click(within(dialog).getByRole("button", { name: /Ha, yuborish/ }));

    await waitFor(() => expect(postSpy).toHaveBeenCalledTimes(1));
    expect(postSpy.mock.calls[0][0]).toBe("notifications/dispatch");
    expect(sentPayload()).toMatchObject({ recipient_id: "56", title: "Ish vaqti", body: "Ertaga 9:00 dan", channels: ["in_app", "realtime"] });
    expect(await screen.findByText("Yuborildi: 1 ta qabul qiluvchi.")).toBeInTheDocument();
  });

  it("sends a roles array, keeps customers disabled with the reason, and estimates the count", async () => {
    const user = userEvent.setup();
    renderForm();
    await chooseMode(user, "Rol");

    const customer = screen.getByRole("checkbox", { name: "Mijoz" });
    expect(customer).toBeDisabled();
    await user.hover(customer.closest("span")!.parentElement!);
    expect(await screen.findByText(/Mijozlarga bu yerdan yuborib bo'lmaydi/)).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "Kuryer" }));
    await user.click(screen.getByRole("checkbox", { name: "Market" }));
    expect(await screen.findByTestId("recipient-estimate")).toHaveTextContent("Taxminan 42 ta qabul qiluvchi");

    await fillContent(user);
    const dialog = await submitAndConfirm(user);
    expect(within(dialog).getByTestId("confirm-count")).toHaveTextContent("taxminan 42 ta");
    await user.click(within(dialog).getByRole("button", { name: /Ha, yuborish/ }));

    await waitFor(() => expect(sentPayload()).toMatchObject({ roles: ["courier", "market"] }));
    expect(sentPayload()).not.toHaveProperty("recipient_id");
  });

  it("sends recipient_ids for a picked list", async () => {
    const user = userEvent.setup();
    renderForm();
    await chooseMode(user, "Tanlangan ro'yxat");

    const combobox = screen.getByRole("combobox", { name: "Tanlangan ro'yxat" });
    await pickOption(combobox, "Kuryer Ali · +998970000095 · courier");
    await pickOption(combobox, "Yandex · +998900000001 · market");
    await fillContent(user);
    const dialog = await submitAndConfirm(user);
    await user.click(within(dialog).getByRole("button", { name: /Ha, yuborish/ }));

    await waitFor(() => expect(sentPayload()).toMatchObject({ recipient_ids: ["56", "3"] }));
  });

  it("sends broadcast: true for everyone and warns in red in the confirm dialog", async () => {
    const user = userEvent.setup();
    renderForm();
    await chooseMode(user, "Hamma");
    await fillContent(user);

    const dialog = await submitAndConfirm(user);
    expect(within(dialog).getByText(/xabar BARCHA foydalanuvchilarga yuboriladi/)).toBeInTheDocument();
    expect(within(dialog).getByTestId("confirm-count")).toHaveTextContent("taxminan 250 ta");
    await user.click(within(dialog).getByRole("button", { name: /Ha, yuborish/ }));

    await waitFor(() => expect(sentPayload()).toMatchObject({ broadcast: true }));
  });
});

describe("NotificationDispatchForm — channels, preview, confirm", () => {
  it("keeps in_app on and locked; SMS and push are now real (off by default, can be ticked)", async () => {
    const user = userEvent.setup();
    renderForm();

    const inApp = screen.getByRole("checkbox", { name: "Ilova ichida" });
    expect(inApp).toBeChecked();
    expect(inApp).toBeDisabled();
    const sms = screen.getByRole("checkbox", { name: "SMS" });
    expect(sms).not.toBeDisabled();
    expect(sms).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Push" })).not.toBeDisabled();
    await user.click(sms);
    expect(screen.getByText(/SMS pullik/)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Darhol (ochiq ekranga)" })).not.toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Telegram" })).not.toBeDisabled();
  });

  it("updates the preview with the title, text, category and priority as they are typed", async () => {
    const user = userEvent.setup();
    renderForm();

    await fillContent(user, "Yangi tarif", "1-oktabrdan");

    expect(screen.getByTestId("preview-card")).toHaveTextContent("Yangi tarif|1-oktabrdan|system|normal");
  });

  it("shows the full text in the confirm dialog and sends nothing on cancel", async () => {
    const user = userEvent.setup();
    renderForm();
    await chooseMode(user, "Hamma");
    await fillContent(user, "Sarlavha matni", "Birinchi qator\nIkkinchi qator");

    const dialog = await submitAndConfirm(user);
    expect(within(dialog).getByTestId("confirm-title")).toHaveTextContent("Sarlavha matni");
    expect(within(dialog).getByTestId("confirm-body").textContent).toBe("Birinchi qator\nIkkinchi qator");
    expect(within(dialog).getByText("Yuborilgan xabarni qaytarib bo'lmaydi.")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Bekor" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(postSpy).not.toHaveBeenCalled();
  });

  it("shows validation errors for a title over 255 and a text over 4096 characters", async () => {
    const user = userEvent.setup();
    renderForm();
    await chooseMode(user, "Hamma");

    fireEvent.change(screen.getByLabelText("Sarlavha"), { target: { value: "a".repeat(256) } });
    fireEvent.change(screen.getByLabelText("Matn"), { target: { value: "b".repeat(4097) } });
    await user.click(screen.getByRole("button", { name: /Yuborish/ }));

    expect(await screen.findByText("255 belgidan oshmasin")).toBeInTheDocument();
    expect(screen.getByText("4096 belgidan oshmasin")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("NotificationDispatchForm — sending", () => {
  it("keeps the button loading and blocked while sending", async () => {
    const user = userEvent.setup();
    let resolvePost: (value: unknown) => void = () => undefined;
    postSpy.mockReturnValue(new Promise((resolve) => { resolvePost = resolve; }) as never);
    renderForm();
    await chooseMode(user, "Hamma");
    await fillContent(user);
    const dialog = await submitAndConfirm(user);

    await user.click(within(dialog).getByRole("button", { name: /Ha, yuborish/ }));
    await user.click(within(dialog).getByRole("button", { name: /Ha, yuborish/ }));

    const sendButton = screen.getAllByRole("button", { name: /Yuborish/ }).find((button) => !dialog.contains(button))!;
    expect(sendButton).toBeDisabled();
    expect(postSpy).toHaveBeenCalledTimes(1);
    resolvePost({ data: { data: { dispatched: 250, recipient_ids: [], channels: ["in_app"] } } });
    expect(await screen.findByText("Yuborildi: 250 ta qabul qiluvchi.")).toBeInTheDocument();
  });

  it("does not retry after a 504, warns that the outcome is unknown and blocks re-sending", async () => {
    const user = userEvent.setup();
    postSpy.mockRejectedValue(Object.assign(new Error("Gateway Timeout"), { isAxiosError: true, response: { status: 504, data: {} } }));
    renderForm();
    await chooseMode(user, "Hamma");
    await fillContent(user);
    const dialog = await submitAndConfirm(user);

    await user.click(within(dialog).getByRole("button", { name: /Ha, yuborish/ }));

    expect(await screen.findByText(/Xabar baribir yuborilgan bo'lishi mumkin/)).toBeInTheDocument();
    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /Yuborish/ })).toBeDisabled();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(postSpy).toHaveBeenCalledTimes(1);

    // "Yangi xabar" — yangi forma, yangi guruh kaliti.
    await user.click(screen.getByRole("button", { name: "Yangi xabar" }));
    expect(screen.getByRole("button", { name: /Yuborish/ })).not.toBeDisabled();
    expect(screen.getByLabelText("Sarlavha")).toHaveValue("");
  });
});
