import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NotificationTable from "./NotificationTable";
import { renderWithProviders } from "../../../test/test-utils";

/** «Ulangan guruhlar» (maket `superadmin-notifications-telegram-groups`) + holat ustuni (9HIaV80X). */

const mocks = vi.hoisted(() => ({ get: vi.fn(), del: vi.fn() }));

vi.mock("../../../shared/api/api", () => ({ api: { get: mocks.get, delete: mocks.del } }));

const ROWS = [
  {
    id: "90",
    createdAt: "2026-10-06T07:34:00.000Z",
    market_id: "12",
    group_id: "-1002184736577",
    group_type: "cancel",
    bot_slug: null,
    is_active: true,
  },
  {
    id: "91",
    createdAt: "2026-10-05T07:30:00.000Z",
    market_id: "27",
    group_id: "-1001937420815",
    group_type: "create",
    bot_slug: null,
    is_active: false,
  },
];

const respond = (items: unknown[]) => {
  mocks.get.mockImplementation((url: string) =>
    Promise.resolve({
      data:
        url === "markets"
          ? { data: [{ id: "12", name: "Baraka Shop" }, { id: "27", name: "Nur Elektronika" }] }
          : { statusCode: 200, data: { items, pagination: { total: items.length, page: 1, limit: 10 } } },
    }),
  );
};

describe("NotificationTable", () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.del.mockReset();
    mocks.del.mockResolvedValue({ data: {} });
    respond(ROWS);
  });

  it("guruhlar: market nomi, guruh ID, xabar turi va holat (Faol / Nofaol + izoh)", async () => {
    renderWithProviders(<NotificationTable onEdit={vi.fn()} />);

    const table = await screen.findByRole("table", { name: "Ulangan Telegram guruhlari" });
    const [, active, inactive] = within(table).getAllByRole("row");

    expect(await within(active).findByText("Baraka Shop")).toBeInTheDocument();
    expect(within(active).getByText("#12")).toBeInTheDocument();
    expect(within(active).getByText("-1002184736577")).toBeInTheDocument();
    expect(within(active).getByText("Bekor qilingan buyurtma")).toBeInTheDocument();
    expect(within(active).getByText("Faol")).toBeInTheDocument();
    expect(within(active).queryByText("Bot guruhdan chiqarilgan — qayta ulang")).not.toBeInTheDocument();

    expect(within(inactive).getByText("Yangi buyurtma")).toBeInTheDocument();
    expect(within(inactive).getByText("Nofaol")).toBeInTheDocument();
    expect(within(inactive).getByText("Bot guruhdan chiqarilgan — qayta ulang")).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "Ulangan guruhlar" })).toBeInTheDocument();
    expect(screen.getByText("1–2 / 2 ta guruh")).toBeInTheDocument();
  });

  it("«Tahrirlash» qatorni qaytaradi", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    renderWithProviders(<NotificationTable onEdit={onEdit} />);

    await user.click(await screen.findByRole("button", { name: "Baraka Shop — bekor qilingan guruhi: tahrirlash" }));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: "90", market_id: "12", is_active: true }));
  });

  it("o'chirish avval tasdiq so'raydi; «Bekor qilish» — so'rov ketmaydi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotificationTable onEdit={vi.fn()} />);

    await user.click(await screen.findByRole("button", { name: "Baraka Shop — bekor qilingan guruhi: o'chirish" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Haqiqatan ham o'chirmoqchimisiz?" });
    expect(dialog).toHaveTextContent(
      "Baraka Shop'ning bekor qilingan buyurtmalari haqidagi xabarlar bu guruhga endi yuborilmaydi. Guruhni keyin qayta ulash mumkin.",
    );
    expect(dialog).toHaveTextContent("Guruh ID: -1002184736577");

    await user.click(within(dialog).getByRole("button", { name: "Bekor qilish" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(mocks.del).not.toHaveBeenCalled();
  });

  it("tasdiqlangach guruh o'chiriladi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotificationTable onEdit={vi.fn()} />);

    await user.click(await screen.findByRole("button", { name: "Nur Elektronika — yangi buyurtma guruhi: o'chirish" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Haqiqatan ham o'chirmoqchimisiz?" });
    await user.click(within(dialog).getByRole("button", { name: "O'chirish" }));

    await waitFor(() => expect(mocks.del).toHaveBeenCalledWith("notifications/91"));
    expect(await screen.findByText("Bildirishnoma o'chirildi")).toBeInTheDocument();
  });

  it("bo'sh ro'yxat — «Hali guruh ulanmagan»", async () => {
    respond([]);
    renderWithProviders(<NotificationTable onEdit={vi.fn()} />);

    expect(await screen.findByText("Hali guruh ulanmagan")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
