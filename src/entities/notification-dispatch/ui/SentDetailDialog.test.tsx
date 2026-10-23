import { useState } from "react";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, type MockInstance } from "vitest";
import { api } from "../../../shared/api/api";
import i18n from "../../../i18n";
import { renderWithProviders } from "../../../test/test-utils";
import { SENT_DETAIL_LIVE_INTERVAL_MS } from "../api/useSentDetail";
import { SentDetailDialog } from "./SentDetailDialog";

const ID = "0b7f6f5e-3c1a-4c6e-9b1d-2f0a6c1e9d42";

const failure = (channel: string, status: string, reason: string | null) => ({ channel, status, reason });
const person = (index: number) => ({
  notification_id: String(900 + index),
  recipient_id: String(index),
  name: `Kuryer ${index}`,
  role: "courier",
  failures: [failure("telegram", index % 2 ? "failed" : "skipped", index % 2 ? "bot_blocked" : "no_telegram_id")],
});

const detail = (overrides: Record<string, unknown> = {}, page = 1) => ({
  statusCode: 200,
  data: {
    dispatch_id: ID,
    status: "partial",
    type: "system.manual",
    category: "branch",
    priority: "high",
    title: "Ertaga qabul punkti 10:00 dan ishlaydi",
    body: "9-oktabr kuni Toshkent HQ qabul punkti 10:00 dan 19:00 gacha ishlaydi.",
    link: null,
    channels: ["in_app", "realtime", "telegram", "sms"],
    recipients: 148,
    dispatched: 148,
    skipped_by_preference: 0,
    channel_status: {
      in_app: { sent: 148 },
      realtime: { emitted: 148 },
      telegram: { sent: 125, failed: 6, skipped: 17 },
      sms: { sent: 136, failed: 3, skipped: 9 },
    },
    audience: { roles: ["courier", "market"] },
    error: null,
    created_by: { id: "1", name: "Shodiyor Ergashev", role: "superadmin" },
    created_at: "2026-10-21T09:15:00.000Z",
    finished_at: "2026-10-21T09:15:04.000Z",
    undelivered: {
      items: Array.from({ length: 10 }, (_, index) => person((page - 1) * 10 + index + 1)),
      meta: { page, limit: 10, total: 33, totalPages: 4 },
    },
    ...overrides,
  },
});

let getSpy: MockInstance<typeof api.get>;
let respond: (params: Record<string, unknown>) => unknown;

beforeEach(() => {
  respond = (params) => detail({}, Number(params.page ?? 1));
  getSpy = vi.spyOn(api, "get").mockImplementation((async (
    url: string,
    config?: { params?: Record<string, unknown> },
  ) => {
    if (url !== `notifications/sent/${ID}`) throw new Error(`unexpected ${url}`);
    return { data: respond(config?.params ?? {}) };
  }) as never);
});

afterEach(() => {
  getSpy.mockRestore();
  vi.useRealTimers();
});

const renderDialog = (onClose = vi.fn()) => {
  renderWithProviders(<SentDetailDialog dispatchId={ID} onClose={onClose} />);
  return onClose;
};

