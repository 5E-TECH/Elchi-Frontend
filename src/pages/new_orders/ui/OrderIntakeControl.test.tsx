import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import NewOrdersHeader from "./NewOrdersHeader";

/**
 * «Qabul va yaratish» sarlavhasi — BUGUNGI QABUL VAQTI (2026-11-08): FAQAT superadmin vaqtni qo'yadi / olib
 * tashlaydi (2026-11-09), boshqa rollar (admin ham) holatni ko'radi. Backend endpointi yo'q (404) — hech narsa
 * ko'rinmaydi.
 */
const mocks = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }));
vi.mock("../../../shared/api/api", () => ({ api: { get: mocks.get, patch: mocks.patch } }));

const intake = (cutoff: string | null, extra: Record<string, unknown> = {}) => ({
  data: {
    statusCode: 200,
    data: {
      cutoff_time: cutoff,
      is_open: true,
      closes_at: cutoff ? "2099-01-01T05:00:00.000Z" : null,
      reopens_at: cutoff ? "2099-01-01T19:00:00.000Z" : null,
      ...extra,
    },
  },
});
const notFound = () =>
  Object.assign(new Error("Not Found"), { response: { status: 404, data: {} } });

const renderHeader = (role: string) =>
  renderWithProviders(<NewOrdersHeader />, {
    route: "/new-orders",
    preloadedState: { role: { id: "1", role, region: null, name: role } } as never,
  });

beforeEach(() => {
  mocks.get.mockReset();
  mocks.patch.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("Bugungi qabul vaqti — sarlavha", () => {
  it("⭐ backend endpointi yo'q (404) — boshqaruv ham, belgi ham yo'q; «Buyurtma yaratish» avvalgidek", async () => {
    mocks.get.mockRejectedValue(notFound());
    renderHeader("superadmin");

    expect(await screen.findByRole("link", { name: /Buyurtma yaratish/ })).toBeInTheDocument();
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith("orders/intake-settings"));
    expect(screen.queryByTestId("order-intake-control")).toBeNull();
    expect(screen.queryByText(/Bugungi qabul/)).toBeNull();
  });

  it('⭐ superadmin: «cheklovsiz» → oyna → «1000» → «10:00» → Saqlash → `PATCH { cutoff_time: "10:00" }`, yorliq yangilanadi', async () => {
    const user = userEvent.setup();
    mocks.get.mockResolvedValue(intake(null));
    mocks.patch.mockResolvedValue(intake("10:00"));
    renderHeader("superadmin");

    await user.click(await screen.findByRole("button", { name: /Bugungi qabul: cheklovsiz/ }));
    const dialog = await screen.findByRole("dialog", { name: "Bugungi qabul vaqti" });
    expect(dialog).toHaveTextContent(
      "barcha rollar uchun: qo'lda, AI bilan va integratsiyalar orqali",
    );
    const field = within(dialog).getByRole("textbox", { name: /Qabul tugaydigan vaqt/ });
    await user.type(field, "1000");
    expect(field).toHaveValue("10:00");
    // Cheklov yo'q — «Cheklovni olib tashlash» ham yo'q.
    expect(within(dialog).queryByRole("button", { name: "Cheklovni olib tashlash" })).toBeNull();
    await user.click(within(dialog).getByRole("button", { name: "Saqlash" }));

    await waitFor(() =>
      expect(mocks.patch).toHaveBeenCalledWith("orders/intake-settings", { cutoff_time: "10:00" }),
    );
    expect(await screen.findByText("Bugungi qabul 10:00 gacha")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("button", { name: /Bugungi qabul: 10:00 gacha/ })).toBeInTheDocument();
  });

  it("noto'g'ri vaqt — maydon ostida xato, so'rov ketmaydi", async () => {
    const user = userEvent.setup();
    mocks.get.mockResolvedValue(intake(null));
    renderHeader("superadmin");

    await user.click(await screen.findByRole("button", { name: /Bugungi qabul: cheklovsiz/ }));
    const dialog = await screen.findByRole("dialog", { name: "Bugungi qabul vaqti" });
    await user.type(within(dialog).getByRole("textbox", { name: /Qabul tugaydigan vaqt/ }), "99");
    await user.click(within(dialog).getByRole("button", { name: "Saqlash" }));

    expect(
      await within(dialog).findByText("Vaqtni 00:00–23:59 ko'rinishida kiriting"),
    ).toBeInTheDocument();
    expect(mocks.patch).not.toHaveBeenCalled();
  });

  it("cheklov bor — «Cheklovni olib tashlash» → `PATCH { cutoff_time: null }`", async () => {
    const user = userEvent.setup();
    mocks.get.mockResolvedValue(intake("10:00"));
    mocks.patch.mockResolvedValue(intake(null));
    renderHeader("superadmin");

    await user.click(await screen.findByRole("button", { name: /Bugungi qabul: 10:00 gacha/ }));
    const dialog = await screen.findByRole("dialog", { name: "Bugungi qabul vaqti" });
    expect(within(dialog).getByRole("textbox", { name: /Qabul tugaydigan vaqt/ })).toHaveValue(
      "10:00",
    );
    await user.click(within(dialog).getByRole("button", { name: "Cheklovni olib tashlash" }));

    await waitFor(() =>
      expect(mocks.patch).toHaveBeenCalledWith("orders/intake-settings", { cutoff_time: null }),
    );
    expect(await screen.findByText("Bugungi qabul cheklovi olib tashlandi")).toBeInTheDocument();
  });

  it("market: cheklov bor — faqat holat belgisi («… gacha» / «yopildi»), tugma yo'q; cheklovsiz — hech narsa", async () => {
    mocks.get.mockResolvedValue(intake("10:00"));
    const first = renderHeader("market");
    expect(await screen.findByTestId("order-intake-status")).toHaveTextContent(
      "Bugungi qabul: 10:00 gacha",
    );
    expect(screen.queryByTestId("order-intake-control")).toBeNull();
    first.unmount();

    mocks.get.mockResolvedValue(intake("10:00", { is_open: false }));
    const second = renderHeader("market");
    expect(await screen.findByTestId("order-intake-status")).toHaveTextContent(
      "Bugungi qabul yopildi",
    );
    second.unmount();

    mocks.get.mockResolvedValue(intake(null));
    renderHeader("manager");
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(3));
    expect(screen.queryByTestId("order-intake-status")).toBeNull();
  });

  it("⭐ admin (2026-11-09): o'zgartira olmaydi — tugma yo'q, faqat holat belgisi; cheklovsiz — hech narsa", async () => {
    mocks.get.mockResolvedValue(intake("10:00"));
    const first = renderHeader("admin");
    expect(await screen.findByTestId("order-intake-status")).toHaveTextContent(
      "Bugungi qabul: 10:00 gacha",
    );
    expect(screen.queryByTestId("order-intake-control")).toBeNull();
    expect(screen.queryByRole("button", { name: /Bugungi qabul/ })).toBeNull();
    first.unmount();

    mocks.get.mockResolvedValue(intake(null));
    renderHeader("admin");
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId("order-intake-control")).toBeNull();
    expect(screen.queryByTestId("order-intake-status")).toBeNull();
    expect(mocks.patch).not.toHaveBeenCalled();
  });
});

