import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { vi, type MockInstance } from "vitest";
import { api } from "../../shared/api/api";
import { renderWithProviders } from "../../test/test-utils";
import NotificationSentPage from "./index";

const httpError = (status: number, message: string) =>
  Object.assign(new Error(message), { isAxiosError: true, response: { status, data: { message } } });

const item = (index: number, overrides: Record<string, unknown> = {}) => ({
  dispatch_id: `d-${index}`,
  status: "sent",
  type: "system.manual",
  title: `Xabar ${index}`,
  body_preview: `Matn ${index}`,
  channels: ["in_app", "realtime", "telegram"],
  recipients: 10,
  dispatched: 10,
  skipped_by_preference: 0,
  by_channel: {},
  channel_status: null,
  no_provider: [],
  message: "Notification dispatched",
  created_by: { id: "1", name: "Shodiyor Ergashev", role: "superadmin" },
  created_at: "2026-10-16T05:05:00.000Z",
  finished_at: "2026-10-16T05:05:02.000Z",
  ...overrides,
});

const ROWS = [
  item(1, {
    status: "partial",
    title: "Ertaga qabul punkti 10:00 dan ishlaydi",
    channels: ["in_app", "realtime", "telegram", "sms"],
    dispatched: 148,
    channel_status: { telegram: { queued: 131, skipped: 17 }, sms: { queued: 139, skipped: 9 } },
    message: "Partially dispatched",
  }),
  item(2, {
    status: "failed",
    title: "Kuryerlar yig'ilishi soat 9:00 da",
    dispatched: 0,
    recipients: 0,
    message: "connect ECONNREFUSED",
    created_by: { id: "7", name: "Nilufar Rashidova", role: "admin" },
  }),
  ...Array.from({ length: 10 }, (_, index) => item(3 + index)),
];

let listCalls: Array<Record<string, unknown>>;
let listResponse: (params: Record<string, unknown>) => unknown;
let getSpy: MockInstance<typeof api.get>;

const pageOf = (rows: unknown[], params: Record<string, unknown>) => {
  const page = Number(params.page ?? 1);
  const limit = Number(params.limit ?? 20);
  return {
    statusCode: 200,
    data: {
      items: rows.slice((page - 1) * limit, page * limit),
      meta: { page, limit, total: rows.length, totalPages: Math.max(1, Math.ceil(rows.length / limit)) },
    },
  };
};

beforeEach(() => {
  listCalls = [];
  listResponse = (params) => {
    const rows = ROWS.filter(
      (row) =>
        (!params.status || row.status === params.status) &&
        (!params.created_by || (row.created_by as { id: string }).id === params.created_by),
    );
    return pageOf(rows, params);
  };
  getSpy = vi.spyOn(api, "get").mockImplementation((async (url: string, config?: { params?: Record<string, unknown> }) => {
    const params = config?.params ?? {};
    if (url === "notifications/sent") {
      listCalls.push(params);
      return { data: listResponse(params) };
    }
    if (url.startsWith("notifications/sent/")) {
      const id = decodeURIComponent(url.slice("notifications/sent/".length));
      const row = ROWS.find((candidate) => candidate.dispatch_id === id);
      if (!row) throw httpError(404, "Dispatch topilmadi");
      return {
        data: {
          data: {
            ...row,
            body: row.body_preview,
            audience: { broadcast: true },
            undelivered: { items: [], meta: { page: 1, limit: 10, total: 0 } },
          },
        },
      };
    }
    if (url === "users") {
      const users =
        params.role === "superadmin"
          ? [{ id: "1", name: "Shodiyor Ergashev", role: "superadmin" }]
          : params.role === "admin"
            ? [{ id: "7", name: "Nilufar Rashidova", role: "admin" }]
            : [];
      return { data: { data: { items: users, meta: { total: users.length } } } };
    }
    throw new Error(`unexpected ${url}`);
  }) as never);
});

afterEach(() => getSpy.mockRestore());

const Location = () => {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.search}</output>;
};

const renderPage = (route = "/notifications/sent") =>
  renderWithProviders(
    <>
      <NotificationSentPage />
      <Location />
    </>,
    { route },
  );

const search = () => new URLSearchParams(screen.getByTestId("location").textContent?.split("?")[1] ?? "");