describe("SentDetailDialog", () => {
  it("shows the message, author, result, channels and the first 10 undelivered; pages through the rest", async () => {
    const user = userEvent.setup();
    const onClose = renderDialog();
    const dialog = await screen.findByRole("dialog", { name: "Ertaga qabul punkti 10:00 dan ishlaydi" });

    expect(within(dialog).getByText(/Shodiyor Ergashev, Superadmin/)).toBeInTheDocument();
    expect(within(dialog).getByText("Qisman yuborildi")).toBeInTheDocument();
    expect(within(dialog).getByText("33 ta qabul qiluvchiga kamida bitta kanal yetmadi")).toBeInTheDocument();
    expect(within(dialog).getByText("Rol: Kuryer, Market")).toBeInTheDocument();
    expect(within(dialog).getByText("Filial · Yuqori")).toBeInTheDocument();
    expect(within(dialog).getByText("Yo'q")).toBeInTheDocument();
    expect(within(dialog).getByText(/9-oktabr kuni Toshkent HQ/)).toBeInTheDocument();
    expect(within(dialog).getByText("Holat jonli — Telegram va SMS yetkazilgach yangilanadi")).toBeInTheDocument();

    const telegram = dialog.querySelector('[data-channel="telegram"]') as HTMLElement;
    expect(within(telegram).getByText("Qisman")).toBeInTheDocument();
    expect(
      within(telegram).getByRole("img", { name: "Telegram: yuborildi 125, xato 6, o'tkazib yuborildi 17" }),
    ).toBeInTheDocument();

    const table = within(dialog).getByRole("table", { name: "Yetkazilmaganlar" });
    expect(within(table).getAllByRole("row")).toHaveLength(11);
    expect(within(table).getAllByText("Botni bloklagan").length).toBeGreaterThan(0);
    expect(within(table).getAllByText("Kuryer").length).toBe(10);
    expect(getSpy).toHaveBeenLastCalledWith(`notifications/sent/${ID}`, { params: { page: 1, limit: 10 } });

    await user.click(within(dialog).getByRole("button", { name: "2" }));
    await waitFor(() =>
      expect(getSpy).toHaveBeenLastCalledWith(`notifications/sent/${ID}`, { params: { page: 2, limit: 10 } }),
    );
    expect(await within(dialog).findByText("Kuryer 11")).toBeInTheDocument();

    await user.click(within(dialog).getAllByRole("button", { name: "Yopish" }).at(-1)!);
    expect(onClose).toHaveBeenCalled();
  });

  it("running: no finish time, live numbers — refetches until the dispatch is done", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let calls = 0;
    respond = () => {
      calls += 1;
      return calls === 1
        ? detail({
            status: "running",
            finished_at: null,
            dispatched: 0,
            channels: ["in_app", "telegram"],
            channel_status: { in_app: { sent: 486 }, telegram: { sent: 212, queued: 241, skipped: 33 } },
          })
        : detail({ status: "sent", channels: ["in_app", "telegram"], channel_status: { telegram: { sent: 453, skipped: 33 } } });
    };
    renderDialog();
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("Yuborish hali tugamagan — raqamlar o'zgarib turadi")).toBeInTheDocument();
    expect(within(dialog).getByText("Hali tugamagan")).toBeInTheDocument();
    expect(within(dialog).queryByRole("table")).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SENT_DETAIL_LIVE_INTERVAL_MS + 100);
    });
    await waitFor(() => expect(calls).toBe(2));
    expect(await within(dialog).findByText("Yuborildi", { selector: "span" })).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SENT_DETAIL_LIVE_INTERVAL_MS * 2);
    });
    // Tugagan — boshqa so'ralmaydi.
    expect(calls).toBe(2);
  });

  it("failed: a clear message, the technical `error` is never shown", async () => {
    respond = () =>
      detail({
        status: "failed",
        dispatched: 0,
        error: "QueryFailedError: deadlock detected",
        finished_at: "2026-10-16T05:05:00.000Z",
        title: "Kuryerlar yig'ilishi soat 9:00 da",
      });
    renderDialog();
    const dialog = await screen.findByRole("dialog", { name: "Kuryerlar yig'ilishi soat 9:00 da" });
    expect(within(dialog).getByText("Xabar hech kimga yuborilmadi")).toBeInTheDocument();
    expect(within(dialog).getByText("Yuborish xato bilan tugadi")).toBeInTheDocument();
    expect(within(dialog).getByText(/Tizimda nosozlik bo'ldi/)).toBeInTheDocument();
    expect(screen.queryByText(/QueryFailedError/)).not.toBeInTheDocument();
    // Yuborish sahifasining o'zida (resendHref yo'q) «Qayta yuborish» chiqmaydi.
    expect(within(dialog).queryByRole("link", { name: "Qayta yuborish" })).not.toBeInTheDocument();
  });

  it("failed + resendHref (NS-2 «Yuborilganlar»): «Qayta yuborish» opens the send page and closes the dialog", async () => {
    respond = () => detail({ status: "failed", dispatched: 0, title: "Kuryerlar yig'ilishi soat 9:00 da" });
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<SentDetailDialog dispatchId={ID} onClose={onClose} resendHref="/notifications/send" />);
    const dialog = await screen.findByRole("dialog", { name: "Kuryerlar yig'ilishi soat 9:00 da" });
    const resend = within(dialog).getByRole("link", { name: "Qayta yuborish" });
    expect(resend).toHaveAttribute("href", "/notifications/send");
    await user.click(resend);
    expect(onClose).toHaveBeenCalled();
  });

  it("resendHref is ignored unless the dispatch failed", async () => {
    renderWithProviders(<SentDetailDialog dispatchId={ID} onClose={vi.fn()} resendHref="/notifications/send" />);
    const dialog = await screen.findByRole("dialog", { name: "Ertaga qabul punkti 10:00 dan ishlaydi" });
    expect(within(dialog).queryByRole("link", { name: "Qayta yuborish" })).not.toBeInTheDocument();
  });

  it("404 — «Xabar topilmadi»", async () => {
    respond = () => {
      throw Object.assign(new Error("nf"), { isAxiosError: true, response: { status: 404, data: { message: "Dispatch topilmadi" } } });
    };
    renderDialog();
    const dialog = await screen.findByRole("dialog", { name: "Yuborilgan xabar" });
    expect(await within(dialog).findByText("Xabar topilmadi")).toBeInTheDocument();
    expect(within(dialog).getByText(/havola eskirgan bo'lishi mumkin/)).toBeInTheDocument();
    expect(screen.queryByText("Dispatch topilmadi")).not.toBeInTheDocument();
  });

  it("server error — friendly text and «Qayta urinish»", async () => {
    const user = userEvent.setup();
    let fail = true;
    respond = () => {
      if (fail) throw Object.assign(new Error("boom"), { isAxiosError: true, response: { status: 500, data: { message: "boom" } } });
      return detail();
    };
    renderDialog();
    const dialog = await screen.findByRole("dialog", { name: "Yuborilgan xabar" });
    expect(await within(dialog).findByText("Tafsilotni yuklab bo'lmadi")).toBeInTheDocument();
    expect(within(dialog).queryByText("boom")).not.toBeInTheDocument();
    fail = false;
    await user.click(within(dialog).getByRole("button", { name: /Qayta urinish/ }));
    expect(await screen.findByRole("dialog", { name: "Ertaga qabul punkti 10:00 dan ishlaydi" })).toBeInTheDocument();
  });
  it("404 opened from the unknown-result card — points to «Qayta urinish», not to a list", async () => {
    respond = () => {
      throw Object.assign(new Error("nf"), { isAxiosError: true, response: { status: 404, data: { message: "Dispatch topilmadi" } } });
    };
    renderWithProviders(<SentDetailDialog dispatchId={ID} source="unknown" onClose={vi.fn()} />);
    const dialog = await screen.findByRole("dialog", { name: "Yuborilgan xabar" });
    expect(await within(dialog).findByText("Xabar topilmadi")).toBeInTheDocument();
    expect(within(dialog).getByText(/serverga yetmagan.*«Qayta urinish»/)).toBeInTheDocument();
    expect(within(dialog).queryByText(/havola eskirgan/)).not.toBeInTheDocument();
  });

  it("reopening the same message starts again on page 1", async () => {
    const user = userEvent.setup();
    const Harness = () => {
      const [id, setId] = useState<string | null>(ID);
      return (
        <>
          <button type="button" onClick={() => setId(ID)}>
            open
          </button>
          <SentDetailDialog dispatchId={id} onClose={() => setId(null)} />
        </>
      );
    };
    renderWithProviders(<Harness />);
    let dialog = await screen.findByRole("dialog", { name: "Ertaga qabul punkti 10:00 dan ishlaydi" });
    await user.click(within(dialog).getByRole("button", { name: "2" }));
    expect(await within(dialog).findByText("Kuryer 11")).toBeInTheDocument();

    await user.click(within(dialog).getAllByRole("button", { name: "Yopish" }).at(-1)!);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "open" }));
    dialog = await screen.findByRole("dialog", { name: "Ertaga qabul punkti 10:00 dan ishlaydi" });
    expect(await within(dialog).findByText("Kuryer 1")).toBeInTheDocument();
    expect(within(dialog).queryByText("Kuryer 11")).not.toBeInTheDocument();
  });

  it("an email failure and a code-less not_eligible get readable labels (no raw i18n keys)", async () => {
    respond = () =>
      detail({
        undelivered: {
          items: [
            {
              notification_id: "990",
              recipient_id: "77",
              name: "Aziza",
              role: "courier",
              failures: [failure("email", "failed", null), failure("push", "not_eligible", null)],
            },
          ],
          meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
        },
      });
    renderDialog();
    const dialog = await screen.findByRole("dialog", { name: "Ertaga qabul punkti 10:00 dan ishlaydi" });
    const table = await within(dialog).findByRole("table", { name: "Yetkazilmaganlar" });
    expect(within(table).getByText("Email")).toBeInTheDocument();
    expect(within(table).getByText("Kanal ulanmagan")).toBeInTheDocument();
    expect(dialog).not.toHaveTextContent(/dispatch\.channel\./);
  });

  it("English: one recipient is singular", async () => {
    await i18n.changeLanguage("en");
    try {
      respond = () =>
        detail({
          channels: ["in_app", "telegram"],
          dispatched: 1,
          channel_status: { in_app: { sent: 1 }, telegram: { failed: 1 } },
          undelivered: { items: [person(1)], meta: { page: 1, limit: 10, total: 1, totalPages: 1 } },
        });
      renderDialog();
      const dialog = await screen.findByRole("dialog", { name: "Ertaga qabul punkti 10:00 dan ishlaydi" });
      expect(await within(dialog).findByText("1 recipient missed at least one channel")).toBeInTheDocument();
      expect(within(dialog.querySelector('[data-channel="telegram"]') as HTMLElement).getByText("1 recipient")).toBeInTheDocument();
    } finally {
      await i18n.changeLanguage("uz");
    }
  });
});