/**
 * Kun almashish soati (Trello #756, 2026-11-09): o'sha oyna ichida ikkinchi qadam — faqat superadmin.
 * `PATCH { day_change_time }`; 400 — maydon xatosi, 403 — «Faqat superadmin …».
 */
describe("Kun almashish soati — oyna ichida", () => {
  const openDialog = async (
    user: ReturnType<typeof userEvent.setup>,
    label: RegExp = /Bugungi qabul: cheklovsiz/,
  ) => {
    await user.click(await screen.findByRole("button", { name: label }));
    return screen.findByRole("dialog", { name: "Bugungi qabul vaqti" });
  };

  it('⭐ superadmin: qator «00:00 (Toshkent)» → «O\'zgartirish» → «1800» → `PATCH { day_change_time: "18:00" }` → asosiy qadamda yangi soat', async () => {
    const user = userEvent.setup();
    mocks.get.mockResolvedValue(intake(null, { day_change_time: "00:00" }));
    mocks.patch.mockResolvedValue(intake(null, { day_change_time: "18:00" }));
    renderHeader("superadmin");
    const dialog = await openDialog(user);

    expect(within(dialog).getByTestId("day-change-row")).toHaveTextContent(
      "Kun almashish soati: 00:00 (Toshkent)",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Kun almashish soatini o'zgartirish" }),
    );

    // O'sha oyna — ikkinchi qadam (ichma-ich oyna yo'q); fokus soat maydonida.
    const step = await screen.findByRole("dialog", { name: "Kun almashish soati" });
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    const field = within(step).getByRole("textbox", { name: /Kun almashish soati/ });
    await waitFor(() => expect(field).toHaveFocus());
    expect(step).toHaveTextContent(
      "Ish kuni shu soatdan keyingi kun shu soatgacha. Faqat buyurtma qabuliga ta'sir qiladi, hisobotlar 00:00 bo'yicha.",
    );
    // Bugungi cheklov yo'q — ogohlantirish ham yo'q.
    expect(within(step).queryByRole("note")).toBeNull();
    await user.clear(field);
    await user.type(field, "1800");
    expect(field).toHaveValue("18:00");
    await user.click(within(step).getByRole("button", { name: "Saqlash" }));

    await waitFor(() =>
      expect(mocks.patch).toHaveBeenCalledWith("orders/intake-settings", {
        day_change_time: "18:00",
      }),
    );
    // Xabar (toast) va asosiy qadamdagi qator — ikkalasida yangi soat.
    await waitFor(() =>
      expect(screen.getAllByText("Kun almashish soati: 18:00 (Toshkent)")).toHaveLength(2),
    );
    const main = await screen.findByRole("dialog", { name: "Bugungi qabul vaqti" });
    expect(within(main).getByTestId("day-change-row")).toHaveTextContent(
      "Kun almashish soati: 18:00 (Toshkent)",
    );
    expect(mocks.patch).toHaveBeenCalledTimes(1);
  });

  it("noto'g'ri qiymat — maydon xatosi, so'rov ketmaydi; «Orqaga» — asosiy qadam", async () => {
    const user = userEvent.setup();
    mocks.get.mockResolvedValue(intake(null, { day_change_time: "00:00" }));
    renderHeader("superadmin");
    const dialog = await openDialog(user);
    await user.click(
      within(dialog).getByRole("button", { name: "Kun almashish soatini o'zgartirish" }),
    );
    const step = await screen.findByRole("dialog", { name: "Kun almashish soati" });
    const field = within(step).getByRole("textbox", { name: /Kun almashish soati/ });
    await user.clear(field);
    await user.type(field, "29");
    await user.click(within(step).getByRole("button", { name: "Saqlash" }));

    expect(
      await within(step).findByText("Vaqtni 00:00–23:59 ko'rinishida kiriting"),
    ).toBeInTheDocument();
    expect(mocks.patch).not.toHaveBeenCalled();
    await user.click(within(step).getByRole("button", { name: "Orqaga" }));
    expect(await screen.findByRole("dialog", { name: "Bugungi qabul vaqti" })).toBeInTheDocument();
  });

  it("bugungi qabul vaqti qo'yilgan — ogohlantirish «Soat o'zgarsa …»; 400 — maydon xatosi; 403 — «Faqat superadmin …»", async () => {
    const user = userEvent.setup();
    mocks.get.mockResolvedValue(intake("10:00", { day_change_time: "00:00" }));
    mocks.patch
      .mockRejectedValueOnce(
        Object.assign(new Error("Bad Request"), { response: { status: 400, data: {} } }),
      )
      .mockRejectedValueOnce(
        Object.assign(new Error("Forbidden"), { response: { status: 403, data: {} } }),
      );
    renderHeader("superadmin");
    const dialog = await openDialog(user, /Bugungi qabul: 10:00 gacha/);
    await user.click(
      within(dialog).getByRole("button", { name: "Kun almashish soatini o'zgartirish" }),
    );
    const step = await screen.findByRole("dialog", { name: "Kun almashish soati" });
    expect(within(step).getByRole("note")).toHaveTextContent(
      "Soat o'zgarsa, bugungi qabul vaqti yangi kunga o'tmasligi mumkin.",
    );
    const field = within(step).getByRole("textbox", { name: /Kun almashish soati/ });
    await user.clear(field);
    await user.type(field, "0500");

    await user.click(within(step).getByRole("button", { name: "Saqlash" }));
    expect(
      await within(step).findByText("Vaqtni 00:00–23:59 ko'rinishida kiriting"),
    ).toBeInTheDocument();
    await user.click(within(step).getByRole("button", { name: "Saqlash" }));
    expect(await screen.findByText("Faqat superadmin o'zgartira oladi")).toBeInTheDocument();
    // Xatoda ikkinchi qadamda qoladi.
    expect(screen.getByRole("dialog", { name: "Kun almashish soati" })).toBeInTheDocument();
  });

  it("⭐ `passed` tuzatishi: kun 18:00 da almashadi, hozir 20:00 (Toshkent) — «10:00» uchun «o'tib ketgan» CHIQMAYDI", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date("2026-11-09T15:00:00.000Z") });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mocks.get.mockResolvedValue(
      intake(null, {
        day_change_time: "18:00",
        day_started_at: "2026-11-09T13:00:00.000Z",
        next_day_change_at: "2026-11-10T13:00:00.000Z",
      }),
    );
    renderHeader("superadmin");
    const dialog = await openDialog(user);
    const field = within(dialog).getByRole("textbox", { name: /Qabul tugaydigan vaqt/ });

    await user.type(field, "1000");
    expect(field).toHaveAccessibleDescription(/Faqat bugun uchun/);
    expect(within(dialog).queryByText(/o'tib ketgan/)).toBeNull();

    // Ish kuni ichida o'tgan soat (19:00) — ogohlantirish chiqadi.
    await user.clear(field);
    await user.type(field, "1900");
    expect(
      within(dialog).getByText("Bu vaqt o'tib ketgan — saqlansa, qabul darhol yopiladi."),
    ).toBeInTheDocument();
  });

  it("admin — oyna ham, kun almashish qatori ham yo'q", async () => {
    mocks.get.mockResolvedValue(intake("10:00", { day_change_time: "18:00" }));
    renderHeader("admin");
    expect(await screen.findByTestId("order-intake-status")).toBeInTheDocument();
    expect(screen.queryByTestId("order-intake-control")).toBeNull();
    expect(screen.queryByTestId("day-change-row")).toBeNull();
    expect(screen.queryByText(/Kun almashish soati/)).toBeNull();
  });
});