describe("NotificationSentPage («Yuborilganlar», NS-2)", () => {
  it("header, list with result notes, no raw backend text", async () => {
    renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Yuborilganlar" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Bildirishnomalar" })).toHaveAttribute("href", "/inbox");
    expect(screen.getByRole("link", { name: "Xabar yuborish" })).toHaveAttribute("href", "/notifications/send");

    const table = await screen.findByRole("table", { name: "Yuborilgan xabarlar" });
    expect(within(table).getAllByRole("row")).toHaveLength(11);
    expect(screen.getByText("12 ta")).toBeInTheDocument();
    expect(screen.getByText("1–10 / 12 ta xabar")).toBeInTheDocument();
    expect(listCalls[0]).toEqual({ page: 1, limit: 10 });

    const partial = within(table).getByRole("row", { name: /Ertaga qabul punkti/ });
    expect(within(partial).getByText("Qisman yuborildi")).toBeInTheDocument();
    expect(within(partial).getByText("O'tkazib yuborildi: Telegram 17, SMS 9")).toBeInTheDocument();
    expect(within(partial).getByText("148 ta qabul qiluvchi")).toBeInTheDocument();
    expect(within(partial).getByText("Darhol")).toBeInTheDocument();
    // Auditoriya ro'yxat javobida yo'q — «—».
    expect(within(partial).getByText("—")).toBeInTheDocument();

    const failed = within(table).getByRole("row", { name: /Kuryerlar yig'ilishi/ });
    expect(within(failed).getByText("Hech kimga ketmadi — qayta yuboring")).toBeInTheDocument();
    expect(within(failed).getByText("Qabul qiluvchi yo'q")).toBeInTheDocument();
    expect(within(failed).getByText("Admin")).toBeInTheDocument();
    expect(screen.queryByText(/ECONNREFUSED|dispatched/)).not.toBeInTheDocument();
  });

  it("filters and the page live in the URL; a filter change goes back to page 1", async () => {
    const user = userEvent.setup();
    renderPage("/notifications/sent?page=2");
    await screen.findByText("11–12 / 12 ta xabar");
    expect(listCalls.at(-1)).toEqual({ page: 2, limit: 10 });

    await user.click(screen.getByRole("combobox", { name: "Natija" }));
    await user.click(await screen.findByRole("option", { name: "Xato" }));
    await waitFor(() => expect(listCalls.at(-1)).toEqual({ page: 1, limit: 10, status: "failed" }));
    expect(search().get("status")).toBe("failed");
    expect(search().has("page")).toBe(false);

    await user.click(screen.getByRole("combobox", { name: "Kim yubordi" }));
    await user.click(await screen.findByRole("option", { name: /Shodiyor Ergashev/ }));
    await waitFor(() => expect(listCalls.at(-1)).toEqual({ page: 1, limit: 10, status: "failed", created_by: "1" }));
    expect(await screen.findByText("Bu natija bo'yicha xabar yo'q")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Filtrni tozalash" }));
    await waitFor(() => expect(listCalls.at(-1)).toEqual({ page: 1, limit: 10 }));
    expect(search().toString()).toBe("");
  });

  it("a row opens the detail dialog, kept in the URL (?id=); closing removes it", async () => {
    const user = userEvent.setup();
    renderPage();
    const table = await screen.findByRole("table", { name: "Yuborilgan xabarlar" });
    await user.click(within(table).getByRole("button", { name: "Kuryerlar yig'ilishi soat 9:00 da" }));
    const dialog = await screen.findByRole("dialog", { name: "Kuryerlar yig'ilishi soat 9:00 da" });
    expect(search().get("id")).toBe("d-2");
    expect(await within(dialog).findByText("Yuborish xato bilan tugadi")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "Qayta yuborish" })).toHaveAttribute("href", "/notifications/send");
    await user.click(within(dialog).getAllByRole("button", { name: "Yopish" }).at(-1)!);
    await waitFor(() => expect(search().has("id")).toBe(false));
  });

  it("a stale link (?id=unknown) — «Xabar topilmadi»", async () => {
    renderPage("/notifications/sent?id=gone");
    const dialog = await screen.findByRole("dialog", { name: "Yuborilgan xabar" });
    expect(await within(dialog).findByText("Xabar topilmadi")).toBeInTheDocument();
  });

  it("nothing sent yet — empty state without filters", async () => {
    listResponse = (params) => pageOf([], params);
    renderPage();
    expect(await screen.findByText("Hali xabar yuborilmagan")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Natija" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Filtrni tozalash" })).not.toBeInTheDocument();
  });

  it("error — friendly text, filters disabled, «Qayta urinish» reloads", async () => {
    const user = userEvent.setup();
    let fail = true;
    listResponse = (params) => {
      if (fail) throw httpError(500, 'relation "notification_dispatches" does not exist');
      return pageOf(ROWS, params);
    };
    renderPage();
    expect(await screen.findByText("Yuborilganlar ro'yxatini olib bo'lmadi")).toBeInTheDocument();
    expect(screen.queryByText(/notification_dispatches/)).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Natija" })).toBeDisabled();
    fail = false;
    await user.click(screen.getByRole("button", { name: "Qayta urinish" }));
    expect(await screen.findByRole("table", { name: "Yuborilgan xabarlar" })).toBeInTheDocument();
  });

  it("an out-of-range page jumps to the last page", async () => {
    renderPage("/notifications/sent?page=9");
    await waitFor(() => expect(search().get("page")).toBe("2"));
    expect(await screen.findByText("11–12 / 12 ta xabar")).toBeInTheDocument();
  });
});
